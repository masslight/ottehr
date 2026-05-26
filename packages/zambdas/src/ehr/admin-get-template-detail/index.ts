import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ClinicalImpression, Communication, Condition, List, Procedure, Resource } from 'fhir/r4b';
import {
  ACCIDENT_STATE_EXTENSION,
  ACCIDENT_TYPE_SYSTEM,
  AdminGetTemplateDetailInput,
  AdminGetTemplateDetailOutput,
  chartDataTagSystem,
  collectKnownExamFields,
  collectKnownRosFields,
  examConfig,
  getRosFindingStateFromKey,
  getSecret,
  GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM,
  ICD_10_CODE_SYSTEM,
  SecretsKeys,
  TemplateAccidentInfo,
  TemplateCodeInfo,
  TemplateExamFinding,
  TemplateRosFinding,
} from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
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

      const result = await performEffect(validatedInput, oystehr);

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

function hasTag(resource: Resource, tagSystem: string): boolean {
  return resource.meta?.tag?.some((tag) => tag.system === tagSystem) ?? false;
}

function getTagCode(resource: Resource, tagSystem: string): string | undefined {
  return resource.meta?.tag?.find((tag) => tag.system === tagSystem)?.code;
}

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
  oystehr: Oystehr
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

  // Determine exam type from template coding and select appropriate config
  const isInPerson = templateList.code?.coding?.some((c) => c.system === GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM);
  const examTypeConfig = isInPerson ? examConfig.inPerson.default : examConfig.telemed.default;

  // Parse HPI note
  const hpiCondition = contained.find(
    (r) => r.resourceType === 'Condition' && hasTag(r, chartDataTagSystem('chief-complaint'))
  ) as Condition | undefined;
  const hpiNote = hpiCondition?.note?.[0]?.text ?? null;

  // Parse MOI note
  const moiCondition = contained.find(
    (r) => r.resourceType === 'Condition' && hasTag(r, chartDataTagSystem('mechanism-of-injury'))
  ) as Condition | undefined;
  const moiNote = moiCondition?.note?.[0]?.text ?? null;

  // get details on ros findings, exam findings and legacy ros
  // these all feed into whether or not the template version is current so they are handled together
  const examTagSystem = chartDataTagSystem('exam-observation-field');
  const rosTagSystem = chartDataTagSystem('ros-observation-field');
  const legacyRosTagSystem = chartDataTagSystem('ros');

  const knownExamFields = collectKnownExamFields(examTypeConfig.components);
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
    const fieldCode = getTagCode(obs, rosTagSystem) ?? 'unknown';
    const findingState = getRosFindingStateFromKey(fieldCode);
    const label = obs.code.text ?? 'unknown';
    const stale = unmatchedRosFieldSet.has(fieldCode);
    return { fieldName: fieldCode, label, findingState, stale };
  });

  const abnormalFieldCodes = buildAbnormalFieldCodes(examTypeConfig.components);
  const fieldLabels = buildFieldLabels(examTypeConfig.components);

  const examFindings: TemplateExamFinding[] = examObservations.map((obs) => {
    const fieldCode = getTagCode(obs, examTagSystem) ?? 'unknown';
    const isAbnormal = abnormalFieldCodes.has(fieldCode);
    const note = obs.note?.[0]?.text ?? '';
    const label = fieldLabels.get(fieldCode) ?? obs.code?.text ?? fieldCode;
    return { fieldName: fieldCode, label, isAbnormal, note };
  });

  // Parse MDM
  const mdmResource = contained.find(
    (r) => r.resourceType === 'ClinicalImpression' && hasTag(r, chartDataTagSystem('medical-decision'))
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
    (r) => r.resourceType === 'Communication' && hasTag(r, chartDataTagSystem('patient-instruction'))
  ) as Communication[];
  const patientInstructions = instructionResources
    .map((r) => ({
      title: r.topic?.text ?? null,
      text: r.payload?.[0]?.contentString ?? '',
    }))
    .filter((i) => Boolean(i.text));

  // Parse CPT codes
  const cptProcedures = contained.filter(
    (r) => r.resourceType === 'Procedure' && hasTag(r, chartDataTagSystem('cpt-code'))
  ) as Procedure[];

  const cptCodes: TemplateCodeInfo[] = cptProcedures.map((proc) => {
    const coding = proc.code?.coding?.[0];
    return {
      code: coding?.code ?? '',
      display: coding?.display ?? '',
    };
  });

  // Parse E&M code
  const emProcedure = contained.find(
    (r) => r.resourceType === 'Procedure' && hasTag(r, chartDataTagSystem('em-code'))
  ) as Procedure | undefined;

  const emCode: TemplateCodeInfo | null = emProcedure
    ? {
        code: emProcedure.code?.coding?.[0]?.code ?? '',
        display: emProcedure.code?.coding?.[0]?.display ?? '',
      }
    : null;

  // Parse accident / condition related to
  const accidentCondition = contained.find(
    (r) => r.resourceType === 'Condition' && hasTag(r, chartDataTagSystem('accident'))
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
    },
  };
};
