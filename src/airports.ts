import axios from "axios";
import { z } from "zod";

const SERPAPI_BASE_URL = "https://serpapi.com/search";

const airportsSearchSchema = z.object({
  departure_id: z
    .string()
    .describe("Departure airport code (e.g., 'CDG', 'AUS', 'LAX', 'SFO'). Use 3-letter IATA codes."),
  arrival_id: z.string().describe("Arrival airport code (e.g., 'NRT', 'LAX', 'JFK', 'LHR'). Use 3-letter IATA codes."),
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
    .default(2)
    .describe("Trip type: 1=Round-trip (requires return_date), 2=One-way (default), 3=Multi-city (requires multi_city_json). Use type=2 for one-way trips to avoid errors."),
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
  include_links: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include booking links for each flight (off by default)"),
});


function formatDuration(minutes: number | string): string {
  const mins = typeof minutes === 'string' ? parseInt(minutes) : minutes;
  if (isNaN(mins)) return 'Unknown';
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}:${remainingMins.toString().padStart(2, '0')}`;
}

function formatFlightToMarkdown(data: any, params: z.infer<typeof airportsSearchSchema>): string {
  if (!data) return "No flight data available.";

  let markdown = `# ${params.departure_id} → ${params.arrival_id}\n\n`;
  
  // Get the Google Flights URL for booking
  const googleFlightsUrl = data.search_metadata?.google_flights_url;

  // Add route summary
  if (params.summary_only) {
    const bestFlight = data.best_flights?.[0];
    const bestPrice = bestFlight?.price || data.price_insights?.lowest_price;
    const flightCount = (data.best_flights?.length || 0) + (data.other_flights?.length || 0);
    
    markdown += `**Best Price**: $${bestPrice}\n`;
    if (bestFlight?.flights?.[0]?.airline) {
      markdown += `**Airline**: ${bestFlight.flights[0].airline}\n`;
    }
    markdown += `**Flights Found**: ${flightCount}\n\n`;

    if (params.include_price_insights !== false && data.price_insights) {
      markdown += `**Price Level**: ${data.price_insights.price_level}\n`;
      if (data.price_insights.typical_price_range) {
        markdown += `**Typical Range**: $${data.price_insights.typical_price_range.join('-$')}\n`;
      }
    }
    return markdown;
  }

  // Add best flights
  if (data.best_flights && params.max_best_flights && params.max_best_flights > 0) {
    markdown += `## Best Options\n\n`;
    const bestFlights = data.best_flights.slice(0, params.max_best_flights);
    
    bestFlights.forEach((flight: any) => {
      const stops = flight.flights && flight.flights.length > 1 ? `${flight.flights.length - 1} stop${flight.flights.length > 2 ? 's' : ''}` : 'Direct';
      const totalDuration = formatDuration(flight.total_duration);
      markdown += `### $${flight.price} • ${totalDuration} • ${stops}\n`;
      if (params.include_links && googleFlightsUrl) {
        markdown += `**URL**: ${googleFlightsUrl}\n`;
      }
      
      if (flight.flights && flight.flights.length > 0) {
        flight.flights.forEach((segment: any, index: number) => {
          const depAirport = segment.departure_airport?.code || segment.departure_airport?.name || segment.departure_airport || 'Unknown';
          const arrAirport = segment.arrival_airport?.code || segment.arrival_airport?.name || segment.arrival_airport || 'Unknown';
          const depTime = segment.departure_airport?.time || 'Unknown';
          const arrTime = segment.arrival_airport?.time || 'Unknown';
          markdown += `${segment.airline} ${segment.flight_number}: ${depAirport} ${depTime} → ${arrAirport} ${arrTime}\n`;
          
          // Add layover information if this is not the last segment
          if (index < flight.flights.length - 1 && flight.layovers?.[index]) {
            const layover = flight.layovers[index];
            const layoverDuration = formatDuration(layover.duration);
            markdown += `  Layover: ${layoverDuration}\n`;
          }
        });
      }
      markdown += `\n`;
    });
  }

  // Add other flights
  if (data.other_flights && params.max_other_flights && params.max_other_flights > 0) {
    markdown += `## Other Options\n\n`;
    const otherFlights = data.other_flights.slice(0, params.max_other_flights);
    
    otherFlights.forEach((flight: any) => {
      const stops = flight.flights && flight.flights.length > 1 ? `${flight.flights.length - 1} stop${flight.flights.length > 2 ? 's' : ''}` : 'Direct';
      const totalDuration = formatDuration(flight.total_duration);
      markdown += `### $${flight.price} • ${totalDuration} • ${stops}\n`;
      if (params.include_links && googleFlightsUrl) {
        markdown += `**URL**: ${googleFlightsUrl}\n`;
      }
      
      if (flight.flights && flight.flights.length > 0) {
        flight.flights.forEach((segment: any, index: number) => {
          const depAirport = segment.departure_airport?.code || segment.departure_airport?.name || segment.departure_airport || 'Unknown';
          const arrAirport = segment.arrival_airport?.code || segment.arrival_airport?.name || segment.arrival_airport || 'Unknown';
          const depTime = segment.departure_airport?.time || 'Unknown';
          const arrTime = segment.arrival_airport?.time || 'Unknown';
          markdown += `${segment.airline} ${segment.flight_number}: ${depAirport} ${depTime} → ${arrAirport} ${arrTime}\n`;
          
          // Add layover information if this is not the last segment
          if (index < flight.flights.length - 1 && flight.layovers?.[index]) {
            const layover = flight.layovers[index];
            const layoverDuration = formatDuration(layover.duration);
            markdown += `  Layover: ${layoverDuration}\n`;
          }
        });
      }
      markdown += `\n`;
    });
  }

  // Add price insights for detailed view
  if (params.include_price_insights !== false && data.price_insights && !params.summary_only) {
    markdown += `**Price Level**: ${data.price_insights.price_level} • Lowest: $${data.price_insights.lowest_price}\n`;
  }

  return markdown;
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
    include_links,
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
