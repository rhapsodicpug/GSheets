import { WebClient } from '@slack/web-api';
import { google } from 'googleapis';

/**
 * Get the current user's ID using the Slack API
 * @param slackToken - The Slack bot token
 * @returns Promise with user ID and username
 */
export async function getCurrentUserInfo(slackToken: string): Promise<{ user_id: string; username: string }> {
  const web = new WebClient(slackToken);
  
  try {
    const authTest = await web.auth.test();
    return {
      user_id: authTest.user_id!,
      username: authTest.user!
    };
  } catch (error) {
    console.error('Error getting user info:', error);
    throw new Error('Failed to get current user information from Slack');
  }
}

/**
 * This function handles the Mosaia tool call for fetching Slack chat history.
 * It fetches recent messages and posts them back to the Slack channel.
 *
 * @param {object} payload - The payload received from the Mosaia agent,
 * containing context like channel ID and user ID.
 * @param {string} payload.channel_id - The ID of the Slack channel to fetch messages from.
 * @param {string} payload.user_id - The ID of the user who invoked the command.
 * @param {string} [payload.text] - Optional text provided with the command (e.g., number of messages to fetch).
 * @returns {Promise<any>}
 */
export async function summarizeSlackChat(payload: { channel_id: string; user_id: string; text: string; secrets: { SLACK_BOT_TOKEN: string } }): Promise<any> {
  console.log('=== TOOL CALL STARTED ===');
  console.log('Payload received:', JSON.stringify(payload, null, 2));
  
  const { channel_id, user_id, text, secrets } = payload;

  // Validate required parameters
  if (!channel_id) {
    console.error('Missing channel_id parameter');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'channel_id is required' })
    };
  }

  if (!user_id) {
    console.error('Missing user_id parameter');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'user_id is required' })
    };
  }

  // Initialize Slack WebClient with your bot token from secrets
  const slackToken = secrets.SLACK_BOT_TOKEN;
  console.log('Slack token available:', !!slackToken);
  
  if (!slackToken) {
    console.error('SLACK_BOT_TOKEN is not set in secrets.');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Slack token not configured. Please set SLACK_BOT_TOKEN in Mosaia dashboard.' })
    };
  }
  
  const web = new WebClient(slackToken);

  // Determine how many messages to fetch (default to 50, or parse from user input)
  let limit = 50;
  if (text && text.trim() !== '') {
    const parsedLimit = parseInt(text, 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 200) {
      limit = parsedLimit;
    }
  }

  console.log(`Fetching ${limit} messages from channel: ${channel_id}`);

  try {
    // Fetch recent messages from the Slack channel
    const history = await web.conversations.history({
      channel: channel_id,
      limit: limit,
    });

    console.log(`Fetched ${history.messages?.length || 0} messages from Slack`);

    if (!history.messages || history.messages.length === 0) {
      console.log('No messages found, posting empty message to Slack');
      
      await web.chat.postMessage({
        channel: channel_id,
        text: `No recent messages found in this channel.`
      });
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'No recent messages found in this channel.',
          messages: []
        })
      };
    }

    // Format messages for Slack display
    const formattedMessages = history.messages.map(msg => {
        const userName = msg.user ? `<@${msg.user}>` : 'Unknown User';
        const messageText = msg.text || '';
      const timestamp = msg.ts ? new Date(parseFloat(msg.ts) * 1000).toLocaleString() : '';
      
      return `*${userName}* [${timestamp}]: ${messageText}`;
    });

    // Create the message to post back to Slack
    const messageText = `*Chat History (${formattedMessages.length} messages):*\n\n${formattedMessages.join('\n\n')}`;

    console.log('Posting message back to Slack...');

    // Post the chat history back to the Slack channel
    const postResult = await web.chat.postMessage({
            channel: channel_id,
      text: messageText,
      unfurl_links: false,
      unfurl_media: false
    });

    console.log('Message posted successfully:', postResult.ok);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully posted ${formattedMessages.length} messages back to Slack channel.`,
        channel_id: channel_id,
        message_count: formattedMessages.length,
        slack_response: postResult.ok
      })
    };

  } catch (error) {
    console.error('Error fetching or posting Slack messages:', error);
    
    let errorMessage = 'An unknown error occurred while processing messages.';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    // Try to post error message to Slack
    try {
      await web.chat.postMessage({
        channel: channel_id,
        text: `❌ Error: ${errorMessage}`
      });
    } catch (postError) {
      console.error('Failed to post error message to Slack:', postError);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : 'No stack trace available'
      })
    };
  }
}

/**
 * Writes a summary or data to a specified Google Sheet and range.
 * @param payload - Contains sheet_id, range, summary, and secrets (GOOGLE_SERVICE_ACCOUNT_KEY)
 */
export async function writeToGoogleSheet(payload: { sheet_id: string; range: string; summary: string; secrets: { GOOGLE_SERVICE_ACCOUNT_KEY: string } }): Promise<any> {
  console.log('=== GOOGLE SHEETS TOOL CALL STARTED ===');
  console.log('Payload received:', JSON.stringify(payload, null, 2));

  const { sheet_id, range, summary, secrets } = payload;

  // Validate required parameters
  if (!sheet_id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'sheet_id is required' })
    };
  }
  if (!range) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'range is required' })
    };
  }
  if (!summary) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'summary is required' })
    };
  }
  const serviceAccountKey = secrets.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Google service account key not configured. Please set GOOGLE_SERVICE_ACCOUNT_KEY in Mosaia dashboard.' })
    };
  }

  let credentials;
  try {
    credentials = JSON.parse(serviceAccountKey);
    // Fix for escaped newlines in .env
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    // Debug log
    console.log('Loaded credentials:', credentials);
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Invalid GOOGLE_SERVICE_ACCOUNT_KEY format. Must be valid JSON.' })
    };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Write the summary to the specified range
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: sheet_id,
      range: range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[summary]]
      }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully wrote summary to Google Sheet.',
        updatedRange: response.data.updatedRange
      })
    };
  } catch (error) {
    console.error('Error writing to Google Sheet:', error);
    let errorMessage = 'An unknown error occurred while writing to Google Sheets.';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    console.error('Google Sheets error message:', errorMessage);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: errorMessage })
    };
  }
}

// Future enhancement: Automatic sheet creation and permission handling
export async function createSheetIfNotExists(sheetId: string, title: string = "Mosaia Summary Sheet", serviceAccountKey: string): Promise<string> {
  try {
    const credentials = JSON.parse(serviceAccountKey);
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Try to access the sheet first
    await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    return sheetId; // Sheet exists, return the ID
  } catch (error) {
    // Sheet doesn't exist, create it
    console.log(`Sheet ${sheetId} not found, creating new sheet: ${title}`);
    
    const credentials = JSON.parse(serviceAccountKey);
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    
    const resource = {
      properties: {
        title: title
      },
      sheets: [
        {
          properties: {
            title: "Sheet1"
          }
        }
      ]
    };

    const response = await sheets.spreadsheets.create({ requestBody: resource });
    const newSheetId = response.data.spreadsheetId;
    
    console.log(`Created new sheet with ID: ${newSheetId}`);
    return newSheetId || sheetId;
  }
}

// Future enhancement: OAuth flow for automatic permissions
export async function requestSheetPermissions(sheetId: string): Promise<boolean> {
  // This would implement OAuth 2.0 flow to request user permission
  // For now, this is a placeholder for future implementation
  console.log(`Would request permissions for sheet: ${sheetId}`);
  return false;
}

// Future enhancement: List available sheets
export async function listAvailableSheets(serviceAccountKey: string): Promise<Array<{id: string | null | undefined, name: string | null | undefined, link: string | null | undefined}>> {
  try {
    const credentials = JSON.parse(serviceAccountKey);
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    
    const drive = google.drive({ version: 'v3', auth });
    
    // Search for Google Sheets files
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id,name,webViewLink)',
      pageSize: 10
    });
    
    return response.data.files?.map(file => ({
      id: file.id,
      name: file.name,
      link: file.webViewLink
    })) || [];
  } catch (error) {
    console.error('Error listing sheets:', error);
    return [];
  }
}
