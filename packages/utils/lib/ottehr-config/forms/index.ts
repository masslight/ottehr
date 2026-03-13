import { FormsConfig, FormsConfigSchema } from 'config-types';
import { FORMS_CONFIG_OVERRIDE } from '../../../ottehr-config-overrides';
import { mergeAndFreezeConfigObjects } from '../helpers';

const DEFAULT_FORMS_CONFIG = {
  forms: [
    {
      title: 'Texas Workers Compensation Form DWC073',
      link: '/dwc073.pdf',
    },
  ],
} as const satisfies FormsConfig;

const mergedConfig = mergeAndFreezeConfigObjects(DEFAULT_FORMS_CONFIG, FORMS_CONFIG_OVERRIDE);

export const FORMS_CONFIG = FormsConfigSchema.parse(mergedConfig) as typeof mergedConfig;
