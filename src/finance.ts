import axios from "axios";
import { z } from "zod";

const SERPAPI_BASE_URL = "https://serpapi.com/search";

interface SerpApiFinanceResponse {
  search_metadata: {
    id: string;
    status: string;
    json_endpoint: string;
    created_at: string;
    processed_at: string;
    google_finance_url: string;
    raw_html_file: string;
    total_time_taken: number;
  };
  search_parameters: {
    engine: string;
    q: string;
    hl: string;
  };
  summary?: {
    title: string;
    stock: string;
    exchange: string;
    price: string;
    extracted_price: number;
    currency?: string;
    market?: {
      trading?: string;
      price: string;
      extracted_price: number;
      currency: string;
      price_movement: {
        percentage: number;
        value: number;
        movement: string;
      };
    };
    extensions: string[];
  };
  futures_chain?: Array<{
    stock: string;
    serpapi_link: string;
    link: string;
    date: string;
    price: string;
    extracted_price: number;
    currency: string;
    price_movement: {
      percentage: number;
      movement: string;
    };
  }>;
  top_news?: {
    link: string;
    snippet: string;
    source: string;
    thumbnail: string;
    date: string;
    iso_date: string;
  };
  markets?: any;
  discover_more?: any;
  price_insights?: {
    previous_close?: number;
    day_range?: string;
    year_range?: string;
    market_cap?: string;
    pe_ratio?: string;
  };
  error?: string;
}

interface BraveNewsResult {
  title: string;
  url: string;
  description: string;
  published_datetime?: string;
  source?: {
    name: string;
  };
}

interface BraveNewsResponse {
  results: BraveNewsResult[];
}

async function fetchAdditionalNews(
  ticker: string,
  maxNews: number
): Promise<BraveNewsResult[]> {
  const braveApiKey = process.env.BRAVE_API_KEY;
  if (!braveApiKey || maxNews <= 1) {
    return [];
  }

  try {
    const query = `${ticker} stock news`;
    const response = await axios.get<BraveNewsResponse>(
      `https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(
        query
      )}&count=${Math.min(maxNews - 1, 10)}`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": braveApiKey,
        },
      }
    );

    return response.data.results || [];
  } catch (error) {
    console.warn("Failed to fetch additional news from Brave Search:", error);
    return [];
  }
}

