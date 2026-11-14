import Oystehr from '@oystehr/sdk';
import {
  ActivityDefinition,
  Condition,
  DiagnosticReport,
  Encounter,
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
  Observation,
  ServiceRequest,
} from 'fhir/r4b';
import { VitalAlertCriticality } from 'utils/lib/types/api/chart-data/chart-data.constants';
import {
  MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE,
  MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_SYSTEM,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import {
  ABNORMAL_RESULT_DR_TAG,
  IN_HOUSE_OBS_DEF_ID_SYSTEM,
  IN_HOUSE_TEST_CODE_SYSTEM,
} from 'utils/lib/types/data/in-house/in-house.constants';
import {
  LAB_DR_TYPE_TAG,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
  OYSTEHR_LABS_FASTING_STATUS_EXT_URL,
} from 'utils/lib/types/data/labs/labs.constants';
import { describe, expect, test } from 'vitest';
import {
  buildLabResults,
  buildMedications,
  buildVisitDiagnoses,
  fetchFlowsheetData,
  labFlagOf,
  unlinkedResultKey,
} from '../../src/ehr/get-flowsheet/patient-data';

const PATIENT = 'Patient/p1';
const ICD = 'http://hl7.org/fhir/sid/icd-10';

const condition = (id: string, code: string, display: string, extra: Partial<Condition> = {}): Condition => ({
  resourceType: 'Condition',
  id,
  subject: { reference: PATIENT },
  code: { coding: [{ system: ICD, code, display }] },
  ...extra,
});

describe('buildVisitDiagnoses', () => {
  const encounters: Encounter[] = [
    {
      resourceType: 'Encounter',
      id: 'e1',
      status: 'finished',
      class: { code: 'AMB' },
      diagnosis: [{ condition: { reference: 'Condition/c2' } }, { condition: { reference: 'Condition/c1' }, rank: 1 }],
    },
    {
      resourceType: 'Encounter',
      id: 'e2',
      status: 'finished',
      class: { code: 'AMB' },
      diagnosis: [{ condition: { reference: 'Condition/c3' } }, { condition: { reference: 'Condition/missing' } }],
    },
    { resourceType: 'Encounter', id: 'e3', status: 'finished', class: { code: 'AMB' } },
    {
      resourceType: 'Encounter',
      id: 'e4',
      status: 'finished',
      class: { code: 'AMB' },
      diagnosis: [
        { condition: { reference: 'Condition/gone' }, rank: 1 },
        { condition: { reference: 'Condition/c2' } },
      ],
    },
  ];
  const conditions = [
    condition('c1', 'J45.41', 'Moderate persistent asthma with (acute) exacerbation'),
    condition('c2', 'R05.9', 'Cough'),
    condition('c3', 'F90.2', 'ADHD, combined type'),
  ];

  test('lists each visit’s diagnoses with the ranked one first', () => {
    expect(buildVisitDiagnoses({ encounters, conditions })).toEqual({
      e1: [
        { code: 'J45.41', display: 'Moderate persistent asthma with (acute) exacerbation', primary: true },
        { code: 'R05.9', display: 'Cough', primary: false },
      ],
      // No rank: the first charted diagnosis is primary; a Condition that was not found is skipped.
      e2: [{ code: 'F90.2', display: 'ADHD, combined type', primary: true }],
      // The ranked Condition is gone: the first one that exists is the primary.
      e4: [{ code: 'R05.9', display: 'Cough', primary: true }],
    });
  });
});

describe('buildMedications', () => {
  const requests: MedicationRequest[] = [
    {
      resourceType: 'MedicationRequest',
      id: 'rx1',
      status: 'active',
      intent: 'order',
      subject: { reference: PATIENT },
      encounter: { reference: 'Encounter/e1' },
      authoredOn: '2026-08-10T14:02:00.000Z',
      medicationCodeableConcept: {
        coding: [{ system: MEDICATION_DISPENSABLE_DRUG_ID, display: 'amlodipine 10 mg tablet' }],
        text: 'amlodipine 10 mg tablet',
      },
    },
    {
      resourceType: 'MedicationRequest',
      id: 'rx2',
      status: 'entered-in-error',
      intent: 'order',
      subject: { reference: PATIENT },
      encounter: { reference: 'Encounter/e1' },
      medicationCodeableConcept: { text: 'wrong drug' },
    },
  ];
  const administrations: MedicationAdministration[] = [
    {
      resourceType: 'MedicationAdministration',
      id: 'ma1',
      status: 'completed',
      subject: { reference: PATIENT },
      context: { reference: 'Encounter/e2' },
      effectiveDateTime: '2026-01-16T14:50:00.000Z',
      meta: {
        tag: [
          {
            system: MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_SYSTEM,
            code: MEDICATION_ADMINISTRATION_IN_PERSON_RESOURCE_CODE,
          },
        ],
      },
      dosage: { dose: { value: 2.5, unit: 'mg' } },
      contained: [
        {
          resourceType: 'Medication',
          id: 'med1',
          identifier: [
            { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'Albuterol 2.5 mg/3 mL nebulizer solution' },
          ],
        },
      ],
    },
    {
      resourceType: 'MedicationAdministration',
      id: 'ma2',
      status: 'stopped',
      subject: { reference: PATIENT },
      context: { reference: 'Encounter/e2' },
      medicationCodeableConcept: { coding: [{ display: 'Ondansetron 4 mg ODT' }] },
    },
  ];
  const statements: MedicationStatement[] = [
    // Written when ma1 was given: dates the in-house dose.
    {
      resourceType: 'MedicationStatement',
      id: 'given1',
      status: 'completed',
      subject: { reference: PATIENT },
      partOf: [{ reference: 'MedicationAdministration/ma1' }],
      effectiveDateTime: '2026-01-16T15:05:00.000Z',
      meta: { tag: [{ code: 'in-house-medication' }] },
    },
  ];
  const medications = buildMedications({ requests, administrations, statements });

  test('groups eRx and in-house drugs by visit with name, strength, status and time', () => {
    expect(medications).toEqual({
      e1: [{ name: 'amlodipine 10 mg tablet', source: 'eRx', status: 'active', time: '2026-08-10T14:02:00.000Z' }],
      e2: [
        {
          name: 'Albuterol 2.5 mg/3 mL nebulizer solution',
          source: 'in-house',
          status: 'administered',
          dose: '2.5 mg',
          time: '2026-01-16T15:05:00.000Z',
        },
        { name: 'Ondansetron 4 mg ODT', source: 'in-house', status: 'cancelled', dose: undefined, time: undefined },
      ],
    });
  });
});

describe('buildLabResults', () => {
  const serviceRequests: ServiceRequest[] = [
    {
      resourceType: 'ServiceRequest',
      id: 'sr-ext',
      status: 'completed',
      intent: 'order',
      subject: { reference: PATIENT },
      encounter: { reference: 'Encounter/e1' },
      code: { coding: [{ system: OYSTEHR_LAB_OI_CODE_SYSTEM, code: 'CMP' }], text: 'Comprehensive metabolic panel' },
    },
    {
      resourceType: 'ServiceRequest',
      id: 'sr-ih',
      status: 'completed',
      intent: 'order',
      subject: { reference: PATIENT },
      encounter: { reference: 'Encounter/e2' },
      code: { coding: [{ system: IN_HOUSE_TEST_CODE_SYSTEM, code: 'Flu A' }], text: 'Flu A' },
      instantiatesCanonical: ['https://ottehr.com/FHIR/InHouseLab/ActivityDefinition/FluA|14.0.0'],
    },
  ];
  const reports: DiagnosticReport[] = [
    {
      resourceType: 'DiagnosticReport',
      id: 'dr-ext',
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: '24323-8' }], text: 'CMP' },
      extension: [{ url: OYSTEHR_LABS_FASTING_STATUS_EXT_URL, valueString: 'Fasting' }],
      basedOn: [{ reference: 'ServiceRequest/sr-ext' }],
      result: [
        { reference: 'Observation/o-glucose' },
        { reference: 'Observation/o-a1c' },
        { reference: 'Observation/o-gone' },
      ],
      issued: '2026-03-10T13:30:00.000Z',
    },
    {
      resourceType: 'DiagnosticReport',
      id: 'dr-ih',
      status: 'final',
      code: { text: 'Flu A' },
      basedOn: [{ reference: 'ServiceRequest/sr-ih' }],
      result: [{ reference: 'Observation/o-flu' }],
      meta: { tag: [{ system: ABNORMAL_RESULT_DR_TAG.system, code: ABNORMAL_RESULT_DR_TAG.code }] },
      effectiveDateTime: '2026-06-20T12:00:00.000Z',
    },
    // An unsolicited result matched to the patient without a visit: no order, no encounter.
    {
      resourceType: 'DiagnosticReport',
      id: 'dr-unlinked',
      status: 'final',
      code: { text: 'TSH' },
      subject: { reference: PATIENT },
      meta: { tag: [{ system: LAB_DR_TYPE_TAG.system, code: LAB_DR_TYPE_TAG.code.unsolicited }] },
      result: [{ reference: 'Observation/o-tsh' }],
      effectiveDateTime: '2026-07-01T09:00:00.000Z',
      issued: '2026-07-02T09:00:00.000Z',
    },
    {
      resourceType: 'DiagnosticReport',
      id: 'dr-cancelled',
      status: 'cancelled',
      code: { text: 'CBC' },
      basedOn: [{ reference: 'ServiceRequest/sr-ext' }],
      result: [{ reference: 'Observation/o-glucose' }],
    },
  ];
  const observations: Observation[] = [
    {
      resourceType: 'Observation',
      id: 'o-glucose',
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: '2345-7', display: 'Glucose' }], text: 'Glucose' },
      valueQuantity: { value: 212, unit: 'mg/dL' },
      interpretation: [{ coding: [{ code: 'HH' }] }],
      referenceRange: [{ low: { value: 70 }, high: { value: 99 } }],
      effectiveDateTime: '2026-03-09T14:00:00.000Z',
    },
    {
      resourceType: 'Observation',
      id: 'o-a1c',
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: '4548-4', display: 'Hemoglobin A1c' }] },
      valueQuantity: { value: 8.1, unit: '%' },
      interpretation: [{ coding: [{ code: 'H' }] }],
      referenceRange: [{ text: '4.0-5.6' }],
    },
    {
      resourceType: 'Observation',
      id: 'o-tsh',
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: '3016-3', display: 'TSH' }], text: 'TSH' },
      valueQuantity: { value: 4.2, unit: 'mIU/L' },
    },
    {
      resourceType: 'Observation',
      id: 'o-flu',
      status: 'final',
      code: { coding: [{ system: IN_HOUSE_TEST_CODE_SYSTEM, code: 'Flu A' }] },
      valueString: 'Detected',
      extension: [{ url: IN_HOUSE_OBS_DEF_ID_SYSTEM, valueString: 'flua-def' }],
    },
  ];
  const activityDefinitions: ActivityDefinition[] = [
    {
      resourceType: 'ActivityDefinition',
      id: 'ad1',
      status: 'active',
      url: 'https://ottehr.com/FHIR/InHouseLab/ActivityDefinition/FluA',
      version: '14.0.0',
      contained: [
        {
          resourceType: 'ObservationDefinition',
          id: 'flua-def',
          code: { coding: [{ system: 'http://loinc.org', code: '104730-7' }], text: 'Influenza A antigen' },
        },
      ],
    },
  ];
  const labs = buildLabResults({ serviceRequests, reports, observations, activityDefinitions });

  test('shapes external results with the lab’s saved interpretation, never a recomputed one', () => {
    expect(labs.e1).toEqual([
      {
        analyte: 'Glucose',
        loincCodes: ['2345-7'],
        testName: 'Comprehensive metabolic panel',
        testLoincCodes: ['24323-8'],
        fasting: true,
        value: 212,
        valueText: '212',
        unit: 'mg/dL',
        referenceRange: '70-99',
        interpretation: 'HH',
        flag: VitalAlertCriticality.Critical,
        resultedAt: '2026-03-09T14:00:00.000Z',
        source: 'external',
      },
      {
        analyte: 'Hemoglobin A1c',
        loincCodes: ['4548-4'],
        testName: 'Comprehensive metabolic panel',
        testLoincCodes: ['24323-8'],
        fasting: true,
        value: 8.1,
        valueText: '8.1',
        unit: '%',
        referenceRange: '4.0-5.6',
        interpretation: 'H',
        flag: VitalAlertCriticality.Abnormal,
        resultedAt: '2026-03-10T13:30:00.000Z',
        source: 'external',
      },
    ]);
  });

  test('names an in-house result from its test definition and flags it from the report tag', () => {
    expect(labs.e2).toEqual([
      {
        analyte: 'Influenza A antigen',
        loincCodes: ['104730-7'],
        testName: 'Flu A',
        testLoincCodes: [],
        fasting: undefined,
        value: undefined,
        valueText: 'Detected',
        unit: '',
        referenceRange: '',
        interpretation: 'A',
        flag: VitalAlertCriticality.Abnormal,
        resultedAt: '2026-06-20T12:00:00.000Z',
        source: 'in-house',
      },
    ]);
  });

  test('an unlinked outside result (no order, no visit) gets its own key, dated by the report', () => {
    expect(labs[unlinkedResultKey('dr-unlinked')]).toEqual([
      {
        analyte: 'TSH',
        loincCodes: ['3016-3'],
        testName: 'TSH',
        testLoincCodes: [],
        fasting: undefined,
        value: 4.2,
        valueText: '4.2',
        unit: 'mIU/L',
        referenceRange: '',
        interpretation: '',
        flag: undefined,
        resultedAt: '2026-07-01T09:00:00.000Z',
        source: 'external',
      },
    ]);
  });

  test('ignores cancelled reports and results that are not present', () => {
    expect(Object.keys(labs)).toEqual(['e1', 'e2', unlinkedResultKey('dr-unlinked')]);
  });

  test('maps only saved interpretation codes to grid flags', () => {
    expect(labFlagOf('N')).toBeUndefined();
    expect(labFlagOf('')).toBeUndefined();
    expect(labFlagOf('L')).toBe(VitalAlertCriticality.Abnormal);
    expect(labFlagOf('LL')).toBe(VitalAlertCriticality.Critical);
  });
});

