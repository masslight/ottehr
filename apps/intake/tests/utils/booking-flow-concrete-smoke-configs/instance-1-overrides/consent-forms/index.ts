export const CONSENT_FORMS_OVERRIDE = {
  forms: [
    {
      id: 'consent-to-treat',
      assetPath: './assets/Consent_to_Treatment.pdf',
      publicUrl: '/Consent_to_Treatment.pdf',
      formTitle: 'Consent to Treatment',
      resourceTitle: 'Consent forms',
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
      id: 'financial-responsibility',
      assetPath: './assets/Financial_Responsibility.pdf',
      publicUrl: '/Financial_Responsibility.pdf',
      formTitle: 'Financial Responsibility Disclosure and Authorization to Bill Insurance',
      resourceTitle: 'Consent forms',
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
      id: 'rights-and-responsibilities',
      assetPath: './assets/Patient_Rights_and_Responsibilities.pdf',
      publicUrl: '/Patient_Rights_and_Responsibilities.pdf',
      formTitle: 'Patient Rights and Responsibilities',
      resourceTitle: 'Consent forms',
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
      id: 'hipaa-acknowledgement',
      assetPath: './assets/Privacy_Practices.pdf',
      publicUrl: '/Privacy_Practices.pdf',
      formTitle: 'HIPAA Acknowledgement',
      resourceTitle: 'HIPAA forms',
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
  ],
};
