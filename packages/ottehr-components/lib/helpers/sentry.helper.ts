import { captureException } from '@sentry/react';

export function safelyCaptureException(error: unknown): void {
  if (
    import.meta.env.MODE === 'development' ||
    import.meta.env.MODE === 'staging' ||
    import.meta.env.MODE === 'testing' ||
    import.meta.env.MODE === 'production' ||
    import.meta.env.MODE === 'training'
  ) {
    captureException(error);
  }
}
