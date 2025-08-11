import { google } from "googleapis";
import { z } from "zod";

// Dynamic calendar data that gets populated on server start
let availableCalendars: Array<{ id: string; summary: string }> = [];
let systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Markdown formatting helpers
function formatEventToMarkdown(event: any): string {
  let markdown = `# ${event.summary || 'Untitled Event'}\n\n`;
  
  if (event.description) markdown += `${event.description}\n\n`;
  
  const startDate = event.start?.dateTime ? new Date(event.start.dateTime) : null;
  const endDate = event.end?.dateTime ? new Date(event.end.dateTime) : null;
  
  if (startDate) {
    markdown += `Start: ${startDate.toLocaleString()}  \n`;
  }
  if (endDate) {
    markdown += `End: ${endDate.toLocaleString()}  \n`;
  }
  
  if (event.location) markdown += `Location: ${event.location}  \n`;
  
  if (event.attendees && event.attendees.length > 0) {
    markdown += `Attendees: ${event.attendees.map((a: any) => {
      let attendee = a.email || a;
      if (a.responseStatus) {
        const status = a.responseStatus === 'accepted' ? '✅' : 
                     a.responseStatus === 'declined' ? '❌' : 
                     a.responseStatus === 'tentative' ? '❓' : '⏳';
        attendee += ` ${status}`;
      }
      return attendee;
    }).join(', ')}  \n`;
  }
  
  if (event.htmlLink) markdown += `Calendar Link: [View Event](${event.htmlLink})  \n`;
  if (event.id) markdown += `Event ID: \`${event.id}\`  \n`;
  
  return markdown;
}

function formatEventListToMarkdown(events: any[], totalResults: number): string {
  if (!events.length) return "# No Upcoming Events\n\nNo events found in the specified time range.";
  
  let markdown = `# Upcoming Events (${totalResults})\n\n`;
  
  events.forEach((event, index) => {
    const startDate = event.start?.dateTime ? new Date(event.start.dateTime) : null;
    const endDate = event.end?.dateTime ? new Date(event.end.dateTime) : null;
    
    markdown += `## ${index + 1}. ${event.summary || 'Untitled Event'}\n`;
    
    if (startDate) {
      if (endDate && startDate.toDateString() === endDate.toDateString()) {
        // Same day event
        markdown += `When: ${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString()} - ${endDate.toLocaleTimeString()}  \n`;
      } else {
        markdown += `Start: ${startDate.toLocaleString()}  \n`;
        if (endDate) markdown += `End: ${endDate.toLocaleString()}  \n`;
      }
    }
    
    if (event.location) markdown += `Location: ${event.location}  \n`;
    if (event.description) markdown += `Description: ${event.description}  \n`;
    if (event.attendees && event.attendees.length > 0) {
      markdown += `Attendees: ${event.attendees.length} people  \n`;
    }
    if (event.id) markdown += `ID: \`${event.id}\`  \n`;
    
    markdown += `\n---\n\n`;
  });
  
  return markdown;
}

function formatCalendarsToMarkdown(calendars: any[]): string {
  if (!calendars.length) return "No calendars found.";
  
  let markdown = `# Available Calendars (${calendars.length})\n\n`;
  
  calendars.forEach((cal, index) => {
    markdown += `## ${index + 1}. ${cal.summary || cal.id}\n`;
    markdown += `ID: \`${cal.id}\`  \n`;
    if (cal.description) markdown += `Description: ${cal.description}  \n`;
    if (cal.timeZone) markdown += `Time Zone: ${cal.timeZone}  \n`;
    if (cal.accessRole) markdown += `Access: ${cal.accessRole}  \n`;
    if (cal.primary) markdown += `Primary: Yes ⭐  \n`;
    markdown += `\n`;
  });
  
  return markdown;
}

// Function to initialize calendar data
export async function initializeCalendarData() {
  try {
    const auth = createCalendarAuth();
    const calendar = google.calendar({ version: "v3", auth });

    const response = await calendar.calendarList.list({ maxResults: 50 });
    availableCalendars =
      response.data.items?.map((cal) => ({
        id: cal.id || "",
        summary: cal.summary || cal.id || "",
      })) || [];

    // Loaded ${availableCalendars.length} calendars
  } catch (error) {
    console.warn(
      "Could not load calendars:",
      error instanceof Error ? error.message : String(error)
    );
    // Fallback to primary calendar
    availableCalendars = [{ id: "primary", summary: "Primary Calendar" }];
  }
}

// Helper function to get calendar description
function getCalendarDescription() {
  if (availableCalendars.length === 0) {
    return "Calendar ID - Options: 'primary' (your main calendar), a specific calendar ID like 'john.doe@gmail.com', or a shared calendar ID";
  }

  const calendarOptions = availableCalendars
    .map((cal) => `'${cal.id}' (${cal.summary})`)
    .join(", ");

  return `Calendar ID - Available options: ${calendarOptions}`;
}