// Markdown formatting helpers
function formatFinanceToMarkdown(
  data: any,
  params: z.infer<typeof financeSearchSchema>,
  braveNews: BraveNewsResult[] = []
): string {
  if (!data) return "No financial data available.";

  let markdown = `# ${params.q}\n\n`;

  // Main stock/security info
  if (data.summary) {
    const summary = data.summary;
    const price = summary.price !== undefined ? summary.price : "N/A";
    markdown += `Current Price: ${summary.currency || "$"}${price}  \n`;

    if (summary.price_movement) {
      const movement = summary.price_movement;
      const arrow =
        movement.movement === "up"
          ? "📈"
          : movement.movement === "down"
          ? "📉"
          : "➡️";
      markdown += `Change: ${arrow} ${movement.percentage}% (${
        movement.value >= 0 ? "+" : ""
      }${movement.value})  \n`;
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
    if (insights.previous_close)
      markdown += `Previous Close: $${insights.previous_close}  \n`;
    if (insights.day_range) markdown += `Day Range: $${insights.day_range}  \n`;
    if (insights.year_range)
      markdown += `52-Week Range: $${insights.year_range}  \n`;
    if (insights.market_cap)
      markdown += `Market Cap: ${insights.market_cap}  \n`;
    if (insights.pe_ratio) markdown += `P/E Ratio: ${insights.pe_ratio}  \n`;
    markdown += `\n`;
  }

  // Futures chain (for summary mode)
  if (
    data.futures_chain &&
    params.summary_only &&
    data.futures_chain.length > 0
  ) {
    const futures = data.futures_chain.slice(0, params.max_futures || 3);
    if (futures.length > 1) {
      markdown += `## Futures Contracts\n\n`;
      futures.forEach((future: any) => {
        markdown += `${future.date || future.stock}: $${
          future.price || future.extracted_price
        }`;
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
      } else if (
        data.top_news.results &&
        Array.isArray(data.top_news.results)
      ) {
        newsItems = data.top_news.results;
      } else if (typeof data.top_news === "object") {
        // If it's a single news object, put it in an array
        if (
          data.top_news.title ||
          data.top_news.headline ||
          data.top_news.snippet
        ) {
          newsItems = [data.top_news];
        } else {
          // Try to convert object values to array
          newsItems = Object.values(data.top_news).filter(
            (item: any) =>
              item &&
              typeof item === "object" &&
              (item.title || item.headline || item.snippet)
          );
        }
      }

      if (newsItems.length > 0) {
        markdown += `## Latest News\n\n`;
        newsItems.slice(0, 5).forEach((news: any, index: number) => {
          if (news && (news.title || news.headline || news.snippet)) {
            markdown += `### ${index + 1}. ${
              news.title || news.headline || "News Update"
            }\n`;
            if (news.source) markdown += `Source: ${news.source}  \n`;
            if (news.date || news.published_date)
              markdown += `Date: ${news.date || news.published_date}  \n`;
            if (news.snippet || news.description)
              markdown += `${news.snippet || news.description}  \n`;
            if (news.link || news.url)
              markdown += `[Read More](${news.link || news.url})  \n`;
            markdown += `\n`;
          }
        });
      }
    } catch (error) {
      // Silently skip news section if there's an error
    }
  }

  // Additional news from Brave Search
  if (braveNews.length > 0 && params.include_news !== false) {
    if (!data.top_news || Object.keys(data.top_news || {}).length === 0) {
      markdown += `## Latest News\n\n`;
    }

    braveNews.forEach((news, index) => {
      const newsIndex = data.top_news ? index + 2 : index + 1; // Start after Google Finance news
      markdown += `### ${newsIndex}. ${news.title}\n`;
      if (news.source?.name) markdown += `Source: ${news.source.name}  \n`;
      if (news.published_datetime)
        markdown += `Date: ${news.published_datetime}  \n`;
      if (news.description) markdown += `${news.description}  \n`;
      if (news.url) markdown += `[Read More](${news.url})  \n`;
      markdown += `\n`;
    });
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
      markdown += `Similar Stocks: ${data.discover_more.similar_stocks
        .map((s: any) => s.stock || s)
        .join(", ")}  \n`;
    }
    markdown += `\n`;
  }

  return markdown;
}

const financeSearchSchema = z.object({
  q: z
    .string()
    .describe(
      "Stock symbol with exchange in format 'SYMBOL:EXCHANGE'. Examples: 'AAPL:NASDAQ', 'TSLA:NASDAQ', 'MSFT:NASDAQ', 'GOOGL:NASDAQ', 'NVDA:NASDAQ' for stocks. For ETFs/Index funds: 'SPY:NYSEARCA', 'VTI:NYSEARCA', 'QQQ:NASDAQ', 'VOO:NYSEARCA'. For crypto: 'BTC-USD', 'ETH-USD'. Note: Just 'SPY' returns market overview with related ETFs in futures_chain."
    ),
  window: z
    .enum(["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"])
    .optional()
    .describe("Time range for graph data"),
  async: z.boolean().optional().describe("Submit search asynchronously"),
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
  max_news: z
    .number()
    .optional()
    .default(1)
    .describe(
      "Maximum number of news articles to return (1 = only top news from Google Finance, >1 = additional news from Brave Search)"
    ),
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
  data: SerpApiFinanceResponse,
  params: z.infer<typeof financeSearchSchema>
): FilteredFinanceResult {
  if (params.summary_only) {
    let stockData: {
      symbol: string;
      name: string;
      price: number;
      currency: string;
      price_movement?: any;
    };

    // Deterministic logic: summary first, then futures_chain
    if (data.summary) {
      stockData = {
        symbol: data.summary.stock,
        name: data.summary.title,
        price: data.summary.extracted_price,
        currency:
          data.summary.currency || data.summary.price.replace(/[0-9.,]/g, ""),
        price_movement: data.summary.market?.price_movement,
      };
    } else if (data.futures_chain && data.futures_chain.length > 0) {
      const mainStock = data.futures_chain[0];
      stockData = {
        symbol: mainStock.stock,
        name: mainStock.date,
        price: mainStock.extracted_price,
        currency: mainStock.currency,
        price_movement: mainStock.price_movement,
      };
    } else {
      throw new Error("No stock data found in API response");
    }

    return {
      search_metadata: data.search_metadata,
      search_parameters: data.search_parameters,
      summary: stockData,
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
    max_news,
    ...apiParams
  } = params;

  const searchParams = new URLSearchParams({
    engine: "google_finance",
    api_key: apiKey,
    q: apiParams.q,
    hl: "en",
    ...(apiParams.window && { window: apiParams.window }),
    ...(apiParams.async !== undefined && { async: apiParams.async.toString() }),
  });

  try {
    const response = await axios.get<SerpApiFinanceResponse>(
      `${SERPAPI_BASE_URL}?${searchParams.toString()}`
    );

    // Check for API errors first
    if (response.data.error) {
      throw new Error(`SerpAPI Error: ${response.data.error}`);
    }

    const filteredData = filterFinanceResponse(response.data, params);

    // Fetch additional news if requested
    let braveNews: BraveNewsResult[] = [];
    if (max_news && max_news > 1 && include_news !== false) {
      braveNews = await fetchAdditionalNews(params.q, max_news);
    }

    return formatFinanceToMarkdown(filteredData, params, braveNews);
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
