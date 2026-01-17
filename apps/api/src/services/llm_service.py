"""LLM Service - OpenAI integration with RAG context for grounded responses."""
from openai import OpenAI
from datetime import datetime
from ..config.settings import settings


class LLMService:
    """Service for interacting with OpenAI LLM with RAG context."""
    
    def __init__(self):
        """Initialize OpenAI client."""
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
    
    def chat(self, user_id: str, message: str, rag_context: str) -> str:
        """
        Generate assistant response using OpenAI with RAG context.
        Enforces that responses only use information from the provided context.
        """
        current_time = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')
        
        system_prompt = f"""You are a helpful study assistant for NUS students. You have access to the user's study tasks (from Canvas) and class schedule (from NUSMods).

IMPORTANT RULES:
1. Only use information from the context provided below.
2. Do NOT make up or invent tasks, due dates, class times, or module information.
3. If the user asks about something not in the context, say "I don't have that information in your schedule or tasks."
4. Be helpful and concise in your responses.
5. When referencing times or dates, use the information exactly as provided in the context.

CONTEXT (User's Data):
{rag_context}

Current Time: {current_time}

User Question: {message}"""
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",  # Using gpt-4o-mini for cost efficiency, can be changed to gpt-4o if needed
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            assistant_message = response.choices[0].message.content
            return assistant_message.strip() if assistant_message else "I apologize, but I couldn't generate a response."
        
        except Exception as e:
            return f"I encountered an error: {str(e)}. Please try again."


# Global instance
llm_service = LLMService()
