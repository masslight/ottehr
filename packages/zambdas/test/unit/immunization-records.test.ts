// Immunization records: the Immunization written alongside an administered order, outside doses, per-vaccine marks
// and the backfill's selection.
import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { Immunization, MedicationAdministration, Organization } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  IMMUNIZATION_ADMINISTRATION_IDENTIFIER_SYSTEM,
  IMMUNIZATION_INFORMATION_SOURCE_SYSTEM,
  IMMUNIZATION_MARK_CLEARED_EXTENSION_URL,
  IMMUNIZATION_MARK_REASON_SYSTEM,
  immunizationFromMedicationAdministration,
  immunizationMarkToRecord,
  immunizationToRecord,
  VACCINE_GROUP_CODE_SYSTEM,
} from 'utils/lib/fhir/immunization';
import { IMMUNIZATION_ORDER_TAG_CODE, IMMUNIZATION_ORDER_TAG_SYSTEM } from 'utils/lib/fhir/medication-administration';
import {
  CVX_CODE_SYSTEM_URL,
  MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM,
  MVX_CODE_SYSTEM_URL,
  PRACTITIONER_ADMINISTERED_MEDICATION_CODE,
  PRACTITIONER_ORDERED_BY_MEDICATION_CODE,
  VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
} from 'utils/lib/types/api/medication-administration.constants';
import { describe, expect, it } from 'vitest';
import { CONTAINED_MANUFACTURER_ORG_ID, CONTAINED_MEDICATION_ID } from '../../src/ehr/immunization/common';
import {
  activeMarkForGroup,
  buildImmunizationMark,
  buildOutsideImmunization,
  buildPatientImmunizationsResponse,
  clearImmunizationMark,
  immunizationSyncRequest,
  validateImmunizationMarkInput,
  validateOutsideImmunizationDetails,
} from '../../src/ehr/immunization/records';
import { selectAdministrationsToBackfill } from '../../src/scripts/backfill-immunizations.helpers';

const NOW = DateTime.fromISO('2026-11-11T09:00:00.000Z');
const patient = { reference: 'Patient/maya' };
const encounter = { reference: 'Encounter/enc-1' };
const nurse = { reference: 'Practitioner/nurse-1', display: 'J. Nurse' };
const doctor = { reference: 'Practitioner/doc-1', display: 'Dr. Patel' };

const administeredOrder = (status: MedicationAdministration['status'] = 'completed'): MedicationAdministration => ({
  resourceType: 'MedicationAdministration',
  id: 'order-1',
  meta: { tag: [{ system: IMMUNIZATION_ORDER_TAG_SYSTEM, code: IMMUNIZATION_ORDER_TAG_CODE }] },
  status,
  subject: patient,
  context: encounter,
  effectiveDateTime: '2026-11-10T10:15:00.000Z',
  medicationReference: { reference: `#${CONTAINED_MEDICATION_ID}` },
  dosage: {
    dose: { value: 0.5, unit: 'mL', system: 'http://unitsofmeasure.org' },
    route: { coding: [{ code: 'IM', system: 'http://hl7.org/fhir/ValueSet/route-codes', display: 'Intramuscular' }] },
    site: { coding: [{ code: '61396006', system: 'http://snomed.info/sct', display: 'Left thigh' }] },
  },
  performer: [
    {
      actor: doctor,
      function: {
        coding: [
          { system: MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM, code: PRACTITIONER_ORDERED_BY_MEDICATION_CODE },
        ],
      },
    },
    {
      actor: nurse,
      function: {
        coding: [
          { system: MEDICATION_ADMINISTRATION_PERFORMER_TYPE_SYSTEM, code: PRACTITIONER_ADMINISTERED_MEDICATION_CODE },
        ],
      },
    },
  ],
  contained: [
    {
      resourceType: 'Medication',
      id: CONTAINED_MEDICATION_ID,
      code: { text: 'Pentacel (DTaP-IPV/Hib)' },
      manufacturer: { reference: `#${CONTAINED_MANUFACTURER_ORG_ID}` },
      batch: { lotNumber: 'U7421AA', expirationDate: '2027-06-30' },
      extension: [
        {
          url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
          valueCodeableConcept: { coding: [{ system: CVX_CODE_SYSTEM_URL, code: '120' }] },
        },
        {
          url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
          valueCodeableConcept: { coding: [{ system: MVX_CODE_SYSTEM_URL, code: 'PMC' }] },
        },
      ],
    },
    { resourceType: 'Organization', id: CONTAINED_MANUFACTURER_ORG_ID, name: 'Sanofi Pasteur' } as Organization,
  ],
});

