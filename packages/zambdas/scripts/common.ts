export const fhirApiUrlFromAuth0Audience = (auth0Audience: string): string => {
  return createApiUrlFromAuth0AudienceAndPrefix(auth0Audience, 'fhir');
};

export const projectApiUrlFromAuth0Audience = (auth0Audience: string): string => {
  return createApiUrlFromAuth0AudienceAndPrefix(auth0Audience, 'project');
};

const createApiUrlFromAuth0AudienceAndPrefix = (auth0Audience: string, prefix: string): string => {
  switch (auth0Audience) {
    case `https://dev.api.zapehr.com`:
      return `https://dev.${prefix}-api.zapehr.com/v1`;
    case `https://dev2.api.zapehr.com`:
      return `https://dev2.${prefix}-api.zapehr.com/v1`;
    case `https://testing.api.zapehr.com`:
      return `https://testing.${prefix}-api.zapehr.com/v1`;
    case `https://staging.api.zapehr.com`:
      return `https://staging.${prefix}-api.zapehr.com/v1`;
    case `https://api.zapehr.com`:
      return `https://${prefix}-api.zapehr.com/v1`;
    default:
      throw `Unexpected auth0 audience value, could not map to an apiUrl. auth0Audience was: ${auth0Audience}`;
  }
};
