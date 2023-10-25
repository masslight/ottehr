import devConfig from '../.env/dev.json';
import testingConfig from '../.env/testing.json';
// import stagingConfig from '../.env/staging.json';
// import productionConfig from '../.env/production.json';

enum environment {
  dev = 'dev',
  testing = 'testing',
  // staging = 'staging',
  // production = 'production',
}

const secretsConfig: Record<environment, object> = {
  dev: devConfig,
  testing: testingConfig,
  // staging: stagingConfig,
  // production: productionConfig,
};

// So we can use await in the scripts' root functions
export const main = async (functionName: (config: object) => any): Promise<void> => {
  // If the argument isn't a valid environment, quit
  const env = process.argv[2] as environment;
  if (!Object.values(environment).includes(env)) {
    throw new Error('¯\\_(ツ)_/¯ environment must match a valid zapEHR environment.');
  }

  const config = secretsConfig[env];
  await functionName(config);
};
