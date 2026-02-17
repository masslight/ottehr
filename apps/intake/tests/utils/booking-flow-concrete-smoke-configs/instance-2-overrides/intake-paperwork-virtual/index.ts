export const INTAKE_PAPERWORK_CONFIG = {
  FormFields: {
    patientDetails: {
      hiddenFields: ['patient-pronouns', 'patient-point-of-discovery'],
    },
    primaryCarePhysician: {
      triggers: [
        {
          targetQuestionLinkId: 'contact-information-page.appointment-service-category',
          effect: ['enable'],
          operator: '=',
          answerString: 'urgent-care',
        },
      ],
    },
    pharmacy: {
      triggers: [
        {
          targetQuestionLinkId: 'contact-information-page.appointment-service-category',
          effect: ['enable'],
          operator: '=',
          answerString: 'urgent-care',
        },
      ],
    },
    paymentOption: {
      hiddenFields: ['self-pay-alert-text'],
    },
    paymentOptionOccMed: {
      hiddenFields: ['self-pay-alert-text-occupational'],
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
      triggers: [
        {
          targetQuestionLinkId: 'contact-information-page.appointment-service-category',
          effect: ['enable'],
          operator: '=',
          answerString: 'urgent-care',
        },
      ],
      requiredFields: ['photo-id-front', 'photo-id-back'],
    },
    emergencyContact: {
      triggers: [
        {
          targetQuestionLinkId: 'contact-information-page.appointment-service-category',
          effect: ['enable'],
          operator: '=',
          answerString: 'urgent-care',
        },
      ],
    },
    responsibleParty: {
      triggers: [
        {
          targetQuestionLinkId: 'contact-information-page.appointment-service-category',
          effect: ['enable'],
          operator: '!=',
          answerString: 'occupational-medicine',
        },
      ],
    },
  },
  hiddenFormSections: ['additional-page', 'patient-condition-page', 'school-work-note-page'],
} as any;
