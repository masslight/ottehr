import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  ActivityDefinition,
  ClinicalImpression,
  Communication,
  Condition,
  List,
  Procedure,
  ServiceRequest,
} from 'fhir/r4b';
import {
  ACCIDENT_STATE_EXTENSION,
  ACCIDENT_TYPE_SYSTEM,
  AdminGetTemplateDetailInput,
  AdminGetTemplateDetailOutput,
  BODY_SITE_SYSTEM,
  chartDataTagSystem,
  collectKnownExamFields,
  collectKnownRosFields,
  CPT_CODE_SYSTEM,
  examConfig,
  extractCptCodeModifiersFromCoding,
  FHIR_EXTENSION,
  getRosFindingStateFromKey,
  getSecret,
  getTag,
  ICD_10_CODE_SYSTEM,
  IN_HOUSE_TEST_CODE_SYSTEM,
  PERFORMER_TYPE_SYSTEM,
  PROCEDURE_TYPE_SYSTEM,
  resourceHasTagSystem,
  SecretsKeys,
  TemplateAccidentInfo,
  TemplateCodeInfo,
  TemplateCptCodeInfo,
  TemplateExamFinding,
  TemplateExternalLabPlanDetail,
  TemplateInHouseLabPlanDetail,
  TemplateProcedurePlan,
  TemplateRosFinding,
} from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import {
  fetchPlanItemsByLabGuid,
  findExternalLabPlans,
  labelForExternalLabPlan,
  matchOrderableItemForPlan,
  parseExternalLabPlan,
} from '../apply-template/apply-external-labs';
import {
  indexLatestActivityDefinitionsByUrl,
  urlFromInstantiatesCanonical,
} from '../apply-template/apply-in-house-labs';
import { findProcedurePlans } from '../apply-template/apply-procedures';
import { analyzeTemplateVersionData, isDiagnosisCondition, verifyIsTemplate } from '../shared/template-helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler(
  'admin-get-template-detail',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const validatedInput = validateRequestParameters(input);

      const { secrets } = validatedInput;
      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
      const oystehr = createOystehrClient(m2mToken, secrets);

      const result = await performEffect(validatedInput, oystehr, m2mToken);

      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    } catch (error: unknown) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('admin-get-template-detail', error, ENVIRONMENT);
    }
  }
);

// Build a set of all field codes that appear under 'abnormal' sections in the exam config
function buildAbnormalFieldCodes(config: Record<string, any>): Set<string> {
  const abnormalCodes = new Set<string>();

  function collectFromComponents(components: Record<string, any>, codes: Set<string>): void {
    for (const [key, value] of Object.entries(components)) {
      if (typeof value !== 'object' || value === null) continue;
      const type = value.type;
      if (type === 'checkbox' || type === 'modal-exam' || type === 'text') {
        codes.add(key);
      } else if (type === 'dropdown' && value.components) {
        Object.keys(value.components).forEach((k: string) => codes.add(k));
      } else if (type === 'multi-select' && value.options) {
        Object.keys(value.options).forEach((k: string) => codes.add(k));
      } else if (type === 'form' && value.components) {
        Object.keys(value.components).forEach((k: string) => codes.add(k));
      } else if (type === 'column' && value.components) {
        collectFromComponents(value.components, codes);
      }
    }
  }

  Object.values(config).forEach((section: any) => {
    if (section?.components?.abnormal) {
      collectFromComponents(section.components.abnormal, abnormalCodes);
    }
  });
  return abnormalCodes;
}

