import { TelemedStatusHistoryElement } from 'ehr-utils/lib/types/api/get-telemed-appointments/get-telemed-appointments.types';
import { AppointmentPackage, LocationIdToAbbreviationMap } from '../helpers/types';
import {
  Appointment,
  Encounter,
  Location,
  Practitioner,
  Resource,
  QuestionnaireResponse,
  EncounterStatusHistory,
} from 'fhir/r4';

// VR - Video Room

export const virtualReadyAppointment: Appointment = {
  id: '265f8134-3546-40a6-9f6f-730f858ae1a3',
  status: 'arrived',
  resourceType: 'Appointment',
  participant: [
    {
      actor: {
        type: 'Patient',
        reference: 'Patient/f0497105-9c68-4208-8e5c-46a0b25bd696',
      },
      status: 'accepted',
    },
    {
      actor: {
        // NY
        reference: 'Location/6d3fe1c9-1ebe-4625-b3e7-66bfccb89385',
      },
      status: 'accepted',
    },
  ],
  start: '2023-02-13T13:00:00.000-05:00',
  end: '2023-02-13T14:00:00.000-05:00',
  meta: {
    versionId: '04086aa8-19de-42d2-85df-375013cae40f',
    lastUpdated: '2023-12-08T17:08:07.451Z',
  },
  extension: [
    {
      url: 'https://extensions.fhir.zapehr.com/appointment-virtual-service-pre-release',
      extension: [
        {
          url: 'channelType',
          valueCoding: {
            system: 'https://fhir.zapehr.com/virtual-service-type',
            code: 'twilio-video-group-rooms',
            display: 'Twilio Video',
          },
        },
      ],
    },
  ],
};

export const virtualReadyAppointmentEncounter: Encounter = {
  id: '9660e1cb-f84c-464d-8594-f6713fa837a5',
  status: 'planned',
  resourceType: 'Encounter',
  text: {
    status: 'generated',
    div: '<div xmlns="http://www.w3.org/1999/xhtml">Encounter for telemed room</div>',
  },
  contained: [
    {
      resourceType: 'Location',
      id: 'home',
      description: "Client's home",
      mode: 'kind',
    },
  ],
  subject: {
    reference: 'Patient/448fd3ad-35eb-4728-92bd-587dcd8f64c5',
  },
  class: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: 'VR',
    display: 'virtual',
  },
  period: {
    start: '2023-12-01T11:18:44.496Z',
  },
  location: [
    {
      location: {
        reference: '#home',
        display: "Client's home",
      },
    },
  ],
  appointment: [
    {
      reference: 'Appointment/265f8134-3546-40a6-9f6f-730f858ae1a3',
    },
  ],
  meta: {
    versionId: '4e46f403-6248-4e7b-9e9c-7bcc17256c61',
    lastUpdated: '2023-12-01T11:18:46.266Z',
  },
  extension: [
    {
      url: 'https://extensions.fhir.zapehr.com/encounter-virtual-service-pre-release',
      extension: [
        {
          url: 'channelType',
          valueCoding: {
            system: 'https://fhir.zapehr.com/virtual-service-type',
            code: 'twilio-video-group-rooms',
            display: 'Twilio Video Group Rooms',
          },
        },
        {
          url: 'addressString',
          valueString: 'RMd8d36eb411d753e3e33f18ac40e9056d',
        },
      ],
    },
  ],
};

export const questionnaireForReadyEncounter: QuestionnaireResponse = {
  id: '67523d37-685f-44e5-8d32-5c1ee7764f0b',
  status: 'completed',
  resourceType: 'QuestionnaireResponse',
  questionnaire: 'Questionnaire/fcfb29e9-1139-4013-8dfb-bb3d4e8c5a84',
  subject: {
    reference: 'Patient/65dd3a0a-b5eb-4f79-8c10-2f0883880428',
  },
  encounter: {
    reference: 'Encounter/9660e1cb-f84c-464d-8594-f6713fa837a5',
  },
  authored: '2023-12-22T22:06:05.376Z',
  source: {
    reference: 'RelatedPerson/fb0d50b2-434a-4f27-8298-6c90580eae98',
  },
  item: [
    {
      linkId: 'patient-street-address',
      answer: [
        {
          valueString: '12345 Rainy Street',
        },
      ],
    },
    {
      linkId: 'patient-city',
      answer: [
        {
          valueString: 'Arlen',
        },
      ],
    },
    {
      linkId: 'patient-state',
      answer: [
        {
          valueString: 'CO',
        },
      ],
    },
    {
      linkId: 'patient-zip',
      answer: [
        {
          valueString: '12345',
        },
      ],
    },
    {
      linkId: 'patient-filling-out-as',
      answer: [
        {
          valueString: 'Parent/Guardian',
        },
      ],
    },
    {
      linkId: 'guardian-email',
      answer: [
        {
          valueString: 'example@example.com',
        },
      ],
    },
    {
      linkId: 'guardian-number',
      answer: [
        {
          valueString: '1234567890',
        },
      ],
    },
    {
      linkId: 'mobile-opt-in',
      answer: [
        {
          valueBoolean: false,
        },
      ],
    },
    {
      linkId: 'patient-point-of-discovery',
      answer: [
        {
          valueString: 'Google/Internet search',
        },
      ],
    },
    {
      linkId: 'payment-option',
      answer: [
        {
          valueString: 'I have insurance',
        },
      ],
    },
    {
      linkId: 'insurance-carrier',
      answer: [
        {
          valueString: 'Fidelis',
        },
      ],
    },
    {
      linkId: 'insurance-member-id',
      answer: [
        {
          valueString: '1234567',
        },
      ],
    },
    {
      linkId: 'policy-holder-first-name',
      answer: [
        {
          valueString: 'AJ',
        },
      ],
    },
    {
      linkId: 'policy-holder-last-name',
      answer: [
        {
          valueString: 'Test',
        },
      ],
    },
    {
      linkId: 'policy-holder-date-of-birth',
      answer: [
        {
          valueDate: '1999-01-01',
        },
      ],
    },
    {
      linkId: 'policy-holder-birth-sex',
      answer: [
        {
          valueString: 'Female',
        },
      ],
    },
    {
      linkId: 'patient-relationship-to-insured',
      answer: [
        {
          valueString: 'Sibling',
        },
      ],
    },
    {
      linkId: 'responsible-party-relationship',
      answer: [
        {
          valueString: 'Legal Guardian',
        },
      ],
    },
    {
      linkId: 'responsible-party-first-name',
      answer: [
        {
          valueString: 'Test',
        },
      ],
    },
    {
      linkId: 'responsible-party-last-name',
      answer: [
        {
          valueString: 'Test',
        },
      ],
    },
    {
      linkId: 'responsible-party-date-of-birth',
      answer: [
        {
          valueDate: '1990-07-01',
        },
      ],
    },
    {
      linkId: 'responsible-party-birth-sex',
      answer: [
        {
          valueString: 'Male',
        },
      ],
    },
    {
      linkId: 'hipaa-acknowledgement',
      answer: [
        {
          valueBoolean: true,
        },
      ],
    },
    {
      linkId: 'consent-to-treat',
      answer: [
        {
          valueBoolean: true,
        },
      ],
    },
    {
      linkId: 'signature',
      answer: [
        {
          valueString: 'AJ Ancheta',
        },
      ],
    },
    {
      linkId: 'full-name',
      answer: [
        {
          valueString: 'AJ Test',
        },
      ],
    },
    {
      linkId: 'consent-form-signer-relationship',
      answer: [
        {
          valueString: 'Parent',
        },
      ],
    },
  ],
  extension: [
    {
      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/ip-address',
      valueString: '::1',
    },
  ],
  meta: {
    versionId: '42eb544f-22f7-47e0-9d0f-7645549280e7',
    lastUpdated: '2023-12-22T22:06:11.361Z',
  },
};

