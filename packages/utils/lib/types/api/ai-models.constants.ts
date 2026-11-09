export type LlmProvider = 'vertex' | 'anthropic';

export type LlmEffort = 'low' | 'medium' | 'high';

export type LlmThinkingMode = 'adaptive' | 'disabled' | 'between_tools';

export interface LlmModel {
  /** Model id sent to the provider API. */
  id: string;
  /** Human-readable name for UI. */
  displayName: string;
  provider: LlmProvider;
}

export interface LlmModelVariant {
  model: LlmModel;
  effort?: LlmEffort;
  thinking?: LlmThinkingMode;
}

export const VERTEX_AI_MODEL: LlmModel = {
  id: 'gemini-3.1-flash-lite',
  displayName: 'Gemini 3.1 Flash Lite',
  provider: 'vertex',
};

export const CLAUDE_SONNET_5_5_MODEL: LlmModel = {
  id: 'claude-sonnet-5-5',
  displayName: 'Claude Sonnet 5.5',
  provider: 'anthropic',
};

export const CLAUDE_OPUS_5_5_MODEL: LlmModel = {
  id: 'claude-opus-5-5',
  displayName: 'Claude Opus 5.5',
  provider: 'anthropic',
};

const THINKING_LABELS: Record<LlmThinkingMode, string> = {
  adaptive: 'adaptive thinking',
  disabled: 'no thinking',
  between_tools: 'no thinking',
};

export const getLlmModelVariantLabel = ({ model, effort, thinking }: LlmModelVariant): string =>
  [model.displayName, effort && `${effort} effort`, thinking && THINKING_LABELS[thinking]].filter(Boolean).join(' · ');
