import { Operation } from 'fast-json-patch';
import {
  ActivityDefinition,
  Condition,
  Encounter,
  EncounterDiagnosis,
  List,
  Procedure,
  ServiceRequest,
} from 'fhir/r4b';
import {
  chartDataTagSystem,
  ICD_10_CODE_SYSTEM,
  IN_HOUSE_TEST_CODE_SYSTEM,
  TEMPLATE_SECTION_DEFAULT_ACTIONS,
  TemplateSectionAction,
  TemplateSectionKey,
} from 'utils';
import { DefaultExamComponentsConfig } from 'utils/lib/ottehr-config/examination/default-components.config';
import { describe, expect, test } from 'vitest';
import {
  collectCptCodesFromApplicableActivityDefinitions,
  makeCreateRequests,
} from '../../src/ehr/apply-template/index';
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
    expect(() => validateRequestParameters(input)).toThrow(/Expected object, received string/);
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

const makeDxEncounter = (id: string, diagnoses: Array<{ conditionId: string; rank?: number }>): Encounter => ({
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

const makeActions = (
  overrides: Partial<Record<TemplateSectionKey, TemplateSectionAction>>
): Record<TemplateSectionKey, TemplateSectionAction> => ({
  ...TEMPLATE_SECTION_DEFAULT_ACTIONS,
  hpi: 'skip',
  moi: 'skip',
  ros: 'skip',
  examFindings: 'skip',
  mdm: 'skip',
  diagnoses: 'skip',
  patientInstructions: 'skip',
  emCode: 'skip',
  ...overrides,
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

    const encounter = makeDxEncounter('enc-1', [{ conditionId: 'existing-1', rank: 1 }]);
    const templateList = makeTemplateList(
      [templateCondA, templateCondB],
      [{ conditionId: 'tmpl-a', rank: 1 }, { conditionId: 'tmpl-b' }]
    );

    const requests = makeCreateRequests(
      encounter,
      templateList,
      [existingCond],
      makeActions({ diagnoses: 'append' }),
      new Set()
    );
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

    const encounter = makeDxEncounter('enc-1', [{ conditionId: 'existing-1', rank: 1 }]);
    const templateList = makeTemplateList([templateCond], [{ conditionId: 'tmpl-a', rank: 1 }]);

    const requests = makeCreateRequests(
      encounter,
      templateList,
      [existingCond],
      makeActions({ diagnoses: 'append' }),
      new Set()
    );
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

    const encounter = makeDxEncounter('enc-1', [{ conditionId: 'existing-1' }]); // no rank: 1
    const templateList = makeTemplateList(
      [templateCondA, templateCondB],
      [{ conditionId: 'tmpl-a', rank: 1 }, { conditionId: 'tmpl-b' }]
    );

    const requests = makeCreateRequests(
      encounter,
      templateList,
      [existingCond],
      makeActions({ diagnoses: 'append' }),
      new Set()
    );
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

    const encounter = makeDxEncounter('enc-1', [{ conditionId: 'existing-1', rank: 1 }]);
    const templateList = makeTemplateList(
      [templateCondA, templateCondB],
      [{ conditionId: 'tmpl-a', rank: 1 }, { conditionId: 'tmpl-b' }]
    );

    const requests = makeCreateRequests(
      encounter,
      templateList,
      [existingCond],
      makeActions({ diagnoses: 'overwrite' }),
      new Set()
    );
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

// ---------------------------------------------------------------------------
// CPT codes / in-house lab overlap (PRD: "Overlap with the CPT Codes section")
// ---------------------------------------------------------------------------

const CPT_CODE_SYSTEM = 'http://www.ama-assn.org/go/cpt';

const makeInHouseLabAD = (id: string, cptCodes: string[]): ActivityDefinition => ({
  resourceType: 'ActivityDefinition',
  id,
  url: `https://example.com/activity-definitions/${id}`,
  status: 'active',
  code: {
    coding: [
      { system: IN_HOUSE_TEST_CODE_SYSTEM, code: 'STREP-RAPID' },
      ...cptCodes.map((code) => ({ system: CPT_CODE_SYSTEM, code })),
    ],
  },
});

const makePlanSR = (id: string, cptCodes: string[]): ServiceRequest => ({
  resourceType: 'ServiceRequest',
  id,
  status: 'active',
  intent: 'plan',
  subject: { reference: '#stub-patient' },
  code: {
    coding: [
      { system: IN_HOUSE_TEST_CODE_SYSTEM, code: 'STREP-RAPID' },
      ...cptCodes.map((code) => ({ system: CPT_CODE_SYSTEM, code })),
    ],
  },
  meta: {
    tag: [{ system: chartDataTagSystem('in-house-lab-template-plan'), code: 'in-house-lab-template-plan' }],
  },
});

const makeCptProcedure = (id: string, cptCode: string): Procedure => ({
  resourceType: 'Procedure',
  id,
  status: 'completed',
  subject: { reference: '#stub-patient' },
  code: { coding: [{ system: CPT_CODE_SYSTEM, code: cptCode }] },
  meta: { tag: [{ system: chartDataTagSystem('cpt-code'), code: 'cpt-code' }] },
});

const makeCptTemplateList = (resources: Array<Procedure | ServiceRequest>): List => ({
  resourceType: 'List',
  id: 'cpt-template',
  status: 'current',
  mode: 'working',
  entry: resources.map((r) => ({ item: { reference: `#${r.id}` } })),
  contained: [
    ...resources,
    {
      resourceType: 'Encounter',
      id: 'stub-enc',
      status: 'unknown',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
    } as Encounter,
  ],
});

const makeSimpleCptEncounter = (): Encounter => ({
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'in-progress',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
  subject: { reference: 'Patient/pat-1' },
});

const getCptPostRequests = (requests: ReturnType<typeof makeCreateRequests>): Array<{ code: string }> =>
  requests
    .filter(
      (r): r is { method: 'POST'; url: string; resource: Procedure } =>
        r.method === 'POST' && (r as any).resource?.resourceType === 'Procedure'
    )
    .flatMap((r) => r.resource.code?.coding ?? [])
    .filter((c) => c.system === CPT_CODE_SYSTEM && c.code !== undefined)
    .map((c) => ({ code: c.code! }));

describe('collectCptCodesFromApplicableActivityDefinitions', () => {
  test('collects CPT codes from ADs when both inHouseLabs and cptCodes are non-skip', () => {
    const ads = [makeInHouseLabAD('ad-1', ['87880', '87081'])];
    const actions = makeActions({ inHouseLabs: 'append', cptCodes: 'append' });
    expect(collectCptCodesFromApplicableActivityDefinitions(ads, actions)).toEqual(new Set(['87880', '87081']));
  });

  test('returns empty set when inHouseLabs is skip (labs not being applied, no dedup needed)', () => {
    const ads = [makeInHouseLabAD('ad-1', ['87880'])];
    const actions = makeActions({ inHouseLabs: 'skip', cptCodes: 'append' });
    expect(collectCptCodesFromApplicableActivityDefinitions(ads, actions)).toEqual(new Set());
  });

  test('returns empty set when cptCodes is skip (CPT section not running, nothing to dedup against)', () => {
    const ads = [makeInHouseLabAD('ad-1', ['87880'])];
    const actions = makeActions({ inHouseLabs: 'append', cptCodes: 'skip' });
    expect(collectCptCodesFromApplicableActivityDefinitions(ads, actions)).toEqual(new Set());
  });

  test('uses updated CPT codes from the current AD, not the codes that were on the plan when the template was saved', () => {
    // Template was created when the Strep Rapid test used CPT 87880.
    // The AD was later updated to use 87882 instead. When applying the template,
    // collectCptCodesFromApplicableActivityDefinitions should read from the current AD (87882),
    // so the dedup set suppresses 87882 — not the now-stale 87880.
    const updatedAd = makeInHouseLabAD('ad-1', ['87882']); // new code after AD was updated
    const actions = makeActions({ inHouseLabs: 'append', cptCodes: 'append' });
    const result = collectCptCodesFromApplicableActivityDefinitions([updatedAd], actions);
    expect(result).toContain('87882');
    expect(result).not.toContain('87880');
  });

  test('uses updated test name from the current AD, not the name embedded in the plan SR', () => {
    // The AD name may differ from whatever was stored on the plan SR at template-creation time.
    // collectCptCodesFromApplicableActivityDefinitions reads from AD.code.coding, confirming
    // the AD is the source of truth for which CPT codes get deduped.
    const renamedAd: ActivityDefinition = {
      ...makeInHouseLabAD('ad-1', ['87880']),
      name: 'Strep Rapid v2',
      title: 'Strep Rapid (Updated)',
    };
    const actions = makeActions({ inHouseLabs: 'append', cptCodes: 'append' });
    const result = collectCptCodesFromApplicableActivityDefinitions([renamedAd], actions);
    // CPT codes are read from the AD regardless of name change
    expect(result).toContain('87880');
  });
});

describe('makeCreateRequests — CPT / in-house lab overlap', () => {
  test('skip lab + append CPT: CPT Procedure is created as a free-standing code', () => {
    const cptProc = makeCptProcedure('cpt-1', '87880');
    const planSR = makePlanSR('plan-1', ['87880']);
    const templateList = makeCptTemplateList([planSR, cptProc]);
    const actions = makeActions({ inHouseLabs: 'skip', cptCodes: 'append' });

    // When labs are skipped the dedup set is empty — CPT Procedure goes through normally.
    const cptCodesFromLabsToSkip = collectCptCodesFromApplicableActivityDefinitions(
      [makeInHouseLabAD('ad-1', ['87880'])],
      actions
    );
    const requests = makeCreateRequests(makeSimpleCptEncounter(), templateList, [], actions, cptCodesFromLabsToSkip);

    const createdCpts = getCptPostRequests(requests);
    expect(createdCpts.map((c) => c.code)).toContain('87880');
  });

  test('append lab + skip CPT: no CPT Procedure is created by the template CPT section', () => {
    const cptProc = makeCptProcedure('cpt-1', '87880');
    const planSR = makePlanSR('plan-1', ['87880']);
    const templateList = makeCptTemplateList([planSR, cptProc]);
    const actions = makeActions({ inHouseLabs: 'append', cptCodes: 'skip' });

    // CPT section is skipped entirely — dedup set is irrelevant, Procedure won't be created.
    const cptCodesFromLabsToSkip = collectCptCodesFromApplicableActivityDefinitions(
      [makeInHouseLabAD('ad-1', ['87880'])],
      actions
    );
    const requests = makeCreateRequests(makeSimpleCptEncounter(), templateList, [], actions, cptCodesFromLabsToSkip);

    const createdCpts = getCptPostRequests(requests);
    expect(createdCpts).toHaveLength(0);
  });

  test('append both: CPT Procedure matching the lab plan is deduplicated — only one charge per code', () => {
    const cptProc = makeCptProcedure('cpt-1', '87880');
    const planSR = makePlanSR('plan-1', ['87880']);
    const templateList = makeCptTemplateList([planSR, cptProc]);
    const actions = makeActions({ inHouseLabs: 'append', cptCodes: 'append' });

    // Both sections run — the lab's CPT code must be excluded from the template's CPT section.
    const cptCodesFromLabsToSkip = collectCptCodesFromApplicableActivityDefinitions(
      [makeInHouseLabAD('ad-1', ['87880'])],
      actions
    );
    const requests = makeCreateRequests(makeSimpleCptEncounter(), templateList, [], actions, cptCodesFromLabsToSkip);

    const createdCpts = getCptPostRequests(requests);
    expect(createdCpts).toHaveLength(0);
  });

  test('append both: a CPT code NOT on any lab plan is still created normally', () => {
    // The template has two CPT codes: 87880 (on the lab plan) and 99213 (standalone).
    // After dedup, 87880 is suppressed but 99213 must still go through.
    const cptProc87880 = makeCptProcedure('cpt-1', '87880');
    const cptProc99213 = makeCptProcedure('cpt-2', '99213');
    const planSR = makePlanSR('plan-1', ['87880']);
    const templateList = makeCptTemplateList([planSR, cptProc87880, cptProc99213]);
    const actions = makeActions({ inHouseLabs: 'append', cptCodes: 'append' });

    const cptCodesFromLabsToSkip = collectCptCodesFromApplicableActivityDefinitions(
      [makeInHouseLabAD('ad-1', ['87880'])],
      actions
    );
    const requests = makeCreateRequests(makeSimpleCptEncounter(), templateList, [], actions, cptCodesFromLabsToSkip);

    const createdCptCodes = getCptPostRequests(requests).map((c) => c.code);
    expect(createdCptCodes).not.toContain('87880');
    expect(createdCptCodes).toContain('99213');
  });
});
