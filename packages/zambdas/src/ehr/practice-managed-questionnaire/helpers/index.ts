import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { Extension, HealthcareService, Questionnaire } from 'fhir/r4b';
import { isEqual } from 'lodash-es';
import {
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
export function bumpFlowFormVersionRequests(
  input: Omit<HandleFormInFlowInput, 'oystehr'> & { flowQuestionnaires: Questionnaire[]; services: HealthcareService[] }
): BatchInputRequest<Questionnaire | HealthcareService>[] {
  const { previousVersion, nextVersion, url, flowQuestionnaires, services } = input;
  const requests: BatchInputRequest<Questionnaire | HealthcareService>[] = [];

  const previousFormCanonical = `${url}|${previousVersion}`;
  const nextFormCanonical = `${url}|${nextVersion}`;

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
    requests.push(...makeServicePatchesForFlowCanonicalBump(services, previousFlowCanonical, nextFlowCanonical));
  }

  return requests;
}

function bumpServiceExtensionCanonical(
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

function makeServicePatchesForFlowCanonicalBump(
  services: HealthcareService[],
  previousCanonical: string,
  nextCanonical: string
): BatchInputPatchRequest<HealthcareService>[] {
  const patchRequests: BatchInputPatchRequest<HealthcareService>[] = [];

  for (const service of services) {
    if (!service.id) continue;

    const existingExtensions = service.extension ?? [];
    const nextExtensions = bumpServiceExtensionCanonical(existingExtensions, previousCanonical, nextCanonical);

    if (isEqual(existingExtensions, nextExtensions)) continue;

    patchRequests.push({
      method: 'PATCH',
      url: `HealthcareService/${service.id}`,
      operations: [{ op: 'replace', path: '/extension', value: nextExtensions }],
    });
  }

  return patchRequests;
}
