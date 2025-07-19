#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@googlemaps/google-maps-services-js";
import { z } from "zod";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const googleMapsClient = new Client({});
const apiKey = process.env.GOOGLE_MAPS_API_KEY;

if (!apiKey) {
  throw new Error("GOOGLE_MAPS_API_KEY is required");
}

// Create the MCP server
const server = new McpServer({
  name: "maps-mcp",
  version: "1.0.0",
});

// Geocoding tool
server.tool(
  "geocode",
  "Convert an address to coordinates",
  {
    address: z.string().describe("The address to geocode"),
  },
  async ({ address }) => {
    try {
      const response = await googleMapsClient.geocode({
        params: {
          address,
          key: apiKey,
        },
      });

      const results = response.data.results;
      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No results found for the given address.",
            },
          ],
        };
      }

      const location = results[0];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              formatted_address: location.formatted_address,
              latitude: location.geometry.location.lat,
              longitude: location.geometry.location.lng,
              place_id: location.place_id,
              types: location.types,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error geocoding address: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Reverse geocoding tool
server.tool(
  "reverse-geocode",
  "Convert coordinates to an address",
  {
    latitude: z.number().describe("The latitude"),
    longitude: z.number().describe("The longitude"),
  },
  async ({ latitude, longitude }) => {
    try {
      const response = await googleMapsClient.reverseGeocode({
        params: {
          latlng: [latitude, longitude],
          key: apiKey,
        },
      });

      const results = response.data.results;
      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No results found for the given coordinates.",
            },
          ],
        };
      }

      const location = results[0];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              formatted_address: location.formatted_address,
              place_id: location.place_id,
              types: location.types,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error reverse geocoding coordinates: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Places search tool
server.tool(
  "places-search",
  "Search for places using text query",
  {
    query: z.string().describe("The search query"),
    location: z.string().optional().describe("Bias results around this location (e.g., 'lat,lng')"),
    radius: z.number().optional().describe("Search radius in meters"),
  },
  async ({ query, location, radius }) => {
    try {
      const params: any = {
        query,
        key: apiKey,
      };

      if (location) {
        params.location = location;
      }
      if (radius) {
        params.radius = radius;
      }

      const response = await googleMapsClient.textSearch({
        params,
      });

      const results = response.data.results;
      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No places found for the given query.",
            },
          ],
        };
      }

      const places = results.slice(0, 5).map(place => ({
        name: place.name,
        formatted_address: place.formatted_address,
        latitude: place.geometry?.location.lat,
        longitude: place.geometry?.location.lng,
        place_id: place.place_id,
        rating: place.rating,
        types: place.types,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(places, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error searching places: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Directions tool
server.tool(
  "get-directions",
  "Get directions between two locations",
  {
    origin: z.string().describe("Starting location (address or lat,lng)"),
    destination: z.string().describe("Ending location (address or lat,lng)"),
    mode: z.enum(["driving", "walking", "bicycling", "transit"]).optional().describe("Travel mode"),
  },
  async ({ origin, destination, mode = "driving" }) => {
    try {
      const response = await googleMapsClient.directions({
        params: {
          origin,
          destination,
          mode: mode as any,
          key: apiKey,
        },
      });

      const routes = response.data.routes;
      if (routes.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No routes found between the given locations.",
            },
          ],
        };
      }

      const route = routes[0];
      const leg = route.legs[0];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              distance: leg.distance.text,
              duration: leg.duration.text,
              start_address: leg.start_address,
              end_address: leg.end_address,
              steps: leg.steps.map(step => ({
                instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
                distance: step.distance.text,
                duration: step.duration.text,
              })),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting directions: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Distance matrix tool
server.tool(
  "distance-matrix",
  "Calculate travel distance and time between multiple origins and destinations",
  {
    origins: z.array(z.string()).describe("Array of origin locations"),
    destinations: z.array(z.string()).describe("Array of destination locations"),
    mode: z.enum(["driving", "walking", "bicycling", "transit"]).optional().describe("Travel mode"),
  },
  async ({ origins, destinations, mode = "driving" }) => {
    try {
      const response = await googleMapsClient.distancematrix({
        params: {
          origins,
          destinations,
          mode: mode as any,
          key: apiKey,
        },
      });

      const rows = response.data.rows;
      const results = [];

      for (let i = 0; i < origins.length; i++) {
        for (let j = 0; j < destinations.length; j++) {
          const element = rows[i].elements[j];
          results.push({
            origin: origins[i],
            destination: destinations[j],
            distance: element.distance?.text || "N/A",
            duration: element.duration?.text || "N/A",
            status: element.status,
          });
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error calculating distance matrix: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Place details tool
server.tool(
  "place-details",
  "Get detailed information about a specific place",
  {
    place_id: z.string().describe("The Google Place ID"),
  },
  async ({ place_id }) => {
    try {
      const response = await googleMapsClient.placeDetails({
        params: {
          place_id,
          key: apiKey,
        },
      });

      const place = response.data.result;
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              name: place.name,
              formatted_address: place.formatted_address,
              phone_number: place.formatted_phone_number,
              website: place.website,
              rating: place.rating,
              user_ratings_total: place.user_ratings_total,
              price_level: place.price_level,
              opening_hours: place.opening_hours?.weekday_text,
              types: place.types,
              latitude: place.geometry?.location.lat,
              longitude: place.geometry?.location.lng,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting place details: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Start the server
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Hello World Server running...");
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

main().catch(console.error);
