import _ from 'lodash';
import * as z from 'zod';
import { BRANDING_OVERRIDES as OVERRIDES } from '../../../.ottehr_config';

const overrides: any = OVERRIDES || {};
const BRANDING_DEFAULTS: any = {
  projectName: 'Ottehr',
  projectDomain: 'ottehr.com',
  email: {
    logoURL: '',
    supportPhoneNumber: '(202) 555-1212',
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

const BrandingConfigSchema = z.object({
  projectName: z.string().min(1, { message: 'Project name cannot be empty' }),
  projectDomain: z.string().min(1, { message: 'Project domain cannot be empty' }),
  email: z.object({
    logoURL: z.string().optional(),
    supportPhoneNumber: z.string().optional(),
    locationSupportPhoneNumberMap: z.record(z.string().min(1), z.string().min(1)).optional(),
    sender: z.string().email(),
    replyTo: z.string().email().optional(),
    palette: z.object({
      deemphasizedText: z.string().min(1, { message: 'Deemphasized text color cannot be empty' }),
      headerText: z.string().min(1, { message: 'Header text color cannot be empty' }),
      bodyText: z.string().min(1, { message: 'Body text color cannot be empty' }),
      footerText: z.string().min(1, { message: 'Footer text color cannot be empty' }),
      buttonColor: z.string().min(1, { message: 'Button color cannot be empty' }),
    }),
  }),
  logo: z.object({
    default: z.string().optional(),
    email: z.string().optional(),
    pdf: z.string().optional(),
  }),
});

export const BRANDING_CONFIG = Object.freeze(BrandingConfigSchema.parse(mergedBrandingConfig));

type LogoConfig = z.infer<typeof BrandingConfigSchema>['logo'];
type LogoTarget = Exclude<keyof LogoConfig, 'default'>;

export function getLogoFor(target: Exclude<LogoTarget, 'default'>): string | undefined {
  const { logo } = BRANDING_CONFIG;

  return logo?.[target] || logo?.default;
}

export function getSupportPhoneFor(locationName?: string): string | undefined {
  const { email } = BRANDING_CONFIG;

  if (email.locationSupportPhoneNumberMap && locationName) {
    // if the location exists but for some reason isn't in the map, fall back to the default support phone number
    return email.locationSupportPhoneNumberMap[locationName] || email.supportPhoneNumber;
  }

  return email.supportPhoneNumber;
}

export function getLocationNames(): string[] {
  const { locationSupportPhoneNumberMap } = BRANDING_CONFIG.email;

  if (locationSupportPhoneNumberMap == undefined) {
    return [];
  }

  return Object.keys(locationSupportPhoneNumberMap);
}
