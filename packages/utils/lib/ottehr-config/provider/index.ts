import { ProviderConfig, ProviderConfigSchema } from 'config-types/config/provider';
import { PROVIDER_OVERRIDES as OVERRIDES } from '../../../ottehr-config-overrides';
import { mergeAndFreezeConfigObjects } from '../helpers';

const overrides: any = OVERRIDES || {};
const PROVIDER_DEFAULTS: ProviderConfig = {
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
    ],
  },
};

const mergedProviderConfig = mergeAndFreezeConfigObjects(PROVIDER_DEFAULTS, overrides);

export const PROVIDER_CONFIG = Object.freeze(ProviderConfigSchema.parse(mergedProviderConfig));
