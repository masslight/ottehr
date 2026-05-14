import { Operation } from 'fast-json-patch';
import { Condition, Encounter, EncounterDiagnosis, List } from 'fhir/r4b';
import {
  chartDataTagSystem,
  ICD_10_CODE_SYSTEM,
  TEMPLATE_SECTION_DEFAULT_ACTIONS,
  TemplateSectionAction,
  TemplateSectionKey,
} from 'utils';
import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';
import { describe, expect, test } from 'vitest';
import { makeCreateRequests } from '../../src/ehr/apply-template/index';
import { validateRequestParameters } from '../../src/ehr/apply-template/validateRequestParameters';
import { ZambdaInput } from '../../src/shared';

const createInput = (body: Record<string, unknown>): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: { Authorization: 'Bearer test-token' },
  secrets: { AUTH0_SECRET: 'test-secret' },
});

const baseBody = {
  encounterId: 'encounter-1',
  templateName: 'My Template',
  examType: DefaultExamComponentsConfig,
};

describe('Apply Template - validateRequestParameters', () => {
  test('accepts a request without sectionActions and defaults to an empty object', () => {
    const result = validateRequestParameters(createInput(baseBody));
    expect(result.sectionActions).toEqual({});
  });

  test('accepts valid sectionActions for every supported section', () => {
    const sectionActions = {
      hpi: 'append',
      moi: 'overwrite',
      ros: 'skip',
      examFindings: 'overwrite',
      mdm: 'append',
      diagnoses: 'append',
      patientInstructions: 'skip',
      cptCodes: 'overwrite',
      emCode: 'skip',
      inHouseLabs: 'append',
    };
    const result = validateRequestParameters(createInput({ ...baseBody, sectionActions }));
    expect(result.sectionActions).toEqual(sectionActions);
  });

  test('rejects an unknown section key', () => {
    const input = createInput({ ...baseBody, sectionActions: { totallyMadeUp: 'append' } });
    expect(() => validateRequestParameters(input)).toThrow(/Unknown template section/);
  });

  test('rejects an invalid action value', () => {
    const input = createInput({ ...baseBody, sectionActions: { hpi: 'merge' } });
    expect(() => validateRequestParameters(input)).toThrow(/Invalid action/);
  });

  test("rejects 'append' for examFindings", () => {
    const input = createInput({ ...baseBody, sectionActions: { examFindings: 'append' } });
    expect(() => validateRequestParameters(input)).toThrow(/does not support the 'append' action/);
  });

  test("rejects 'append' for emCode", () => {
    const input = createInput({ ...baseBody, sectionActions: { emCode: 'append' } });
    expect(() => validateRequestParameters(input)).toThrow(/does not support the 'append' action/);
  });

  test("rejects 'overwrite' for inHouseLabs", () => {
    const input = createInput({ ...baseBody, sectionActions: { inHouseLabs: 'overwrite' } });
    expect(() => validateRequestParameters(input)).toThrow(/does not support the 'overwrite' action/);
  });

  test("accepts 'skip' and 'append' for inHouseLabs", () => {
    expect(() =>
      validateRequestParameters(createInput({ ...baseBody, sectionActions: { inHouseLabs: 'skip' } }))
    ).not.toThrow();
    expect(() =>
      validateRequestParameters(createInput({ ...baseBody, sectionActions: { inHouseLabs: 'append' } }))
    ).not.toThrow();
  });

  test('rejects sectionActions that is not an object', () => {
    const input = createInput({ ...baseBody, sectionActions: 'not-an-object' });
    expect(() => validateRequestParameters(input)).toThrow(/must be an object/);
  });

  test('still throws when required fields are missing', () => {
    const input = createInput({ templateName: 'foo', examType: DefaultExamComponentsConfig });
    expect(() => validateRequestParameters(input)).toThrow(/encounterId/);
  });
});

// ---------------------------------------------------------------------------
// makeCreateRequests — diagnosis behavior
// ---------------------------------------------------------------------------

const makeDxCondition = (id: string, icdCode: string): Condition => ({
  resourceType: 'Condition',
  id,
  subject: { reference: 'Patient/pat-1' },
  meta: { tag: [{ system: chartDataTagSystem('diagnosis'), code: 'diagnosis' }] },
  code: { coding: [{ system: ICD_10_CODE_SYSTEM, code: icdCode }] },
});

