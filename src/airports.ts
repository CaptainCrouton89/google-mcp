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
    .describe("Return date in YYYY-MM-DD format for round-trip (REQUIRED when type=1)"),
  multi_city_json: z
    .string()
    .optional()
    .describe("JSON string for multi-city trips with multiple legs (required when type=3)"),
  type: z
    .number()
    .optional()
    .describe("Trip type: 1=Round-trip (requires return_date), 2=One-way, 3=Multi-city (requires multi_city_json). Defaults to one-way if not specified."),
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

function formatFlightToMarkdown(data: any, params: z.infer<typeof airportsSearchSchema>): string {
  if (!data) return "No flight data available.";

  let markdown = `# Flight Search: ${params.departure_id} → ${params.arrival_id}\n\n`;

  // Add route summary
  if (params.summary_only) {
    const bestFlight = data.best_flights?.[0];
    const bestPrice = bestFlight?.price || data.price_insights?.lowest_price;
    const flightCount = (data.best_flights?.length || 0) + (data.other_flights?.length || 0);
    
    markdown += `## Summary\n`;
    markdown += `- **Route**: ${params.departure_id} → ${params.arrival_id}\n`;
    markdown += `- **Best Price**: $${bestPrice}\n`;
    if (bestFlight?.flights?.[0]?.airline) {
      markdown += `- **Best Airline**: ${bestFlight.flights[0].airline}\n`;
    }
    markdown += `- **Total Flights Found**: ${flightCount}\n\n`;

    if (params.include_price_insights !== false && data.price_insights) {
      markdown += `### Price Insights\n`;
      markdown += `- **Lowest Price**: $${data.price_insights.lowest_price}\n`;
      markdown += `- **Price Level**: ${data.price_insights.price_level}\n`;
      if (data.price_insights.typical_price_range) {
        markdown += `- **Typical Range**: $${data.price_insights.typical_price_range.join(' - $')}\n`;
      }
      markdown += `\n`;
    }
    return markdown;
  }

  // Add best flights
  if (data.best_flights && params.max_best_flights && params.max_best_flights > 0) {
    markdown += `## Best Flights\n\n`;
    const bestFlights = data.best_flights.slice(0, params.max_best_flights);
    
    bestFlights.forEach((flight: any, index: number) => {
      markdown += `### Flight ${index + 1} - $${flight.price}\n`;
      markdown += `- **Duration**: ${flight.total_duration}\n`;
      markdown += `- **Type**: ${flight.type}\n`;
      if (flight.carbon_emissions?.this_flight) {
        markdown += `- **CO₂ Emissions**: ${flight.carbon_emissions.this_flight}kg\n`;
      }
      
      if (flight.flights && flight.flights.length > 0) {
        markdown += `- **Segments**:\n`;
        flight.flights.forEach((segment: any, segIndex: number) => {
          markdown += `  ${segIndex + 1}. **${segment.airline}** ${segment.flight_number}\n`;
          markdown += `     - ${segment.departure_airport} → ${segment.arrival_airport}\n`;
          markdown += `     - Duration: ${segment.duration}\n`;
          markdown += `     - Class: ${segment.travel_class}\n`;
          if (segment.overnight) markdown += `     - Overnight flight\n`;
          if (segment.often_delayed_by_over_30_min) markdown += `     - ⚠️ Often delayed >30min\n`;
        });
      }
      markdown += `\n`;
    });
  }

  // Add other flights
  if (data.other_flights && params.max_other_flights && params.max_other_flights > 0) {
    markdown += `## Other Flight Options\n\n`;
    const otherFlights = data.other_flights.slice(0, params.max_other_flights);
    
    otherFlights.forEach((flight: any, index: number) => {
      markdown += `### Option ${index + 1} - $${flight.price}\n`;
      markdown += `- **Duration**: ${flight.total_duration}\n`;
      markdown += `- **Type**: ${flight.type}\n`;
      
      if (flight.layovers && flight.layovers.length > 0) {
        markdown += `- **Layovers**: ${flight.layovers.map((l: any) => `${l.name} (${l.duration})`).join(', ')}\n`;
      }
      
      if (flight.carbon_emissions?.this_flight) {
        markdown += `- **CO₂ Emissions**: ${flight.carbon_emissions.this_flight}kg\n`;
      }
      
      if (flight.flights && flight.flights.length > 0) {
        markdown += `- **Segments**:\n`;
        flight.flights.forEach((segment: any, segIndex: number) => {
          markdown += `  ${segIndex + 1}. **${segment.airline}** ${segment.flight_number}\n`;
          markdown += `     - ${segment.departure_airport} → ${segment.arrival_airport}\n`;
          markdown += `     - Duration: ${segment.duration}\n`;
          markdown += `     - Class: ${segment.travel_class}\n`;
          if (segment.overnight) markdown += `     - Overnight flight\n`;
          if (segment.often_delayed_by_over_30_min) markdown += `     - ⚠️ Often delayed >30min\n`;
        });
      }
      markdown += `\n`;
    });
  }

  // Add price insights for detailed view
  if (params.include_price_insights !== false && data.price_insights && !params.summary_only) {
    markdown += `## Price Insights\n`;
    markdown += `- **Lowest Price**: $${data.price_insights.lowest_price}\n`;
    markdown += `- **Price Level**: ${data.price_insights.price_level}\n`;
    if (data.price_insights.typical_price_range) {
      markdown += `- **Typical Range**: $${data.price_insights.typical_price_range.join(' - $')}\n`;
    }
    markdown += `\n`;
  }

  return markdown;
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
): Promise<string> {
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
    return formatFlightToMarkdown(response.data, params);
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