// Calendar schemas - these are created as functions to capture dynamic data
export const createEventSchema = () =>
  z.object({
    summary: z.string().describe("Event title/summary"),
    description: z.string().optional().describe("Event description"),
    location: z.string().optional().describe("Event location"),
    startDateTime: z
      .string()
      .describe(
        "Start date/time in ISO format (e.g., '2025-01-15T09:00:00-07:00')"
      ),
    endDateTime: z
      .string()
      .describe(
        "End date/time in ISO format (e.g., '2025-01-15T10:00:00-07:00')"
      ),
    attendees: z
      .array(z.string())
      .optional()
      .describe("Array of attendee email addresses"),
    calendarId: z
      .string()
      .default("primary")
      .describe(getCalendarDescription()),
    timeZone: z
      .string()
      .optional()
      .describe(
        `Time zone - defaults to local time (${systemTimezone}). Examples: 'America/New_York', 'Europe/London', 'Asia/Tokyo'`
      ),
  });

export const listEventsSchema = () =>
  z.object({
    calendarId: z
      .string()
      .default("primary")
      .describe(getCalendarDescription()),
    timeMin: z
      .string()
      .optional()
      .describe("Lower bound for event start time (ISO format)"),
    timeMax: z
      .string()
      .optional()
      .describe("Upper bound for event start time (ISO format)"),
    maxResults: z
      .number()
      .min(1)
      .max(250)
      .default(10)
      .describe("Maximum number of events to return"),
    singleEvents: z
      .boolean()
      .default(true)
      .describe("Whether to expand recurring events"),
    orderBy: z
      .enum(["startTime", "updated"])
      .default("startTime")
      .describe("Order of events"),
  });

export const getEventSchema = () =>
  z.object({
    eventId: z.string().describe("Event ID"),
    calendarId: z
      .string()
      .default("primary")
      .describe(getCalendarDescription()),
  });

export const updateEventSchema = () =>
  z.object({
    eventId: z.string().describe("Event ID"),
    calendarId: z
      .string()
      .default("primary")
      .describe(getCalendarDescription()),
    summary: z.string().optional().describe("Event title/summary"),
    description: z.string().optional().describe("Event description"),
    location: z.string().optional().describe("Event location"),
    startDateTime: z
      .string()
      .optional()
      .describe("Start date/time in ISO format"),
    endDateTime: z.string().optional().describe("End date/time in ISO format"),
    attendees: z
      .array(z.string())
      .optional()
      .describe("Array of attendee email addresses"),
  });

export const deleteEventSchema = () =>
  z.object({
    eventId: z.string().describe("Event ID"),
    calendarId: z
      .string()
      .default("primary")
      .describe(getCalendarDescription()),
  });

export const listCalendarsSchema = () =>
  z.object({
    maxResults: z
      .number()
      .min(1)
      .max(250)
      .default(10)
      .describe("Maximum number of calendars to return"),
  });

// OAuth2 Authentication helper
function createCalendarAuth() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2callback";

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required. Run oauth-setup.js to configure."
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!accessToken || !refreshToken) {
    throw new Error("OAuth2 tokens missing. Run oauth-setup.js to get tokens.");
  }

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

