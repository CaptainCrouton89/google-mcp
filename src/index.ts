#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as dotenv from "dotenv";
import { airportsSearchSchema, searchAirports } from "./airports.js";
import {
  createEvent,
  createEventSchema,
  deleteEvent,
  deleteEventSchema,
  getEvent,
  getEventSchema,
  initializeCalendarData,
  listCalendars,
  listCalendarsSchema,
  listEvents,
  listEventsSchema,
  updateEvent,
  updateEventSchema,
} from "./calendar.js";
import { financeSearchSchema, searchFinance } from "./finance.js";
import {
  getEmail,
  getEmailSchema,
  getLabels,
  readEmails,
  readEmailsSchema,
  sendEmail,
  sendEmailSchema,
} from "./gmail.js";
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

// Temporarily redirect stdout to prevent dotenv logging
const originalWrite = process.stdout.write;
process.stdout.write = () => true;
dotenv.config({ path: ".env.local" });
process.stdout.write = originalWrite;

// Create the MCP server
const server = new McpServer({
  name: "google-mcp",
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
            text: result,
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

// Gmail tools
server.tool(
  "gmail-send-email",
  "Send an email using Gmail",
  sendEmailSchema.shape,
  async (params) => {
    return await sendEmail(params);
  }
);

server.tool(
  "gmail-read-emails",
  "Read/list emails from Gmail with optional search query",
  readEmailsSchema.shape,
  async (params) => {
    return await readEmails(params);
  }
);

server.tool(
  "gmail-get-email",
  "Get a specific email by message ID",
  getEmailSchema.shape,
  async (params) => {
    return await getEmail(params);
  }
);

server.tool("gmail-get-labels", "Get all Gmail labels", {}, async () => {
  return await getLabels();
});

// Calendar tools will be registered after initialization
function registerCalendarTools() {
  server.tool(
    "calendar-create-event",
    "Create a new calendar event. Current time: " + new Date().toLocaleString(),
    createEventSchema().shape,
    async (params) => {
      return await createEvent(params);
    }
  );

  server.tool(
    "calendar-list-events",
    "List calendar events with optional filters",
    listEventsSchema().shape,
    async (params) => {
      return await listEvents(params);
    }
  );

  server.tool(
    "calendar-get-event",
    "Get a specific calendar event by ID",
    getEventSchema().shape,
    async (params) => {
      return await getEvent(params);
    }
  );

  server.tool(
    "calendar-update-event",
    "Update an existing calendar event",
    updateEventSchema().shape,
    async (params) => {
      return await updateEvent(params);
    }
  );

  server.tool(
    "calendar-delete-event",
    "Delete a calendar event",
    deleteEventSchema().shape,
    async (params) => {
      return await deleteEvent(params);
    }
  );

  server.tool(
    "calendar-list-calendars",
    "List all available calendars",
    listCalendarsSchema().shape,
    async (params) => {
      return await listCalendars(params);
    }
  );
}

// Start the server
async function main() {
  try {
    // Initialize calendar data on server start
    await initializeCalendarData();

    // Register calendar tools after initialization
    registerCalendarTools();

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Google MCP Server running...");
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

main().catch(console.error);
