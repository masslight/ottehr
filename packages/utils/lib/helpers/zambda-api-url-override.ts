// Set by the local zambda server to its own zambda API URL.
export const LOCAL_ZAMBDA_API_URL_ENV = 'LOCAL_ZAMBDA_API_URL';

// The zambda API URL to use instead of the SDK default, so zambdas run by the local server call other
// zambdas on it rather than on the deployed project. Undefined everywhere else.
export const zambdaApiUrlOverride = (): string | undefined =>
  // this module also reaches browser bundles, which have no process
  typeof process === 'undefined' ? undefined : process.env[LOCAL_ZAMBDA_API_URL_ENV] || undefined;