const makeTemplateList = (
  conditions: Condition[],
  stubDiagnoses: Array<{ conditionId: string; rank?: number }>
): List => ({
  resourceType: 'List',
  id: 'template-list',
  status: 'current',
  mode: 'working',
  entry: conditions.map((c) => ({ item: { reference: `#${c.id}` } })),
  contained: [
    ...conditions,
    {
      resourceType: 'Encounter',
      id: 'stub-enc',
      status: 'unknown',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
      diagnosis: stubDiagnoses.map(({ conditionId, rank }) => ({
        condition: { reference: `Condition/${conditionId}` },
        ...(rank !== undefined ? { rank } : {}),
      })),
    } as Encounter,
  ],
});

const makeEncounter = (id: string, diagnoses: Array<{ conditionId: string; rank?: number }>): Encounter => ({
  resourceType: 'Encounter',
  id,
  status: 'in-progress',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
  subject: { reference: 'Patient/pat-1' },
  diagnosis: diagnoses.map(({ conditionId, rank }) => ({
    condition: { reference: `Condition/${conditionId}` },
    ...(rank !== undefined ? { rank } : {}),
  })),
});

const makeActions = (diagnosesAction: TemplateSectionAction): Record<TemplateSectionKey, TemplateSectionAction> => ({
  ...TEMPLATE_SECTION_DEFAULT_ACTIONS,
  diagnoses: diagnosesAction,
  hpi: 'skip' as const,
  moi: 'skip' as const,
  ros: 'skip' as const,
  examFindings: 'skip' as const,
  mdm: 'skip' as const,
  patientInstructions: 'skip' as const,
  cptCodes: 'skip' as const,
  emCode: 'skip' as const,
});

const getEncounterDiagnosisPatchOperations = (requests: ReturnType<typeof makeCreateRequests>): Operation | null => {
  const encounterPatch = requests.find(
    (r): r is { method: 'PATCH'; url: string; operations: any[] } =>
      r.method === 'PATCH' && 'url' in r && (r as any).url?.startsWith('Encounter/')
  ) as any;
  return encounterPatch?.operations?.find((op: any) => op.path === '/diagnosis') ?? null;
};

