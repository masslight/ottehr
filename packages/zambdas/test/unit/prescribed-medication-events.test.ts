import { Extension, MedicationRequest } from 'fhir/r4b';
import { PRESCRIPTION_ERX_EVENTS_URL } from 'utils/lib/fhir/constants';
import { describe, expect, it } from 'vitest';
import { makePrescribedMedicationDTO, makePrescribedMedicationEvents } from '../../src/shared/chart-data';

const makeEvent = (code: string, description: string, source: { display?: string; reference?: string }): Extension => ({
  url: 'event',
  extension: [
    { url: 'code', valueString: code },
    { url: 'description', valueString: description },
    { url: 'recorded', valueDateTime: '2026-10-10T14:00:00.000Z' },
    { url: 'source', valueReference: source },
  ],
});

const makeMedicationRequest = (extension: MedicationRequest['extension']): MedicationRequest => ({
  resourceType: 'MedicationRequest',
  id: 'med-request-1',
  status: 'active',
  intent: 'order',
  subject: { reference: 'Patient/patient-1' },
  extension,
});

describe('makePrescribedMedicationEvents', () => {
  it('request with events, reads them in order, success', () => {
    const medicationRequest = makeMedicationRequest([
      {
        url: PRESCRIPTION_ERX_EVENTS_URL,
        extension: [
          makeEvent('ordered', 'Prescription ordered', { reference: 'Practitioner/practitioner-1' }),
          makeEvent('accepted', 'Prescription accepted by Surescripts', { display: 'Surescripts' }),
        ],
      },
    ]);

    expect(makePrescribedMedicationEvents(medicationRequest)).toEqual([
      {
        code: 'ordered',
        description: 'Prescription ordered',
        recorded: '2026-10-10T14:00:00.000Z',
        source: undefined,
        practitionerId: 'practitioner-1',
      },
      {
        code: 'accepted',
        description: 'Prescription accepted by Surescripts',
        recorded: '2026-10-10T14:00:00.000Z',
        source: 'Surescripts',
        practitionerId: undefined,
      },
    ]);
  });

  it.each([
    ['no extensions', undefined],
    ['other extensions only', [{ url: 'https://example.com/extension', valueString: 'value' }]],
    ['an empty events extension', [{ url: PRESCRIPTION_ERX_EVENTS_URL }]],
  ])('request with %s, has no events, success', (_name, extension) => {
    expect(makePrescribedMedicationEvents(makeMedicationRequest(extension))).toEqual([]);
  });
});

describe('makePrescribedMedicationDTO', () => {
  it('request with events, includes them, success', () => {
    const dto = makePrescribedMedicationDTO(
      makeMedicationRequest([
        {
          url: PRESCRIPTION_ERX_EVENTS_URL,
          extension: [makeEvent('accepted', 'Prescription accepted by Surescripts', { display: 'Surescripts' })],
        },
      ])
    );

    expect(dto.events).toEqual([expect.objectContaining({ code: 'accepted', source: 'Surescripts' })]);
  });

  it('request without events, has an empty list of them, success', () => {
    expect(makePrescribedMedicationDTO(makeMedicationRequest(undefined)).events).toEqual([]);
  });
});
