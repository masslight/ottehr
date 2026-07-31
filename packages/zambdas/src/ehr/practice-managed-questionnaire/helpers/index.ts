import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { Extension, HealthcareService, Questionnaire } from 'fhir/r4b';
import { isEqual } from 'lodash-es';
import {
  MANAGED_QUESTIONNAIRE_ERROR,
  PAPERWORK_FLOW_TAG,
  PRACTICE_MANAGED_QUESTIONNAIRE_BASE_VERSION,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
} from 'utils';
import {
  getCanonicalUrlFromQ,
  healthcareServiceExtensionUrlMap,
  PAPERWORK_FLOW_BASE_VERSION,
  searchActiveQuestionnairesByTag,
  searchServiceCategoryHealthcareServices,
} from '../../paperwork-flow/shared';

export const questionnaireElements = ['id', 'title', 'status', 'url', 'version', 'meta'] as const;
export type FhirQuestionnaireSubset = Pick<Questionnaire, (typeof questionnaireElements)[number]>;

export function isLatestVersion(candidate: FhirQuestionnaireSubset, current: FhirQuestionnaireSubset): boolean {
  const versionComparison = compareVersions(
    candidate.version ?? PRACTICE_MANAGED_QUESTIONNAIRE_BASE_VERSION,
    current.version ?? PRACTICE_MANAGED_QUESTIONNAIRE_BASE_VERSION
  );

  if (versionComparison > 0) return true;
  if (versionComparison < 0) return false;

  // Versions are equal, compare lastUpdated
  const candidateLastUpdated = candidate.meta?.lastUpdated;
  const currentLastUpdated = current.meta?.lastUpdated;

  return new Date(candidateLastUpdated ?? '') >= new Date(currentLastUpdated ?? '');
}

function compareVersions(versionA: string, versionB: string): number {
  const a = versionA.split('.').map(Number);
  const b = versionB.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return 1;
    if (a[i] < b[i]) return -1;
  }

  return 0;
}

export const patchQuestionnaireVersion = (version: string): string => {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
};

export const validateQisPracticeManaged = (questionnaire: Questionnaire, questionnaireId: string): void => {
  const isPracticeManaged = questionnaire.meta?.tag?.some(
    (t) => t.system === PRACTICE_MANAGED_QUESTIONNAIRE_TAG.system && t.code === PRACTICE_MANAGED_QUESTIONNAIRE_TAG.code
  );

  if (!isPracticeManaged) {
    throw new Error(`Attempting to get questionnaire that is not practice managed Questionnaire/${questionnaireId}`);
  }
};

interface HandleFormInFlowInput {
  previousVersion: string;
  nextVersion: string;
  url: string;
  oystehr: Oystehr;
}
export async function handleFormInFlows(
  input: HandleFormInFlowInput
): Promise<BatchInputRequest<Questionnaire | HealthcareService>[]> {
  const { oystehr, ...additionalInput } = input;
  const [flowQuestionnaires, services] = await Promise.all([
    searchActiveQuestionnairesByTag(oystehr, PAPERWORK_FLOW_TAG),
    searchServiceCategoryHealthcareServices(oystehr),
  ]);

  return bumpFlowFormVersionRequests({ ...additionalInput, flowQuestionnaires, services });
}

