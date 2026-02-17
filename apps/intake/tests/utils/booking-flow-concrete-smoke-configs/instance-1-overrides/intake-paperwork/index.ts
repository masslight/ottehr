export const INTAKE_PAPERWORK_CONFIG = {
  hiddenFormSections: [
    'employer-information-page',
    'occupational-medicine-employer-information-page',
    'attorney-mva-page',
    'payment-option-occ-med-page',
    'payment-option-mva-page',
  ],
  FormFields: {
    paymentOption: {
      items: {
        selfPayAlert: {
          text: 'This is a custom self pay alert message.',
        },
      },
    },
    cardPayment: {
      requiredFields: ['valid-card-on-file'],
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
    version: '1.3.0',
  },
} as any;
