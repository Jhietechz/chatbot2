require('dotenv').config();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");
console.log('Initializing AI Assistant...');

// --- API Credentials & Configuration ---
// --- In the Configuration section ---
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const SEARCH_ENGINE_ID = process.env.SEARCH_ENGINE_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Initialize the Google AI client
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const geminiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" }) : null; // Use Flash for speed & cost

const professionalData = {
    name: "Emmanuel",
    email: "emmanuelyegon513@gmail.com",
    portfolio: "https://github.com/Jhievirl1",
    linkedin: "https://linkedin.com/in/jhietech-profile",
    calendly: "https://calendly.com/jhietech1/30min",
    servicesSummary: "I specialize in full-stack web development, mobile applications, chatbot creation, and IT support."
};

// --- NEW: The Bot's "Brain" - A Knowledge Base ---
const knowledgeBase = {
    'languages': {
        keywords: ['what language', 'what languages', 'can you speak'],
        explanation: "I primarily communicate in *English*.\n\n" +
            "However, I can understand and respond to simple commands and greetings in other languages, such as *Swahili* (e.g., 'mambo', 'asante').\n\n" +
            `I know *${professionalData.name}* can. For complex topics and questions, English will provide the most accurate response.`
    },
    'identity': {
        keywords: ['who are you', 'who is this', 'who is the bot', 'who is you', 'what are you', 'your name', 'about yourself', 'about you'], // Keywords to trigger this response
        explanation: `I am an AI assistant, created by *${professionalData.name}* to help manage his communications and provide instant information.\n\n` +
            `I can answer questions on various tech topics, perform web searches for you, or provide ${professionalData.name}'s contact and scheduling details.\n\n` +
            `Just ask me a question or type 'help' to see a list of my main commands!`,
        // No 'example' needed for this topic
    },
    'mission': {
        keywords: ['mission', 'vision', 'purpose', 'goal'],
        explanation: `My primary mission is to act as a seamless extension of *${professionalData.name}*, providing instant, accurate, and helpful information to make your interaction as efficient as possible.\n\n` +
            `My vision is to demonstrate how AI can be a powerful and reliable partner in professional communication, bridging the gap between immediate needs and human availability.`
    },
    'api': {
        keywords: ['api', 'application programming interface'],
        explanation: "An *API (Application Programming Interface)* is like a restaurant menu. It lists a set of operations that a software system can perform, allowing other programs to interact with it without needing to know the internal details, just like you don't need to know how the kitchen works to order food.",
        example: "For example, when a weather app on your phone shows you the forecast, it's using an API to request that data from a weather service's server."
    },
    'javascript': {
        keywords: ['javascript', 'js'],
        explanation: "*JavaScript (JS)* is a programming language that makes websites interactive. If HTML is the skeleton of a webpage and CSS is the skin and clothes, JavaScript is the brain and muscles that allow it to move and react to you.",
        example: "Things like clickable buttons, pop-up forms, and dynamically updating content on a page are all typically powered by JavaScript."
    },
    'nodejs': {
        keywords: ['node.js', 'node', 'nodejs'],
        explanation: "*Node.js* is an environment that allows you to run JavaScript code on a server, outside of a web browser. This is what enables building fast and scalable back-end services, like APIs and web servers, using JavaScript.",
        example: `The very bot you're talking to right now is likely running on Node.js! It handles the server-side logic for receiving and responding to your messages.`
    },
    'python': {
        keywords: ['python'],
        explanation: "*Python* is a high-level, versatile programming language known for its simple, readable syntax. It's widely used in web development, data science, artificial intelligence, and automation.",
        example: "Major platforms like Instagram, Spotify, and Netflix use Python extensively in their back-end systems for its power and scalability."
    },
    'react': {
        keywords: ['react', 'reactjs'],
        explanation: "*React* is a popular JavaScript library for building user interfaces, particularly for single-page applications. It allows developers to create reusable UI components.",
        example: "The feed on Facebook and the interface of Instagram are built using React, allowing for fast and dynamic updates without reloading the entire page."
    },
    // Add more topics here!
};