// A form version bump must also bump every flow that derives from it: flow Questionnaires are
// canonical (versioned) resources too, so rather than patching derivedFrom in place, the previous
// flow version is retired and a new one is minted — identical except for the bumped flow version
// and the updated form canonical in derivedFrom.
// requests to patch and HealthcareServices pointing at the prior version of the form are also made
export function bumpFlowFormVersionRequests(
  input: Omit<HandleFormInFlowInput, 'oystehr'> & { flowQuestionnaires: Questionnaire[]; services: HealthcareService[] }
): BatchInputRequest<Questionnaire | HealthcareService>[] {
  const { previousVersion, nextVersion, url, flowQuestionnaires, services } = input;
  const requests: BatchInputRequest<Questionnaire | HealthcareService>[] = [];

  const previousFormCanonical = `${url}|${previousVersion}`;
  const nextFormCanonical = `${url}|${nextVersion}`;

  // Collected across all flows so services shared by more than one bumped flow get a single
  // patch applying every bump, rather than one patch per flow overwriting the previous one.
  const flowCanonicalBumps: { previousCanonical: string; nextCanonical: string }[] = [];

  for (const flow of flowQuestionnaires) {
    const derivedFromIndex = flow.derivedFrom?.findIndex((canonical) => canonical === previousFormCanonical) ?? -1;
    if (derivedFromIndex === -1) continue;

    const retirePatch: BatchInputPatchRequest<Questionnaire> = {
      method: 'PATCH',
      url: `Questionnaire/${flow.id}`,
      operations: [{ op: 'replace', path: '/status', value: 'retired' }],
    };

    const nextDerivedFrom = [...(flow.derivedFrom ?? [])];
    nextDerivedFrom[derivedFromIndex] = nextFormCanonical;

    const nextFlowVersion = flow.version ? patchQuestionnaireVersion(flow.version) : PAPERWORK_FLOW_BASE_VERSION;

    const { id: _flowId, meta, ...rest } = flow;
    const nextFlowQuestionnaire: Questionnaire = {
      ...rest,
      ...(meta?.tag && { meta: { tag: meta.tag } }),
      version: nextFlowVersion,
      derivedFrom: nextDerivedFrom,
    };

    const createPost: BatchInputPostRequest<Questionnaire> = {
      method: 'POST',
      url: '/Questionnaire',
      resource: nextFlowQuestionnaire,
    };

    requests.push(retirePatch, createPost);

    // Services don't reference forms directly — they hold a valueCanonical pointing at the flow
    // Questionnaire's own canonical. Since the flow's canonical just changed (version bump above),
    // any service still pointing at the flow's previous canonical needs to be re-pointed at the new one.
    const previousFlowCanonical = getCanonicalUrlFromQ(flow);
    if (!previousFlowCanonical) continue;

    const nextFlowCanonical = `${flow.url}|${nextFlowVersion}`;
    flowCanonicalBumps.push({ previousCanonical: previousFlowCanonical, nextCanonical: nextFlowCanonical });
  }

  requests.push(...makeServicePatchesForFlowCanonicalBumps(services, flowCanonicalBumps));

  return requests;
}

export function bumpServiceExtensionCanonical(
  extensions: Extension[],
  previousCanonical: string,
  nextCanonical: string
): Extension[] {
  const flowExtensionUrls: string[] = Object.values(healthcareServiceExtensionUrlMap);

  return extensions.map((ext) => {
    if (flowExtensionUrls.includes(ext.url) && ext.valueCanonical === previousCanonical) {
      return { ...ext, valueCanonical: nextCanonical };
    }
    return ext;
  });
}

// Applies every previous -> next canonical bump to each service's extensions in one pass, emitting
// at most one PATCH per service. This matters when a service is bound (on different modes/extension
// urls) to more than one flow that got bumped in the same batch: patching per-flow would have each
// PATCH replace the whole /extension array from the same pre-bump snapshot, so the later PATCH would
// silently clobber the earlier one's change instead of the two accumulating.
export function makeServicePatchesForFlowCanonicalBumps(
  services: HealthcareService[],
  canonicalBumps: { previousCanonical: string; nextCanonical: string }[]
): BatchInputPatchRequest<HealthcareService>[] {
  const patchRequests: BatchInputPatchRequest<HealthcareService>[] = [];

  for (const service of services) {
    if (!service.id) continue;

    const existingExtensions = service.extension ?? [];
    let nextExtensions = existingExtensions;
    for (const { previousCanonical, nextCanonical } of canonicalBumps) {
      nextExtensions = bumpServiceExtensionCanonical(nextExtensions, previousCanonical, nextCanonical);
    }

    if (isEqual(existingExtensions, nextExtensions)) continue;

    patchRequests.push({
      method: 'PATCH',
      url: `HealthcareService/${service.id}`,
      operations: [{ op: 'replace', path: '/extension', value: nextExtensions }],
    });
  }

  return patchRequests;
}

export async function validateFormIsExcludedFromFlows(formQId: string, oystehr: Oystehr): Promise<void> {
  console.log('checking if the form is contained in any flows before retiring');
  const [targetFormQ, flowQuestionnaires] = await Promise.all([
    oystehr.fhir.get<Questionnaire>({ resourceType: 'Questionnaire', id: formQId }),
    searchActiveQuestionnairesByTag(oystehr, PAPERWORK_FLOW_TAG),
  ]);
  evaluateFlowsForUrl(targetFormQ, flowQuestionnaires);
}

export const evaluateFlowsForUrl = (targetFormQ: Questionnaire, flowQuestionnaires: Questionnaire[]): void => {
  const canonicalUrl = getCanonicalUrlFromQ(targetFormQ);
  const contained = flowQuestionnaires.filter((q) => {
    return q.derivedFrom?.some((url) => url === canonicalUrl);
  });

  if (contained.length > 0) {
    const flowsImpacted = contained.map((flow) => flow.title);
    throw MANAGED_QUESTIONNAIRE_ERROR(
      `This form is contained in a paperwork flow, please remove it from the following: ${flowsImpacted.join(', ')}`
    );
  }
  console.log('safe to retire');
};
