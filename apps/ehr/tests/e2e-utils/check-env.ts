/**
 * Checks if current environment is allowed
 * @throws {Error} If environment is not in allowed list
 * @returns {void}
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const checkIfEnvAllowed = () => {
  const env = process.env.ENV;

  console.log('used ENV: ', env);

  // temporary check, later we can remove this check if we want to allow tests on production
  if (env === 'demo') {
    throw Error('⚠️ Only non production envs allowed');
  }
};
