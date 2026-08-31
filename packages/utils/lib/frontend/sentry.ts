import { captureException, captureMessage } from '@sentry/react';

export function safelyCaptureException(error: unknown): void {
  const { MODE: environment } = import.meta.env;
  if (['dev', 'testing', 'staging', 'demo', 'production'].includes(environment)) {
    captureException(error);
  }
}

export function safelyCaptureMessage(
  message: string,
  options?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  }
): void {
  const { MODE: environment } = import.meta.env;

  if (['dev', 'testing', 'staging', 'demo', 'production'].includes(environment)) {
    captureMessage(message, {
      level: options?.level ?? 'error',
      tags: options?.tags,
      extra: options?.extra,
    });
  }
}
