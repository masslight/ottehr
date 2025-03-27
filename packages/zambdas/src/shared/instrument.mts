import * as Sentry from '@sentry/aws-serverless';

Sentry.init({
  environment: undefined,
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  beforeSend(event) {
    const environment = event.tags?.environment?.toString();
    // https://github.com/getsentry/sentry-javascript/issues/13391#issuecomment-2359832269
    // filter out events from dev and local
    if (!environment || ['dev', 'local'].includes(environment)) {
      return null;
    }

    // update transaction name
    event.transaction = `[${environment}]-${event.tags?.zambda?.toString()}`;
    return event;
  },
});
