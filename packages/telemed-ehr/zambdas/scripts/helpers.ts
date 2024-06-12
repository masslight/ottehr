export const fhirApiUrlFromAuth0Audience = (auth0Audience: string): string => {
  switch (auth0Audience) {
    case 'https://dev.api.zapehr.com':
      return 'https://dev.fhir-api.zapehr.com';
    case 'https://dev2.api.zapehr.com':
      return 'https://dev2.fhir-api.zapehr.com';
    case 'https://testing.api.zapehr.com':
      return 'https://testing.fhir-api.zapehr.com';
    case 'https://staging.api.zapehr.com':
      return 'https://staging.fhir-api.zapehr.com';
    case 'https://api.zapehr.com':
      return 'https://fhir-api.zapehr.com';
    default:
      throw `Unexpected auth0 audience value, could not map to a projectApiUrl. auth0Audience was: ${auth0Audience}`;
  }
};

// todo remove code duplication with configure-zapehr-secrets
export const projectApiUrlFromAuth0Audience = (auth0Audience: string): string => {
  switch (auth0Audience) {
    case 'https://dev.api.zapehr.com':
      return 'https://dev.project-api.zapehr.com/v1';
    case 'https://dev2.api.zapehr.com':
      return 'https://dev2.project-api.zapehr.com/v1';
    case 'https://testing.api.zapehr.com':
      return 'https://testing.project-api.zapehr.com/v1';
    case 'https://staging.api.zapehr.com':
      return 'https://staging.project-api.zapehr.com/v1';
    case 'https://api.zapehr.com':
      return 'https://project-api.zapehr.com/v1';
    default:
      throw `Unexpected auth0 audience value, could not map to a projectApiUrl. auth0Audience was: ${auth0Audience}`;
  }
};