// Build a map of field codes to their display labels from the exam config
function buildFieldLabels(config: Record<string, any>): Map<string, string> {
  const labels = new Map<string, string>();

  function collectFromComponents(components: Record<string, any>): void {
    for (const [key, value] of Object.entries(components)) {
      if (typeof value !== 'object' || value === null) continue;
      const type = value.type;
      if ((type === 'checkbox' || type === 'modal-exam' || type === 'text') && 'label' in value) {
        labels.set(key, value.label as string);
      } else if (type === 'dropdown' && value.components) {
        if ('label' in value) labels.set(key, value.label as string);
        for (const [optKey, opt] of Object.entries(value.components as Record<string, any>)) {
          if (opt && 'label' in opt) labels.set(optKey, `${value.label}: ${opt.label}`);
        }
      } else if (type === 'multi-select' && value.options) {
        if ('label' in value) labels.set(key, value.label as string);
        for (const [optKey, opt] of Object.entries(value.options as Record<string, any>)) {
          if (opt && 'label' in opt) labels.set(optKey, `${value.label}: ${opt.label}`);
        }
      } else if (type === 'form' && value.components) {
        for (const [elemKey, elem] of Object.entries(value.components as Record<string, any>)) {
          if (elem && 'label' in elem) labels.set(elemKey, `${value.label}: ${elem.label}`);
          else labels.set(elemKey, `${value.label}: ${elemKey}`);
        }
      } else if (type === 'column' && value.components) {
        collectFromComponents(value.components);
      }
    }
  }

  Object.values(config).forEach((section: any) => {
    if (section?.components?.normal) collectFromComponents(section.components.normal);
    if (section?.components?.abnormal) collectFromComponents(section.components.abnormal);
  });
  return labels;
}

