import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ClinicalImpression, Communication, Condition, List, Observation, Procedure, Resource } from 'fhir/r4b';
import { examConfig, getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { AdminGetTemplateDetailInput, validateRequestParameters } from './validateRequestParameters';

interface ExamFinding {
  fieldName: string;
  label: string;
  isAbnormal: boolean;
  note: string;
}

interface DiagnosisInfo {
  code: string;
  display: string;
}

interface CodeInfo {
  code: string;
  display: string;
}

interface TemplateDetailOutput {
  templateName: string;
  templateId: string;
  examVersion: string;
  sections: {
    hpiNote: string | null;
    rosNote: string | null;
    examFindings: ExamFinding[];
    mdm: string | null;
    diagnoses: DiagnosisInfo[];
    patientInstructions: string | null;
    cptCodes: CodeInfo[];
    emCode: CodeInfo | null;
  };
}

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
function buildAbnormalFieldCodes(): Set<string> {
  const abnormalCodes = new Set<string>();
  const config = examConfig.inPerson.default.components;

  function collectAbnormalCodes(obj: Record<string, any>): void {
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'abnormal' && typeof value === 'object') {
        collectFieldCodes(value, abnormalCodes);
      } else if (typeof value === 'object' && value !== null && 'components' in value) {
        collectAbnormalCodes(value.components);
      }
    }
  }

  function collectFieldCodes(obj: Record<string, any>, codes: Set<string>): void {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        if ('type' in value && value.type === 'checkbox') {
          codes.add(key);
        } else if ('components' in value) {
          collectFieldCodes(value.components, codes);
        } else if ('type' in value && value.type === 'column') {
          collectFieldCodes(value.components, codes);
        }
      }
    }
  }

  collectAbnormalCodes(config);
  return abnormalCodes;
}

// Build a map of field codes to their display labels from the exam config
function buildFieldLabels(): Map<string, string> {
  const labels = new Map<string, string>();
  const config = examConfig.inPerson.default.components;

  function collect(obj: Record<string, any>): void {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        if ('label' in value && 'type' in value && (value.type === 'checkbox' || value.type === 'text')) {
          labels.set(key, value.label as string);
        }
        if ('components' in value) {
          collect(value.components);
        }
      }
    }
  }

  collect(config);
  return labels;
}

const performEffect = async (
  validatedInput: AdminGetTemplateDetailInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr
): Promise<TemplateDetailOutput> => {
  const { templateId } = validatedInput;

  const templateList = await oystehr.fhir.get<List>({
    resourceType: 'List',
    id: templateId,
  });

  if (!templateList.contained || templateList.contained.length === 0) {
    throw new Error(`Template ${templateId} has no contained resources`);
  }

  const contained = templateList.contained;

  // Extract exam version from the List's code coding
  const examVersion = templateList.code?.coding?.[0]?.version ?? '';

  // Parse HPI note
  const hpiCondition = contained.find(
    (r) =>
      r.resourceType === 'Condition' && hasTag(r, 'https://fhir.zapehr.com/r4/StructureDefinitions/chief-complaint')
  ) as Condition | undefined;
  const hpiNote = hpiCondition?.note?.[0]?.text ?? null;

  // Parse ROS note
  const rosCondition = contained.find(
    (r) => r.resourceType === 'Condition' && hasTag(r, 'https://fhir.zapehr.com/r4/StructureDefinitions/ros')
  ) as Condition | undefined;
  const rosNote = rosCondition?.note?.[0]?.text ?? null;

  // Parse exam findings
  const examObservations = contained.filter(
    (r) =>
      r.resourceType === 'Observation' &&
      hasTag(r, 'https://fhir.zapehr.com/r4/StructureDefinitions/exam-observation-field')
  ) as Observation[];

  const abnormalFieldCodes = buildAbnormalFieldCodes();
  const fieldLabels = buildFieldLabels();

  const examFindings: ExamFinding[] = examObservations.map((obs) => {
    const fieldCode =
      getTagCode(obs, 'https://fhir.zapehr.com/r4/StructureDefinitions/exam-observation-field') ?? 'unknown';
    const isAbnormal = abnormalFieldCodes.has(fieldCode);
    const note = obs.note?.[0]?.text ?? '';
    const label = fieldLabels.get(fieldCode) ?? obs.code?.text ?? fieldCode;
    return { fieldName: fieldCode, label, isAbnormal, note };
  });

  // Parse MDM
  const mdmResource = contained.find(
    (r) =>
      r.resourceType === 'ClinicalImpression' &&
      hasTag(r, 'https://fhir.zapehr.com/r4/StructureDefinitions/medical-decision')
  ) as ClinicalImpression | undefined;
  const mdm = mdmResource?.summary ?? null;

  // Parse diagnoses (ICD-10 coded Conditions)
  const diagnosisConditions = contained.filter(
    (r) =>
      r.resourceType === 'Condition' &&
      (r as Condition).code?.coding?.some((c) => c.system === 'http://hl7.org/fhir/sid/icd-10')
  ) as Condition[];

  const diagnoses: DiagnosisInfo[] = diagnosisConditions.map((cond) => {
    const icdCoding = cond.code?.coding?.find((c) => c.system === 'http://hl7.org/fhir/sid/icd-10');
    return {
      code: icdCoding?.code ?? '',
      display: icdCoding?.display ?? '',
    };
  });

  // Parse patient instructions
  const instructionResource = contained.find(
    (r) =>
      r.resourceType === 'Communication' &&
      hasTag(r, 'https://fhir.zapehr.com/r4/StructureDefinitions/patient-instruction')
  ) as Communication | undefined;
  const patientInstructions = instructionResource?.payload?.[0]?.contentString ?? null;

  // Parse CPT codes
  const cptProcedures = contained.filter(
    (r) => r.resourceType === 'Procedure' && hasTag(r, 'https://fhir.zapehr.com/r4/StructureDefinitions/cpt-code')
  ) as Procedure[];

  const cptCodes: CodeInfo[] = cptProcedures.map((proc) => {
    const coding = proc.code?.coding?.[0];
    return {
      code: coding?.code ?? '',
      display: coding?.display ?? '',
    };
  });

  // Parse E&M code
  const emProcedure = contained.find(
    (r) => r.resourceType === 'Procedure' && hasTag(r, 'https://fhir.zapehr.com/r4/StructureDefinitions/em-code')
  ) as Procedure | undefined;

  const emCode: CodeInfo | null = emProcedure
    ? {
        code: emProcedure.code?.coding?.[0]?.code ?? '',
        display: emProcedure.code?.coding?.[0]?.display ?? '',
      }
    : null;

  return {
    templateName: templateList.title ?? '',
    templateId: templateList.id!,
    examVersion,
    sections: {
      hpiNote,
      rosNote,
      examFindings,
      mdm,
      diagnoses,
      patientInstructions,
      cptCodes,
      emCode,
    },
  };
};
