#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as dotenv from "dotenv";
import { airportsSearchSchema, searchAirports } from "./airports.js";
import { financeSearchSchema, searchFinance } from "./finance.js";
import {
  directionsSchema,
  distanceMatrix,
  distanceMatrixSchema,
  geocode,
  geocodeSchema,
  getDirections,
  placeDetails,
  placeDetailsSchema,
  placesSearch,
  placesSearchSchema,
  reverseGeocode,
  reverseGeocodeSchema,
} from "./maps.js";

dotenv.config({ path: ".env.local" });

// Create the MCP server
const server = new McpServer({
  name: "maps-mcp",
  version: "1.0.0",
});

// Geocoding tool
server.tool(
  "geocode",
  "Convert an address to coordinates",
  geocodeSchema.shape,
  async (params) => {
    return await geocode(params);
  }
);

// Reverse geocoding tool
server.tool(
  "reverse-geocode",
  "Convert coordinates to an address",
  reverseGeocodeSchema.shape,
  async (params) => {
    return await reverseGeocode(params);
  }
);

// Places search tool
server.tool(
  "places-search",
  "Search for places using text query",
  placesSearchSchema.shape,
  async (params) => {
    return await placesSearch(params);
  }
);

// Directions tool
server.tool(
  "get-directions",
  "Get directions between two locations",
  directionsSchema.shape,
  async (params) => {
    return await getDirections(params);
  }
);

// Distance matrix tool
server.tool(
  "distance-matrix",
  "Calculate travel distance and time between multiple origins and destinations",
  distanceMatrixSchema.shape,
  async (params) => {
    return await distanceMatrix(params);
  }
);

// Place details tool
server.tool(
  "place-details",
  "Get detailed information about a specific place",
  placeDetailsSchema.shape,
  async (params) => {
    return await placeDetails(params);
  }
);

// Finance search tool
server.tool(
  "finance-search",
  "Search for stocks, indices, mutual funds, currencies, and futures using Google Finance",
  financeSearchSchema.shape,
  async (params) => {
    try {
      const result = await searchFinance(params);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error searching finance data: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

// Airports search tool
server.tool(
  "airports-search",
  "Search for airport and flight information using Google Flights",
  airportsSearchSchema.shape,
  async (params) => {
    try {
      const result = await searchAirports(params);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error searching airports data: ${
              error instanceof Error ? error.message : String(error)
            }`,
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
