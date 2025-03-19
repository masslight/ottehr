import path from 'path';

export const performEffectWithEnvFile = async (callback: (config: any) => void): Promise<void> => {
  const env = process.argv[2];
  try {
    const configPath = path.resolve(__dirname, `../../../zambdas/.env/${env}.json`);
    const config = await import(configPath);
    await callback(config);
  } catch (e) {
    console.error(e);
    throw new Error(`can't import config for the environment: '${env}'`);
  }
};
