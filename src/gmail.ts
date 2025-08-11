import { google } from "googleapis";
import { z } from "zod";

// Gmail schemas
export const sendEmailSchema = z.object({
  to: z.string().describe("Recipient email address"),
  subject: z.string().describe("Email subject"),
  body: z.string().describe("Email body content"),
  cc: z.string().optional().describe("CC email addresses (comma-separated)"),
  bcc: z.string().optional().describe("BCC email addresses (comma-separated)"),
});

export const readEmailsSchema = z.object({
  query: z
    .string()
    .optional()
    .describe(
      "Gmail search query (e.g., 'is:unread', 'from:example@gmail.com')"
    ),
  maxResults: z
    .number()
    .min(1)
    .max(100)
    .default(10)
    .describe("Maximum number of emails to return"),
  labelIds: z
    .array(z.string())
    .optional()
    .describe("Array of label IDs to filter by"),
});

export const getEmailSchema = z.object({
  messageId: z.string().describe("Gmail message ID"),
});

export const createLabelSchema = z.object({
  name: z.string().describe("Label name"),
  messageListVisibility: z
    .enum(["show", "hide"])
    .default("show")
    .describe("Message list visibility"),
  labelListVisibility: z
    .enum(["labelShow", "labelHide"])
    .default("labelShow")
    .describe("Label list visibility"),
});

// Markdown formatting helpers
function formatEmailListToMarkdown(emails: any[]): string {
  if (!emails.length) return "No emails found.";
  
  let markdown = `# Inbox (${emails.length} emails)\n\n`;
  
  emails.forEach((email, index) => {
    const date = new Date(email.date).toLocaleDateString();
    const from = email.from.replace(/[<>]/g, '');
    const subject = email.subject || '(No Subject)';
    const snippet = email.snippet || '';
    
    markdown += `## ${index + 1}. ${subject}\n`;
    markdown += `From: ${from}  \n`;
    markdown += `Date: ${date}  \n`;
    markdown += `ID: \`${email.id}\`\n\n`;
    
    if (snippet) {
      markdown += `${snippet}\n\n`;
    }
    
    markdown += `---\n\n`;
  });
  
  return markdown;
}

function formatEmailToMarkdown(email: any): string {
  const date = new Date(email.date).toLocaleDateString();
  const from = email.from.replace(/[<>]/g, '');
  const to = email.to.replace(/[<>]/g, '');
  const subject = email.subject || '(No Subject)';
  
  let markdown = `# ${subject}\n\n`;
  markdown += `From: ${from}  \n`;
  markdown += `To: ${to}  \n`;
  if (email.cc) markdown += `CC: ${email.cc.replace(/[<>]/g, '')}  \n`;
  if (email.bcc) markdown += `BCC: ${email.bcc.replace(/[<>]/g, '')}  \n`;
  markdown += `Date: ${date}  \n`;
  markdown += `Message ID: \`${email.id}\`\n\n`;
  
  if (email.body) {
    markdown += `---\n\n${email.body}\n`;
  }
  
  return markdown;
}

function formatLabelsToMarkdown(labels: any[]): string {
  if (!labels.length) return "No labels found.";
  
  let markdown = `# Gmail Labels (${labels.length})\n\n`;
  
  const systemLabels = labels.filter(label => label.type === 'system');
  const userLabels = labels.filter(label => label.type === 'user');
  
  if (systemLabels.length) {
    markdown += `## System Labels\n\n`;
    systemLabels.forEach(label => {
      markdown += `- ${label.name} (\`${label.id}\`)`;
      if (label.messagesUnread > 0) {
        markdown += ` - ${label.messagesUnread} unread`;
      }
      markdown += `\n`;
    });
    markdown += `\n`;
  }
  
  if (userLabels.length) {
    markdown += `## Custom Labels\n\n`;
    userLabels.forEach(label => {
      markdown += `- ${label.name} (\`${label.id}\`)`;
      if (label.messagesTotal) {
        markdown += ` - ${label.messagesTotal} total`;
        if (label.messagesUnread > 0) {
          markdown += `, ${label.messagesUnread} unread`;
        }
      }
      markdown += `\n`;
    });
  }
  
  return markdown;
}

