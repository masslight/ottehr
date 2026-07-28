import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { Questionnaire } from 'fhir/r4b';
import {
  PAPERWORK_FLOW_TAG,
  PRACTICE_MANAGED_QUESTIONNAIRE_BASE_VERSION,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
} from 'utils';
import { PAPERWORK_FLOW_BASE_VERSION, searchActiveQuestionnairesByTag } from '../../paperwork-flow/shared';

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
export async function handleFormInFlows(input: HandleFormInFlowInput): Promise<BatchInputRequest<Questionnaire>[]> {
  const { oystehr, ...additionalInput } = input;
  const flowQuestionnaires = await searchActiveQuestionnairesByTag(oystehr, PAPERWORK_FLOW_TAG);

  return bumpFlowFormVersionRequests({ ...additionalInput, flowQuestionnaires });
}

// A form version bump must also bump every flow that derives from it: flow Questionnaires are
// canonical (versioned) resources too, so rather than patching derivedFrom in place, the previous
// flow version is retired and a new one is minted — identical except for the bumped flow version
// and the updated form canonical in derivedFrom.
export function bumpFlowFormVersionRequests(
  input: Omit<HandleFormInFlowInput, 'oystehr'> & { flowQuestionnaires: Questionnaire[] }
): BatchInputRequest<Questionnaire>[] {
  const { previousVersion, nextVersion, url, flowQuestionnaires } = input;
  const requests: BatchInputRequest<Questionnaire>[] = [];

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
  }

  return requests;
}