export const virtualPreVideoAppointment: Appointment = {
  id: '266f8134-3546-40a6-9f6f-730f858ae1a3',
  status: 'pending',
  resourceType: 'Appointment',
  participant: [
    {
      actor: {
        type: 'Patient',
        reference: 'Patient/f0497105-9c68-4208-8e5c-46a0b25bd696',
      },
      status: 'accepted',
    },
    {
      actor: {
        // TX
        reference: 'Location/7143e392-7b37-4fe4-9c06-4faf6ec8a406',
      },
      status: 'accepted',
    },
  ],
  start: '2023-02-13T13:00:00.000-05:00',
  end: '2023-02-13T14:00:00.000-05:00',
  meta: {
    versionId: '04086aa8-19de-42d2-85df-375013cae40f',
    lastUpdated: '2023-12-08T17:08:07.451Z',
  },
  extension: [
    {
      url: 'https://extensions.fhir.zapehr.com/appointment-virtual-service-pre-release',
      extension: [
        {
          url: 'channelType',
          valueCoding: {
            system: 'https://fhir.zapehr.com/virtual-service-type',
            code: 'twilio-video-group-rooms',
            display: 'Twilio Video',
          },
        },
      ],
    },
  ],
};

export const virtualPreVideoAppointmentEncounter: Encounter = {
  id: '7d073d40-02fc-4b1e-a5be-ed9fe31cc31f',
  status: 'arrived',
  resourceType: 'Encounter',
  text: {
    status: 'generated',
    div: '<div xmlns="http://www.w3.org/1999/xhtml">Encounter for telemed room</div>',
  },
  contained: [
    {
      resourceType: 'Location',
      id: 'home',
      description: "Client's home",
      mode: 'kind',
    },
  ],
  statusHistory: [
    {
      status: 'planned',
      period: {
        start: '2023-12-01T11:25:19.525Z',
        end: '2023-12-01T11:26:19.525Z',
      },
    },
  ],
  subject: {
    reference: 'Patient/448fd3ad-35eb-4728-92bd-587dcd8f64c5',
  },
  class: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: 'VR',
    display: 'virtual',
  },
  period: {
    start: '2023-12-01T11:25:19.525Z',
  },
  location: [
    {
      location: {
        reference: '#home',
        display: "Client's home",
      },
    },
  ],
  appointment: [
    {
      reference: 'Appointment/266f8134-3546-40a6-9f6f-730f858ae1a3',
    },
  ],
  meta: {
    versionId: 'cc2a3749-2c7d-4185-9875-f8ec67182dcf',
    lastUpdated: '2023-12-01T11:25:24.663Z',
  },
  extension: [
    {
      url: 'https://extensions.fhir.zapehr.com/encounter-virtual-service-pre-release',
      extension: [
        {
          url: 'channelType',
          valueCoding: {
            system: 'https://fhir.zapehr.com/virtual-service-type',
            code: 'twilio-video-group-rooms',
            display: 'Twilio Video Group Rooms',
          },
        },
        {
          url: 'addressString',
          valueString: 'RM9d9e1b8efdc14c983e6861472912b37b',
        },
      ],
    },
  ],
};

