import Oystehr from '@oystehr/sdk';
import {
  Account,
  ActivityDefinition,
  ClinicalImpression,
  Communication,
  Condition,
  Coverage,
  Encounter,
  List,
  Location,
  Observation,
  Patient,
  Procedure,
  Resource,
  ServiceRequest,
} from 'fhir/r4b';
import {
  chartDataTagSystem,
  extractCptCodeModifiersFromCoding,
  GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM,
  GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM,
  REPEAT_TEST_CPT_CODE_MODIFIER,
} from 'utils';
import { getLatestInHouseLabActivityDefinitionsForTemplatePlan } from '../apply-template/apply-in-house-labs';

// Meta-tag systems that mark a resource as belonging in a global template.
// IMPORTANT: this is a positive allow-list
export const TEMPLATE_TAG_SYSTEMS: ReadonlySet<string> = new Set([
  chartDataTagSystem('chief-complaint'),
  chartDataTagSystem('mechanism-of-injury'),
  chartDataTagSystem('ros'), // legacy
  chartDataTagSystem('exam-observation-field'),
  chartDataTagSystem('ros-observation-field'),
  chartDataTagSystem('medical-decision'),
  chartDataTagSystem('patient-instruction'),
  chartDataTagSystem('cpt-code'),
  chartDataTagSystem('em-code'),
  chartDataTagSystem('diagnosis'),
  // ATHENA TODO: shouldn't the in house lab template tag be here? Also shouldn't all these strings for the various things be a type/const?
  // chartDataTagSystem('in-house-lab-template-plan')
]);

// Minimal shape for tag-based predicates so callers can pass resources from any FHIR version (R4B / R5) without
// fighting cross-version type unions. The runtime shape of meta.tag is identical across versions.
type TaggedResource = {
  resourceType?: string;
  meta?: { tag?: Array<{ system?: string; code?: string }> };
};

// ATHENA TODO: figure out if adding the in house lab template plan key would break this anywhere
export function hasTemplateRelevantTag(resource: TaggedResource | undefined): boolean {
  return resource?.meta?.tag?.some((tag) => !!tag.system && TEMPLATE_TAG_SYSTEMS.has(tag.system)) ?? false;
}

export function isDiagnosisCondition(resource: TaggedResource | undefined): boolean {
  if (resource?.resourceType !== 'Condition') return false;
  return resource.meta?.tag?.some((tag) => tag.system === chartDataTagSystem('diagnosis')) ?? false;
}

export function isInHouseLabRepeatTestCptCode(resource: TemplateEncounterResource | undefined): boolean {
  if (!resource) return false;
  if (resource.resourceType !== 'Procedure') return false;
  return (
    !!resource.meta?.tag?.some((tag) => tag.system === chartDataTagSystem('cpt-code')) &&
    !!resource.code?.coding &&
    resource.code.coding
      .flatMap((coding) => extractCptCodeModifiersFromCoding(coding))
      .some((modifier) => modifier.code === REPEAT_TEST_CPT_CODE_MODIFIER.code)
  );
}

export function verifyIsTemplate(templateList: List, templateId: string): void {
  const isTemplate = templateList.code?.coding?.some((c) => c.system === GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM);
  if (!isTemplate) {
    throw new Error(`List ${templateId} is not a global template`);
  }
}

export async function findHolderList(oystehr: Oystehr): Promise<List | undefined> {
  const holderLists = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [{ name: '_tag', value: `${GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM}|` }],
    })
  ).unbundle();

  return holderLists.find((l) => l.meta?.tag?.some((tag) => tag.system === GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM));
}

type VersionCheckResult = {
  isCurrentVersion: boolean;
  unmatchedExamFields: string[];
  unmatchedRosFields: string[];
  examObservations: Observation[];
  rosObservations: Observation[];
  rosNote: string | null;
};

