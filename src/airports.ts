import axios from "axios";
import { z } from "zod";

const SERPAPI_BASE_URL = "https://serpapi.com/search";

const airportsSearchSchema = z.object({
  departure_id: z
    .string()
    .describe("Departure airport code (e.g., 'CDG', 'AUS')"),
  arrival_id: z.string().describe("Arrival airport code (e.g., 'NRT', 'LAX')"),
  outbound_date: z
    .string()
    .optional()
    .describe("Outbound date in YYYY-MM-DD format"),
  return_date: z
    .string()
    .optional()
    .describe("Return date in YYYY-MM-DD format for round-trip"),
  multi_city_json: z
    .string()
    .optional()
    .describe("JSON string for multi-city trips with multiple legs"),
  type: z
    .number()
    .optional()
    .describe("Trip type indicator (e.g., 3 for multi-city)"),
  max_best_flights: z
    .number()
    .optional()
    .default(3)
    .describe("Maximum number of best flights to return"),
  max_other_flights: z
    .number()
    .optional()
    .default(5)
    .describe("Maximum number of other flights to return"),
  include_price_insights: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include price insights and history"),
  include_airports: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include airport information"),
  summary_only: z
    .boolean()
    .optional()
    .default(true)
    .describe("Return only essential flight information"),
});

interface FilteredFlightResult {
  search_metadata?: any;
  search_parameters?: any;
  summary?: {
    route: string;
    best_price: number;
    best_airline?: string;
    flight_count: number;
  };
  best_flights?: any[];
  other_flights?: any[];
  price_insights?: any;
  airports?: any;
}

function filterFlightResponse(
  data: any,
  params: z.infer<typeof airportsSearchSchema>
): FilteredFlightResult | any {
  if (params.summary_only) {
    const bestFlight = data.best_flights?.[0];
    return {
      search_metadata: data.search_metadata,
      search_parameters: data.search_parameters,
      summary: {
        route: `${params.departure_id} → ${params.arrival_id}`,
        best_price: bestFlight?.price || data.price_insights?.lowest_price,
        best_airline: bestFlight?.flights?.[0]?.airline,
        flight_count:
          (data.best_flights?.length || 0) + (data.other_flights?.length || 0),
      },
      ...(params.include_price_insights !== false &&
        data.price_insights && {
          price_insights: {
            lowest_price: data.price_insights.lowest_price,
            price_level: data.price_insights.price_level,
            typical_price_range: data.price_insights.typical_price_range,
          },
        }),
    };
  }

  const filtered: FilteredFlightResult = {
    search_metadata: data.search_metadata,
    search_parameters: data.search_parameters,
  };

  if (
    data.best_flights &&
    params.max_best_flights &&
    params.max_best_flights > 0
  ) {
    filtered.best_flights = data.best_flights
      .slice(0, params.max_best_flights)
      .map((flight: any) => ({
        flights: flight.flights?.map((f: any) => ({
          departure_airport: f.departure_airport,
          arrival_airport: f.arrival_airport,
          duration: f.duration,
          airline: f.airline,
          flight_number: f.flight_number,
          travel_class: f.travel_class,
          overnight: f.overnight,
          often_delayed_by_over_30_min: f.often_delayed_by_over_30_min,
        })),
        total_duration: flight.total_duration,
        price: flight.price,
        type: flight.type,
        airline_logo: flight.airline_logo,
        carbon_emissions: flight.carbon_emissions,
      }));
  }

  if (
    data.other_flights &&
    params.max_other_flights &&
    params.max_other_flights > 0
  ) {
    filtered.other_flights = data.other_flights
      .slice(0, params.max_other_flights)
      .map((flight: any) => ({
        flights: flight.flights?.map((f: any) => ({
          departure_airport: f.departure_airport,
          arrival_airport: f.arrival_airport,
          duration: f.duration,
          airline: f.airline,
          flight_number: f.flight_number,
          travel_class: f.travel_class,
          overnight: f.overnight,
          often_delayed_by_over_30_min: f.often_delayed_by_over_30_min,
        })),
        layovers: flight.layovers,
        total_duration: flight.total_duration,
        price: flight.price,
        type: flight.type,
        airline_logo: flight.airline_logo,
        carbon_emissions: flight.carbon_emissions,
      }));
  }

  if (params.include_price_insights !== false && data.price_insights) {
    filtered.price_insights = {
      lowest_price: data.price_insights.lowest_price,
      price_level: data.price_insights.price_level,
      typical_price_range: data.price_insights.typical_price_range,
    };
  }

  if (params.include_airports && data.airports) {
    filtered.airports = data.airports;
  }

  return filtered;
}

export async function searchAirports(
  params: z.infer<typeof airportsSearchSchema>
) {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    throw new Error("SERP_API_KEY environment variable is required");
  }

  const {
    max_best_flights,
    max_other_flights,
    include_price_insights,
    include_airports,
    summary_only,
    ...apiParams
  } = params;

  const searchParams = new URLSearchParams({
    engine: "google_flights",
    api_key: apiKey,
    departure_id: apiParams.departure_id,
    arrival_id: apiParams.arrival_id,
    hl: "en",
    currency: "USD",
    ...(apiParams.outbound_date && { outbound_date: apiParams.outbound_date }),
    ...(apiParams.return_date && { return_date: apiParams.return_date }),
    ...(apiParams.multi_city_json && {
      multi_city_json: apiParams.multi_city_json,
    }),
    ...(apiParams.type !== undefined && { type: apiParams.type.toString() }),
  });

  try {
    const response = await axios.get(
      `${SERPAPI_BASE_URL}?${searchParams.toString()}`
    );
    return filterFlightResponse(response.data, params);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Airports API request failed: ${
          error.response?.data?.error || error.message
        }`
      );
    }
    throw error;
  }
}

export { airportsSearchSchema };
