import { ChatAnthropic } from '@langchain/anthropic';
import { AIMessageChunk, BaseMessageLike } from '@langchain/core/messages';

process.env.ANTHROPIC_API_KEY = '';

let chatbot: ChatAnthropic;

export async function invokeChatbot(input: BaseMessageLike[]): Promise<AIMessageChunk> {
  if (chatbot == null) {
    chatbot = new ChatAnthropic({
      model: 'claude-3-7-sonnet-20250219',
      temperature: 0,
    });
  }
  return chatbot.invoke(input);
}
