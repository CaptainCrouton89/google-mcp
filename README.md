# Google MCP Server

A comprehensive Model Context Protocol (MCP) server that provides access to Google services including Maps, Finance, Flights, Gmail, and Calendar through a unified API.

<a href="https://glama.ai/mcp/servers/@CaptainCrouton89/maps-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@CaptainCrouton89/maps-mcp/badge" alt="Server Boilerplate MCP server" />
</a>

## Features

### 🗺️ Google Maps & Places
- **Geocoding**: Convert addresses to coordinates and vice versa
- **Places Search**: Find businesses, landmarks, and points of interest
- **Directions**: Get turn-by-turn directions between locations
- **Distance Matrix**: Calculate travel time and distance between multiple points
- **Place Details**: Get detailed information about specific places

### 📈 Google Finance
- **Stock Search**: Search for stocks, indices, mutual funds, currencies, and futures
- **Market Data**: Get current prices, movement, and market information
- **Financial News**: Access top financial news related to securities

### ✈️ Google Flights
- **Airport Search**: Find flights and airport information
- **Flight Pricing**: Get flight prices and insights
- **Multi-city Trips**: Support for complex multi-destination journeys

### 📧 Gmail
- **Send Emails**: Send emails with subject, body, CC, and BCC
- **Read Emails**: List and search emails with Gmail query syntax
- **Email Details**: Get full email content by message ID
- **Label Management**: Access Gmail labels and organization

### 📅 Google Calendar
- **Event Management**: Create, read, update, and delete calendar events
- **Multi-Calendar Support**: Work with multiple calendars (Personal, Work, Travel)
- **Event Listing**: List events with filters and date ranges
- **Calendar Management**: List and access different calendars

## Installation

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm

### Setup
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd google-mcp
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the project:
   ```bash
   pnpm run build
   ```

### MCP Client Integration

Install the server to your preferred MCP clients:

```bash
# Install to all MCP clients
pnpm run install-server

# Install to specific clients
pnpm run install-desktop    # Claude Desktop
pnpm run install-cursor     # Cursor IDE
pnpm run install-code       # Claude Code
pnpm run install-mcp        # Local .mcp.json only
```

## Configuration

### Environment Variables
Create a `.env.local` file in the project root with your Google API credentials:

```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
GOOGLE_CLIENT_ID=your_oauth_client_id
GOOGLE_CLIENT_SECRET=your_oauth_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
```

### Google API Setup
1. **Google Maps API**: Enable Maps, Places, and Directions APIs in Google Cloud Console
2. **Gmail/Calendar**: Set up OAuth 2.0 credentials and obtain refresh tokens
3. **Finance/Flights**: Uses Google's public APIs (no additional setup required)

## Usage

### Running the Server
```bash
# Start the compiled server
pnpm start

# Or run in development mode
node dist/index.js
```

### Available Tools

#### Maps & Places
- `geocode` - Convert address to coordinates
- `reverse-geocode` - Convert coordinates to address  
- `places-search` - Search for places by text query
- `get-directions` - Get directions between locations
- `distance-matrix` - Calculate distances between multiple points
- `place-details` - Get detailed place information

#### Finance
- `finance-search` - Search stocks, currencies, and financial instruments

#### Flights
- `airports-search` - Search flights and airport information

#### Gmail
- `gmail-send-email` - Send emails
- `gmail-read-emails` - List/search emails
- `gmail-get-email` - Get specific email by ID
- `gmail-get-labels` - List Gmail labels

#### Calendar
- `calendar-create-event` - Create new events
- `calendar-list-events` - List events with filters
- `calendar-get-event` - Get specific event details
- `calendar-update-event` - Update existing events
- `calendar-delete-event` - Delete events
- `calendar-list-calendars` - List available calendars

## Development

### Project Structure
```
src/
├── index.ts       # Main MCP server implementation
├── maps.ts        # Google Maps & Places functionality
├── finance.ts     # Google Finance integration
├── airports.ts    # Google Flights integration  
├── gmail.ts       # Gmail API integration
└── calendar.ts    # Google Calendar integration

scripts/
└── update-config.js   # MCP client configuration installer

dist/             # Compiled JavaScript output
```

### Key Technologies
- **MCP SDK**: `@modelcontextprotocol/sdk` for protocol implementation
- **Schema Validation**: Zod for runtime type checking
- **Google APIs**: Official Google client libraries
- **TypeScript**: Full type safety with ES2022 target
- **Transport**: StdioServerTransport for MCP communication

### Development Workflow
1. Make changes to TypeScript files in `src/`
2. Build: `pnpm run build`
3. Test: `pnpm start`
4. Install to clients: `pnpm run install-server`
5. Restart MCP clients to load changes

### Adding New Tools
1. Define Zod schema for parameters
2. Implement handler function
3. Register tool in `src/index.ts` using `server.tool()`
4. Build and reinstall to test

## Architecture

This MCP server follows these design patterns:

- **Modular Design**: Each Google service is in its own module
- **Schema Validation**: All parameters validated with Zod schemas
- **Error Handling**: Comprehensive error handling with meaningful messages
- **Type Safety**: Full TypeScript coverage with strict mode
- **Transport Agnostic**: Uses MCP's standard transport layer

## License

[License information]

## Contributing

[Contribution guidelines]