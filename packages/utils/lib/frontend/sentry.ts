import { captureException } from '@sentry/react';

export function safelyCaptureException(error: unknown): void {
  const { MODE: environment } = import.meta.env;
  if (['dev', 'testing', 'staging', 'demo', 'production'].includes(environment)) {
    captureException(error);
  }
}
