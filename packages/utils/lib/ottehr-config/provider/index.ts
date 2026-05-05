import type { ProviderConfig } from 'config-types';

const PROVIDER_DATA: ProviderConfig = {
  assessment: {
    visionAutoCptCodes: ['99173'],
  },
};

export const PROVIDER_CONFIG = Object.freeze(PROVIDER_DATA);