describe('fetchFlowsheetData: reflex results', () => {
  // Shapes from the labs code: a reflex report is a copy of the ordered report with the reflex tag, the reflex test's
  // code and no basedOn (scripts/labs/reflex-test-helper.ts); get-lab-orders finds it by that tag and the order's
  // placer number (checkForDiagnosticReportDrivenResults), and handle-lab-result has no ServiceRequest for it.
  const placer = { system: OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM, value: 'ORD-1001' };
  const order: ServiceRequest = {
    resourceType: 'ServiceRequest',
    id: 'sr-tsh',
    status: 'completed',
    intent: 'order',
    subject: { reference: PATIENT },
    encounter: { reference: 'Encounter/e1' },
    identifier: [placer],
    code: { coding: [{ system: OYSTEHR_LAB_OI_CODE_SYSTEM, code: 'TSHRFX' }], text: 'TSH w/ reflex to FT4' },
  };
  const result = (id: string, code: string, display: string, value: number, unit: string): Observation => ({
    resourceType: 'Observation',
    id,
    status: 'final',
    code: { coding: [{ system: 'http://loinc.org', code, display }] },
    effectiveDateTime: '2026-03-10T13:00:00.000Z',
    valueQuantity: { value, unit },
  });
  const ordered: DiagnosticReport = {
    resourceType: 'DiagnosticReport',
    id: 'dr-tsh',
    status: 'final',
    subject: { reference: PATIENT },
    identifier: [placer, { type: { coding: [{ code: 'FILL' }] }, value: 'F-1' }],
    basedOn: [{ reference: 'ServiceRequest/sr-tsh' }],
    code: { coding: [{ system: 'http://loinc.org', code: '3016-3' }] },
    result: [{ reference: 'Observation/o-tsh' }],
  };
  const reflex: DiagnosticReport = {
    ...ordered,
    id: 'dr-reflex',
    meta: { tag: [{ system: LAB_DR_TYPE_TAG.system, code: LAB_DR_TYPE_TAG.code.reflex, display: 'reflex' }] },
    identifier: [placer, { type: { coding: [{ code: 'FILL' }] }, value: 'F-2' }],
    basedOn: undefined,
    code: { coding: [{ code: '3051-0', system: 'http://loinc.org', display: 'Free T3, Blood' }] },
    result: [{ reference: 'Observation/o-ft3' }],
  };
  const observations = [
    result('o-tsh', '3016-3', 'TSH', 6.2, 'mIU/L'),
    result('o-ft3', '3051-0', 'Free T3', 3.1, 'pg/mL'),
  ];
  const reports = [ordered, reflex];

  // A FHIR server holding those resources, answering the searches it understands.
  const bundle = (resources: unknown[]): unknown => ({
    total: resources.length,
    entry: resources.map((resource) => ({ resource, search: { mode: 'match' } })),
    unbundle: () => resources,
  });
  const resultsOf = (drs: DiagnosticReport[]): Observation[] =>
    observations.filter((o) => drs.some((dr) => dr.result?.some((r) => r.reference === `Observation/${o.id}`)));
  const param = (params: { name: string; value: string }[], name: string): string | undefined =>
    params.find((p) => p.name === name)?.value;
  const search = async ({
    resourceType,
    params,
  }: {
    resourceType: string;
    params: { name: string; value: string }[];
  }): Promise<unknown> => {
    if (resourceType === 'ServiceRequest' && param(params, 'code') === `${OYSTEHR_LAB_OI_CODE_SYSTEM}|`) {
      const drs = reports.filter((dr) => dr.basedOn?.some((b) => b.reference === 'ServiceRequest/sr-tsh'));
      return bundle([order, ...drs, ...resultsOf(drs)]);
    }
    if (resourceType === 'DiagnosticReport' && param(params, 'subject') === PATIENT) {
      const tag = param(params, '_tag');
      const drs = reports.filter((dr) => dr.meta?.tag?.some((t) => `${t.system}|${t.code}` === tag));
      return bundle([...drs, ...resultsOf(drs)]);
    }
    return bundle([]);
  };
  const oystehr = { fhir: { search } } as unknown as Oystehr;

  test('a reflex report (no basedOn) shows with its order, on the order’s visit', async () => {
    const { labs } = await fetchFlowsheetData(oystehr, 'p1', ['labs']);
    expect(Object.keys(labs ?? {})).toEqual(['e1']);
    expect(labs?.e1.map((lab) => [lab.analyte, lab.value, lab.testName])).toEqual([
      ['TSH', 6.2, 'TSH w/ reflex to FT4'],
      ['Free T3', 3.1, 'TSH w/ reflex to FT4'],
    ]);
  });
});