export const questionnaireForPreVideoEncounter: QuestionnaireResponse = {
  id: '67623d37-685f-44e5-8d32-5c1ee7764f0b',
  status: 'completed',
  resourceType: 'QuestionnaireResponse',
  questionnaire: 'Questionnaire/fcfb29e9-1139-4013-8dfb-bb3d4e8c5a84',
  subject: {
    reference: 'Patient/65dd3a0a-b5eb-4f79-8c10-2f0883880428',
  },
  encounter: {
    reference: 'Encounter/7d073d40-02fc-4b1e-a5be-ed9fe31cc31f',
  },
  authored: '2023-12-22T22:06:05.376Z',
  source: {
    reference: 'RelatedPerson/fb0d50b2-434a-4f27-8298-6c90580eae98',
  },
  item: [
    {
      linkId: 'patient-street-address',
      answer: [
        {
          valueString: '12345 Rainy Street',
        },
      ],
    },
    {
      linkId: 'patient-city',
      answer: [
        {
          valueString: 'Arlen',
        },
      ],
    },
    {
      linkId: 'patient-state',
      answer: [
        {
          valueString: 'CO',
        },
      ],
    },
    {
      linkId: 'patient-zip',
      answer: [
        {
          valueString: '12345',
        },
      ],
    },
    {
      linkId: 'patient-filling-out-as',
      answer: [
        {
          valueString: 'Parent/Guardian',
        },
      ],
    },
    {
      linkId: 'guardian-email',
      answer: [
        {
          valueString: 'example@example.com',
        },
      ],
    },
    {
      linkId: 'guardian-number',
      answer: [
        {
          valueString: '9372234871',
        },
      ],
    },
    {
      linkId: 'mobile-opt-in',
      answer: [
        {
          valueBoolean: false,
        },
      ],
    },
    {
      linkId: 'patient-point-of-discovery',
      answer: [
        {
          valueString: 'Google/Internet search',
        },
      ],
    },
    {
      linkId: 'payment-option',
      answer: [
        {
          valueString: 'I have insurance',
        },
      ],
    },
    {
      linkId: 'insurance-carrier',
      answer: [
        {
          valueString: 'Fidelis',
        },
      ],
    },
    {
      linkId: 'insurance-member-id',
      answer: [
        {
          valueString: '1234567',
        },
      ],
    },
    {
      linkId: 'policy-holder-first-name',
      answer: [
        {
          valueString: 'AJ',
        },
      ],
    },
    {
      linkId: 'policy-holder-last-name',
      answer: [
        {
          valueString: 'Test',
        },
      ],
    },
    {
      linkId: 'policy-holder-date-of-birth',
      answer: [
        {
          valueDate: '1999-01-01',
        },
      ],
    },
    {
      linkId: 'policy-holder-birth-sex',
      answer: [
        {
          valueString: 'Female',
        },
      ],
    },
    {
      linkId: 'patient-relationship-to-insured',
      answer: [
        {
          valueString: 'Sibling',
        },
      ],
    },
    {
      linkId: 'responsible-party-relationship',
      answer: [
        {
          valueString: 'Legal Guardian',
        },
      ],
    },
    {
      linkId: 'responsible-party-first-name',
      answer: [
        {
          valueString: 'Test',
        },
      ],
    },
    {
      linkId: 'responsible-party-last-name',
      answer: [
        {
          valueString: 'Test',
        },
      ],
    },
    {
      linkId: 'responsible-party-date-of-birth',
      answer: [
        {
          valueDate: '1990-07-01',
        },
      ],
    },
    {
      linkId: 'responsible-party-birth-sex',
      answer: [
        {
          valueString: 'Male',
        },
      ],
    },
    {
      linkId: 'hipaa-acknowledgement',
      answer: [
        {
          valueBoolean: true,
        },
      ],
    },
    {
      linkId: 'consent-to-treat',
      answer: [
        {
          valueBoolean: true,
        },
      ],
    },
    {
      linkId: 'signature',
      answer: [
        {
          valueString: 'AJ Ancheta',
        },
      ],
    },
    {
      linkId: 'full-name',
      answer: [
        {
          valueString: 'AJ Test',
        },
      ],
    },
    {
      linkId: 'consent-form-signer-relationship',
      answer: [
        {
          valueString: 'Parent',
        },
      ],
    },
  ],
  extension: [
    {
      url: 'https://fhir.zapehr.com/r4/StructureDefinitions/ip-address',
      valueString: '::1',
    },
  ],
  meta: {
    versionId: '42eb544f-22f7-47e0-9d0f-7645549280e7',
    lastUpdated: '2023-12-22T22:06:11.361Z',
  },
};

export const virtualOnVideoAppointment: Appointment = {
  id: '97bb3bcc-5ad5-47b2-9dbf-cb18664b4873',
  status: 'arrived',
  resourceType: 'Appointment',
  start: '2023-02-13T13:00:00.000-05:00',
  end: '2023-02-13T14:00:00.000-05:00',
  participant: [
    {
      actor: {
        type: 'Patient',
        reference: 'Patient/ca344451-3218-499b-a8b2-820467a413ac',
      },
      status: 'accepted',
    },
    {
      actor: {
        // LA
        reference: 'Location/d0cd35f6-82d2-41ec-8116-5cc91ec25904',
      },
      status: 'accepted',
    },
  ],
  meta: {
    versionId: 'b3fee5c0-38bd-4ff5-b27e-8b09a20fc7d3',
    lastUpdated: '2023-12-08T12:47:11.818Z',
  },
  extension: [
    {
      url: 'https://extensions.fhir.zapehr.com/appointment-virtual-service-pre-release',
      extension: [
        {
          url: 'channelType',
          valueCoding: {
            system: 'https://fhir.zapehr.com/virtual-service-type',
            code: 'twilio-video-group-rooms',
            display: 'Twilio Video',
          },
        },
      ],
    },
  ],
};

export const virtualOnVideoAppointmentEncounter: Encounter = {
  id: '7d083d40-02fc-4b1e-a5be-ed9fe31cc31f',
  status: 'in-progress',
  resourceType: 'Encounter',
  text: {
    status: 'generated',
    div: '<div xmlns="http://www.w3.org/1999/xhtml">Encounter for telemed room</div>',
  },
  contained: [
    {
      resourceType: 'Location',
      id: 'home',
      description: "Client's home",
      mode: 'kind',
    },
  ],
  statusHistory: [
    {
      status: 'planned',
      period: {
        start: '2023-12-01T11:25:19.525Z',
        end: '2023-12-01T11:26:19.525Z',
      },
    },
    {
      status: 'arrived',
      period: {
        start: '2023-12-01T11:26:19.525Z',
        end: '2023-12-02T5:26:19.525Z',
      },
    },
  ],
  subject: {
    reference: 'Patient/448fd3ad-35eb-4728-92bd-587dcd8f64c5',
  },
  class: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: 'VR',
    display: 'virtual',
  },
  period: {
    start: '2023-12-01T11:25:19.525Z',
  },
  location: [
    {
      location: {
        reference: '#home',
        display: "Client's home",
      },
    },
  ],
  appointment: [
    {
      reference: 'Appointment/97bb3bcc-5ad5-47b2-9dbf-cb18664b4873',
    },
  ],
  meta: {
    versionId: 'cc2a3749-2c7d-4185-9875-f8ec67182dcf',
    lastUpdated: '2023-12-01T11:25:24.663Z',
  },
  extension: [
    {
      url: 'https://extensions.fhir.zapehr.com/encounter-virtual-service-pre-release',
      extension: [
        {
          url: 'channelType',
          valueCoding: {
            system: 'https://fhir.zapehr.com/virtual-service-type',
            code: 'twilio-video-group-rooms',
            display: 'Twilio Video Group Rooms',
          },
        },
        {
          url: 'addressString',
          valueString: 'RM9d9e1b8efdc14c983e6861472912b37b',
        },
      ],
    },
  ],
};