const performEffect = async (
  validatedInput: AdminGetTemplateDetailInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr,
  m2mToken: string
): Promise<AdminGetTemplateDetailOutput> => {
  const { templateId } = validatedInput;

  const templateList = await oystehr.fhir.get<List>({
    resourceType: 'List',
    id: templateId,
  });

  verifyIsTemplate(templateList, templateId);

  if (!templateList.contained || templateList.contained.length === 0) {
    throw new Error(`Template ${templateId} has no contained resources`);
  }

  const contained = templateList.contained;

  // Extract exam version from the List's code coding
  const examVersion = templateList.code?.coding?.[0]?.version ?? '';

  // Parse HPI note
  const hpiCondition = contained.find(
    (r) => r.resourceType === 'Condition' && resourceHasTagSystem(r, chartDataTagSystem('chief-complaint'))
  ) as Condition | undefined;
  const hpiNote = hpiCondition?.note?.[0]?.text ?? null;

  // Parse MOI note
  const moiCondition = contained.find(
    (r) => r.resourceType === 'Condition' && resourceHasTagSystem(r, chartDataTagSystem('mechanism-of-injury'))
  ) as Condition | undefined;
  const moiNote = moiCondition?.note?.[0]?.text ?? null;

  // get details on ros findings, exam findings and legacy ros
  // these all feed into whether or not the template version is current so they are handled together
  const examTagSystem = chartDataTagSystem('exam-observation-field');
  const rosTagSystem = chartDataTagSystem('ros-observation-field');
  const legacyRosTagSystem = chartDataTagSystem('ros');

  const knownExamFields = collectKnownExamFields(examConfig.default.components);
  const knownRosFields = collectKnownRosFields();

  const { isCurrentVersion, unmatchedRosFields, examObservations, rosObservations, rosNote } =
    analyzeTemplateVersionData({
      contained,
      examTagSystem,
      rosTagSystem,
      legacyRosTagSystem,
      knownExamFields,
      knownRosFields,
    });

  const unmatchedRosFieldSet: Set<string> = new Set(unmatchedRosFields);

  // Config exam and row into template DTOs
  const rosFindings: TemplateRosFinding[] = rosObservations.map((obs) => {
    const fieldCode = getTag(obs, rosTagSystem)?.code ?? 'unknown';
    const findingState = getRosFindingStateFromKey(fieldCode);
    const label = obs.code.text ?? 'unknown';
    const stale = unmatchedRosFieldSet.has(fieldCode);
    return { fieldName: fieldCode, label, findingState, stale };
  });

  const abnormalFieldCodes = buildAbnormalFieldCodes(examConfig.default.components);
  const fieldLabels = buildFieldLabels(examConfig.default.components);

  const examFindings: TemplateExamFinding[] = examObservations.map((obs) => {
    const fieldCode = getTag(obs, examTagSystem)?.code ?? 'unknown';
    const isAbnormal = abnormalFieldCodes.has(fieldCode);
    const note = obs.note?.[0]?.text ?? '';
    const label = fieldLabels.get(fieldCode) ?? obs.code?.text ?? fieldCode;
    return { fieldName: fieldCode, label, isAbnormal, note };
  });

  // Parse MDM
  const mdmResource = contained.find(
    (r) => r.resourceType === 'ClinicalImpression' && resourceHasTagSystem(r, chartDataTagSystem('medical-decision'))
  ) as ClinicalImpression | undefined;
  const mdm = mdmResource?.summary ?? null;

  // Parse diagnoses. Identify them by the `diagnosis` meta tag — Medical Conditions are also Conditions with
  // ICD-10 codes, so a code-system check alone would surface them as diagnoses incorrectly.
  const diagnosisConditions = contained.filter((r) => isDiagnosisCondition(r)) as Condition[];

  const diagnoses: TemplateCodeInfo[] = diagnosisConditions.map((cond) => {
    const icdCoding = cond.code?.coding?.find((c) => c.system === ICD_10_CODE_SYSTEM);
    return {
      code: icdCoding?.code ?? '',
      display: icdCoding?.display ?? '',
    };
  });

  // Parse patient instructions
  const instructionResources = contained.filter(
    (r) => r.resourceType === 'Communication' && resourceHasTagSystem(r, chartDataTagSystem('patient-instruction'))
  ) as Communication[];
  const patientInstructions = instructionResources
    .map((r) => ({
      title: r.topic?.text ?? null,
      text: r.payload?.[0]?.contentString ?? '',
    }))
    .filter((i) => Boolean(i.text));

  // Parse CPT codes
  const cptProcedures = contained.filter(
    (r) => r.resourceType === 'Procedure' && resourceHasTagSystem(r, chartDataTagSystem('cpt-code'))
  ) as Procedure[];

  const cptCodes: TemplateCptCodeInfo[] = cptProcedures.map((proc) => {
    const coding = proc.code?.coding?.[0];
    return {
      code: coding?.code ?? '',
      display: coding?.display ?? '',
      modifiers: coding ? extractCptCodeModifiersFromCoding(coding) : [],
    };
  });

  // Parse E&M code
  const emProcedure = contained.find(
    (r) => r.resourceType === 'Procedure' && resourceHasTagSystem(r, chartDataTagSystem('em-code'))
  ) as Procedure | undefined;

  const emCode: TemplateCodeInfo | null = emProcedure
    ? {
        code: emProcedure.code?.coding?.[0]?.code ?? '',
        display: emProcedure.code?.coding?.[0]?.display ?? '',
      }
    : null;

  // Parse accident / condition related to
  const accidentCondition = contained.find(
    (r) => r.resourceType === 'Condition' && resourceHasTagSystem(r, chartDataTagSystem('accident'))
  ) as Condition | undefined;

  const accident: TemplateAccidentInfo | null = accidentCondition
    ? {
        autoAccident:
          accidentCondition.code?.coding?.some((c) => c.system === ACCIDENT_TYPE_SYSTEM && c.code === 'AA') ?? false,
        employment:
          accidentCondition.code?.coding?.some((c) => c.system === ACCIDENT_TYPE_SYSTEM && c.code === 'EM') ?? false,
        otherAccident:
          accidentCondition.code?.coding?.some((c) => c.system === ACCIDENT_TYPE_SYSTEM && c.code === 'OA') ?? false,
        date: accidentCondition.onsetDateTime ?? undefined,
        state: accidentCondition.extension?.find((ext) => ext.url === ACCIDENT_STATE_EXTENSION)?.valueString,
      }
    : null;

  // Parse in-house lab plans. Each plan is a ServiceRequest with intent 'plan'
  // and the in-house-lab-template-plan meta tag; we resolve its canonical
  // ActivityDefinition reference to a human-readable test name and surface a
  // missing flag when the AD isn't available in this environment.
  const inHouseLabPlanTagSystem = chartDataTagSystem('in-house-lab-template-plan');
  const inHouseLabPlans = contained.filter(
    (r): r is ServiceRequest =>
      r.resourceType === 'ServiceRequest' &&
      (r as ServiceRequest).intent === 'plan' &&
      resourceHasTagSystem(r, inHouseLabPlanTagSystem)
  );

  // Saved plans store the AD canonical without a version suffix so templates
  // float forward as new AD versions are published. Older templates may carry
  // a versioned canonical; we strip the version for the search either way and
  // pick the latest semver match below.
  const canonicalRefs = Array.from(
    new Set(inHouseLabPlans.flatMap((p) => p.instantiatesCanonical ?? []).filter((ref): ref is string => Boolean(ref)))
  );

  let activeAdByUrl = new Map<string, ActivityDefinition>();
  const retiredAdByUrl = new Map<string, ActivityDefinition>();
  if (canonicalRefs.length > 0) {
    const urlsToSearch = Array.from(new Set(canonicalRefs.map(urlFromInstantiatesCanonical)));
    try {
      const ads = (
        await oystehr.fhir.search<ActivityDefinition>({
          resourceType: 'ActivityDefinition',
          params: [{ name: 'url', value: urlsToSearch.join(',') }],
        })
      ).unbundle() as ActivityDefinition[];
      activeAdByUrl = indexLatestActivityDefinitionsByUrl(ads.filter((ad) => ad.status === 'active'));

      // we still query the inactive ads and set them aside so we can display useful info like the in-applicable test's name
      // so a user might be able to fix it
      ads
        .filter((ad) => ad.status === 'retired')
        .forEach((retiredAd) => {
          if (!retiredAd.url) return;
          retiredAdByUrl.set(retiredAd.url, retiredAd);
        });
    } catch (err) {
      console.warn('Could not resolve ActivityDefinitions for in-house lab plans:', err);
    }
  }

  const inHouseLabs: TemplateInHouseLabPlanDetail[] = inHouseLabPlans.map((plan) => {
    const canonical = plan.instantiatesCanonical?.[0] ?? '';

    // cpts codes, test code, and test name should all come from the AD itself to pick up any changes to the test
    const ad = canonical ? activeAdByUrl.get(urlFromInstantiatesCanonical(canonical)) : undefined;
    let fallbackTestName = 'Unknown test';
    if (!ad) {
      console.warn(
        `Could not resolve ActivityDefinitions for in-house lab plans canonical ${canonical}. Trying in the retired ads collection`
      );
      const maybeRetiredAd = retiredAdByUrl.get(urlFromInstantiatesCanonical(canonical));
      fallbackTestName = maybeRetiredAd?.name ?? maybeRetiredAd?.title ?? fallbackTestName;
    }
    const inHouseCoding = ad?.code?.coding?.find((c) => c.system === IN_HOUSE_TEST_CODE_SYSTEM);
    const cptCodes: TemplateCptCodeInfo[] = (ad?.code?.coding ?? [])
      .filter((c) => c.system === 'http://www.ama-assn.org/go/cpt' && c.code)
      .map((c) => ({ code: c.code ?? '', display: c.display ?? '', modifiers: extractCptCodeModifiersFromCoding(c) }));

    const diagnoses: TemplateCodeInfo[] = (plan.reasonCode ?? [])
      .map((rc) => {
        const icd = rc.coding?.find((c) => c.system === ICD_10_CODE_SYSTEM) ?? rc.coding?.[0];
        return { code: icd?.code ?? '', display: icd?.display ?? rc.text ?? '' };
      })
      .filter((d) => d.code || d.display);
    const notes = (plan.note ?? []).map((n) => n.text ?? '').filter((t) => t.length > 0);

    return {
      planId: plan.id ?? '',
      testName: ad?.name ?? ad?.title ?? fallbackTestName,
      activityDefinitionRef: canonical,
      code: inHouseCoding?.code ?? '',
      diagnoses,
      notes,
      cptCodes,
      missing: !ad,
    };
  });

  // Parse external lab plans. Each plan is a ServiceRequest with intent 'plan'
  // and the external-lab-template-plan meta tag carrying the lab + test combo,
  // Dx, note, and PSC flag. We verify each lab + test combo still resolves in
  // the lab's current compendium so the admin UI can flag tests that would be
  // skipped at apply time.
  const externalLabPlans = findExternalLabPlans(templateList);
  const externalParsedPlans = externalLabPlans.map((plan) => ({ plan, parsed: parseExternalLabPlan(plan) }));

  const externalOrderableItemsByLabGuid = await fetchPlanItemsByLabGuid(
    externalParsedPlans.map((p) => p.parsed).filter((p): p is NonNullable<typeof p> => p !== null),
    m2mToken
  );

  const externalLabs: TemplateExternalLabPlanDetail[] = externalParsedPlans.map(({ plan, parsed }) => {
    if (!parsed) {
      // Malformed plan (missing lab guid or item code) - surface it as missing
      // so an admin can rebuild the template; apply-template skips it with a
      // warning.
      return {
        planId: plan.id ?? '',
        labGuid: '',
        labName: '',
        testName: labelForExternalLabPlan(plan),
        testCode: '',
        diagnoses: [],
        note: null,
        psc: false,
        missing: true,
      };
    }
    const items = externalOrderableItemsByLabGuid.get(parsed.labGuid);
    // When the availability check itself failed, don't report a false
    // "missing" - apply-template re-checks and warns at apply time.
    const missing = items === undefined || items === 'fetch-failed' ? false : !matchOrderableItemForPlan(parsed, items);
    return {
      planId: parsed.planId,
      labGuid: parsed.labGuid,
      labName: parsed.labName,
      testName: parsed.testName,
      testCode: parsed.itemCode,
      diagnoses: parsed.dx.map((d) => ({ code: d.code, display: d.display })),
      note: parsed.note ?? null,
      psc: parsed.psc,
      missing,
    };
  });

  // Parse in-office procedure plans. Each plan is a ServiceRequest with intent
  // 'plan' and the procedure-template-plan meta tag, carrying the procedure
  // form's data via category/performerType/bodySite plus a stable set of
  // extensions for the remaining fields. Diagnoses and CPT codes are stored as
  // cross-references into the template's own contained Conditions and CPT
  // Procedures, so we look those up here and surface inline {code, display}
  // tuples for the UI.
  const procedurePlans = findProcedurePlans(templateList);

  // Build the lookup tables in a single pass so procedure plans' cross-refs
  // (reasonReference -> Condition, supportingInfo -> CPT Procedure) can resolve
  // to inline {code, display} tuples in the detail output without scanning
  // contained twice.
  const conditionById = new Map<string, Condition>();
  const cptProcedureById = new Map<string, Procedure>();
  const cptCodeTagSystem = chartDataTagSystem('cpt-code');
  for (const r of contained) {
    if (!r.id) continue;
    if (r.resourceType === 'Condition') conditionById.set(r.id, r as Condition);
    else if (r.resourceType === 'Procedure' && resourceHasTagSystem(r as Procedure, cptCodeTagSystem)) {
      cptProcedureById.set(r.id, r as Procedure);
    }
  }

  const getExtensionString = (sr: ServiceRequest, url: string): string | undefined =>
    sr.extension?.find((e) => e.url === url)?.valueString;
  const getExtensionBoolean = (sr: ServiceRequest, url: string): boolean | undefined =>
    sr.extension?.find((e) => e.url === url)?.valueBoolean;
  const getExtensionStrings = (sr: ServiceRequest, url: string): string[] =>
    (sr.extension ?? []).filter((e) => e.url === url).flatMap((e) => (e.valueString ? [e.valueString] : []));
  const getCodingCode = (
    concept: { coding?: { system?: string; code?: string }[] } | undefined,
    system: string
  ): string | undefined => concept?.coding?.find((c) => c.system === system)?.code;

  const procedures: TemplateProcedurePlan[] = procedurePlans.map((plan) => {
    const procedureDiagnoses: TemplateCodeInfo[] = (plan.reasonReference ?? []).flatMap((ref) => {
      const id = ref.reference?.split('/')[1];
      if (!id) return [];
      const cond = conditionById.get(id);
      if (!cond) return [];
      const icd = cond.code?.coding?.find((c) => c.system === ICD_10_CODE_SYSTEM) ?? cond.code?.coding?.[0];
      if (!icd?.code && !icd?.display) return [];
      return [{ code: icd?.code ?? '', display: icd?.display ?? '' }];
    });
    const procedureCptCodes: TemplateCptCodeInfo[] = (plan.supportingInfo ?? []).flatMap((ref) => {
      const id = ref.reference?.split('/')[1];
      if (!id) return [];
      const proc = cptProcedureById.get(id);
      if (!proc) return [];
      const coding = proc.code?.coding?.find((c) => c.system === CPT_CODE_SYSTEM) ?? proc.code?.coding?.[0];
      if (!coding?.code && !coding?.display) return [];
      // Preserve any CPT modifiers stored as Coding.extension on the CPT
      // Procedure. The standalone CPT Codes section does the same, so a CPT
      // that the provider modified (e.g. -LT) reads consistently between the
      // two places it surfaces in the preview.
      return [
        {
          code: coding?.code ?? '',
          display: coding?.display ?? '',
          modifiers: extractCptCodeModifiersFromCoding(coding),
        },
      ];
    });

    return {
      planId: plan.id ?? '',
      procedureType: getCodingCode(plan.category?.[0], PROCEDURE_TYPE_SYSTEM),
      performerType: getCodingCode(plan.performerType, PERFORMER_TYPE_SYSTEM),
      bodySite: getCodingCode(plan.bodySite?.[0], BODY_SITE_SYSTEM),
      bodySide: getExtensionString(plan, FHIR_EXTENSION.ServiceRequest.bodySide.url),
      technique: getExtensionStrings(plan, FHIR_EXTENSION.ServiceRequest.technique.url),
      medicationUsed: getExtensionString(plan, FHIR_EXTENSION.ServiceRequest.medicationUsed.url),
      suppliesUsed: getExtensionString(plan, FHIR_EXTENSION.ServiceRequest.suppliesUsed.url),
      procedureDetails: getExtensionString(plan, FHIR_EXTENSION.ServiceRequest.procedureDetails.url),
      specimenSent: getExtensionBoolean(plan, FHIR_EXTENSION.ServiceRequest.specimenSent.url),
      complications: getExtensionString(plan, FHIR_EXTENSION.ServiceRequest.complications.url),
      patientResponse: getExtensionString(plan, FHIR_EXTENSION.ServiceRequest.patientResponse.url),
      postInstructions: getExtensionString(plan, FHIR_EXTENSION.ServiceRequest.postInstructions.url),
      timeSpent: getExtensionString(plan, FHIR_EXTENSION.ServiceRequest.timeSpent.url),
      documentedBy: getExtensionString(plan, FHIR_EXTENSION.ServiceRequest.documentedBy.url),
      consentObtained: getExtensionBoolean(plan, FHIR_EXTENSION.ServiceRequest.consentObtained.url),
      diagnoses: procedureDiagnoses,
      cptCodes: procedureCptCodes,
    };
  });

  return {
    templateName: templateList.title ?? '',
    templateId: templateList.id!,
    examVersion,
    isCurrentVersion,
    sections: {
      hpiNote,
      moiNote,
      rosNote,
      rosFindings,
      examFindings,
      mdm,
      diagnoses,
      patientInstructions,
      cptCodes,
      emCode,
      accident,
      inHouseLabs,
      externalLabs,
      procedures,
    },
  };
};
