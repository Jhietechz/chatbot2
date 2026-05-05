# WhatsApp AI Chatbot

An AI-powered WhatsApp chatbot that leverages Google Gemini and OpenAI for intelligent, context-aware conversations. Built with Node.js and whatsapp-web.js, it can answer questions, perform web searches, and provide professional contact and scheduling information.

## Features
- WhatsApp integration using whatsapp-web.js
- AI responses via Google Gemini and OpenAI
- Web search capability (Google Custom Search API)
- Professional contact, portfolio, and scheduling info
- Knowledge base for common tech topics

## Requirements
- Node.js (v18+ recommended)
- WhatsApp account (for QR login)
- Google Gemini API key (GEMINI_API_KEY)
- Google Custom Search API key (GOOGLE_API_KEY) and Search Engine ID (SEARCH_ENGINE_ID)
- (Optional) OpenAI API key (OPENAI_API_KEY)

## Setup
1. Clone the repository:
   ```sh
   git clone <repo-url>
   cd whatsapp-bot
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Create a `.env` file in the root directory and add:
   ```env
   GOOGLE_API_KEY=your_google_api_key
   SEARCH_ENGINE_ID=your_search_engine_id
   GEMINI_API_KEY=your_gemini_api_key
   OPENAI_API_KEY=your_openai_api_key # optional
   ```
4. Start the bot:
   ```sh
   node src/bot.js
   ```
5. Scan the QR code with your WhatsApp app to connect.

## Usage
- Send messages to the bot in WhatsApp to get AI-powered responses.
- Type `help` for a list of commands.
- Ask for portfolio, contact, or to schedule a meeting.

## Environment Variables
| Variable           | Description                        |
|--------------------|------------------------------------|
| GOOGLE_API_KEY     | Google Custom Search API key       |
| SEARCH_ENGINE_ID   | Google Search Engine ID            |
| GEMINI_API_KEY     | Google Gemini API key              |
| OPENAI_API_KEY     | (Optional) OpenAI API key          |

## Author & Contact
- **Emmanuel**
- Email: emmanuelyegon513@gmail.com
- Portfolio: https://my-portfolio-zeta-puce-31.vercel.app   
- GitHub: https://github.com/Jhietechz
- LinkedIn: www.linkedin.com/in/kibet-emmanuel-9b8371363

## License
ISC