// the transaction request's resource; the request type is a union with GET, which has none
const resourceOf = (request: BatchInputRequest<Immunization> | undefined): Immunization | undefined =>
  (request as { resource?: Immunization } | undefined)?.resource;

const fakeOystehr = (immunizations: Immunization[]): Oystehr =>
  ({ fhir: { search: async () => ({ unbundle: () => immunizations }) } }) as unknown as Oystehr;

describe('Immunization alongside an administered order', () => {
  it('carries the dose given here, linked to its MedicationAdministration', () => {
    const immunization = immunizationFromMedicationAdministration(administeredOrder());

    expect(immunization).toMatchObject({
      resourceType: 'Immunization',
      status: 'completed',
      primarySource: true,
      identifier: [{ system: IMMUNIZATION_ADMINISTRATION_IDENTIFIER_SYSTEM, value: 'order-1' }],
      vaccineCode: { coding: [{ system: CVX_CODE_SYSTEM_URL, code: '120' }], text: 'Pentacel (DTaP-IPV/Hib)' },
      patient,
      encounter,
      occurrenceDateTime: '2026-11-10T10:15:00.000Z',
      manufacturer: { display: 'Sanofi Pasteur', identifier: { system: MVX_CODE_SYSTEM_URL, value: 'PMC' } },
      lotNumber: 'U7421AA',
      expirationDate: '2027-06-30',
      doseQuantity: { value: 0.5, unit: 'mL' },
      route: { coding: [{ code: 'IM' }] },
      site: { coding: [{ code: '61396006' }] },
      performer: [
        { function: { coding: [{ code: 'AP' }] }, actor: nurse },
        { function: { coding: [{ code: 'OP' }] }, actor: doctor },
      ],
    });
    expect(immunization.recorded).toBeDefined();

    const record = immunizationToRecord({ ...immunization, id: 'imm-1' });
    expect(record).toMatchObject({
      id: 'imm-1',
      vaccineName: 'Pentacel (DTaP-IPV/Hib)',
      cvx: '120',
      outside: false,
      dateGiven: '2026-11-10T10:15:00.000Z',
      dateUnknown: false,
      administeredBy: { id: 'nurse-1', name: 'J. Nurse' },
      lot: 'U7421AA',
      manufacturer: 'Sanofi Pasteur',
      mvx: 'PMC',
      medicationAdministrationId: 'order-1',
      encounterId: 'enc-1',
    });
  });

  it('is created on administration, updated in place on re-administration and entered in error when undone', async () => {
    const created = await immunizationSyncRequest(fakeOystehr([]), administeredOrder());
    expect(created).toMatchObject({ method: 'POST', url: '/Immunization', resource: { status: 'completed' } });

    const existing: Immunization = { ...resourceOf(created)!, id: 'imm-1', recorded: '2026-11-10T10:16:00.000Z' };
    const partly = await immunizationSyncRequest(fakeOystehr([existing]), administeredOrder('on-hold'));
    expect(partly).toMatchObject({
      method: 'PUT',
      url: '/Immunization/imm-1',
      resource: { id: 'imm-1', status: 'completed', recorded: '2026-11-10T10:16:00.000Z' },
    });

    const undone = await immunizationSyncRequest(fakeOystehr([existing]), administeredOrder('not-done'));
    expect(resourceOf(undone)?.status).toBe('entered-in-error');
    const cancelled = await immunizationSyncRequest(fakeOystehr([existing]), administeredOrder('stopped'));
    expect(resourceOf(cancelled)?.status).toBe('entered-in-error');
  });

  it('writes nothing for an order that was never administered', async () => {
    expect(await immunizationSyncRequest(fakeOystehr([]), administeredOrder('in-progress'))).toBeUndefined();
    expect(await immunizationSyncRequest(fakeOystehr([]), administeredOrder('stopped'))).toBeUndefined();
  });
});

