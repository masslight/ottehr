import { z } from 'zod';
import { FORMS_CONFIG_OVERRIDE } from '../../../ottehr-config-overrides';
import { mergeAndFreezeConfigObjects } from '../helpers';

const DEFAULT_FORMS_CONFIG: FormsConfig = {
  forms: [
    {
      title: 'Texas Workers Compensation Form DWC073',
      link: '/dwc073.pdf',
    },
  ],
};

const mergedConfig = mergeAndFreezeConfigObjects(FORMS_CONFIG_OVERRIDE, DEFAULT_FORMS_CONFIG);

const FormSchema = z.object({
  title: z.string(),
  link: z.string(),
});

const FormsConfigSchema = z.object({
  forms: z.array(FormSchema),
});

type FormsConfig = z.infer<typeof FormsConfigSchema>;

export const FORMS_CONFIG = FormsConfigSchema.parse(mergedConfig);