// Create event function
export async function createEvent(
  params: z.infer<ReturnType<typeof createEventSchema>>
) {
  try {
    const auth = createCalendarAuth();
    const calendar = google.calendar({ version: "v3", auth });

    const event: any = {
      summary: params.summary,
      description: params.description,
      location: params.location,
      start: {
        dateTime: params.startDateTime,
        timeZone: params.timeZone,
      },
      end: {
        dateTime: params.endDateTime,
        timeZone: params.timeZone,
      },
    };

    if (params.attendees && params.attendees.length > 0) {
      event.attendees = params.attendees.map((email) => ({ email }));
    }

    const response = await calendar.events.insert({
      calendarId: params.calendarId,
      requestBody: event,
      sendUpdates: "all", // Send invitations to attendees
    });

    const eventData = {
      id: response.data.id,
      summary: response.data.summary,
      start: response.data.start,
      end: response.data.end,
      location: response.data.location,
      description: response.data.description,
      attendees: response.data.attendees,
      htmlLink: response.data.htmlLink,
    };

    return {
      content: [
        {
          type: "text" as const,
          text: `# Event Created Successfully ✅\n\n${formatEventToMarkdown(eventData)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error creating event: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}

// List events function
export async function listEvents(
  params: z.infer<ReturnType<typeof listEventsSchema>>
) {
  try {
    const auth = createCalendarAuth();
    const calendar = google.calendar({ version: "v3", auth });

    const listParams: any = {
      calendarId: params.calendarId,
      maxResults: params.maxResults,
      singleEvents: params.singleEvents,
      orderBy: params.orderBy,
    };

    if (params.timeMin) listParams.timeMin = params.timeMin;
    if (params.timeMax) listParams.timeMax = params.timeMax;

    // If no timeMin is specified, default to current time
    if (!params.timeMin) {
      listParams.timeMin = new Date().toISOString();
    }

    const response = await calendar.events.list(listParams);

    const events = response.data.items?.map((event) => ({
      id: event.id,
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: event.start,
      end: event.end,
      attendees: event.attendees?.map((a) => ({
        email: a.email,
        responseStatus: a.responseStatus,
      })),
      htmlLink: event.htmlLink,
      status: event.status,
      created: event.created,
      updated: event.updated,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: formatEventListToMarkdown(events || [], events?.length || 0),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error listing events: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}

// Get specific event function
export async function getEvent(
  params: z.infer<ReturnType<typeof getEventSchema>>
) {
  try {
    const auth = createCalendarAuth();
    const calendar = google.calendar({ version: "v3", auth });

    const response = await calendar.events.get({
      calendarId: params.calendarId,
      eventId: params.eventId,
    });

    const event = response.data;
    const eventDetail = {
      id: event.id,
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: event.start,
      end: event.end,
      attendees: event.attendees?.map((a) => ({
        email: a.email,
        displayName: a.displayName,
        responseStatus: a.responseStatus,
      })),
      creator: event.creator,
      organizer: event.organizer,
      htmlLink: event.htmlLink,
      status: event.status,
      created: event.created,
      updated: event.updated,
      recurrence: event.recurrence,
    };

    return {
      content: [
        {
          type: "text" as const,
          text: formatEventToMarkdown(eventDetail),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error getting event: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}

// Update event function
export async function updateEvent(
  params: z.infer<ReturnType<typeof updateEventSchema>>
) {
  try {
    const auth = createCalendarAuth();
    const calendar = google.calendar({ version: "v3", auth });

    // First get the existing event
    const existingEvent = await calendar.events.get({
      calendarId: params.calendarId,
      eventId: params.eventId,
    });

    const updatedEvent: any = { ...existingEvent.data };

    // Update only the provided fields
    if (params.summary !== undefined) updatedEvent.summary = params.summary;
    if (params.description !== undefined)
      updatedEvent.description = params.description;
    if (params.location !== undefined) updatedEvent.location = params.location;
    if (params.startDateTime !== undefined) {
      updatedEvent.start = {
        ...updatedEvent.start,
        dateTime: params.startDateTime,
      };
    }
    if (params.endDateTime !== undefined) {
      updatedEvent.end = { ...updatedEvent.end, dateTime: params.endDateTime };
    }
    if (params.attendees !== undefined) {
      updatedEvent.attendees = params.attendees.map((email) => ({ email }));
    }

    const response = await calendar.events.update({
      calendarId: params.calendarId,
      eventId: params.eventId,
      requestBody: updatedEvent,
      sendUpdates: "all",
    });

    const updatedEventData = {
      id: response.data.id,
      summary: response.data.summary,
      start: response.data.start,
      end: response.data.end,
      location: response.data.location,
      description: response.data.description,
      attendees: response.data.attendees,
      htmlLink: response.data.htmlLink,
      updated: response.data.updated,
    };

    return {
      content: [
        {
          type: "text" as const,
          text: `# Event Updated Successfully ✅\n\n${formatEventToMarkdown(updatedEventData)}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error updating event: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}

// Delete event function
export async function deleteEvent(
  params: z.infer<ReturnType<typeof deleteEventSchema>>
) {
  try {
    const auth = createCalendarAuth();
    const calendar = google.calendar({ version: "v3", auth });

    await calendar.events.delete({
      calendarId: params.calendarId,
      eventId: params.eventId,
      sendUpdates: "all",
    });

    return {
      content: [
        {
          type: "text" as const,
          text: `# Event Deleted Successfully ✅\n\nEvent \`${params.eventId}\` has been deleted from your calendar.`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error deleting event: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}

// List calendars function
export async function listCalendars(
  params: z.infer<ReturnType<typeof listCalendarsSchema>>
) {
  try {
    const auth = createCalendarAuth();
    const calendar = google.calendar({ version: "v3", auth });

    const response = await calendar.calendarList.list({
      maxResults: params.maxResults,
    });

    const calendars = response.data.items?.map((cal) => ({
      id: cal.id,
      summary: cal.summary,
      description: cal.description,
      timeZone: cal.timeZone,
      accessRole: cal.accessRole,
      primary: cal.primary,
      backgroundColor: cal.backgroundColor,
      foregroundColor: cal.foregroundColor,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: formatCalendarsToMarkdown(calendars || []),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error listing calendars: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}
