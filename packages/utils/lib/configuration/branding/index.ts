import _ from 'lodash';
import * as z from 'zod';
import { BRANDING_OVERRIDES as OVERRIDES } from '../../../.ottehr_config';

const overrides: any = OVERRIDES || {};
const BRANDING_DEFAULTS: any = {
  projectName: 'Ottehr',
  email: {
    logoURL: '',
    palette: {
      deemphasizedText: '#00000061',
      headerText: '#0F347C',
      bodyText: '#000000DE',
      footerText: '#212130',
      buttonColor: '#295F75',
    },
    sender: 'ottehr-support@masslight.com',
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

const mergedBrandingConfig = _.merge({ ...BRANDING_DEFAULTS }, { ...overrides });

const BrandingConfigSchema = z.object({
  projectName: z.string().min(1, { message: 'Project name cannot be empty' }),
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
});

export const BRANDING_CONFIG = Object.freeze(BrandingConfigSchema.parse(mergedBrandingConfig));
