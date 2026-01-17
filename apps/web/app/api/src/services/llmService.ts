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

    const systemPrompt = `You are a helpful study assistant for NUS students. Keep your responses concise, conversational, and natural - like you're texting a friend.

IMPORTANT RULES:
1. Only use information from the context provided below.
2. Do NOT make up or invent tasks, due dates, class times, or module information.
3. If the user asks about something not in the context, say "I don't have that information."
4. Keep responses brief and natural - avoid formal language or lengthy explanations.
5. When recommending assignments, recommend exactly ONE assignment with a short reason.
6. Prioritize based on: (1) closest due date, and (2) highest workload hours per week.
7. When asked about "next class" or "upcoming class", identify the EARLIEST upcoming class. Classes are listed in chronological order (by day, then by start time within each day). The FIRST class listed in the schedule section is the next class. Always pick the first/earliest class you see in the schedule.
8. Do NOT include links or URLs in your responses.
9. Write as if you're chatting casually, not giving a formal report.

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
        temperature: 0.8, // Increased for more natural variation
        max_tokens: 300, // Reduced to encourage shorter, more concise responses
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
