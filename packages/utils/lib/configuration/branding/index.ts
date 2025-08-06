import _ from 'lodash';
import * as z from 'zod';
import { CONFIG } from '../../../.ottehr_config';

const overrides: any = CONFIG.branding || {};
const BRANDING_DEFAULTS: any = {
  projectName: 'Ottehr',
  pallette: {
    // these are dummy values, but ottehr theme defaults should come from here eventually
    primaryColor: '#4CAF50',
    secondaryColor: '#FFC107',
    backgroundColor: '#F5F5F5',
    textColor: '#212121',
  },
};

const mergedBrandingConfig = _.merge(BRANDING_DEFAULTS, overrides);

const BrandingConfigSchema = z.object({
  projectName: z.string().min(1, { message: 'Project name cannot be empty' }),
  pallette: z.object({
    primaryColor: z.string().min(1, { message: 'Primary color cannot be empty' }),
    secondaryColor: z.string().min(1, { message: 'Secondary color cannot be empty' }),
    backgroundColor: z.string().min(1, { message: 'Background color cannot be empty' }),
    textColor: z.string().min(1, { message: 'Text color cannot be empty' }),
  }),
});

export const BRANDING_CONFIG = Object.freeze(BrandingConfigSchema.parse(mergedBrandingConfig));
