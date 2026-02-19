export const CONSENT_FORMS_OVERRIDE = {
  forms: [
    {
      id: 'notice-of-privacy-practices',
      formTitle: 'Notice of Privacy Practices',
      resourceTitle: 'HIPAA forms',
      assetPath: './assets/QUC_Notice_of_Privacy_Practices.pdf',
      publicUrl: '/QUC_Notice_of_Privacy_Practices.pdf',
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '64292-6',
            display: 'Privacy Policy',
          },
        ],
        text: 'HIPAA Acknowledgement forms',
      },
      createsConsentResource: false,
    },
    {
      id: 'consent-to-treat',
      formTitle: 'Insurance Agreement',
      resourceTitle: 'Consent forms',
      assetPath: './assets/QUC_Insurance_Agreement.pdf',
      publicUrl: '/QUC_Insurance_Agreement.pdf',
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
    {
      id: 'visit-follow-up-communication',
      formTitle: 'Visit Follow-up Communication',
      resourceTitle: 'Consent forms',
      assetPath: './assets/QUC_Visit_Follow-up_Communication.pdf',
      publicUrl: '/QUC_Visit_Follow-up_Communication.pdf',
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
