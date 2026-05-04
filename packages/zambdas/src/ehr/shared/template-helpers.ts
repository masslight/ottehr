import Oystehr from '@oystehr/sdk';
import { Condition, List, Observation, Resource } from 'fhir/r4b';
import {
  GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM,
  GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM,
  GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM,
} from 'utils';

export function verifyIsTemplate(templateList: List, templateId: string): void {
  const isTemplate = templateList.code?.coding?.some(
    (c) => c.system === GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM || c.system === GLOBAL_TEMPLATE_TELEMED_CODE_SYSTEM
  );
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
