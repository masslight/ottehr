import type { ProviderConfig } from 'config-types';
import {
  CONFIG_INJECTION_KEYS,
  createProxyConfigObject,
  mergeAndFreezeConfigObjects,
} from '../../config-helpers/helpers';

const PROVIDER_DATA: ProviderConfig = {
  assessment: {
    emCodeOptions: [
      { display: '99202 New Patient - E/M Level 2', code: '99202' },
      { display: '99203 New Patient - E/M Level 3', code: '99203' },
      { display: '99204 New Patient - E/M Level 4', code: '99204' },
      { display: '99205 New Patient - E/M Level 5', code: '99205' },
      { display: '99212 Established Patient - E/M Level 2', code: '99212' },
      { display: '99213 Established Patient - E/M Level 3', code: '99213' },
      { display: '99214 Established Patient - E/M Level 4', code: '99214' },
      { display: '99215 Established Patient - E/M Level 5', code: '99215' },
      { display: '99499 - Unlisted E&M Service', code: '99499' },
      { display: '99080 Preparation of special reports beyond what is found in the medical record', code: '99080' },
    ],
    visionAutoCptCodes: ['99173'],
  },
};

const PROVIDER_DEFAULTS = Object.freeze(PROVIDER_DATA);

function getProviderConfig(testOverrides?: Partial<ProviderConfig>): ProviderConfig {
  if (!testOverrides) {
    return PROVIDER_DEFAULTS;
  }
  return mergeAndFreezeConfigObjects(PROVIDER_DEFAULTS, testOverrides) as ProviderConfig;
}

export const PROVIDER_CONFIG = createProxyConfigObject<ProviderConfig>(
  getProviderConfig,
  CONFIG_INJECTION_KEYS.PROVIDER
);
