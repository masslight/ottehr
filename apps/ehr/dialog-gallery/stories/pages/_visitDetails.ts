import type { FetchMock } from '../../harness/story';
import { adminUserMock, zambdaOutput } from './_mocks';
import { mockPatient } from './_patient';

export const VISIT_ROUTE = '/visit/appointment-1';
export const VISIT_ROUTE_PATH = '/visit/:id';

const visitDetails = {
  appointment: {
    resourceType: 'Appointment',
    id: 'appointment-1',
    // "arrived" is the status in which the page offers "Move to next".
    status: 'arrived',
    start: '2026-11-13T15:00:00.000Z',
    end: '2026-11-13T15:15:00.000Z',
    appointmentType: { text: 'walk-in' },
    participant: [
      { actor: { reference: 'Patient/patient-1' }, status: 'accepted' },
      { actor: { reference: 'Location/loc-1' }, status: 'accepted' },
    ],
  },
  patient: mockPatient,
  encounter: {
    resourceType: 'Encounter',
    id: 'encounter-1',
    status: 'arrived',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
    subject: { reference: 'Patient/patient-1' },
    appointment: [{ reference: 'Appointment/appointment-1' }],
  },
  flags: [],
  visitTimezone: 'America/New_York',
  qrId: 'qr-1',
  // Not attested and no signed consent PDF: the state in which saving shows the consent reminder.
  consentIsAttested: false,
  responsiblePartyName: null,
  responsiblePartyEmail: null,
  consentDetails: null,
  visitLocationName: 'Downtown Clinic',
  visitLocationId: 'loc-1',
  standAloneForms: [
    {
      questionnaireId: 'questionnaire-1',
      questionnaireTitle: 'Sports Physical Screening',
      questionnaireUrl: 'https://example.com/fhir/Questionnaire/sports-physical-screening',
      allItems: [
        { linkId: 'played-sports', type: 'string', text: 'Sports played this season' },
        { linkId: 'prior-injury', type: 'string', text: 'Prior injuries' },
      ],
      questionnaireResponse: {
        resourceType: 'QuestionnaireResponse',
        id: 'form-qr-1',
        status: 'completed',
        questionnaire: 'https://example.com/fhir/Questionnaire/sports-physical-screening|1.0.0',
        item: [
          { linkId: 'played-sports', answer: [{ valueString: 'Soccer, track' }] },
          { linkId: 'prior-injury', answer: [{ valueString: 'Sprained left ankle (2024)' }] },
        ],
      },
    },
  ],
};

export const visitDetailsMocks: FetchMock[] = [
  adminUserMock,
  { url: 'ehr-get-visit-details', response: zambdaOutput(visitDetails) },
  {
    url: 'get-visit-files',
    response: zambdaOutput({
      photoIdCards: [],
      insuranceCards: [],
      insuranceCardsSecondary: [],
      consentPdfUrls: [],
      fullCardPdfs: [],
    }),
  },
  { url: 'get-visit-fax-history', response: zambdaOutput({ faxesSent: [] }) },
  { url: 'list-service-categories', response: zambdaOutput({ serviceCategories: [] }) },
  {
    url: 'get-patient-account',
    response: zambdaOutput({ patient: mockPatient, coverages: {}, insuranceOrgs: [], coverageChecks: [] }),
  },
  {
    url: /\/fhir\/Patient\b/,
    response: { resourceType: 'Bundle', type: 'searchset', total: 1, entry: [{ resource: mockPatient }] },
  },
];

export const VISIT_NOTES =
  'Whole visit page rendered from mocked zambdas (visit in "arrived" status, patient account with no coverages, consent not attested, one standalone custom form); requests with no mock answer empty.';