export const virtualUnsignedAppointment: Appointment = {
  id: 'b26587b6-06a6-4098-bd9e-c585adcf16e4',
  status: 'arrived',
  resourceType: 'Appointment',
  start: '2023-02-13T13:00:00.000-05:00',
  end: '2023-02-13T14:00:00.000-05:00',
  participant: [
    {
      actor: {
        type: 'Patient',
        reference: 'Patient/ed308cd0-db87-4a75-9037-b7a0c6b60f91',
      },
      status: 'accepted',
    },
    {
      actor: {
        // VI
        reference: 'Location/c006084d-d7b3-4cfa-9d6b-36a445cddd9b',
      },
      status: 'accepted',
    },
  ],
  meta: {
    versionId: 'fd51f82a-0e18-48c9-b399-d956653497d9',
    lastUpdated: '2023-12-08T17:31:03.827Z',
  },
  extension: [
    {
      url: 'https://extensions.fhir.zapehr.com/appointment-virtual-service-pre-release',
      extension: [
        {
          url: 'channelType',
          valueCoding: {
            system: 'https://fhir.zapehr.com/virtual-service-type',
            code: 'twilio-video-group-rooms',
            display: 'Twilio Video',
          },
        },
      ],
    },
  ],
};

export const virtualUnsignedAppointmentEncounter: Encounter = {
  id: '7d074d40-02fc-4b1e-a5be-ed9fe31cc31f',
  status: 'finished',
  resourceType: 'Encounter',
  text: {
    status: 'generated',
    div: '<div xmlns="http://www.w3.org/1999/xhtml">Encounter for telemed room</div>',
  },
  contained: [
    {
      resourceType: 'Location',
      id: 'home',
      description: "Client's home",
      mode: 'kind',
    },
  ],
  statusHistory: [
    {
      status: 'planned',
      period: {
        start: '2023-12-01T11:25:19.525Z',
        end: '2023-12-01T11:26:19.525Z',
      },
    },
    {
      status: 'arrived',
      period: {
        start: '2023-12-01T11:26:19.525Z',
        end: '2023-12-02T5:26:19.525Z',
      },
    },
    {
      status: 'in-progress',
      period: {
        start: '2023-12-02T5:26:19.525Z',
        end: '2023-12-03T5:26:19.525Z',
      },
    },
  ],
  subject: {
    reference: 'Patient/448fd3ad-35eb-4728-92bd-587dcd8f64c5',
  },
  class: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: 'VR',
    display: 'virtual',
  },
  period: {
    start: '2023-12-01T11:25:19.525Z',
  },
  location: [
    {
      location: {
        reference: '#home',
        display: "Client's home",
      },
    },
  ],
  appointment: [
    {
      reference: 'Appointment/b26587b6-06a6-4098-bd9e-c585adcf16e4',
    },
  ],
  meta: {
    versionId: 'cc2a3749-2c7d-4185-9875-f8ec67182dcf',
    lastUpdated: '2023-12-01T11:25:24.663Z',
  },
  extension: [
    {
      url: 'https://extensions.fhir.zapehr.com/encounter-virtual-service-pre-release',
      extension: [
        {
          url: 'channelType',
          valueCoding: {
            system: 'https://fhir.zapehr.com/virtual-service-type',
            code: 'twilio-video-group-rooms',
            display: 'Twilio Video Group Rooms',
          },
        },
        {
          url: 'addressString',
          valueString: 'RM9d9e1b8efdc14c983e6861472912b37b',
        },
      ],
    },
  ],
};

export const virtualCompleteAppointment: Appointment = {
  id: 'f952a3d2-4d74-49a4-80e0-ad0db6fc38d5',
  status: 'fulfilled',
  resourceType: 'Appointment',
  slot: [
    {
      reference: 'Slot/f66086f9-1ed2-45be-b57c-3b0e6f16e238',
    },
  ],
  participant: [
    {
      actor: {
        reference: 'Patient/448fd3ad-35eb-4728-92bd-587dcd8f64c5',
      },
      status: 'accepted',
    },
    {
      actor: {
        // NY
        reference: 'Location/6d3fe1c9-1ebe-4625-b3e7-66bfccb89385',
      },
      status: 'accepted',
    },
  ],
  description: 'f',
  start: '2023-02-13T13:00:00.000-05:00',
  end: '2023-02-13T14:00:00.000-05:00',
  meta: {
    versionId: 'd116e547-3ccf-4678-bf4c-55be09d78bf8',
    lastUpdated: '2023-12-06T16:29:32.454Z',
  },
  extension: [
    {
      url: 'https://extensions.fhir.zapehr.com/appointment-virtual-service-pre-release',
      extension: [
        {
          url: 'channelType',
          valueCoding: {
            system: 'https://fhir.zapehr.com/virtual-service-type',
            code: 'twilio-video-group-rooms',
            display: 'Twilio Video',
          },
        },
      ],
    },
  ],
};

