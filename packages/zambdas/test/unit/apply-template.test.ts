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
import { collectContainedIdsClaimedByProcedures } from '../../src/ehr/apply-template/apply-procedures';
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
      procedures: 'append',
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

  test("rejects 'overwrite' for procedures", () => {
    // Like in-house labs, procedures are constrained to skip/append - applying
    // a template should never silently delete a provider's existing procedure
    // documentation. The validator enforces that constraint by reading
    // TEMPLATE_SECTIONS_NO_OVERWRITE.
    const input = createInput({ ...baseBody, sectionActions: { procedures: 'overwrite' } });
    expect(() => validateRequestParameters(input)).toThrow(/does not support the 'overwrite' action/);
  });

  test("accepts 'skip' and 'append' for procedures", () => {
    expect(() =>
      validateRequestParameters(createInput({ ...baseBody, sectionActions: { procedures: 'skip' } }))
    ).not.toThrow();
    expect(() =>
      validateRequestParameters(createInput({ ...baseBody, sectionActions: { procedures: 'append' } }))
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
      new Set(),
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
      new Set(),
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
      new Set(),
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
      new Set(),
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
    const requests = makeCreateRequests(
      makeSimpleCptEncounter(),
      templateList,
      [],
      actions,
      cptCodesFromLabsToSkip,
      new Set()
    );

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
    const requests = makeCreateRequests(
      makeSimpleCptEncounter(),
      templateList,
      [],
      actions,
      cptCodesFromLabsToSkip,
      new Set()
    );

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
    const requests = makeCreateRequests(
      makeSimpleCptEncounter(),
      templateList,
      [],
      actions,
      cptCodesFromLabsToSkip,
      new Set()
    );

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
    const requests = makeCreateRequests(
      makeSimpleCptEncounter(),
      templateList,
      [],
      actions,
      cptCodesFromLabsToSkip,
      new Set()
    );

    const createdCptCodes = getCptPostRequests(requests).map((c) => c.code);
    expect(createdCptCodes).not.toContain('87880');
    expect(createdCptCodes).toContain('99213');
  });
});

// ---------------------------------------------------------------------------
// makeCreateRequests — procedure plans
// ---------------------------------------------------------------------------

const PROCEDURE_PLAN_TAG_SYSTEM = chartDataTagSystem('procedure-template-plan');
const PROCEDURE_META_TAG_SYSTEM = chartDataTagSystem('procedure');

const makeProcedurePlan = (id: string, opts: { dxRefIds?: string[]; cptRefIds?: string[] } = {}): ServiceRequest => ({
  resourceType: 'ServiceRequest',
  id,
  status: 'active',
  intent: 'plan',
  subject: { reference: '#stub-patient' },
  category: [{ coding: [{ system: 'https://fhir.ottehr.com/CodeSystem/Procedure/procedure-type', code: 'splint' }] }],
  reasonReference: (opts.dxRefIds ?? []).map((refId) => ({ reference: `Condition/${refId}` })),
  supportingInfo: (opts.cptRefIds ?? []).map((refId) => ({ reference: `Procedure/${refId}` })),
  meta: { tag: [{ system: PROCEDURE_PLAN_TAG_SYSTEM, code: 'procedure-template-plan' }] },
});

