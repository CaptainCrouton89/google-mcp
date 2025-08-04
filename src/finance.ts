import axios from "axios";
import { z } from "zod";

const SERPAPI_BASE_URL = "https://serpapi.com/search";

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
) {
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
    return filterFinanceResponse(response.data, params);
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