export const virtualCompleteAppointmentEncounter: Encounter = {
  id: '7d073r40-02fc-4b1e-a5be-ed9fe31cc31f',
  status: 'finished',
  resourceType: 'Encounter',
  text: {
    status: 'generated',
    div: '<div xmlns="http://www.w3.org/1999/xhtml">Encounter for telemed room</div>',
  },
  contained: [
    {
      resourceType: 'Location',
      id: 'home',
      description: "Client's home",
      mode: 'kind',
    },
  ],
  statusHistory: [
    {
      status: 'planned',
      period: {
        start: '2023-12-01T11:25:19.525Z',
        end: '2023-12-01T11:26:19.525Z',
      },
    },
    {
      status: 'arrived',
      period: {
        start: '2023-12-01T11:26:19.525Z',
        end: '2023-12-02T5:26:19.525Z',
      },
    },
    {
      status: 'in-progress',
      period: {
        start: '2023-12-02T5:26:19.525Z',
        end: '2023-12-03T5:26:19.525Z',
      },
    },
  ],
  subject: {
    reference: 'Patient/448fd3ad-35eb-4728-92bd-587dcd8f64c5',
  },
  class: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: 'VR',
    display: 'virtual',
  },
  period: {
    start: '2023-12-01T11:25:19.525Z',
  },
  location: [
    {
      location: {
        reference: '#home',
        display: "Client's home",
      },
    },
  ],
  appointment: [
    {
      reference: 'Appointment/f952a3d2-4d74-49a4-80e0-ad0db6fc38d5',
    },
  ],
  meta: {
    versionId: 'cc2a3749-2c7d-4185-9875-f8ec67182dcf',
    lastUpdated: '2023-12-01T11:25:24.663Z',
  },
  extension: [
    {
      url: 'https://extensions.fhir.zapehr.com/encounter-virtual-service-pre-release',
      extension: [
        {
          url: 'channelType',
          valueCoding: {
            system: 'https://fhir.zapehr.com/virtual-service-type',
            code: 'twilio-video-group-rooms',
            display: 'Twilio Video Group Rooms',
          },
        },
        {
          url: 'addressString',
          valueString: 'RM9d9e1b8efdc14c983e6861472912b37b',
        },
      ],
    },
  ],
};

export const encounterWithVRExtension: Encounter = {
  id: 'a98211d9-23ac-47a3-b286-362178401541',
  status: 'arrived',
  resourceType: 'Encounter',
  text: {
    status: 'generated',
    div: '<div xmlns="http://www.w3.org/1999/xhtml">Encounter for telemed room</div>',
  },
  contained: [
    {
      resourceType: 'Location',
      id: 'home',
      description: "Client's home",
      mode: 'kind',
    },
  ],
  subject: {
    reference: 'Patient/448fd3ad-35eb-4728-92bd-587dcd8f64c5',
  },
  class: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: 'VR',
    display: 'virtual',
  },
  period: {
    start: '2023-12-01T11:17:03.829Z',
  },
  location: [
    {
      location: {
        reference: '#home',
        display: "Client's home",
      },
    },
  ],
  appointment: [
    {
      reference: 'Appointment/f951a3d2-4d74-49a4-80e0-ad0db6fc38d5',
    },
  ],
  meta: {
    versionId: '3e7d285e-bd85-478a-b15e-795d6f542b8b',
    lastUpdated: '2023-12-01T11:17:05.866Z',
  },
  extension: [
    {
      url: 'https://extensions.fhir.zapehr.com/encounter-virtual-service-pre-release',
      extension: [
        {
          url: 'channelType',
          valueCoding: {
            system: 'https://fhir.zapehr.com/virtual-service-type',
            code: 'twilio-video-group-rooms',
            display: 'Twilio Video Group Rooms',
          },
        },
        {
          url: 'addressString',
          valueString: 'RM90c3f46c55d0f728fbc4ea2245d2c1c5',
        },
      ],
    },
  ],
};

export const appointmentWithoutVRExtension: Appointment = {
  id: 'f951a3d2-4d74-49a4-80e0-ad0db6fc38d5',
  status: 'arrived',
  resourceType: 'Appointment',
  slot: [
    {
      reference: 'Slot/f66086f9-1ed2-45be-b57c-3b0e6f16e238',
    },
  ],
  participant: [
    {
      actor: {
        reference: 'Patient/448fd3ad-35eb-4728-92bd-587dcd8f64c5',
      },
      status: 'accepted',
    },
    {
      actor: {
        reference: 'Location/6d3fe1c9-1ebe-4625-b3e7-66bfccb89385',
      },
      status: 'accepted',
    },
  ],
  description: 'f',
  start: '2023-02-13T13:00:00.000-05:00',
  end: '2023-02-13T14:00:00.000-05:00',
  meta: {
    versionId: 'd116e547-3ccf-4678-bf4c-55be09d78bf8',
    lastUpdated: '2023-12-06T16:29:32.454Z',
  },
};

