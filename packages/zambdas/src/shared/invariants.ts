import { captureMessage, withScope } from '@sentry/aws-serverless';

/**
 * Reports a violation of the invariant "every Patient has at least one user-relatedperson RelatedPerson"
 * to Sentry. Call from the zero-RP branch of any code path that depends on this invariant, so we
 * notice when the data model gets violated via migration, import, or an unauthorized API path.
 */
export const reportMissingUserRelatedPerson = (site: string, patientId: string | undefined): void => {
  withScope((scope) => {
    scope.setTag('invariant', 'user-relatedperson:>=1');
    scope.setTag('site', site);
    if (patientId) scope.setTag('patientId', patientId);
    captureMessage('Patient has no user-relatedperson (invariant violation)', 'error');
  });
};
