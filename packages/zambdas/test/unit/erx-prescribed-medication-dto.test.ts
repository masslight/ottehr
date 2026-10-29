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
      {
        code: 'ordered',
        text: 'Prescription ordered',
        recorded: '2026-10-27T15:00:30.000Z',
        agent: undefined,
        agentPractitionerId: 'practitioner-1',
      },
      {
        code: 'accepted',
        text: 'Prescription accepted by Surescripts',
        recorded: '2026-10-27T15:01:00.000Z',
        agent: 'Surescripts',
        agentPractitionerId: undefined,
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

// Review #6: a Provenance may target its prescription by a versioned or an absolute reference.
describe('makePrescribedMedicationDTO events: the target reference', () => {
  it('matches the prescription by a relative, versioned or absolute reference, and no other', () => {
    const codes = (target: string): string[] =>
      makePrescribedMedicationDTO(makeMedicationRequest(), [
        makeProvenance('ordered', '2026-10-27T15:00:30.000Z', 'x', target),
      ]).events!.map((event) => event.code);
    expect(codes('MedicationRequest/med-request-1')).toEqual(['ordered']);
    expect(codes('MedicationRequest/med-request-1/_history/3')).toEqual(['ordered']);
    expect(codes('https://fhir-api.zapehr.com/r4/MedicationRequest/med-request-1')).toEqual(['ordered']);
    expect(codes('https://fhir-api.zapehr.com/r4/MedicationRequest/med-request-1/_history/2')).toEqual(['ordered']);
    expect(codes('MedicationRequest/med-request-10')).toEqual([]);
    expect(codes('https://fhir-api.zapehr.com/r4/MedicationRequest/other')).toEqual([]);
    expect(codes('Task/med-request-1')).toEqual([]);
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

describe('makePrescribedMedicationDTO order fields', () => {
  // As the eRx service stores an order
  const stored = makeMedicationRequest({
    medicationCodeableConcept: {
      coding: [{ system: 'http://hl7.org/fhir/sid/ndc', code: '00093416173', display: 'Amoxicillin 400 mg/5ml Susp' }],
    },
    reasonCode: [
      {
        coding: [
          {
            system: 'http://hl7.org/fhir/sid/icd-10-cm',
            code: 'H66.93',
            display: 'Otitis media, unspecified, bilateral',
          },
        ],
      },
    ],
    dosageInstruction: [{ patientInstruction: 'Take 12.5 mL by mouth twice daily for 10 days.' }],
    note: [{ text: 'Shake well' }],
    dispenseRequest: {
      quantity: { value: 250, unit: 'Milliliter', system: 'http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl' },
      numberOfRepeatsAllowed: 0,
      expectedSupplyDuration: { value: 10, unit: 'days', system: 'http://unitsofmeasure.org', code: 'd' },
    },
    substitution: { allowedBoolean: false },
  });

  it('reads the order as stored', () => {
    expect(makePrescribedMedicationDTO(stored).order).toEqual({
      patientId: 'patient-1',
      ndc: '00093416173',
      medicationDescription: 'Amoxicillin 400 mg/5ml Susp',
      quantityValue: 250,
      quantityUnit: 'Milliliter',
      daysSupply: 10,
      numberOfRefills: 0,
      substitutionAllowed: false,
      noteToPharmacy: 'Shake well',
      diagnosisCode: 'H66.93',
      diagnosisDescription: 'Otitis media, unspecified, bilateral',
    });
  });

  it('leaves out what was never stored, without defaults', () => {
    const order = makePrescribedMedicationDTO(makeMedicationRequest({ subject: { reference: 'Group/g' } })).order;
    expect(Object.values(order ?? {}).filter((value) => value !== undefined)).toEqual([]);
  });

  it('leaves the rest of the row as it was', () => {
    const { order: _order, ...rest } = makePrescribedMedicationDTO(stored);
    expect(rest).toEqual({
      resourceId: 'med-request-1',
      name: 'Amoxicillin 400 mg/5ml Susp',
      instructions: 'Take 12.5 mL by mouth twice daily for 10 days.',
      added: '2026-10-27T15:00:00.000Z',
      provider: undefined,
      status: 'active',
      prescriptionId: undefined,
      encounterId: 'encounter-1',
      isRenewal: undefined,
      pharmacyId: undefined,
      pharmacyName: undefined,
      sent: '2026-10-27T15:00:00.000Z',
      events: [],
    });
  });
});

describe('makePrescribedMedicationDTO compound', () => {
  const NDC = 'http://hl7.org/fhir/sid/ndc';
  const NCI = 'http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl';
  const gram = (value: number): { value: number; unit: string; system: string; code: string } => ({
    value,
    unit: 'Gram',
    system: NCI,
    code: 'C48155',
  });
  // As the eRx service stores a compound (buildCompoundMedication). Test codes are made up.
  const compoundRequest = makeMedicationRequest({
    contained: [
      {
        resourceType: 'Medication',
        id: 'compound',
        code: { text: 'Ketoprofen 10% cream' },
        form: { coding: [{ system: NCI, code: 'C28944', display: 'Cream' }], text: 'Cream' },
        ingredient: [
          {
            itemCodeableConcept: {
              coding: [{ system: NDC, code: '00000000001', display: 'Ketoprofen Powder' }],
              text: 'Ketoprofen Powder',
            },
            strength: { numerator: gram(3), denominator: gram(30) },
          },
          {
            itemCodeableConcept: { text: 'Lidocaine' },
            strength: {
              numerator: { value: 300, unit: 'Milligram', system: NCI, code: 'C28253' },
              denominator: gram(30),
            },
          },
          { itemCodeableConcept: { text: 'Cream base' }, strength: { numerator: gram(26.7), denominator: gram(30) } },
          { itemCodeableConcept: { text: 'Unknown unit' }, strength: { numerator: { value: 1, unit: 'tbsp' } } },
        ],
      },
    ],
    medicationReference: { reference: '#compound', display: 'Ketoprofen 10% cream' },
  });

  it('is named by its contained Medication, with its form and every ingredient as the amount that went in', () => {
    const dto = makePrescribedMedicationDTO(compoundRequest);
    expect(dto.name).toBe('Ketoprofen 10% cream');
    expect(dto.order?.compound).toEqual({
      description: 'Ketoprofen 10% cream',
      dosageForm: 'Cream',
      ingredients: [
        { description: 'Ketoprofen Powder', ndc: '00000000001', amount: { value: 3, unit: 'Gram' } },
        { description: 'Lidocaine', amount: { value: 300, unit: 'Milligram' } },
        { description: 'Cream base', amount: { value: 26.7, unit: 'Gram' } },
        // Read without its amount: the order can't be rebuilt from it.
        { description: 'Unknown unit' },
      ],
    });
  });

  it('falls back to the reference display for its name', () => {
    const [medication] = compoundRequest.contained!;
    const dto = makePrescribedMedicationDTO({
      ...compoundRequest,
      contained: [{ ...medication, code: undefined, form: undefined } as typeof medication],
    });
    expect(dto.name).toBe('Ketoprofen 10% cream');
    expect(dto.order?.compound?.description).toBe('Ketoprofen 10% cream');
    expect(dto.order?.compound).not.toHaveProperty('dosageForm');
  });

  it('falls back to the medication text without a contained Medication', () => {
    const dto = makePrescribedMedicationDTO(
      makeMedicationRequest({ medicationCodeableConcept: { text: 'Magic mouthwash' } })
    );
    expect(dto.name).toBe('Magic mouthwash');
    expect(dto.order?.compound).toBeUndefined();
  });

  it('leaves a product’s name and order as they were', () => {
    const dto = makePrescribedMedicationDTO(
      makeMedicationRequest({
        medicationCodeableConcept: {
          text: 'ignored',
          coding: [{ system: NDC, code: '00093416173', display: 'Amoxicillin 400 mg/5ml Susp' }],
        },
      })
    );
    expect(dto.name).toBe('Amoxicillin 400 mg/5ml Susp');
    expect(dto.order).not.toHaveProperty('compound');
  });
});