// --- State Management & Cooldown ---
const userContext = {};
const lastOwnerMessageTimestamps = {};
const botSessionTimestamps = {};
const OWNER_COOL_DOWN_PERIOD = 10 * 1000; // 10 seconds
const BOT_SESSION_DURATION = 2 * 10 * 1000; // 2 minutes

// --- Command Aliases ---
const commandAliases = {
    'hi': 'greet', 'hello': 'greet', 'hey': 'greet', 'vipi': 'greet', 'mambo': 'greet', 'how are you': 'greet', 'Oyaah': 'greet', 'niaje': 'greet', 'rada': 'greet',
    'info': 'services', 'portfolio': 'services', 'what do you do': 'services',
    'email': 'contact', 'meeting': 'schedule', 'book a meeting': 'schedule',
    'commands': 'help',
    'repeat': 'repeat', 'retry': 'repeat', 'again': 'repeat', 'come up again': 'repeat'
};
async function performWebSearch(msg, query) {
    if (!GOOGLE_API_KEY || !SEARCH_ENGINE_ID) {
        // This check is important so the bot doesn't fail silently if keys are missing.
        console.error('Search API credentials are not configured in the .env file.');
        return msg.reply('Sorry, the web search function is not configured by the administrator.');
    }
    if (!query) {
        return msg.reply('A search query is required.');
    }

    const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}`;

    try {
        const response = await axios.get(apiUrl);
        const results = response.data.items;

        if (!results || results.length === 0) {
            return msg.reply(`Sorry, I couldn't find any web results for "*${query}*".`);
        }

        let replyMessage = `I found these web results for finding about "*${query}*":\n\n`;
        results.slice(0, 3).forEach((item, index) => {
            replyMessage += `*${index + 1}. ${item.title}*\n_${item.snippet.replace(/\n/g, '')}_\n${item.link}\n\n`;
        });
        await msg.reply(replyMessage);

    } catch (error) {
        console.error('Google Search API Error:', error.response ? error.response.data : error.message);
        await msg.reply('Sorry, I encountered an error while searching the web. The API may be temporarily unavailable or the daily query limit may have been reached.');
    }
}

