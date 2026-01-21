import { z } from 'zod';
import { CONSENT_FORMS_OVERRIDE } from '../../../ottehr-config-overrides/consent-forms';
import { PRIVACY_POLICY_CODE } from '../../types';
import { mergeAndFreezeConfigObjects } from '../helpers';

const CodingSchema = z.object({
  system: z.string().optional(),
  code: z.string().optional(),
  display: z.string().optional(),
});

const PathConfigSchema = z.union([
  z.string(),
  z.object({
    default: z.string(),
    byState: z.record(z.string(), z.string()).optional(),
  }),
]);

type PathConfig = z.infer<typeof PathConfigSchema>;

const ConsentFormSchema = z.object({
  id: z.string(),
  formTitle: z.string(),
  resourceTitle: z.string(),
  type: z.object({
    coding: z.array(CodingSchema).min(1),
    text: z.string().optional(),
  }),
  createsConsentResource: z.boolean(),
  assetPath: PathConfigSchema,
  publicUrl: PathConfigSchema,
});

const ConsentFormsConfigSchema = z.object({
  forms: z.array(ConsentFormSchema).min(1),
});

export type ConsentFormConfig = z.infer<typeof ConsentFormSchema>;
export type ConsentFormsConfig = z.infer<typeof ConsentFormsConfigSchema>;

const DEFAULT_CONSENT_FORMS: ConsentFormsConfig = {
  forms: [
    {
      id: 'hipaa-acknowledgement',
      formTitle: 'HIPAA Acknowledgement',
      resourceTitle: 'HIPAA forms',
      assetPath: './assets/HIPAA.Acknowledgement-S.pdf',
      publicUrl: '/hipaa_notice_template.pdf',
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: PRIVACY_POLICY_CODE,
            display: 'Privacy Policy',
          },
        ],
        text: 'HIPAA Acknowledgement forms',
      },
      createsConsentResource: false,
    },
    {
      id: 'consent-to-treat',
      formTitle: 'Consent to Treat, Guarantee of Payment & Card on File Agreement',
      resourceTitle: 'Consent forms',
      assetPath: {
        default: './assets/CTT.and.Guarantee.of.Payment.and.Credit.Card.Agreement-S.pdf',
        byState: {
          IL: './assets/CTT.and.Guarantee.of.Payment.and.Credit.Card.Agreement.Illinois-S.pdf',
        },
      },
      publicUrl: '/consent_to_treat_template.pdf',
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '59284-0',
            display: 'Consent Documents',
          },
          {
            system: 'https://fhir.ottehr.com/CodeSystem/consent-source',
            code: 'patient-registration',
            display: 'Patient Registration Consent',
          },
        ],
        text: 'Consent forms',
      },
      createsConsentResource: true,
    },
  ],
};

const mergedConsentFormsConfig = mergeAndFreezeConfigObjects(CONSENT_FORMS_OVERRIDE, DEFAULT_CONSENT_FORMS);

export const CONSENT_FORMS_CONFIG = ConsentFormsConfigSchema.parse(mergedConsentFormsConfig);

const resolveAssetPath = (path: PathConfig, locationState?: string): string => {
  if (typeof path === 'string') {
    return path;
  }

  if (locationState && path.byState?.[locationState]) {
    return path.byState[locationState];
  }

  return path.default;
};

export type ResolvedConsentFormConfig = Omit<ConsentFormConfig, 'assetPath' | 'publicUrl'> & {
  assetPath: string;
  publicUrl: string;
};

export const getConsentFormsForLocation = (locationState?: string): ResolvedConsentFormConfig[] => {
  return CONSENT_FORMS_CONFIG.forms.map((form) => ({
    ...form,
    assetPath: resolveAssetPath(form.assetPath, locationState),
    publicUrl: resolveAssetPath(form.publicUrl, locationState),
  }));
};
