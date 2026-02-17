export const INTAKE_PAPERWORK_CONFIG = {
  hiddenFormSections: [
    'employer-information-page',
    'occupational-medicine-employer-information-page',
    'attorney-mva-page',
    'payment-option-occ-med-page',
    'payment-option-mva-page',
    'emergency-contact-page',
  ],
  FormFields: {
    paymentOption: {
      items: {
        selfPayAlert: {
          text: 'By choosing to proceed with self-pay without insurance, you agree to pay the prices posted on our website for the services provided at the time of service.',
        },
      },
    },
    photoId: {
      items: {
        photoIdFront: {
          label: 'Take a picture of the front side of your Photo ID',
        },
        photoIdBack: {
          label: 'Take a picture of the back side of your Photo ID',
        },
      },
      requiredFields: ['photo-id-front', 'photo-id-back'],
    },
  },
  questionnaireBase: {
    version: '1.1.0',
  },
} as any;
