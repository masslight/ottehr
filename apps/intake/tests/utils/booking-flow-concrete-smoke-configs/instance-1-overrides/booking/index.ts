export const BOOKING_OVERRIDES = {
  serviceCategoriesEnabled: {
    serviceModes: [],
    visitType: [],
  },
  serviceCategories: [
    { display: 'Urgent Care', code: 'urgent-care', system: 'https://fhir.ottehr.com/CodeSystem/service-category' },
  ],
  FormFields: {
    patientInfo: {
      hiddenFields: ['patient-ssn', 'return-patient-check'],
      requiredFields: ['patient-birth-sex', 'patient-email', 'tell-us-more'],
      items: {
        tellUsMore: {
          key: 'tell-us-more',
          label: "Today's Complaint",
          type: 'string',
        },
      },
    },
  },
  homepageOptions: [
    { id: 'schedule-in-person-visit', label: 'Schedule In-Person Visit' },
    { id: 'start-virtual-visit', label: 'Start Virtual Visit' },
    { id: 'schedule-virtual-visit', label: 'Schedule Virtual Visit' },
  ],
  inPersonPrebookRoutingParams: [],
} as any;
