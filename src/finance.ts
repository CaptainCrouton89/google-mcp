import axios from "axios";
import { z } from "zod";

const SERPAPI_BASE_URL = "https://serpapi.com/search";

// Markdown formatting helpers
function formatFinanceToMarkdown(data: any, params: z.infer<typeof financeSearchSchema>): string {
  if (!data) return "No financial data available.";

  let markdown = `# ${params.q}\n\n`;

  // Main stock/security info
  if (data.summary) {
    const summary = data.summary;
    markdown += `Current Price: ${summary.currency || '$'}${summary.price}  \n`;
    
    if (summary.price_movement) {
      const movement = summary.price_movement;
      const arrow = movement.movement === 'up' ? '📈' : movement.movement === 'down' ? '📉' : '➡️';
      markdown += `Change: ${arrow} ${movement.percentage}% (${movement.value >= 0 ? '+' : ''}${movement.value})  \n`;
    }
    
    if (summary.name && summary.name !== summary.symbol) {
      markdown += `Name: ${summary.name}  \n`;
    }
    markdown += `\n`;
  }

  // Price insights
  if (data.price_insights) {
    const insights = data.price_insights;
    markdown += `## Price Analysis\n\n`;
    if (insights.previous_close) markdown += `Previous Close: $${insights.previous_close}  \n`;
    if (insights.day_range) markdown += `Day Range: $${insights.day_range}  \n`;
    if (insights.year_range) markdown += `52-Week Range: $${insights.year_range}  \n`;
    if (insights.market_cap) markdown += `Market Cap: ${insights.market_cap}  \n`;
    if (insights.pe_ratio) markdown += `P/E Ratio: ${insights.pe_ratio}  \n`;
    markdown += `\n`;
  }

  // Futures chain (for summary mode)
  if (data.futures_chain && params.summary_only && data.futures_chain.length > 0) {
    const futures = data.futures_chain.slice(0, params.max_futures || 3);
    if (futures.length > 1) {
      markdown += `## Futures Contracts\n\n`;
      futures.forEach((future: any) => {
        markdown += `${future.date || future.stock}: $${future.price || future.extracted_price}`;
        if (future.change) markdown += ` (${future.change})`;
        markdown += `  \n`;
      });
      markdown += `\n`;
    }
  }

  // Top news - safely handle different data structures
  if (data.top_news && params.include_news !== false) {
    try {
      let newsItems: any[] = [];
      
      if (Array.isArray(data.top_news)) {
        newsItems = data.top_news;
      } else if (data.top_news.results && Array.isArray(data.top_news.results)) {
        newsItems = data.top_news.results;
      } else if (typeof data.top_news === 'object' && data.top_news.length) {
        // Try to convert to array if it has a length property
        newsItems = Object.values(data.top_news);
      }
      
      if (newsItems.length > 0) {
        markdown += `## Latest News\n\n`;
        newsItems.slice(0, 5).forEach((news: any, index: number) => {
          if (news && (news.title || news.headline)) {
            markdown += `### ${index + 1}. ${news.title || news.headline}\n`;
            if (news.source) markdown += `Source: ${news.source}  \n`;
            if (news.date || news.published_date) markdown += `Date: ${news.date || news.published_date}  \n`;
            if (news.snippet || news.description) markdown += `${news.snippet || news.description}  \n`;
            if (news.link || news.url) markdown += `[Read More](${news.link || news.url})  \n`;
            markdown += `\n`;
          }
        });
      }
    } catch (error) {
      // Silently skip news section if there's an error
    }
  }

  // Market overview (if included)
  if (data.markets && params.include_markets) {
    markdown += `## Market Overview\n\n`;
    if (data.markets.top_news) {
      markdown += `Market News Available: ${data.markets.top_news.length} articles  \n`;
    }
    markdown += `\n`;
  }

  // Discover more (if included)
  if (data.discover_more && params.include_discover) {
    markdown += `## Related\n\n`;
    if (data.discover_more.similar_stocks) {
      markdown += `Similar Stocks: ${data.discover_more.similar_stocks.map((s: any) => s.stock || s).join(', ')}  \n`;
    }
    markdown += `\n`;
  }

  return markdown;
}

