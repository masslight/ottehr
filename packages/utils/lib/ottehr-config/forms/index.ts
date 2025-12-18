import { z } from 'zod';
import { FORMS_CONFIG_OVERRIDE } from '../../../ottehr-config-overrides';
import { mergeAndFreezeConfigObjects } from '../helpers';

const DEFAULT_FORMS_CONFIG: FormsConfig = {
  forms: [
    {
      title: 'Texas Workers Compensation Form DWC073',
      link: 'https://drive.google.com/file/d/1H2PLOAOlblpPJUkgmFvnw6XLJYRnW2GX/view?usp=drive_link',
    },
  ],
};

const mergedConfig = mergeAndFreezeConfigObjects(DEFAULT_FORMS_CONFIG, FORMS_CONFIG_OVERRIDE);

const FormSchema = z.object({
  title: z.string(),
  link: z.string(),
});

const FormsConfigSchema = z.object({
  forms: z.array(FormSchema),
});

type FormsConfig = z.infer<typeof FormsConfigSchema>;

export const FORMS_CONFIG = FormsConfigSchema.parse(mergedConfig);
