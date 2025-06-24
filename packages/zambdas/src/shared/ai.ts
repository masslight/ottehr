import { ChatAnthropic } from '@langchain/anthropic';
import { AIMessageChunk, BaseMessageLike } from '@langchain/core/messages';
import { getSecret, Secrets, SecretsKeys } from 'utils';

let chatbot: ChatAnthropic;

export async function invokeChatbot(input: BaseMessageLike[], secrets: Secrets | null): Promise<AIMessageChunk> {
  process.env.ANTHROPIC_API_KEY = getSecret(SecretsKeys.ANTHROPIC_API_KEY, secrets);
  if (chatbot == null) {
    chatbot = new ChatAnthropic({
      model: 'claude-3-7-sonnet-20250219',
      temperature: 0,
    });
  }
  return chatbot.invoke(input);
}