// --- The Core Command Handler ---
const commands = {
    'greet': {
        description: 'A friendly and professional greeting.',
        execute: async (msg) => {
            const contact = await msg.getContact();
            const userName = contact.pushname || 'there';
            const currentHour = new Date().getHours();
            let greetingMessage;

            if (currentHour >= 5 && currentHour < 12) {
                greetingMessage = `☀️ Good morning, ${userName}!`;
            } else if (currentHour >= 12 && currentHour < 18) {
                greetingMessage = `🌤️ Good afternoon, ${userName}!`;
            } else { // Covers all evening/night scenarios
                greetingMessage = `🌙 Good evening, ${userName}!`;
            }
            await msg.reply(`${greetingMessage} This is ${professionalData.name}'s AI assistant. You can type 'help' to see what I can do.`);
        }
    },
    'services': {
        description: `Provides a summary of ${professionalData.name}'s services.`,
        execute: async (msg) => {
            const servicesMessage = `*Services & Portfolio for ${professionalData.name}*\n\n` +
                `*Summary:* ${professionalData.servicesSummary}\n\n` +
                `*Portfolio:* ${professionalData.portfolio}\n` +
                `*LinkedIn:* ${professionalData.linkedin}`;
            await msg.reply(servicesMessage);
        }
    },
    'contact': {
        description: `Provides ${professionalData.name}'s professional email.`,
        execute: async (msg) => {
            const contactMessage = `You can reach ${professionalData.name} via email for any professional inquiries:\n\n` +
                `📧 *${professionalData.email}*`;
            await msg.reply(contactMessage);
        }
    },
    'schedule': {
        description: 'Provides a link to schedule a meeting.',
        execute: async (msg) => {
            const scheduleMessage = `To schedule a meeting with ${professionalData.name}, please use the following link:\n\n` +
                `🗓️ *${professionalData.calendly}*`;
            await msg.reply(scheduleMessage);
        }
    },
    'time': {
        description: 'Displays the current server time.',
        execute: async (msg) => {
            const now = new Date();
            await msg.reply(`The current time here is: ${now.toLocaleTimeString()} (${now.toLocaleDateString()})`);
        }
    },
    'echo': { // Added echo to match help message
        description: 'Repeats your message back to you.',
        execute: async (msg, args) => {
            if (args.length > 0) {
                await msg.reply(args.join(' '));
            } else {
                await msg.reply('Please provide a message to echo. Usage: `echo <your message>`');
            }
        }
    },
    'random': {
        description: 'Picks a random item from a list.',
        execute: async (msg, args) => {
            const optionsString = args.join(' ');
            const options = optionsString.split(',').map(opt => opt.trim()).filter(Boolean);
            if (options.length < 2) {
                return msg.reply('Please provide at least two options separated by commas. Usage: `random option A, option B`');
            }
            const randomIndex = Math.floor(Math.random() * options.length);
            await msg.reply(`🤔 Out of: *${options.join(', ')}*...\nI choose: *${options[randomIndex]}*! ✨`);
        }
    },
    'search': {
        description: 'Searches the web for a specific query.',
        execute: async (msg, args) => {
            if (args.length === 0) {
                return msg.reply('Please provide something to search for. Usage: `search what is an API`');
            }
            const query = args.join(' ');
            // The command now just calls our reusable helper function.
            await performWebSearch(msg, query);
        }
    },
    'help': {
        description: 'Shows a list of primary commands.',
        execute: async (msg) => {
            const contact = await msg.getContact();
            const userName = contact.pushname || 'there';
            const helpMessage = `*Alright ${userName}, Here to help.*\n\n` +
                `Here are my primary functions. Just type the command word to get started:\n\n` +
                `*services*  - See what Emmanuel offers.\n` +
                `*contact*  - Get Emmanuel's professional email.\n` +
                `*schedule*  - Get a link to book a meeting.\n\n` +
                `For more advanced commands, type:  *more commands*`;

            await msg.reply(helpMessage);
        }
    },

    'more commands': {
        description: 'Shows a list of advanced commands.',
        execute: async (msg) => {
            const moreCommandsText = `*Advanced & Other Commands:*\n\n` +
                `*ask <question>*\n` +
                `_Ask the advanced JHIETECH AI anything (e.g., "ask what is a chatbot")._\n\n` +
                `*search <query>*\n` +
                `_Search the web for any topic (e.g., "search for young IT interprenuers in Kenya Today.")._\n\n` +
                `*repeat*\n` +
                `_Repeats the last command you successfully ran._\n\n` +
                `*time*\n` +
                `_Shows the current server time._`;
            await msg.reply(moreCommandsText);
        }
    },

    'repeat': {
        description: 'Repeats the last command you successfully executed.',
        execute: async (msg, args) => {
            const chatId = msg.from; // Or msg.id.remote for groups
            const context = userContext[chatId];

            if (context && context.lastCommand) {
                const { command, args: lastArgs } = context.lastCommand;
                console.log(`Repeating last command for ${chatId}: "${command}" with args [${lastArgs.join(', ')}]`);

                await msg.reply(`Sure, running the last command (*${command}*) again for you...`);
                // Re-execute the command using the stored data
                await commands[command].execute(msg, lastArgs);
            } else {
                await msg.reply("I don't have a previous command to repeat for you. Please issue a command first!");
            }
        }
    },
    'ask': {
        description: "Starts a continuous chat session with the advanced AI.",
        execute: async (msg, args) => {
            const chatId = (await msg.getChat()).id._serialized;

            // Initialize user context if it doesn't exist
            if (!userContext[chatId]) {
                userContext[chatId] = {};
            }

            userContext[chatId].isAiChatActive = true;
            // Start with a clean chat history each time a session is initiated
            userContext[chatId].aiChatHistory = [];

            await msg.reply("✅ You've started a new AI chat session.\n\n" +
                "I will now remember our conversation. All your messages will be sent directly to the Advanced JHIETECH AI.\n\n" +
                "To stop, just type *exit*.");
        }
    },
    'session': {
        description: 'Starts a 60-second interactive session for rapid commands.',
        execute: async (msg, args) => {
            const chatId = (await msg.getChat()).id._serialized;

            // Set the session timestamp for this user
            botSessionTimestamps[chatId] = Date.now();

            await msg.reply("✅ **Bot session activated for 2 minutes.**\n\nI will bypass the owner cooldown for your next few messages. You can now send commands like 'search' or 'ask' rapidly.");
        }
    },
    'exit': {
        description: 'Exits the continuous AI chat session.',
        execute: async (msg, args) => {
            const chatId = (await msg.getChat()).id._serialized;

            if (userContext[chatId]?.isAiChatActive) {
                delete userContext[chatId].isAiChatActive;
                delete userContext[chatId].aiChatHistory; // Clear the history
                await msg.reply("Exiting AI chat session. I am now back in my role as Emmanuel's assistant.\n\nType 'help' for my main functions.");
            } else {
                await msg.reply("You are not currently in an AI chat session. There is nothing to exit.");
            }
        }
    },
};

