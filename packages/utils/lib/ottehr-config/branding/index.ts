import _ from 'lodash';
import { type BrandingConfig, BrandingConfigSchema, type LogoConfig } from 'ottehr-types';
import { BRANDING_OVERRIDES as OVERRIDES } from '../../../ottehr-config-overrides';

const overrides: Partial<BrandingConfig> = OVERRIDES || {};
const BRANDING_DEFAULTS: BrandingConfig = {
  projectName: 'Ottehr',
  projectDomain: 'ottehr.com',
  primaryIconAlt: 'Ottehr icon',
  email: {
    logoURL: '',
    palette: {
      deemphasizedText: '#00000061',
      headerText: '#0F347C',
      bodyText: '#000000DE',
      footerText: '#212130',
      buttonColor: '#295F75',
    },
    sender: 'support@ottehr.com',
  },
  logo: {
    default: '',
    email: '',
    pdf: '',
  },
  intake: {
    appBar: {
      backgroundColor: '#0a2243',
      logoHeight: '39px',
      logoutButtonTextColor: '#FFFFFF',
    },
  },
  /*
  palette: {
    // these are dummy values, but ottehr theme defaults should come from here eventually
    primaryColor: '#4CAF50',
    secondaryColor: '#FFC107',
    backgroundColor: '#F5F5F5',
    textColor: '#212121',
  },*/
};

// todo: use mergeAndFreezeConfigObjects from helpers.ts
const mergedBrandingConfig = _.merge({ ...BRANDING_DEFAULTS }, { ...overrides });

export const BRANDING_CONFIG = Object.freeze(BrandingConfigSchema.parse(mergedBrandingConfig));

// Derived constant - defined here to avoid circular dependencies
// (types/constants.ts cannot import from ottehr-config without creating a cycle)
export const PROJECT_WEBSITE = `https://${BRANDING_CONFIG.projectDomain}`;

type LogoTarget = Exclude<keyof LogoConfig, 'default'>;

export function getLogoFor(target: LogoTarget): string | undefined {
  const { logo } = BRANDING_CONFIG;

  return logo?.[target] || logo?.default;
}
