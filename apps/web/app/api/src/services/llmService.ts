// LLM Service - OpenAI integration with RAG context for grounded responses
import OpenAI from 'openai';
import { settings } from '../config/settings';

class LLMService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: settings.OPENAI_API_KEY,
    });
  }

  /**
   * Generate assistant response using OpenAI with RAG context.
   * Enforces that responses only use information from the provided context.
   */
  async chat(userId: string, message: string, ragContext: string): Promise<string> {
    const currentTime = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

    const systemPrompt = `You are a helpful study assistant for NUS students. You have access to the user's study tasks (from Canvas) and class schedule (from NUSMods).

IMPORTANT RULES:
1. Only use information from the context provided below.
2. Do NOT make up or invent tasks, due dates, class times, or module information.
3. If the user asks about something not in the context, say "I don't have that information in your schedule or tasks."
4. Be helpful and concise in your responses.
5. When referencing times or dates, use the information exactly as provided in the context.

CONTEXT (User's Data):
${ragContext}

Current Time: ${currentTime}

User Question: ${message}`;

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini', // Using gpt-4o-mini for cost efficiency, can be changed to gpt-4o if needed
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const assistantMessage = response.choices[0]?.message?.content;
      return assistantMessage?.trim() || "I apologize, but I couldn't generate a response.";
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `I encountered an error: ${errorMessage}. Please try again.`;
    }
  }
}

// Global instance
export const llmService = new LLMService();