const financeSearchSchema = z.object({
  q: z
    .string()
    .describe(
      "Stock symbol, index, mutual fund, currency, or futures (e.g., 'GOOGL:NASDAQ', 'WMT:NYSE')"
    ),
  window: z
    .enum(["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"])
    .optional()
    .describe("Time range for graph data"),
  no_cache: z
    .boolean()
    .optional()
    .describe("Force fresh results instead of cached"),
  async: z.boolean().optional().describe("Submit search asynchronously"),
  output: z.enum(["json", "html"]).optional().describe("Response format"),
  include_markets: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include market overview data"),
  include_discover: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include discover more section"),
  include_news: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include top news"),
  max_futures: z
    .number()
    .optional()
    .default(3)
    .describe("Maximum number of futures chain items to return"),
  summary_only: z
    .boolean()
    .optional()
    .default(true)
    .describe("Return only essential information (price, movement, news)"),
});

interface FilteredFinanceResult {
  search_metadata?: any;
  search_parameters?: any;
  summary?: {
    symbol: string;
    name?: string;
    price: number | string;
    currency?: string;
    price_movement?: {
      percentage: number;
      value: number;
      movement: string;
    };
  };
  markets?: any;
  futures_chain?: any[];
  discover_more?: any;
  top_news?: any;
  price_insights?: any;
}

function filterFinanceResponse(
  data: any,
  params: z.infer<typeof financeSearchSchema>
): FilteredFinanceResult | any {
  if (params.summary_only) {
    const mainStock = data.futures_chain?.[0];
    return {
      search_metadata: data.search_metadata,
      search_parameters: data.search_parameters,
      summary: {
        symbol: mainStock?.stock || params.q,
        name: mainStock?.date,
        price: mainStock?.extracted_price || mainStock?.price,
        currency: mainStock?.currency,
        price_movement: mainStock?.price_movement,
      },
      ...(params.include_news !== false &&
        data.markets?.top_news && { top_news: data.markets.top_news }),
      ...(data.price_insights && { price_insights: data.price_insights }),
    };
  }

  const filtered: FilteredFinanceResult = {
    search_metadata: data.search_metadata,
    search_parameters: data.search_parameters,
  };

  if (params.include_markets) {
    filtered.markets = data.markets;
  }

  if (data.futures_chain && params.max_futures && params.max_futures > 0) {
    filtered.futures_chain = data.futures_chain.slice(0, params.max_futures);
  }

  if (params.include_discover) {
    filtered.discover_more = data.discover_more;
  }

  if (params.include_news !== false && data.markets?.top_news) {
    filtered.top_news = data.markets.top_news;
  }

  if (data.price_insights) {
    filtered.price_insights = data.price_insights;
  }

  return filtered;
}

export async function searchFinance(
  params: z.infer<typeof financeSearchSchema>
): Promise<string> {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    throw new Error("SERP_API_KEY environment variable is required");
  }

  const {
    include_markets,
    include_discover,
    include_news,
    max_futures,
    summary_only,
    ...apiParams
  } = params;

  const searchParams = new URLSearchParams({
    engine: "google_finance",
    api_key: apiKey,
    q: apiParams.q,
    hl: "en",
    ...(apiParams.window && { window: apiParams.window }),
    ...(apiParams.no_cache !== undefined && {
      no_cache: apiParams.no_cache.toString(),
    }),
    ...(apiParams.async !== undefined && { async: apiParams.async.toString() }),
    ...(apiParams.output && { output: apiParams.output }),
  });

  try {
    const response = await axios.get(
      `${SERPAPI_BASE_URL}?${searchParams.toString()}`
    );
    const filteredData = filterFinanceResponse(response.data, params);
    return formatFinanceToMarkdown(filteredData, params);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Finance API request failed: ${
          error.response?.data?.error || error.message
        }`
      );
    }
    throw error;
  }
}

export { financeSearchSchema };