describe('outside doses', () => {
  it('needs the vaccine, a real past date when given and a known source', () => {
    expect(() => validateOutsideImmunizationDetails({})).toThrow(/vaccine.name/);
    expect(() => validateOutsideImmunizationDetails({ vaccine: { name: 'DTaP' }, dateGiven: 'yesterday' })).toThrow(
      /not a valid date/
    );
    expect(() =>
      validateOutsideImmunizationDetails({
        vaccine: { name: 'DTaP' },
        dateGiven: DateTime.now().plus({ days: 1 }).toISODate(),
      })
    ).toThrow(/future/);
    expect(() => validateOutsideImmunizationDetails({ vaccine: { name: 'DTaP' }, source: 'hearsay' })).toThrow(
      /Unknown source/
    );
    expect(() => validateOutsideImmunizationDetails({ vaccine: { name: 'DTaP', id: '../Patient' } })).toThrow(
      /not a valid id/
    );
    expect(
      validateOutsideImmunizationDetails({
        vaccine: { id: 'med-1', name: ' DTaP ' },
        dateGiven: '2026-03-02',
        place: 'Mercy Pediatrics',
        source: 'written-record',
        cvx: '20',
      })
    ).toEqual({
      vaccine: { id: 'med-1', name: 'DTaP' },
      cvx: '20',
      dateGiven: '2026-03-02',
      place: 'Mercy Pediatrics',
      source: 'written-record',
      lot: undefined,
      manufacturer: undefined,
      mvx: undefined,
    });
  });

  it('is an Immunization only: primary source false, the source coded from NIP001, the date or "unknown"', () => {
    const dated = buildOutsideImmunization(
      {
        vaccine: { name: 'DTaP' },
        cvx: '20',
        dateGiven: '2026-03-02',
        place: 'Mercy Pediatrics',
        source: 'written-record',
      },
      patient,
      encounter,
      nurse,
      NOW
    );
    expect(dated).toEqual({
      resourceType: 'Immunization',
      status: 'completed',
      primarySource: false,
      reportOrigin: {
        coding: [
          {
            system: IMMUNIZATION_INFORMATION_SOURCE_SYSTEM,
            code: '03',
            display: "Historical information - from parent's written record",
          },
        ],
        text: 'a written record',
      },
      vaccineCode: { coding: [{ system: CVX_CODE_SYSTEM_URL, code: '20' }], text: 'DTaP' },
      patient,
      encounter,
      occurrenceDateTime: '2026-03-02',
      recorded: NOW.toISO(),
      location: { display: 'Mercy Pediatrics' },
      performer: [
        {
          function: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0443', code: 'EP' }] },
          actor: nurse,
        },
      ],
    });

    const undated = buildOutsideImmunization({ vaccine: { name: 'MMR' } }, patient, encounter, nurse, NOW);
    expect(undated.occurrenceDateTime).toBeUndefined();
    expect(undated.occurrenceString).toBe('unknown');
    expect(undated.reportOrigin).toMatchObject({ coding: [{ code: '01' }], text: 'source unspecified' });

    const record = immunizationToRecord({ ...undated, id: 'imm-2' });
    expect(record).toMatchObject({
      outside: true,
      dateUnknown: true,
      dateGiven: undefined,
      source: 'unspecified',
      sourceCode: '01',
    });
    expect(immunizationToRecord({ ...dated, id: 'imm-3' })).toMatchObject({
      outside: true,
      dateGiven: '2026-03-02',
      place: 'Mercy Pediatrics',
      source: 'written-record',
      sourceCode: '03',
    });
  });
});