export function analyzeTemplateVersionData(params: {
  contained: Resource[];
  examTagSystem: string;
  rosTagSystem: string;
  legacyRosTagSystem: string;
  knownExamFields: Set<string>;
  knownRosFields: Set<string>;
}): VersionCheckResult {
  const { contained, examTagSystem, rosTagSystem, legacyRosTagSystem, knownExamFields, knownRosFields } = params;

  const getTagCode = (resource: any, system: string): string | undefined =>
    resource.meta?.tag?.find((t: any) => t.system === system)?.code;

  const hasTag = (resource: any, system: string): boolean => resource.meta?.tag?.some((t: any) => t.system === system);

  let rosNote: string | null = null;
  let legacyRosFound = false;

  const unmatchedExamFields: string[] = [];
  const unmatchedRosFields: string[] = [];

  const examObservations: Observation[] = [];
  const rosObservations: Observation[] = [];

  for (const r of contained) {
    if (r.resourceType === 'Condition') {
      if (!rosNote && hasTag(r, legacyRosTagSystem)) {
        rosNote = (r as Condition).note?.[0]?.text ?? null;
        legacyRosFound = true;
      }

      continue;
    }

    if (r.resourceType !== 'Observation') continue;

    // exam fields
    if (hasTag(r, examTagSystem)) {
      examObservations.push(r as Observation);
      const code = getTagCode(r, examTagSystem);
      if (code && !knownExamFields.has(code)) {
        unmatchedExamFields.push(code);
      }
    }

    // ros fields
    if (hasTag(r, rosTagSystem)) {
      rosObservations.push(r as Observation);
      const code = getTagCode(r, rosTagSystem);
      if (code && !knownRosFields.has(code)) {
        unmatchedRosFields.push(code);
      }
    }
  }

  // A template is "current" if all its exam & ros observation fields exist in the current config.
  // This matches the approach used by useUnmatchedExamFields for visit exam data.
  const isCurrentVersion = unmatchedExamFields.length === 0 && unmatchedRosFields.length === 0 && !legacyRosFound;

  return {
    isCurrentVersion,
    unmatchedExamFields,
    unmatchedRosFields,
    examObservations,
    rosObservations,
    rosNote,
  };
}

export type TemplateEncounterResource =
  | Encounter
  | Observation
  | ClinicalImpression
  | Communication
  | Condition
  | Procedure
  | ServiceRequest
  | Patient
  | Location
  | Coverage
  | Account;

export const getTemplateEncounterBundle = async (
  oystehr: Oystehr,
  encounterId: string
): Promise<TemplateEncounterResource[]> => {
  return (
    await oystehr.fhir.search<TemplateEncounterResource>({
      resourceType: 'Encounter',
      params: [
        { name: '_id', value: encounterId },
        { name: '_revinclude:iterate', value: 'Observation:encounter' },
        { name: '_revinclude:iterate', value: 'ClinicalImpression:encounter' },
        { name: '_revinclude:iterate', value: 'Communication:encounter' },
        // NOTE: this pulls all Conditions that have ever been associated with an encounter
        // not just the ones currently on the Encounter. Need to filter it down later
        { name: '_revinclude:iterate', value: 'Condition:encounter' },
        { name: '_revinclude:iterate', value: 'Procedure:encounter' },
        // Pulled in so in-house lab orders on this encounter can be saved as
        // template plans when creating templates.
        { name: '_revinclude:iterate', value: 'ServiceRequest:encounter' },

        // all of these resources are for creating in house labs
        { name: '_include', value: 'Encounter:location' },
        { name: '_include', value: 'Encounter:patient' },
        { name: '_revinclude:iterate', value: 'Coverage:patient' },
        { name: '_revinclude:iterate', value: 'Account:patient' },
      ],
    })
  ).unbundle();
};

/**
 * Grabs all of the resources related to the Encounter, as well as any latest ActivityDefinitions for in house labs
 * referenced on ServiceRequest plans on the template
 * @param oystehr
 * @param encounterId
 * @param templateList
 * @returns
 */
export const getTemplateBaseResources = async (
  oystehr: Oystehr,
  encounterId: string,
  templateList: List
): Promise<{ encounterResources: TemplateEncounterResource[]; latestInHouseLabAds: ActivityDefinition[] }> => {
  const [encounterResources, latestInHouseLabAds] = await Promise.all([
    getTemplateEncounterBundle(oystehr, encounterId),
    getLatestInHouseLabActivityDefinitionsForTemplatePlan(oystehr, templateList),
  ]);

  return { encounterResources, latestInHouseLabAds };
};
