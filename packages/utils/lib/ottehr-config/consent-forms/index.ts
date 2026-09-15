import type { ConsentFormConfig, ConsentFormsConfig, PathConfig, ResolvedConsentFormConfig } from 'config-types';

const PRIVACY_POLICY_CODE = '64292-6';

const CONSENT_FORMS_DATA: ConsentFormsConfig = {
  forms: [
    {
      id: 'hipaa-acknowledgement',
      formTitle: 'HIPAA Omnibus Notice of Privacy Practices',
      resourceTitle: 'HIPAA forms',
      assetPath: './assets/hipaa.pdf',
      publicUrl: '/hipaa.pdf',
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
      formTitle: 'Office Policies and Procedures',
      resourceTitle: 'Consent forms',
      assetPath: {
        default: './assets/office_policies_and_procedures.pdf',
        byState: {
          IL: './assets/CTT.and.Guarantee.of.Payment.and.Credit.Card.Agreement.Illinois-S.pdf',
        },
      },
      publicUrl: '/office_policies_and_procedures.pdf',
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

export { CONSENT_FORMS_DATA };

export const CONSENT_FORMS_CONFIG = Object.freeze(CONSENT_FORMS_DATA) as typeof CONSENT_FORMS_DATA;

const resolveAssetPath = (path: PathConfig, locationState?: string): string => {
  if (typeof path === 'string') {
    return path;
  }

  if (locationState && path.byState?.[locationState]) {
    return path.byState[locationState];
  }

  return path.default;
};

/**
 * Resolve state-conditional paths for a given array of consent forms.
 * Use this when you already have the forms array and need to resolve the paths.
 */
export const resolveConsentFormsPaths = (
  forms: ConsentFormConfig[],
  locationState?: string
): ResolvedConsentFormConfig[] => {
  return forms.map((form) => ({
    ...form,
    assetPath: resolveAssetPath(form.assetPath, locationState),
    publicUrl: resolveAssetPath(form.publicUrl, locationState),
  }));
};

export const getConsentFormsForLocation = (locationState?: string): ResolvedConsentFormConfig[] => {
  return resolveConsentFormsPaths(CONSENT_FORMS_CONFIG.forms, locationState);
};
