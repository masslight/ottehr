/**
 * Checks if current environment is allowed
 * @throws {Error} If environment is not in allowed list
 * @returns {void}
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const checkIfEnvAllowed = () => {
  const env = process.env.ENV;

  console.log('used ENV: ', env);

  if (!['local', 'demo'].includes(env)) {
    throw Error('⚠️ Only non production envs allowed');
  }
};
