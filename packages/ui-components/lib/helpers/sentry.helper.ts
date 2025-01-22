import { captureException } from '@sentry/react';

export function safelyCaptureException(error: unknown): void {
  const { MODE: environment } = import.meta.env;
  if (['dev', 'testing', 'staging', 'training', 'production'].includes(environment)) {
    captureException(error);
  }
}