const client = new Client({ authStrategy: new LocalAuth() });

// --- Lifecycle Events ---
client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('authenticated', () => console.log('AI Assistant Authenticated!'));
client.on('ready', () => console.log('AI Assistant is ready!'));
client.on('disconnected', (reason) => console.log('Client was logged out', reason));

// --- Main Message Handler (Refined) ---
client.on('message', async msg => {
    const rawMessageBody = msg.body || '';
    if (!rawMessageBody) return;

    const chat = await msg.getChat();
    const chatId = chat.id._serialized;
    const isFromMe = msg.fromMe;
    const messageLowerCase = rawMessageBody.trim().toLowerCase();

    // 1. IGNORE ALL GROUP MESSAGES (No change needed)
    if (chat.isGroup) return;
    // --- NEW: PRIORITY 1.5 - DEDICATED AI CHAT MODE ---
    // If the user is in an active AI chat, handle it here and bypass everything else.
    if (userContext[chatId]?.isAiChatActive) {
        // The ONLY command that works in this mode is 'exit'
        if (messageLowerCase === 'exit') {
            await commands.exit.execute(msg); // Run the exit command
            return; // Stop processing
        }

        console.log(`[AI Chat] Sending message to Gemini for chat ${chatId}: "${rawMessageBody}"`);
        await chat.sendStateTyping();

        try {
            // Get the conversation history for this user
            const history = userContext[chatId].aiChatHistory || [];

            const chatSession = geminiModel.startChat({
                history: history,
                generationConfig: {
                    maxOutputTokens: 1000,
                },
            });

            const result = await chatSession.sendMessage(rawMessageBody);
            const response = result.response;
            const answer = response.text();

            await msg.reply(answer);

            // Update the history with the new user message and bot response
            userContext[chatId].aiChatHistory.push({ role: "user", parts: [{ text: rawMessageBody }] });
            userContext[chatId].aiChatHistory.push({ role: "model", parts: [{ text: answer }] });

        } catch (error) {
            console.error("Gemini AI Chat Error:", error);
            await msg.reply("I seem to have encountered an error in our conversation. You can try again or type *exit* to reset.");
        }

        // This message was handled by the AI, so we stop all further processing.
        return;
    }

    // --- PRIORITY 1.5: OWNER COOLDOWN LOGIC (REFINED & DEBUGGABLE) ---
    console.log(`\n--- New Message in Chat: ${chatId} (isFromMe: ${isFromMe}) ---`);

    if (isFromMe) {
        console.log('[Cooldown] Owner sent a message. Updating timestamp.');
        lastOwnerMessageTimestamps[chatId] = Date.now();
        // Also clear any active bot session for this chat
        if (botSessionTimestamps[chatId]) delete botSessionTimestamps[chatId];
        return;
    }

    // Check for an active bot session
    const lastBotReplyTimestamp = botSessionTimestamps[chatId];
    let isBotSessionActive = false;
    if (lastBotReplyTimestamp) {
        const timeSinceBotReply = Date.now() - lastBotReplyTimestamp;
        if (timeSinceBotReply < BOT_SESSION_DURATION) {
            isBotSessionActive = true;
        }
    }

    // Now, check the owner cooldown, but allow the bot to bypass it if a session is active.
    const lastOwnerTimestamp = lastOwnerMessageTimestamps[chatId];
    if (lastOwnerTimestamp && !isBotSessionActive) {
        const timeSinceOwnerReply = Date.now() - lastOwnerTimestamp;
        if (timeSinceOwnerReply < OWNER_COOL_DOWN_PERIOD) {
            console.log(`[Cooldown] Owner cooldown is ACTIVE and bot session has expired. Bot will not respond.`);
            return;
        }
    }

    // Log the decision
    if (isBotSessionActive) {
        console.log(`[Cooldown] Bot session is ACTIVE. Bypassing owner cooldown.`);
    } else {
        console.log(`[Cooldown] No active bot session. Proceeding normally.`);
    }
    await msg.react('↙️');
    await chat.sendStateTyping();
    let handled = false;

    // --- Message Processing Pipeline ---

    // 2. UNIFIED COMMAND PARSER (Now with Polite Request handling)
    let commandToExecute = null;
    let commandArgs = [];
    let isPoliteRequest = false;

    // A. Check for polite requests first
    const politeRequestStarters = ['can you', 'would you', 'could you', 'will you', 'may you', 'kindly'];
    let potentialCommandQuery = messageLowerCase;
    const politeMatch = messageLowerCase.match(new RegExp(`^(${politeRequestStarters.join('|')})\\s(.+)`, 'i'));
    if (politeMatch) {
        potentialCommandQuery = politeMatch[2].trim();
        isPoliteRequest = true;
    }

    // B. Parse the core query for a command
    const commandKeys = Object.keys(commands);
    // First, check for an exact match on the potential query
    if (commands[potentialCommandQuery]) {
        commandToExecute = potentialCommandQuery;
    } else { // Then, check for a keyword-prefix match
        for (const key of commandKeys) {
            if (potentialCommandQuery.startsWith(key + ' ')) {
                commandToExecute = key;
                // Correctly slice arguments from the *potentialCommandQuery*, not the original message
                commandArgs = potentialCommandQuery.slice(key.length + 1).split(/\s+/);
                break;
            }
        }
    }

    // C. Handle aliases on the original message as a final fallback
    if (!commandToExecute && commandAliases[messageLowerCase]) {
        commandToExecute = commandAliases[messageLowerCase];
    }

    if (commandToExecute) {
                // If a user issues a command, they are no longer in "Quiet Mode".
        if (userContext[chatId]?.isQuietMode) {
            delete userContext[chatId].isQuietMode;
            console.log(`[Quiet Mode] User issued a command. Deactivating quiet mode for chat ${chatId}.`);
        }
        if (isPoliteRequest) {
            const inquiry = commandArgs.length > 0 ? `*${commandArgs.join(' ')}*` : `that`;
            await msg.reply(`Of course, I can help you with ${inquiry}. One moment...`);
        }

        console.log(`Executing command: "${commandToExecute}" with args: [${commandArgs.join(', ')}]`);
        try {
            await commands[commandToExecute].execute(msg, commandArgs);

            // On successful execution, store this as the last command.
            if (commandToExecute !== 'repeat') {
                if (!userContext[chatId]) userContext[chatId] = {};
                userContext[chatId].lastCommand = {
                    command: commandToExecute,
                    args: commandArgs
                };
                console.log(`Stored last command for ${chatId}:`, userContext[chatId].lastCommand);
            }

        } catch (error) {
            console.error(`Error executing command "${commandToExecute}":`, error);
            await msg.reply('Sorry, an error occurred while running that command.');
        }
        handled = true;
        // We no longer clear the entire context, just the lastTopic if it exists
        if (userContext[chatId]?.lastTopic) delete userContext[chatId].lastTopic;

    }
    // 2.5. IDENTITY CHECK (Who are you?)
    if (!handled) {
        const identityKeywords = ['who are you', 'who is this', 'what are you'];
        if (identityKeywords.some(kw => messageLowerCase.includes(kw))) {
            console.log('Identity question detected. Responding with self-introduction.');
            await msg.reply(knowledgeBase.identity.explanation);
            handled = true;
            // We clear context because this question starts a new conversation thread.
            if (userContext[chatId]) delete userContext[chatId];
        }
    }
    //2.6. MISSION CHECK (What is your purpose?)
    if (!handled) {
        const missionKeywords = ['mission', 'vision', 'purpose', 'goal'];
        if (missionKeywords.some(kw => messageLowerCase.includes(kw))) {
            console.log('Mission/vision question detected. Responding with purpose.');
            await msg.reply(knowledgeBase.mission.explanation);
            handled = true;
            // Clear context as this is a foundational question
            if (userContext[chatId]) delete userContext[chatId];
        }
    }
    // 3. AI Knowledge & Context Check (The bot's "brain")
    if (!handled) {
        let foundInKB = false;
        for (const topic in knowledgeBase) {
            if (knowledgeBase[topic].keywords.some(kw => messageLowerCase.includes(kw))) {
                await msg.reply(knowledgeBase[topic].explanation);
                userContext[chatId] = { lastTopic: topic };
                foundInKB = true;
                handled = true;
                break;
            }
        }

        // B. If not found, check if it's a question for automatic web search
        if (!foundInKB) {
            const questionStarters = ['what is', 'what are', 'what\'s', 'who is', 'who are', 'who\'s', 'where is', 'where are', 'when is', 'why is', 'how to', 'how is', 'how do', 'which is', 'explain', 'define', 'how will', 'which is', 'explain', 'google', 'tell me about'];
            const questionRegex = new RegExp(`^(${questionStarters.join('|')})\\s(.+)`, 'i');
            const match = messageLowerCase.match(questionRegex);
            if (match) {
                const query = match[2].replace(/\?$/, '').trim();
                await msg.reply(`${professionalData.name} may not have a curated answer for that. I am here to help him inquire the web for "*${query}*"...`);
                await performWebSearch(msg, query);
                handled = true;
            }
        }

        // C. Contextual follow-ups ("example", "more details")
        if (!handled && userContext[chatId]?.lastTopic) {
            if (messageLowerCase.includes('example')) {
                await msg.reply(knowledgeBase[userContext[chatId].lastTopic].example || "I don't have a specific example for that.");
                handled = true;
            } else if (messageLowerCase.includes('more') || messageLowerCase.includes('details')) {
                await msg.reply(knowledgeBase[userContext[chatId].lastTopic].explanation);
                handled = true;
            }
        }
    }

    // 4. Conversational Checks (Acknowledgment, Appreciation, Parting)
    if (!handled) {
        const confusionKeywords = [
            "i don't understand", "i dont understand", "don't get it", "dont get it",
            "what do you mean", "what does that mean", "i'm confused", "im confused",
            "that makes no sense", "doesn't make sense"
        ];

        if (confusionKeywords.some(kw => messageLowerCase.includes(kw))) {
            console.log('User confusion detected. Offering help.');

            const apologyMessage = `I apologize if my last response was unclear. I'm still learning!\n\n` +
                `Perhaps we could try a different approach. You can:\n\n` +
                `• Ask me to *search* for a topic (e.g., "search for Node.js tutorials").\n` +
                `• Type *help* to see my main list of commands.`;

            await msg.reply(apologyMessage);

            // Clear any confusing context to start fresh
            if (userContext[chatId]) delete userContext[chatId];
            handled = true;
        }
    }

    if (!handled) {
        const acknowledgmentKeywords = ['okay', 'sure', 'yes', 'yeah', 'yep', 'poa', '👍', 'ok', 'sawa', 'got it', 'i see', 'alright', 'understood', 'cool', 'really', 'perfect'];
        const ackRegex = new RegExp(`^(${acknowledgmentKeywords.join('|')})[\\s.!]*$`);

        if (ackRegex.test(messageLowerCase)) {
            const context = userContext[chatId];
            await msg.reply(context?.lastTopic ? "Great! Let me know if you need more details." : "Alright! Feel free to ask if anything comes to mind.");
            if (context) delete userContext[chatId];
            handled = true;
        }
    }

    if (!handled) {
        const appreciationKeywords = ['thank you', 'thanks', 'asante', 'shukran', 'appreciated', 'nice one', 'awesome', 'fine', 'fantastic'];
        if (appreciationKeywords.some(kw => messageLowerCase.includes(kw))) {
            await msg.reply(`You're very welcome! Happy to help. 😊`);
            if (userContext[chatId]) delete userContext[chatId];
            handled = true;
        }
    }

    if (!handled) {
        const partingKeywords = ['good night', 'gud nite', 'gn', 'lala salama', 'bye bye', 'bye', 'goodbye',];
        if (partingKeywords.some(kw => messageLowerCase.includes(kw))) {
            console.log(`Parting keyword detected: "${messageLowerCase}"`);
            const partingReplies = [
                'Goodbye! Have a great day. 👋',
                'See you later!',
                'Bye! Feel free to reach out anytime.'
            ];
            // Give a specific reply for 'good night' vs. a general 'bye'
            if (messageLowerCase.includes('night')) {
                await msg.reply('Good night to you too! Sweet dreams. ✨');
            } else {
                await msg.reply(partingReplies[Math.floor(Math.random() * partingReplies.length)]);
            }

            if (userContext[chatId]) delete userContext[chatId]; // End of conversation, clear all context
            handled = true;
        }
    }
    // 7. Fallback as Emmanuel's Assistant (if nothing else handled the message)
   // 7. Fallback Logic (with Quiet Mode)
    const context = userContext[chatId] || {};
    
    // Check if the user is in "Quiet Mode"
    if (context.isQuietMode) {
        // If in quiet mode, we do nothing and let Emmanuel reply,
        // unless the user types a command, which will be caught by the command parser earlier.
        console.log(`[Quiet Mode] User is in quiet mode. Bot will remain silent.`);
        // We don't set handled=true, we just exit.
        return; 
    }
    
    if (!handled) {
        // This block is now only reached if the user is NOT in quiet mode and no other logic was triggered.
        const now = new Date();
        const hour = now.getHours();
        const isSleepTime = hour >= 23 || hour < 6;

        let fallbackMessage;
        if (isSleepTime) {
            fallbackMessage = `*Shhh...* 🌙\n\n` +
                `This is ${professionalData.name}'s AI assistant. He is likely asleep.\n\n` +
                `Your message has been noted for him to see in the morning. If you need my help for anything, please start your next message with one of my commands (type 'help' to see them).`;
        } else {
            fallbackMessage = `Hello! I'm *${professionalData.name}'s* AI assistant.\n\n` +
                `He's currently unavailable but will respond to your message as soon as possible.\n\n` +
                `In the meantime, you can ask me questions about technology or type *session* to prioritize my session. Do this to avoid interruption.`;
        }
        await msg.reply(fallbackMessage);

        // --- KEY ADDITION: Set the user's state to "Quiet Mode" ---
        if (!userContext[chatId]) userContext[chatId] = {};
        userContext[chatId].isQuietMode = true;
        console.log(`[Quiet Mode] Set quiet mode for chat ${chatId}.`);
        
        handled = true; // Mark as handled
        if (context.lastTopic) delete context.lastTopic; // Clean up old context
    }
    if (handled) {
        // When the bot replies, it only sets the main owner cooldown.
        // The user must explicitly type 'session' to activate the session bypass.
        lastOwnerMessageTimestamps[chatId] = Date.now();
        console.log(`[Cooldown] Bot has replied. Owner activity timestamp updated for chat ${chatId}.`);
    }
});

client.initialize();