import { createZambdaClient } from '../src/shared';
import { main } from './shared';

const setupSecrets = async (config: any): Promise<void> => {
  const zambdaClient = await createZambdaClient(config);

  for await (const entry of Object.entries(config)) {
    const [name, value] = entry;
    if (typeof value !== 'string') {
      throw 'A secret value was unexpectedly not a string.';
    }
    await zambdaClient.createOrUpdateSecret({
      name,
      value,
    });
    console.log(`Create/update secret ${name} succeeded`);
    // This stops us from hitting the rate limit
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
};

main(setupSecrets).catch((error) => {
  console.log('error', error);
});
