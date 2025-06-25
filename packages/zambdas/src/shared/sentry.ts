import { init, isInitialized, setTag } from '@sentry/aws-serverless';
import { getSecret, Secrets } from 'utils';

export function configSentry(zambdaName: string, secrets: Secrets | null): void {
  const environment = getSecret('ENVIRONMENT', secrets);
  if (isInitialized()) {
    console.log('Sentry is all ready initialized');
  } else {
    console.log('Initializing sentry now');
    init({
      environment: environment,
      dsn: secrets?.SENTRY_DSN,
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
  }

  setTag('zambda', zambdaName);
  setTag('environment', environment);
}