// OAuth2 Authentication helper
function createGmailAuth() {
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

// Send email function
export async function sendEmail(params: z.infer<typeof sendEmailSchema>) {
  try {
    const auth = createGmailAuth();
    const gmail = google.gmail({ version: "v1", auth });

    // Create email content
    const email = [];
    email.push(`To: ${params.to}`);
    if (params.cc) email.push(`Cc: ${params.cc}`);
    if (params.bcc) email.push(`Bcc: ${params.bcc}`);
    email.push(`Subject: ${params.subject}`);
    email.push("");
    email.push(params.body);

    const rawEmail = Buffer.from(email.join("\n")).toString("base64url");

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: rawEmail,
      },
    });

    return {
      content: [
        {
          type: "text" as const,
          text: `# Email Sent Successfully ✅\n\nMessage ID: \`${response.data.id}\`  \nThread ID: \`${response.data.threadId}\`  \nTo: ${params.to}  \nSubject: ${params.subject}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error sending email: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}

// Read emails function
export async function readEmails(params: z.infer<typeof readEmailsSchema>) {
  try {
    const auth = createGmailAuth();
    const gmail = google.gmail({ version: "v1", auth });

    const listParams: any = {
      userId: "me",
      maxResults: params.maxResults,
    };

    if (params.query) listParams.q = params.query;
    if (params.labelIds) listParams.labelIds = params.labelIds;

    const response = await gmail.users.messages.list(listParams);

    if (!response.data.messages || response.data.messages.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "# No Emails Found\n\nNo emails found matching your search criteria.",
          },
        ],
      };
    }

    // Get detailed information for each message
    const emailDetails = await Promise.all(
      response.data.messages
        .slice(0, params.maxResults)
        .map(async (message) => {
          const detail = await gmail.users.messages.get({
            userId: "me",
            id: message.id!,
            format: "metadata",
            metadataHeaders: ["From", "To", "Subject", "Date"],
          });

          const headers = detail.data.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
              ?.value || "";

          return {
            id: message.id,
            threadId: message.threadId,
            from: getHeader("From"),
            to: getHeader("To"),
            subject: getHeader("Subject"),
            date: getHeader("Date"),
            snippet: detail.data.snippet,
            labelIds: detail.data.labelIds,
          };
        })
    );

    return {
      content: [
        {
          type: "text" as const,
          text: formatEmailListToMarkdown(emailDetails),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error reading emails: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}

// Get specific email function
export async function getEmail(params: z.infer<typeof getEmailSchema>) {
  try {
    const auth = createGmailAuth();
    const gmail = google.gmail({ version: "v1", auth });

    const response = await gmail.users.messages.get({
      userId: "me",
      id: params.messageId,
      format: "full",
    });

    const message = response.data;
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
        ?.value || "";

    // Extract body content
    let body = "";
    if (message.payload?.body?.data) {
      body = Buffer.from(message.payload.body.data, "base64").toString();
    } else if (message.payload?.parts) {
      // Handle multipart messages
      for (const part of message.payload.parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          body = Buffer.from(part.body.data, "base64").toString();
          break;
        }
      }
    }

    // Truncate body if it exceeds 30000 characters
    const truncatedBody =
      body.length > 20000
        ? body.substring(0, 20000) +
          "\n\n[Email body truncated - content too long]"
        : body;

    const emailDetail = {
      id: message.id,
      threadId: message.threadId,
      from: getHeader("From"),
      to: getHeader("To"),
      cc: getHeader("Cc"),
      bcc: getHeader("Bcc"),
      subject: getHeader("Subject"),
      date: getHeader("Date"),
      body: truncatedBody,
      snippet: message.snippet,
      labelIds: message.labelIds,
    };

    return {
      content: [
        {
          type: "text" as const,
          text: formatEmailToMarkdown(emailDetail),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error getting email: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}

// Get Gmail labels function
export async function getLabels() {
  try {
    const auth = createGmailAuth();
    const gmail = google.gmail({ version: "v1", auth });

    const response = await gmail.users.labels.list({
      userId: "me",
    });

    const labels = response.data.labels?.map((label) => ({
      id: label.id,
      name: label.name,
      type: label.type,
      messagesTotal: label.messagesTotal,
      messagesUnread: label.messagesUnread,
      threadsTotal: label.threadsTotal,
      threadsUnread: label.threadsUnread,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: formatLabelsToMarkdown(labels || []),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Error getting labels: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    };
  }
}
