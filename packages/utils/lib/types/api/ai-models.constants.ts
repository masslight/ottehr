export interface LlmModel {
  /** Model id sent to the provider API. */
  id: string;
  /** Human-readable name for UI. */
  displayName: string;
}

export const VERTEX_AI_MODEL: LlmModel = { id: 'gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash Lite' };
export const CLAUDE_SONNET_5_5_MODEL: LlmModel = { id: 'claude-sonnet-5-5', displayName: 'Claude Sonnet 5.5' };
export const CLAUDE_OPUS_5_5_MODEL: LlmModel = { id: 'claude-opus-5-5', displayName: 'Claude Opus 5.5' };
