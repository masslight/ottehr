import { createZambdaClient, performEffectWithEnvFile } from './common';

const setupSecrets = async (config: any): Promise<void> => {
  const zambdaClient = await createZambdaClient(config);

  for await (const entry of Object.entries(config)) {
    const [key, value] = entry;
    if (typeof value !== 'string') {
      throw 'A secret value was unexpectedly not a string.';
    }
    await zambdaClient.createOrUpdateSecret({
      name: key,
      value: value,
    });
    console.log(`Create/update secret ${key} succeeded`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
};

// So we can use await
const main = async (): Promise<void> => {
  await performEffectWithEnvFile(setupSecrets);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