const makeProcedureTemplateList = (resources: Array<Procedure | ServiceRequest | Condition>): List => ({
  resourceType: 'List',
  id: 'proc-template',
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

const getProcedureServiceRequestPosts = (
  requests: ReturnType<typeof makeCreateRequests>
): Array<{ method: 'POST'; url: string; resource: ServiceRequest; fullUrl?: string }> =>
  requests.filter(
    (r): r is { method: 'POST'; url: string; resource: ServiceRequest; fullUrl?: string } =>
      r.method === 'POST' && (r as any).resource?.resourceType === 'ServiceRequest'
  );

describe('makeCreateRequests — procedure plans', () => {
  test("procedures='skip' emits no procedure ServiceRequest", () => {
    const plan = makeProcedurePlan('plan-1');
    const templateList = makeProcedureTemplateList([plan]);
    const actions = makeActions({ procedures: 'skip' });
    const requests = makeCreateRequests(makeSimpleCptEncounter(), templateList, [], actions, new Set(), new Set());
    expect(getProcedureServiceRequestPosts(requests)).toHaveLength(0);
  });

  test("procedures='append' creates one live ServiceRequest per plan, tagged for chart-data", () => {
    const planA = makeProcedurePlan('plan-a');
    const planB = makeProcedurePlan('plan-b');
    const templateList = makeProcedureTemplateList([planA, planB]);
    const actions = makeActions({ procedures: 'append' });
    const requests = makeCreateRequests(makeSimpleCptEncounter(), templateList, [], actions, new Set(), new Set());

    const created = getProcedureServiceRequestPosts(requests);
    expect(created).toHaveLength(2);
    for (const req of created) {
      // Each must be the chart-data shape (completed/original-order/procedure tag)
      // rather than the plan shape — get-chart-data filters on these.
      expect(req.resource.status).toBe('completed');
      expect(req.resource.intent).toBe('original-order');
      expect(
        req.resource.meta?.tag?.some((t) => t.system === PROCEDURE_META_TAG_SYSTEM && t.code === 'procedure')
      ).toBe(true);
      expect(req.resource.meta?.tag?.some((t) => t.system === PROCEDURE_PLAN_TAG_SYSTEM)).toBe(false);
      // Cross-section linkage requires the SR's fullUrl to be a urn:uuid so other
      // resources in the transaction (encounter.diagnosis, etc) could reference it.
      expect(req.fullUrl).toMatch(/^urn:uuid:/);
    }
  });

  test('rewrites reasonReference and supportingInfo to the new fullUrls of the contained diagnoses and CPT Procedures', () => {
    // The diagnosis Condition and CPT Procedure live in the template's contained
    // array — when applied they each get a fresh urn:uuid fullUrl in the same
    // transaction. The procedure plan's cross-refs (Condition/dx-1, Procedure/cpt-1)
    // must be rewritten to point at those fullUrls so the live procedure links to
    // the live resources, not the template stub ids.
    const dxCondition = makeDxCondition('dx-1', 'J02.9');
    const cptProcedure = makeCptProcedure('cpt-1', '29105');
    const plan = makeProcedurePlan('plan-1', { dxRefIds: ['dx-1'], cptRefIds: ['cpt-1'] });
    const templateList: List = {
      resourceType: 'List',
      id: 'proc-template',
      status: 'current',
      mode: 'working',
      entry: [{ item: { reference: `#dx-1` } }, { item: { reference: `#cpt-1` } }, { item: { reference: `#plan-1` } }],
      contained: [
        dxCondition,
        cptProcedure,
        plan,
        {
          resourceType: 'Encounter',
          id: 'stub-enc',
          status: 'unknown',
          class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
          diagnosis: [{ condition: { reference: 'Condition/dx-1' } }],
        } as Encounter,
      ],
    };
    const actions = makeActions({ procedures: 'append', diagnoses: 'append', cptCodes: 'append' });
    const requests = makeCreateRequests(makeSimpleCptEncounter(), templateList, [], actions, new Set(), new Set());

    // Find the fullUrls assigned to the new live Condition and CPT Procedure.
    const dxPostRequest = requests.find(
      (r): r is { method: 'POST'; resource: Condition; fullUrl?: string; url: string } =>
        r.method === 'POST' && (r as any).resource?.resourceType === 'Condition'
    )!;
    const cptPostRequest = requests.find(
      (r): r is { method: 'POST'; resource: Procedure; fullUrl?: string; url: string } =>
        r.method === 'POST' && (r as any).resource?.resourceType === 'Procedure'
    )!;
    expect(dxPostRequest.fullUrl).toMatch(/^urn:uuid:/);
    expect(cptPostRequest.fullUrl).toMatch(/^urn:uuid:/);

    // The procedure SR's refs must match those fullUrls exactly.
    const procedureSR = getProcedureServiceRequestPosts(requests)[0]!.resource;
    expect(procedureSR.reasonReference).toEqual([{ reference: dxPostRequest.fullUrl }]);
    expect(procedureSR.supportingInfo).toEqual([{ reference: cptPostRequest.fullUrl }]);
  });

  // Helper to build the linked-procedure template fixture used by the
  // skip-override tests below: a Dx Condition + a CPT Procedure on the
  // template, plus a procedure plan that links to both.
  const makeLinkedProcedureTemplate = (): List => ({
    resourceType: 'List',
    id: 'proc-template',
    status: 'current',
    mode: 'working',
    entry: [{ item: { reference: `#dx-1` } }, { item: { reference: `#cpt-1` } }, { item: { reference: `#plan-1` } }],
    contained: [
      makeDxCondition('dx-1', 'J02.9'),
      makeCptProcedure('cpt-1', '29105'),
      makeProcedurePlan('plan-1', { dxRefIds: ['dx-1'], cptRefIds: ['cpt-1'] }),
      {
        resourceType: 'Encounter',
        id: 'stub-enc',
        status: 'unknown',
        class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
        diagnosis: [{ condition: { reference: 'Condition/dx-1' } }],
      } as Encounter,
    ],
  });

  test("procedures='append' + diagnoses='skip': procedure's linked Dx is force-created and added to encounter.diagnosis", () => {
    // The user skipped the standalone Diagnoses section but kept Procedures,
    // so the procedure's linked Dx still needs to land on the chart - same
    // shape as in-house labs where the lab's reasonCode diagnoses apply
    // regardless of the standalone Dx section. Verify the Condition gets
    // created, the procedure references it via reasonReference, and
    // encounter.diagnosis gets patched so the Dx shows in the chart's Dx tab.
    const templateList = makeLinkedProcedureTemplate();
    const actions = makeActions({ procedures: 'append', diagnoses: 'skip', cptCodes: 'append' });
    const claimedByProcedures = collectContainedIdsClaimedByProcedures(templateList, actions.procedures);
    const requests = makeCreateRequests(
      makeSimpleCptEncounter(),
      templateList,
      [],
      actions,
      new Set(),
      claimedByProcedures
    );

    const dxPostRequest = requests.find(
      (r): r is { method: 'POST'; resource: Condition; fullUrl?: string; url: string } =>
        r.method === 'POST' && (r as any).resource?.resourceType === 'Condition'
    );
    expect(dxPostRequest, 'Dx Condition should still be created even with diagnoses=skip').toBeDefined();
    expect(dxPostRequest!.fullUrl).toMatch(/^urn:uuid:/);

    const procedureSR = getProcedureServiceRequestPosts(requests)[0]!.resource;
    expect(procedureSR.reasonReference).toEqual([{ reference: dxPostRequest!.fullUrl }]);

    // encounter.diagnosis gets patched to include the new procedure-claimed Dx
    // so it shows in the chart's standalone Diagnoses list too.
    const dxPatch = getEncounterDiagnosisPatchOperations(requests);
    expect(dxPatch).not.toBeNull();
    if (dxPatch && (dxPatch.op === 'add' || dxPatch.op === 'replace')) {
      expect(dxPatch.value).toContainEqual(
        expect.objectContaining({ condition: { reference: dxPostRequest!.fullUrl } })
      );
    }
  });

  test("procedures='append' + cptCodes='skip': procedure's linked CPT is force-created and procedure links to it", () => {
    // Same idea as the Dx test above but for the CPT side. The procedure's
    // CPT lives on the chart via its meta tag regardless of encounter
    // linkage, so we don't need an encounter-side patch for CPT codes.
    const templateList = makeLinkedProcedureTemplate();
    const actions = makeActions({ procedures: 'append', diagnoses: 'append', cptCodes: 'skip' });
    const claimedByProcedures = collectContainedIdsClaimedByProcedures(templateList, actions.procedures);
    const requests = makeCreateRequests(
      makeSimpleCptEncounter(),
      templateList,
      [],
      actions,
      new Set(),
      claimedByProcedures
    );

    const cptPostRequest = requests.find(
      (r): r is { method: 'POST'; resource: Procedure; fullUrl?: string; url: string } =>
        r.method === 'POST' && (r as any).resource?.resourceType === 'Procedure'
    );
    expect(cptPostRequest, 'CPT Procedure should still be created even with cptCodes=skip').toBeDefined();

    const procedureSR = getProcedureServiceRequestPosts(requests)[0]!.resource;
    expect(procedureSR.supportingInfo).toEqual([{ reference: cptPostRequest!.fullUrl }]);
  });

  test("procedures='append' + both diagnoses and cptCodes='skip': both linked resources are force-created", () => {
    const templateList = makeLinkedProcedureTemplate();
    const actions = makeActions({ procedures: 'append', diagnoses: 'skip', cptCodes: 'skip' });
    const claimedByProcedures = collectContainedIdsClaimedByProcedures(templateList, actions.procedures);
    const requests = makeCreateRequests(
      makeSimpleCptEncounter(),
      templateList,
      [],
      actions,
      new Set(),
      claimedByProcedures
    );

    const dxPostRequest = requests.find(
      (r): r is { method: 'POST'; resource: Condition; fullUrl?: string; url: string } =>
        r.method === 'POST' && (r as any).resource?.resourceType === 'Condition'
    );
    const cptPostRequest = requests.find(
      (r): r is { method: 'POST'; resource: Procedure; fullUrl?: string; url: string } =>
        r.method === 'POST' && (r as any).resource?.resourceType === 'Procedure'
    );
    expect(dxPostRequest, 'Dx Condition should be force-created').toBeDefined();
    expect(cptPostRequest, 'CPT Procedure should be force-created').toBeDefined();

    const procedureSR = getProcedureServiceRequestPosts(requests)[0]!.resource;
    expect(procedureSR.reasonReference).toEqual([{ reference: dxPostRequest!.fullUrl }]);
    expect(procedureSR.supportingInfo).toEqual([{ reference: cptPostRequest!.fullUrl }]);
  });

  test("procedures='skip': claimedByProcedures is empty, standalone Dx skip really skips the Dx", () => {
    // When procedures itself is skipped, no plans claim anything, so the
    // skip-override doesn't kick in - this confirms collectContainedIdsClaimedByProcedures
    // returns an empty Set in that case and the standalone Dx behavior is
    // unchanged.
    const templateList = makeLinkedProcedureTemplate();
    const actions = makeActions({ procedures: 'skip', diagnoses: 'skip', cptCodes: 'append' });
    const claimedByProcedures = collectContainedIdsClaimedByProcedures(templateList, actions.procedures);
    expect(claimedByProcedures.size).toBe(0);
    const requests = makeCreateRequests(
      makeSimpleCptEncounter(),
      templateList,
      [],
      actions,
      new Set(),
      claimedByProcedures
    );

    expect(getProcedureServiceRequestPosts(requests)).toHaveLength(0);
    const dxPostRequest = requests.find(
      (r) => r.method === 'POST' && (r as any).resource?.resourceType === 'Condition'
    );
    expect(dxPostRequest, 'Dx should NOT be created when procedures is also skipped').toBeUndefined();
  });

  test("procedures='append' + a procedure's Dx is already on the encounter: procedure links to the existing Condition (QA regression)", () => {
    // QA reported: when a chart already has the same Dx that a template
    // procedure was linked to (e.g. the user added it manually before
    // applying the template), the procedure ends up with no Dx attached.
    //
    // Root cause: the standalone dedup recognized the duplicate and skipped
    // pushing it to encounter.diagnosis, but still POSTed a new (orphan)
    // Condition. The procedure's reasonReference resolved to that orphan via
    // fullUrl. The chart's procedure card looks up linked Dx through
    // encounter.diagnosis, so the orphan never showed.
    //
    // Fix: when the duplicate is procedure-claimed, redirect the procedure's
    // ref to the existing Condition's literal reference instead of creating
    // an orphan. Verify the procedure links to the existing Condition by id.
    const templateList = makeLinkedProcedureTemplate();
    const actions = makeActions({ procedures: 'append', diagnoses: 'append', cptCodes: 'append' });
    const claimedByProcedures = collectContainedIdsClaimedByProcedures(templateList, actions.procedures);

    // Encounter already carries the same Dx (J02.9) the template procedure
    // is linked to. The Condition is on encounter.diagnosis.
    const existingDxCondition = makeDxCondition('existing-dx-1', 'J02.9');
    const encounterWithExistingDx = makeDxEncounter('enc-1', [{ conditionId: 'existing-dx-1' }]);

    const requests = makeCreateRequests(
      encounterWithExistingDx,
      templateList,
      [existingDxCondition],
      actions,
      new Set(),
      claimedByProcedures
    );

    // No new Condition POST for the duplicate Dx (no orphan).
    const newConditionPosts = requests.filter(
      (r): r is { method: 'POST'; resource: Condition; fullUrl?: string; url: string } =>
        r.method === 'POST' && (r as any).resource?.resourceType === 'Condition'
    );
    expect(
      newConditionPosts,
      'Duplicate Dx should be redirected to the existing Condition, not POSTed as an orphan'
    ).toHaveLength(0);

    // The procedure's reasonReference is a literal reference to the existing
    // Condition (Condition/existing-dx-1), not a urn:uuid fullUrl.
    const procedureSR = getProcedureServiceRequestPosts(requests)[0]!.resource;
    expect(procedureSR.reasonReference).toEqual([{ reference: 'Condition/existing-dx-1' }]);

    // encounter.diagnosis is unchanged — the existing entry stays put, no
    // duplicate gets pushed.
    const dxPatch = getEncounterDiagnosisPatchOperations(requests);
    if (dxPatch && (dxPatch.op === 'add' || dxPatch.op === 'replace')) {
      expect(dxPatch.value).toHaveLength(1);
      expect(dxPatch.value[0]).toMatchObject({ condition: { reference: 'Condition/existing-dx-1' } });
    }
  });

  test('a sparse procedure plan with no cross-refs still produces a clean ServiceRequest', () => {
    // Some templates may carry procedures with no diagnoses or CPT codes -
    // those should still apply without emitting empty reasonReference/[]
    // arrays on the live SR.
    const plan = makeProcedurePlan('plan-1');
    const templateList = makeProcedureTemplateList([plan]);
    const actions = makeActions({ procedures: 'append' });
    const requests = makeCreateRequests(makeSimpleCptEncounter(), templateList, [], actions, new Set(), new Set());

    const procedureSR = getProcedureServiceRequestPosts(requests)[0]!.resource;
    expect(procedureSR.reasonReference).toBeUndefined();
    expect(procedureSR.supportingInfo).toBeUndefined();
  });
});
