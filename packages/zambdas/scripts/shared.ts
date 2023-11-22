/* eslint-disable typescript-sort-keys/string-enum */
enum environment {
  dev = 'dev',
  dev2 = 'dev2',
  testing = 'testing',
  staging = 'staging',
  production = 'production',
}
/* eslint-enable typescript-sort-keys/string-enum */

// So we can use await in the scripts' root functions
export const main = async (functionName: (config: object) => any): Promise<void> => {
  // If the argument isn't a valid environment, quit
  const env = process.argv[2] as environment;
  if (!Object.values(environment).includes(env)) {
    throw new Error('¯\\_(ツ)_/¯ environment must match a valid environment.');
  }

  const configModule = await import(`../.env/${env}.json`);
  await functionName(configModule.default);
};
