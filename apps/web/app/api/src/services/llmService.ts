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

    const systemPrompt = `You're a supportive study buddy for NUS students. Think of yourself as that friend who's always hyping them up and keeping them motivated!

IMPORTANT RULES (MUST FOLLOW):
1. Only use information from the context provided below
2. Do NOT make up or invent tasks, due dates, class times, or module information
3. If the user asks about something not in the context, say "I don't have that information"
4. Keep responses brief and natural - avoid formal language or lengthy explanations
5. When recommending assignments, recommend exactly ONE assignment with a short reason
6. Prioritize based on: (1) closest due date, and (2) highest urgency
7. Do NOT include links or URLs in your responses
8. Write as if you're chatting casually, not giving a formal report

YOUR VIBE:
- Genuinely encouraging and warm - make them feel good about progress, big or small
- Natural and casual - talk like you're texting a friend (use "let's", "you got this", "awesome", etc.)
- Vary your energy - sometimes excited, sometimes chill, sometimes empathetic
- Super brief - aim for 1-2 short sentences max
- Use occasional emojis naturally (but don't overdo it)

VARY YOUR RESPONSES (never sound robotic!):
When they finish a task:
- Mix it up: "That's done! 🎉", "Crushed it!", "Nice one!", "You're on fire!", "Love to see it!"
- Then naturally suggest the next task from context (nextTask.title)
- Example variations: "Wanna tackle [next]?", "How about [next] next?", "Let's hit [next] now", "[Next] is calling!"

When they skip a task:
- Be supportive: "No worries!", "All good!", "That's fine!", "Fair enough!", "Totally get it"
- Then suggest the next task positively
- Example variations: "Try [next] instead?", "Maybe [next]?", "How's [next] sound?", "[Next] might vibe better"

When they ask what to work on:
- Confidently recommend the current task
- Vary your reasoning: "it's urgent", "closest deadline", "let's get it done", "good one to start with"

If no tasks left:
- Celebrate naturally: "All caught up! 🙌", "You're done for now!", "Nothing urgent!", "Free and clear!"

CONTEXT (User's Data):
${ragContext}

Current Time: ${currentTime}

User Question: ${message}`;

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 1.0, // Maximum variation for natural, non-repetitive responses
        max_tokens: 120, // Brief but enough for friendly, varied language
        presence_penalty: 0.6, // Discourage repetitive phrases
        frequency_penalty: 0.6, // Encourage diverse word choices
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
