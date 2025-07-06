"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeSlackChat = summarizeSlackChat;
const web_api_1 = require("@slack/web-api"); // Assuming you have the Slack Web API client installed
/**
 * This function handles the Mosaia tool call for summarizing Slack chats.
 * It fetches recent messages, sends them to an LLM for summarization into a table,
 * and then posts the summary back to the Slack channel.
 *
 * @param {object} payload - The payload received from the Mosaia agent,
 * containing context like channel ID and user ID.
 * @param {string} payload.channel_id - The ID of the Slack channel where the command was invoked.
 * @param {string} payload.user_id - The ID of the user who invoked the command.
 * @param {string} [payload.text] - Optional text provided with the command (e.g., number of messages to summarize).
 * @returns {Promise<void>}
 */
function summarizeSlackChat(payload) {
    return __awaiter(this, void 0, void 0, function* () {
        const { channel_id, user_id, text } = payload;
        // Initialize Slack WebClient with your bot token
        // Make sure your bot token has the necessary scopes (e.g., channels:history, chat:write)
        const slackToken = process.env.SLACK_BOT_TOKEN;
        if (!slackToken) {
            console.error('SLACK_BOT_TOKEN is not set in environment variables.');
            // In a real application, you might want to send an error message back to Slack
            return;
        }
        const web = new web_api_1.WebClient(slackToken);
        // Initialize Gemini API key
        // This key should be kept secure and not exposed client-side.
        const geminiApiKey = process.env.ENV_VAR_TWO || ""; // Canvas provides this automatically if empty
        // Determine how many messages to fetch (default to 50, or parse from user input)
        let limit = 50;
        if (text) {
            const parsedLimit = parseInt(text, 10);
            if (!isNaN(parsedLimit) && parsedLimit > 0 && parsedLimit <= 200) { // Max 200 messages to avoid excessively long prompts
                limit = parsedLimit;
            }
        }
        try {
            // 1. Fetch recent messages from the Slack channel
            const history = yield web.conversations.history({
                channel: channel_id,
                limit: limit,
                // You might want to add 'oldest' or 'latest' to filter by time if needed
            });
            if (!history.messages || history.messages.length === 0) {
                yield web.chat.postMessage({
                    channel: channel_id,
                    text: `No recent messages found in this channel to summarize.`,
                });
                return;
            }
            // Prepare messages for the LLM prompt
            // Filter out bot messages and format for clarity
            const chatMessages = history.messages
                .filter(msg => !msg.subtype && !msg.bot_id) // Exclude bot messages and certain message subtypes
                .map(msg => {
                // Replace user IDs with display names if possible (requires more Slack API calls or caching)
                // For simplicity, we'll use raw user IDs here.
                const userName = msg.user ? `<@${msg.user}>` : 'Unknown User';
                const messageText = msg.text || '';
                const timestamp = new Date(parseFloat(msg.ts) * 1000).toLocaleString(); // Convert Slack timestamp to readable date
                return `${userName} [${timestamp}]: ${messageText}`;
            })
                .reverse() // Reverse to get chronological order for summarization
                .join('\n');
            if (chatMessages.length === 0) {
                yield web.chat.postMessage({
                    channel: channel_id,
                    text: `No human messages found in the last ${limit} messages to summarize.`,
                });
                return;
            }
            // 2. Construct the prompt for the LLM
            const prompt = `Summarize the following Slack chat messages into a tabular JSON format.
    The table should have columns for 'Topic', 'Key Points' (as an array of strings), 'Participants' (as an array of user IDs or names), and 'Date Range' (e.g., "YYYY-MM-DD toYYYY-MM-DD").
    Focus on distinct topics or discussions. If there are multiple topics, provide multiple entries in the array.
    
    Chat Messages:
    \`\`\`
    ${chatMessages}
    \`\`\`
    
    Please provide the output as a JSON array of objects, strictly following this schema:
    [
      {
        "topic": "string",
        "key_points": ["string"],
        "participants": ["string"],
        "date_range": "string"
      }
    ]
    `;
            // 3. Call the Gemini API for summarization
            const chatHistory = []; // Use our custom interface here
            chatHistory.push({ role: "user", parts: [{ text: prompt }] });
            const payload = {
                contents: chatHistory,
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                "topic": { "type": "STRING" },
                                "key_points": {
                                    "type": "ARRAY",
                                    "items": { "type": "STRING" }
                                },
                                "participants": {
                                    "type": "ARRAY",
                                    "items": { "type": "STRING" }
                                },
                                "date_range": { "type": "STRING" }
                            },
                            "propertyOrdering": ["topic", "key_points", "participants", "date_range"]
                        }
                    }
                }
            };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
            const response = yield fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = yield response.json();
            let summarizedData = [];
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const jsonString = result.candidates[0].content.parts[0].text;
                try {
                    summarizedData = JSON.parse(jsonString);
                    // Ensure it's an array and its items match the interface
                    if (!Array.isArray(summarizedData) || !summarizedData.every(item => typeof item.topic === 'string' &&
                        Array.isArray(item.key_points) && item.key_points.every(kp => typeof kp === 'string') &&
                        Array.isArray(item.participants) && item.participants.every(p => typeof p === 'string') &&
                        typeof item.date_range === 'string')) {
                        throw new Error("Parsed JSON does not match expected schema.");
                    }
                }
                catch (parseError) {
                    console.error('Error parsing LLM response JSON:', parseError);
                    yield web.chat.postMessage({
                        channel: channel_id,
                        text: `I encountered an error processing the summary. The LLM response was not in the expected format.`,
                    });
                    return;
                }
            }
            else {
                console.error('LLM response was empty or malformed:', JSON.stringify(result, null, 2));
                yield web.chat.postMessage({
                    channel: channel_id,
                    text: `I couldn't generate a summary from the chat history. The LLM did not provide a valid response.`,
                });
                return;
            }
            if (summarizedData.length === 0) {
                yield web.chat.postMessage({
                    channel: channel_id,
                    text: `The LLM did not identify any distinct topics to summarize from the provided messages.`,
                });
                return;
            }
            // 4. Format the summary as a Slack-friendly table using Markdown
            let tableMarkdown = `*Summary of recent chat messages (${limit} messages):*\n\n`;
            tableMarkdown += `| Topic | Key Points | Participants | Date Range |\n`;
            tableMarkdown += `|---|---|---|---|\n`;
            summarizedData.forEach(entry => {
                const topic = entry.topic.replace(/\|/g, '\\|'); // Escape pipes in content
                const keyPoints = entry.key_points.map(kp => `- ${kp}`).join('\n').replace(/\|/g, '\\|');
                const participants = entry.participants.join(', ').replace(/\|/g, '\\|');
                const dateRange = entry.date_range.replace(/\|/g, '\\|');
                tableMarkdown += `| ${topic} | ${keyPoints} | ${participants} | ${dateRange} |\n`;
            });
            // 5. Send the summary back to Slack
            yield web.chat.postMessage({
                channel: channel_id,
                text: tableMarkdown, // Use 'text' for simple Markdown, or 'blocks' for more complex layouts
                // You can use the 'blocks' property for richer Slack messages, e.g.,
                // blocks: [
                //   {
                //     type: 'section',
                //     text: {
                //       type: 'mrkdwn',
                //       text: tableMarkdown,
                //     },
                //   },
                // ],
            });
            console.log(`Summary successfully posted to channel ${channel_id}`);
        }
        catch (error) {
            console.error('Error in summarizeSlackChat:', error);
            // Post an error message to Slack if something goes wrong
            yield web.chat.postMessage({
                channel: channel_id,
                text: `An error occurred while summarizing the chat: \`${error instanceof Error ? error.message : String(error)}\``,
            });
        }
    });
}
