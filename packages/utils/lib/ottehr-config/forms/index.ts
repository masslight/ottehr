import { z } from 'zod';
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

const FormSchema = z.object({
  title: z.string(),
  link: z.string(),
});

const FormsConfigSchema = z.object({
  forms: z.array(FormSchema),
});

export type FormsConfig = z.infer<typeof FormsConfigSchema>;

export const FORMS_CONFIG = FormsConfigSchema.parse(mergedConfig) as typeof mergedConfig;
