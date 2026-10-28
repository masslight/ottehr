import Oystehr from '@oystehr/sdk';
import { MedicationRequest, Provenance } from 'fhir/r4b';
import { ERX_EVENT_CODE_SYSTEM, PRESCRIPTION_ERX_PHARMACY_ID_URL } from 'utils/lib/fhir/constants';
import { describe, expect, it, vi } from 'vitest';
import { getErxOrders } from '../../src/ehr/get-erx-orders';
import { makePrescribedMedicationDTO } from '../../src/shared/chart-data';
import { planSection } from '../../src/shared/chart-sections/sections/plan';

const makeMedicationRequest = (overrides: Partial<MedicationRequest> = {}): MedicationRequest => ({
  resourceType: 'MedicationRequest',
  id: 'med-request-1',
  status: 'active',
  intent: 'order',
  subject: { reference: 'Patient/patient-1' },
  encounter: { reference: 'Encounter/encounter-1' },
  meta: { lastUpdated: '2026-10-27T15:00:00.000Z' },
  ...overrides,
});

describe('makePrescribedMedicationDTO pharmacy id', () => {
  it('reads the string the eRx service writes', () => {
    const medicationRequest = makeMedicationRequest({
      extension: [{ url: PRESCRIPTION_ERX_PHARMACY_ID_URL, valueString: '0002026' }],
    });
    expect(makePrescribedMedicationDTO(medicationRequest).pharmacyId).toBe('0002026');
  });

  it('still reads an integer', () => {
    const medicationRequest = makeMedicationRequest({
      extension: [{ url: PRESCRIPTION_ERX_PHARMACY_ID_URL, valueInteger: 2026 }],
    });
    expect(makePrescribedMedicationDTO(medicationRequest).pharmacyId).toBe('2026');
  });
});

const makeProvenance = (
  code: string,
  recorded: string,
  text?: string,
  target = 'MedicationRequest/med-request-1',
  who: Provenance['agent'][number]['who'] = { display: 'Surescripts' }
): Provenance => ({
  resourceType: 'Provenance',
  target: [{ reference: target }],
  recorded,
  activity: { coding: [{ system: ERX_EVENT_CODE_SYSTEM, code }], text },
  agent: [{ who }],
});

describe('makePrescribedMedicationDTO events and sent time', () => {
  const provenances = [
    makeProvenance('accepted', '2026-10-27T15:01:00.000Z', 'Prescription accepted by Surescripts'),
    makeProvenance('ordered', '2026-10-27T15:00:30.000Z', 'Prescription ordered', undefined, {
      reference: 'Practitioner/practitioner-1',
    }),
    makeProvenance('dispensed', '2026-10-27T18:00:00.000Z', 'x', 'MedicationRequest/another-request'),
    { ...makeProvenance('audit', '2026-10-27T15:02:00.000Z'), activity: { coding: [{ system: 'other', code: 'x' }] } },
  ];

  it('lists only its own eRx events, oldest first', () => {
    expect(makePrescribedMedicationDTO(makeMedicationRequest(), provenances).events).toEqual([
      { code: 'ordered', text: 'Prescription ordered', recorded: '2026-10-27T15:00:30.000Z', agent: undefined },
      {
        code: 'accepted',
        text: 'Prescription accepted by Surescripts',
        recorded: '2026-10-27T15:01:00.000Z',
        agent: 'Surescripts',
      },
    ]);
  });

  it('is sent when ordered, else when authored, else when last updated', () => {
    const authored = makeMedicationRequest({ authoredOn: '2026-10-27' });
    expect(makePrescribedMedicationDTO(authored, provenances).sent).toBe('2026-10-27T15:00:30.000Z');
    expect(makePrescribedMedicationDTO(authored).sent).toBe('2026-10-27');
    expect(makePrescribedMedicationDTO(makeMedicationRequest()).sent).toBe('2026-10-27T15:00:00.000Z');
  });
});

describe('eRx events reach the prescription table', () => {
  const medicationRequest = makeMedicationRequest({
    meta: { tag: [{ code: 'erx-medication' }], lastUpdated: '2026-10-27T15:00:00.000Z' },
  });
  const provenance = makeProvenance('ordered', '2026-10-27T15:00:30.000Z');

  it('get-erx-orders asks for the Provenances and maps them', async () => {
    const search = vi.fn().mockResolvedValue({ unbundle: () => [medicationRequest, provenance] });
    const response = await getErxOrders({ fhir: { search } } as unknown as Oystehr, { encounterIds: ['encounter-1'] });
    expect(search.mock.calls[0][0].params).toContainEqual({ name: '_revinclude', value: 'Provenance:target' });
    expect(response.orders).toHaveLength(1);
    expect(response.orders[0].sent).toBe('2026-10-27T15:00:30.000Z');
    expect(response.orders[0].events?.map((event) => event.code)).toEqual(['ordered']);
  });

  it('the plan section asks for the Provenances and maps them', async () => {
    const requests = planSection.requests('encounter-1', undefined as never);
    expect(requests.some((request) => request.url.includes('_revinclude=Provenance:target'))).toBe(true);
    const plan = await planSection.build(
      {
        encounter: { resourceType: 'Encounter', id: 'encounter-1', status: 'in-progress' },
        encounterId: 'encounter-1',
      } as never,
      [medicationRequest, provenance],
      undefined as never
    );
    expect(plan.prescribedMedications).toHaveLength(1);
    expect(plan.prescribedMedications[0].sent).toBe('2026-10-27T15:00:30.000Z');
    expect(plan.prescribedMedications[0].events?.map((event) => event.code)).toEqual(['ordered']);
  });
});