describe('makeCreateRequests — diagnosis behavior', () => {
  test('append: a Dx already on the encounter is not duplicated', () => {
    const existingCond = makeDxCondition('existing-1', 'J02.9');
    const templateCondA = makeDxCondition('tmpl-a', 'J02.9'); // same code — should be deduped
    const templateCondB = makeDxCondition('tmpl-b', 'J10.0'); // new code — should be added

    const encounter = makeEncounter('enc-1', [{ conditionId: 'existing-1', rank: 1 }]);
    const templateList = makeTemplateList(
      [templateCondA, templateCondB],
      [{ conditionId: 'tmpl-a', rank: 1 }, { conditionId: 'tmpl-b' }]
    );

    const requests = makeCreateRequests(encounter, templateList, [existingCond], makeActions('append'));
    const diagnosisPatchOps = getEncounterDiagnosisPatchOperations(requests);

    expect(diagnosisPatchOps).not.toBeNull();
    if (diagnosisPatchOps && (diagnosisPatchOps.op === 'add' || diagnosisPatchOps.op === 'replace')) {
      // Existing entry (existingCond) + new entry (tmpl-b) = 2. No duplicate for J02.9.
      expect(diagnosisPatchOps.value).toHaveLength(2);
      const references = diagnosisPatchOps.value
        .map((dx: EncounterDiagnosis): string | undefined => {
          return dx.condition.reference;
        })
        .filter((elm: string | undefined) => elm !== undefined);
      // .filter((elm) => elm !== undefined);
      expect(references).toContain('Condition/existing-1');
      expect(references).not.toContain('#tmpl-a');
    }
  });

  test('append: the chart primary Dx keeps rank 1 even when the template also has a rank-1 Dx', () => {
    const existingCond = makeDxCondition('existing-1', 'J02.9');
    const templateCond = makeDxCondition('tmpl-a', 'J45.909'); // different code, template claims rank 1

    const encounter = makeEncounter('enc-1', [{ conditionId: 'existing-1', rank: 1 }]);
    const templateList = makeTemplateList([templateCond], [{ conditionId: 'tmpl-a', rank: 1 }]);

    const requests = makeCreateRequests(encounter, templateList, [existingCond], makeActions('append'));
    const diagnosisPatchOp = getEncounterDiagnosisPatchOperations(requests);

    expect(diagnosisPatchOp).not.toBeNull();
    if (diagnosisPatchOp && (diagnosisPatchOp.op === 'add' || diagnosisPatchOp.op === 'replace')) {
      expect(diagnosisPatchOp.value).toHaveLength(2);

      const existingEntry = diagnosisPatchOp.value.find(
        (d: EncounterDiagnosis) => d.condition.reference === 'Condition/existing-1'
      );
      expect(existingEntry?.rank).toBe(1);

      // Template's rank-1 must be demoted because the chart already has a primary Dx.
      const templateEntry = diagnosisPatchOp.value.find(
        (d: EncounterDiagnosis) => d.condition.reference !== 'Condition/existing-1'
      );
      expect(templateEntry?.rank).toBeUndefined();
    }
  });

  test('append: when the encounter has no primary Dx, template Dx are applied with their ranks intact', () => {
    const existingCond = makeDxCondition('existing-1', 'J02.9'); // on encounter but no rank
    const templateCondA = makeDxCondition('tmpl-a', 'J45.909'); // primary — rank 1
    const templateCondB = makeDxCondition('tmpl-b', 'J10.0'); // secondary — no rank

    const encounter = makeEncounter('enc-1', [{ conditionId: 'existing-1' }]); // no rank: 1
    const templateList = makeTemplateList(
      [templateCondA, templateCondB],
      [{ conditionId: 'tmpl-a', rank: 1 }, { conditionId: 'tmpl-b' }]
    );

    const requests = makeCreateRequests(encounter, templateList, [existingCond], makeActions('append'));
    const diagnosisPatchOp = getEncounterDiagnosisPatchOperations(requests);

    expect(diagnosisPatchOp).not.toBeNull();
    if (diagnosisPatchOp && (diagnosisPatchOp.op === 'add' || diagnosisPatchOp.op === 'replace')) {
      // Existing entry + two template entries = 3 total
      expect(diagnosisPatchOp.value).toHaveLength(3);

      const templateAddedPatchReferences: EncounterDiagnosis[] = diagnosisPatchOp.value.filter(
        (d: EncounterDiagnosis) => d.condition.reference !== 'Condition/existing-1'
      );
      const primaryEntry = templateAddedPatchReferences.find((d: EncounterDiagnosis) => d.rank === 1);
      const secondaryEntry = templateAddedPatchReferences.find((d: EncounterDiagnosis) => d.rank !== 1);
      expect(primaryEntry).toBeDefined();
      expect(secondaryEntry?.rank).toBeUndefined();
    }
  });

  test('overwrite: encounter Dx is replaced exactly by the template, preserving template ranks', () => {
    const existingCond = makeDxCondition('existing-1', 'J02.9');
    const templateCondA = makeDxCondition('tmpl-a', 'J45.909');
    const templateCondB = makeDxCondition('tmpl-b', 'J10.0');

    const encounter = makeEncounter('enc-1', [{ conditionId: 'existing-1', rank: 1 }]);
    const templateList = makeTemplateList(
      [templateCondA, templateCondB],
      [{ conditionId: 'tmpl-a', rank: 1 }, { conditionId: 'tmpl-b' }]
    );

    const requests = makeCreateRequests(encounter, templateList, [existingCond], makeActions('overwrite'));
    const diagnosisPatchOp = getEncounterDiagnosisPatchOperations(requests);

    expect(diagnosisPatchOp).not.toBeNull();
    if (diagnosisPatchOp && (diagnosisPatchOp.op === 'add' || diagnosisPatchOp.op === 'replace')) {
      // Only the two template entries; existing-1 must be gone.
      expect(diagnosisPatchOp.value).toHaveLength(2);

      const references = diagnosisPatchOp.value.map((d: EncounterDiagnosis) => d.condition.reference as string);
      expect(references.every((r: string) => r.startsWith('urn:uuid:'))).toBe(true);

      const primaryEntry = diagnosisPatchOp.value.find((d: EncounterDiagnosis) => d.rank === 1);
      const secondaryEntry = diagnosisPatchOp.value.find((d: EncounterDiagnosis) => d.rank !== 1);
      expect(primaryEntry).toBeDefined();
      expect(secondaryEntry?.rank).toBeUndefined();
    }
  });
});