describe('per-vaccine marks', () => {
  const input = { patientId: 'maya', vaccineGroup: 'rota', mark: 'declined' as const, note: 'Parents declined' };

  it('validates the patient id, the group and the mark', () => {
    expect(() => validateImmunizationMarkInput({})).toThrow(/patientId/);
    expect(() =>
      validateImmunizationMarkInput({ patientId: 'maya', vaccineGroup: 'unicorn', mark: 'declined' })
    ).toThrow(/Unknown vaccine group/);
    expect(() => validateImmunizationMarkInput({ patientId: 'maya', vaccineGroup: 'rota', mark: 'meh' })).toThrow(
      /Unknown mark/
    );
    expect(validateImmunizationMarkInput({ ...input, note: '  ' })).toEqual({ ...input, note: undefined });
  });

  it('is an Immunization not done, with the reason, the group, who and when, and keeps its history when cleared', () => {
    const mark = { ...buildImmunizationMark(input, patient, nurse, NOW), id: 'mark-1' };
    expect(mark).toMatchObject({
      status: 'not-done',
      statusReason: { coding: [{ system: IMMUNIZATION_MARK_REASON_SYSTEM, code: 'PATOBJ' }] },
      vaccineCode: { coding: [{ system: VACCINE_GROUP_CODE_SYSTEM, code: 'rota' }], text: 'Rotavirus' },
      recorded: NOW.toISO(),
      note: [{ text: 'Parents declined', authorReference: nurse }],
    });
    expect(immunizationMarkToRecord(mark)).toEqual({
      id: 'mark-1',
      vaccineGroup: { code: 'rota', display: 'Rotavirus' },
      mark: 'declined',
      markedAt: NOW.toISO(),
      markedBy: { id: 'nurse-1', name: 'J. Nurse' },
      note: 'Parents declined',
    });
    expect(activeMarkForGroup([mark], 'rota')).toBe(mark);
    expect(activeMarkForGroup([mark], 'mmr')).toBeUndefined();

    const later = NOW.plus({ days: 27 });
    const cleared = clearImmunizationMark(mark, doctor, later);
    expect(cleared.status).toBe('not-done');
    expect(cleared.extension?.find((e) => e.url === IMMUNIZATION_MARK_CLEARED_EXTENSION_URL)?.extension).toEqual([
      { url: 'date', valueDateTime: later.toISO() },
      { url: 'by', valueReference: doctor },
    ]);
    expect(immunizationMarkToRecord(cleared).cleared).toEqual({
      at: later.toISO(),
      by: { id: 'doc-1', name: 'Dr. Patel' },
    });
    expect(activeMarkForGroup([cleared], 'rota')).toBeUndefined();
    expect(() => clearImmunizationMark(cleared, doctor, later)).toThrow(/already cleared/);
    expect(() => clearImmunizationMark({ ...mark, status: 'completed' }, doctor, later)).toThrow(
      /not an immunization mark/
    );
  });

  it('the patient response lists doses newest first with undated last, marks with their history, no undone doses', () => {
    const given = { ...immunizationFromMedicationAdministration(administeredOrder()), id: 'given' };
    const undone = { ...immunizationFromMedicationAdministration(administeredOrder('not-done')), id: 'undone' };
    const outside = {
      ...buildOutsideImmunization(
        { vaccine: { name: 'MMR' }, dateGiven: '2026-11-11' },
        patient,
        encounter,
        nurse,
        NOW
      ),
      id: 'outside',
    };
    const undated = {
      ...buildOutsideImmunization({ vaccine: { name: 'Hep B' } }, patient, encounter, nurse, NOW),
      id: 'undated',
    };
    const mark = { ...buildImmunizationMark(input, patient, nurse, NOW), id: 'mark' };

    const response = buildPatientImmunizationsResponse([undated, undone, given, mark, outside]);

    expect(response.immunizations.map((record) => record.id)).toEqual(['outside', 'given', 'undated']);
    expect(response.marks.map((record) => record.id)).toEqual(['mark']);
  });
});

describe('backfill selection', () => {
  it('creates for administered vaccine orders without an Immunization and skips the rest', () => {
    const linked: Immunization = {
      ...immunizationFromMedicationAdministration({ ...administeredOrder(), id: 'order-linked' }),
      id: 'imm-linked',
    };
    const result = selectAdministrationsToBackfill(
      [
        administeredOrder(),
        { ...administeredOrder('on-hold'), id: 'order-partly' },
        { ...administeredOrder(), id: 'order-linked' },
        { ...administeredOrder('in-progress'), id: 'order-pending' },
        { ...administeredOrder(), id: 'order-med', meta: undefined },
      ],
      [linked]
    );
    expect(result.toCreate.map((order) => order.id)).toEqual(['order-1', 'order-partly']);
    expect(result.existing).toBe(1);
    expect(result.skipped).toBe(2);
  });
});