export const myPractitioner: Practitioner = {
  id: 'c742c0f2-b699-4a0b-8b34-8b84524b7892',
  resourceType: 'Practitioner',
  meta: {
    versionId: 'fad86ea8-fd01-4d1a-b88a-94abb1bc065b',
    lastUpdated: '2023-12-12T19:05:50.343Z',
  },
  qualification: [
    {
      identifier: [
        {
          system: 'https://fhir.zapehr.com/r4/StructureDefinitions/practitioner-qualification-identifier',
          value: '1',
        },
      ],
      code: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0360|2.7',
            code: 'MD',
            display: 'Doctor of Medicine',
          },
        ],
        text: 'License state',
      },
      extension: [
        {
          url: 'http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/practitioner-qualification',
          extension: [
            {
              url: 'status',
              valueCode: 'active',
            },
            {
              url: 'whereValid',
              valueCodeableConcept: {
                coding: [
                  {
                    code: 'LA',
                    system: 'http://hl7.org/fhir/us/core/ValueSet/us-core-usps-state',
                  },
                ],
              },
            },
          ],
        },
      ],
    },
    {
      identifier: [
        {
          system: 'https://fhir.zapehr.com/r4/StructureDefinitions/practitioner-qualification-identifier',
          value: '2',
        },
      ],
      code: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0360|2.7',
            code: 'MD',
            display: 'Doctor of Medicine',
          },
        ],
        text: 'License state',
      },
      extension: [
        {
          url: 'http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/practitioner-qualification',
          extension: [
            {
              url: 'status',
              valueCode: 'active',
            },
            {
              url: 'whereValid',
              valueCodeableConcept: {
                coding: [
                  {
                    code: 'NY',
                    system: 'http://hl7.org/fhir/us/core/ValueSet/us-core-usps-state',
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  ],
  name: [
    {
      use: 'official',
      family: 'Paul',
    },
  ],
};

export const newYorkLocation: Location = {
  resourceType: 'Location',
  address: {
    state: 'NY',
  },
  id: '6d3fe1c9-1ebe-4625-b3e7-66bfccb89385',
  meta: {
    versionId: '1e2bb903-0f83-458e-902b-330facaea9fa',
    lastUpdated: '2023-12-08T10:27:24.321Z',
  },
  extension: [
    {
      url: 'https://extensions.fhir.zapehr.com/location-form-pre-release',
      valueCoding: {
        system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
        code: 'vi',
        display: 'Virtual',
      },
    },
  ],
  name: 'New York virtual',
};

export const losAngelesLocation: Location = {
  resourceType: 'Location',
  address: {
    state: 'LA',
  },
  id: 'd0cd35f6-82d2-41ec-8116-5cc91ec25904',
  meta: {
    versionId: '98e3eac8-74f3-42fa-8f32-156ef9437cc9',
    lastUpdated: '2023-12-08T12:39:11.643Z',
  },
  extension: [
    {
      url: 'https://extensions.fhir.zapehr.com/location-form-pre-release',
      valueCoding: {
        system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
        code: 'vi',
        display: 'Virtual',
      },
    },
  ],
  name: 'Los-Angeles virtual',
};

export const fullEncounterStatusHistory: EncounterStatusHistory[] = [
  {
    status: 'planned',
    period: {
      start: '2023-12-01T11:25:19.525Z',
      end: '2023-12-01T11:26:19.525Z',
    },
  },
  {
    status: 'arrived',
    period: {
      start: '2023-12-01T11:26:19.525Z',
      end: '2023-12-02T5:26:19.525Z',
    },
  },
  {
    status: 'in-progress',
    period: {
      start: '2023-12-02T5:26:19.525Z',
      end: '2023-12-03T5:26:19.525Z',
    },
  },
  {
    status: 'finished',
    period: {
      start: '2023-12-03T5:26:19.525Z',
      end: '2023-12-04T5:26:19.525Z',
    },
  },
];

export const unsignedEncounterMappedStatusHistory = [
  {
    status: 'ready',
    start: '2023-12-01T11:25:19.525Z',
    end: '2023-12-01T11:26:19.525Z',
  },
  {
    status: 'pre-video',
    start: '2023-12-01T11:26:19.525Z',
    end: '2023-12-02T5:26:19.525Z',
  },
  {
    status: 'on-video',
    start: '2023-12-02T5:26:19.525Z',
    end: '2023-12-03T5:26:19.525Z',
  },
  {
    status: 'unsigned',
    start: '2023-12-03T5:26:19.525Z',
    end: '2023-12-04T5:26:19.525Z',
  },
];

export const completeEncounterMappedStatusHistory: TelemedStatusHistoryElement[] = [
  {
    status: 'ready',
    start: '2023-12-01T11:25:19.525Z',
    end: '2023-12-01T11:26:19.525Z',
  },
  {
    status: 'pre-video',
    start: '2023-12-01T11:26:19.525Z',
    end: '2023-12-02T5:26:19.525Z',
  },
  {
    status: 'on-video',
    start: '2023-12-02T5:26:19.525Z',
    end: '2023-12-03T5:26:19.525Z',
  },
  {
    status: 'unsigned',
    start: '2023-12-03T5:26:19.525Z',
    end: '2023-12-04T5:26:19.525Z',
  },
  {
    status: 'complete',
    start: '2023-12-04T5:26:19.525Z',
  },
];

export const testVirtualLocationsMap: LocationIdToAbbreviationMap = {
  AK: '0fceb44a-569a-4f7c-adb0-0d726526a0bc',
  AL: '7f686fbd-2b39-4d78-9071-db6b121844c3',
  AR: '51cf2846-2d01-4ade-b249-a3548009e6db',
  AZ: 'a46ffdda-8ade-4bc6-927d-4ba51ea23e43',
  CA: '0db7a6f3-aaea-46c8-8bc7-473a4adb3274',
  CO: '916b5823-8ac9-4c4b-81cb-572a15ab3df7',
  CT: '2ff3f184-49bf-40e7-9bca-b32e48971b3c',
  DC: '1c0eaaef-e78b-4cfb-a01f-c754ed55a1eb',
  DE: '7fc5d97c-8164-40d1-b868-0b6cd20af9bc',
  FL: 'ac886f33-062b-44fd-96dc-bde14f1760e6',
  GA: '241d3d86-8708-44e3-9c83-694cd919a10a',
  HI: '6344bd7a-65bf-45b7-8145-e8ea9d08da31',
  IA: '76bde1aa-1247-4b22-bac9-458353bded68',
  ID: '1084f2a3-9748-4911-b368-a5bd16b017c4',
  IL: 'b7c96703-f2a2-4872-aff2-2462ea5700f5',
  IN: '4828244b-fc33-47e2-a2c6-6c32d500b2ff',
  KS: 'b40c4bf9-bcf8-4bc7-98c2-05b1ff08c10e',
  KY: 'f3a55f30-7473-44bf-bbea-5f89d02b0590',
  LA: 'd0cd35f6-82d2-41ec-8116-5cc91ec25904',
  MA: '2102c4e7-fefb-4c4a-896f-623fc29344c0',
  MD: '850a4ff3-8da9-4fec-acf8-53b4b01e4fb2',
  ME: 'fdf8563f-03e5-4494-98d0-4fd1229b3c99',
  MI: '877794c7-af6d-444d-aa4c-9cbc9e55f4f8',
  MN: '4537ec04-c703-48ec-918e-85991dc4ea55',
  MO: '5af0d394-1c9e-4486-9c17-4b78f53bb828',
  MS: '8fa45782-4104-4aac-8659-77432444cf83',
  MT: '191a2ea8-cc11-487d-b8c5-116fc34c65bf',
  NC: '1463c01a-6d6e-46f6-869f-18b28d7164ee',
  ND: 'ea0c2c59-8489-451a-8ae7-d8de3ef2f76d',
  NE: 'a6b1732f-7691-44cd-b653-2617e9c35f40',
  NH: '12433833-0408-47ef-949e-6c76cd934cb9',
  NJ: '455b81fc-d67f-4fc2-9ed7-208a925f4d11',
  NM: 'b7232eee-2c27-49af-afc4-b6f361f361d5',
  NV: '730017e9-eefb-4a57-b3f8-5172719bcce5',
  NY: '6d3fe1c9-1ebe-4625-b3e7-66bfccb89385',
  OH: 'b482e40f-ad37-4c86-be7e-7f55d43a3214',
  OK: '8d54f653-5413-4702-a057-8b3dd4116d55',
  OR: '2c931659-883d-45d8-abb5-9ab49e8bd3fd',
  PA: '70f9ae05-ab2b-473d-bdca-236de1b89ca6',
  RI: '9dfedd5d-7f4d-4a46-9fa0-c416cb94af8c',
  SC: 'f65efc12-d6a7-48cc-ab99-44dc0be9ef3c',
  SD: 'ca66ac21-1e4f-4d8e-8944-f18e51eba0a0',
  TN: '1a6fd3cf-5736-4277-8118-01ceb1b45cc1',
  TX: '7143e392-7b37-4fe4-9c06-4faf6ec8a406',
  UT: 'c91c816f-9cf8-425a-9b4f-23ae80764a43',
  VA: 'c751f751-a7b8-4c0f-8e5b-558d18eec336',
  VI: 'c006084d-d7b3-4cfa-9d6b-36a445cddd9b',
  VT: '8414172e-30b4-4688-bacb-7f2672889c73',
  WA: '2dc84b95-e811-44e1-b405-65cd6cf2058b',
  WI: '1fe41163-069d-4d8c-b1c8-001501272b62',
  WV: '1802510d-01b4-409d-9919-fe1f95378ad0',
  WY: '99b6d92c-9e73-4680-aeda-fcfdde6d8fd2',
};

export const allTestAppointmentsPackages: AppointmentPackage[] = [
  {
    appointment: virtualReadyAppointment,
    location: {
      state: 'NY',
      locationId: testVirtualLocationsMap['NY'],
    },
    telemedStatus: 'ready',
    telemedStatusHistory: [],
  },
  {
    appointment: virtualPreVideoAppointment,
    location: {
      state: 'TX',
      locationId: testVirtualLocationsMap['TX'],
    },
    telemedStatus: 'pre-video',
    telemedStatusHistory: [],
  },
  {
    appointment: virtualOnVideoAppointment,
    location: {
      state: 'LA',
      locationId: testVirtualLocationsMap['LA'],
    },
    telemedStatus: 'on-video',
    telemedStatusHistory: [],
  },
  {
    appointment: virtualUnsignedAppointment,
    location: {
      state: 'VI',
      locationId: testVirtualLocationsMap['VI'],
    },
    telemedStatus: 'unsigned',
    telemedStatusHistory: [],
  },
  {
    appointment: virtualCompleteAppointment,
    location: {
      state: 'NY',
      locationId: testVirtualLocationsMap['NY'],
    },
    telemedStatus: 'complete',
    telemedStatusHistory: [],
  },
];

export const testSameEstimatedTimeStatesGroups = [
  ['DC', 'MD', 'VA'],
  ['NJ', 'PA', 'VI'],
  ['NC', 'TN', 'FL'],
];

export const myPractitionerLocations: Location[] = [losAngelesLocation, newYorkLocation];

export const allLocations: (Location | Resource)[] = [
  newYorkLocation,
  losAngelesLocation,
  {
    resourceType: 'Location',
    address: {
      state: 'VI',
    },
    id: 'c006084d-d7b3-4cfa-9d6b-36a445cddd9b',
    meta: {
      versionId: 'fd9982e8-569a-49a7-b671-904bf2988661',
      lastUpdated: '2023-12-08T17:27:31.020Z',
    },
    extension: [
      {
        url: 'https://extensions.fhir.zapehr.com/location-form-pre-release',
        valueCoding: {
          system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
          code: 'vi',
          display: 'Virtual',
        },
      },
    ],
    name: 'Virginia virtual',
  },
];

export const allTestResources = [
  encounterWithVRExtension,
  virtualReadyAppointment,
  virtualReadyAppointmentEncounter,
  questionnaireForReadyEncounter,
  virtualPreVideoAppointment,
  virtualPreVideoAppointmentEncounter,
  questionnaireForPreVideoEncounter,
  virtualOnVideoAppointment,
  virtualOnVideoAppointmentEncounter,
  virtualUnsignedAppointment,
  virtualUnsignedAppointmentEncounter,
  virtualCompleteAppointment,
  virtualCompleteAppointmentEncounter,
  appointmentWithoutVRExtension,
  ...allLocations,
  {
    resourceType: 'Patient',
    active: true,
    name: [
      {
        given: ['a'],
        family: 'b',
      },
    ],
    birthDate: '1999-10-17',
    gender: 'male',
    address: [
      {
        postalCode: '10960',
      },
    ],
    id: '448fd3ad-35eb-4728-92bd-587dcd8f64c5',
    meta: {
      versionId: '8ee370a3-e3b7-497b-a042-36b407eb6dbe',
      lastUpdated: '2023-02-09T03:38:25.975Z',
    },
  },
  {
    resourceType: 'Patient',
    active: true,
    name: [
      {
        given: ['Olha'],
        family: 'Kovalenko',
      },
    ],
    birthDate: '2000-01-01',
    gender: 'female',
    address: [
      {
        postalCode: '06001',
      },
    ],
    id: 'ed308cd0-db87-4a75-9037-b7a0c6b60f91',
    meta: {
      versionId: '1f68894f-8578-4785-9d80-057a1e59d451',
      lastUpdated: '2023-02-10T09:46:21.417Z',
    },
  },
  {
    resourceType: 'Patient',
    active: true,
    name: [
      {
        given: ['Denys'],
        family: 'Ent',
      },
    ],
    birthDate: '2000-01-01',
    gender: 'female',
    address: [
      {
        postalCode: '10035',
      },
    ],
    id: 'ca344451-3218-499b-a8b2-820467a413ac',
    meta: {
      versionId: '7bc6c617-021d-47df-b40d-32366a711dd6',
      lastUpdated: '2023-02-10T10:12:42.722Z',
    },
  },
  {
    resourceType: 'Patient',
    active: true,
    name: [
      {
        given: ['alex'],
        family: 'willingham',
      },
    ],
    birthDate: '1999-10-17',
    gender: 'male',
    address: [
      {
        postalCode: '10960',
      },
    ],
    contact: [
      {
        relationship: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
                code: 'U',
              },
            ],
          },
        ],
        name: {
          given: ['Alex'],
          family: 'Willingham',
        },
        telecom: [
          {
            system: 'email',
            value: 'awillingham@masslight.com',
          },
          {
            system: 'phone',
            value: '8455216925',
          },
        ],
        address: {
          line: ['708 butternut st nw'],
          city: 'washington',
          state: 'dc',
          postalCode: '20012',
        },
      },
    ],
    id: 'f0497105-9c68-4208-8e5c-46a0b25bd696',
    meta: {
      versionId: 'fcfb9186-4779-45c0-a61d-c1ed7f0eb472',
      lastUpdated: '2023-02-14T02:29:32.460Z',
    },
  },
  {
    resourceType: 'RelatedPerson',
    active: true,
    name: [
      {
        given: ['f'],
        family: 'b',
      },
    ],
    telecom: [
      {
        system: 'phone',
        value: '1231231234',
      },
      {
        system: 'email',
        value: 'alexwillingham@gmail.com',
      },
    ],
    address: [
      {
        line: ['7', 'j'],
        city: 'd',
        state: 'dc',
        postalCode: '10960',
      },
    ],
    patient: {
      reference: 'Patient/448fd3ad-35eb-4728-92bd-587dcd8f64c5',
    },
    id: '2bd0cdc2-2fac-4ee5-9079-a4fa626a75ab',
    meta: {
      versionId: 'd2beb4a8-db8c-4f91-8e5e-bdf94c512d3e',
      lastUpdated: '2023-02-09T03:38:26.619Z',
    },
  },
  {
    resourceType: 'RelatedPerson',
    active: true,
    name: [
      {
        given: ['f'],
      },
    ],
    patient: {
      reference: 'Patient/448fd3ad-35eb-4728-92bd-587dcd8f64c5',
    },
    id: '19a17015-d635-4080-8fbd-5a77c0a1af72',
    meta: {
      versionId: '21a19d18-795e-4b9c-b0d7-a28ba45f3a40',
      lastUpdated: '2023-02-09T03:38:26.787Z',
    },
  },
  {
    resourceType: 'RelatedPerson',
    active: true,
    name: [
      {
        given: ['Olha'],
        family: 'Kovalenko',
      },
    ],
    telecom: [
      {
        system: 'phone',
        value: '1768574658',
      },
      {
        system: 'email',
        value: 'okovalenko@masslight.com',
      },
    ],
    address: [
      {
        line: ['test address'],
        city: 'Hartford',
        state: 'CT',
        postalCode: '06001',
      },
    ],
    patient: {
      reference: 'Patient/ed308cd0-db87-4a75-9037-b7a0c6b60f91',
    },
    id: '3b7f9535-f986-4070-8db7-44075ce94585',
    meta: {
      versionId: '8a4b4ef3-b919-4289-91f5-186e6f7b8c23',
      lastUpdated: '2023-02-10T09:46:22.057Z',
    },
  },
  {
    resourceType: 'RelatedPerson',
    active: true,
    name: [
      {
        given: ['Denys'],
        family: 'Ent',
      },
    ],
    telecom: [
      {
        system: 'phone',
        value: '2025248769',
      },
      {
        system: 'email',
        value: 'dmyroshnychenko+ent9@masslight.com',
      },
    ],
    address: [
      {
        line: ['356 Wesmond Dr'],
        city: 'Alexandria',
        state: 'VA',
        postalCode: '22305',
      },
    ],
    patient: {
      reference: 'Patient/ca344451-3218-499b-a8b2-820467a413ac',
    },
    id: 'b4064019-3d88-437f-ac85-b14c614e7321',
    meta: {
      versionId: '27e0e19c-d561-4706-95b0-b4130ba0c67f',
      lastUpdated: '2023-02-10T10:12:43.905Z',
    },
  },
  {
    resourceType: 'RelatedPerson',
    active: true,
    name: [
      {
        given: ['johnone'],
        family: 'doeone',
      },
    ],
    birthDate: '2000-01-01',
    patient: {
      reference: 'Patient/ca344451-3218-499b-a8b2-820467a413ac',
    },
    id: '4afe86a1-e719-4524-9e98-675a87aea5d7',
    meta: {
      versionId: 'df325c17-2ea7-4178-a7a8-2fc0a17fe191',
      lastUpdated: '2023-02-10T10:12:44.164Z',
    },
  },
  {
    resourceType: 'RelatedPerson',
    active: true,
    name: [
      {
        given: ['Denys Myroshnychenko'],
      },
    ],
    patient: {
      reference: 'Patient/ca344451-3218-499b-a8b2-820467a413ac',
    },
    id: '3922ec93-49b5-469b-94f1-7dbfde6a891b',
    meta: {
      versionId: '31ac9ebb-e692-440e-9220-46708b4fbabf',
      lastUpdated: '2023-02-10T10:12:44.714Z',
    },
  },
  {
    resourceType: 'RelatedPerson',
    active: true,
    name: [
      {
        given: ['alex'],
      },
    ],
    patient: {
      reference: 'Patient/f0497105-9c68-4208-8e5c-46a0b25bd696',
    },
    relationship: [
      {
        coding: [
          {
            code: 'ONESELF',
            system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
          },
        ],
      },
    ],
    id: 'e12f520d-603f-4fc8-aeae-a6e7a5e8c001',
    meta: {
      versionId: '6b475d2f-3ccf-49d7-a86f-59cdb1e2382e',
      lastUpdated: '2023-02-14T02:29:33.477Z',
    },
  },
];
