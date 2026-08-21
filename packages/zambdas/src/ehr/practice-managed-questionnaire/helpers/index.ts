import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { Questionnaire } from 'fhir/r4b';
import { PAPERWORK_FLOW_TAG } from 'utils/lib/fhir/constants';
import {
  isPortalManagedQ,
  PRACTICE_MANAGED_QUESTIONNAIRE_BASE_VERSION,
} from 'utils/lib/helpers/practice-managed-questionnaires';
import { MANAGED_QUESTIONNAIRE_ERROR } from 'utils/lib/types/errors';
import {
  getCanonicalUrlFromQ,
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

// The portal edits two categories of Questionnaire: practice-managed (custom, admin-authored) and
// practice-default (Ottehr-managed intake forms brought in for locked editing). Both are accepted here;
// the locked-edit restrictions for defaults are enforced separately (see lock-validation).
export const validateQisPracticeManaged = (questionnaire: Questionnaire, questionnaireId: string): void => {
  if (!isPortalManagedQ(questionnaire)) {
    throw new Error(
      `Attempting to access a questionnaire that is not practice-managed or practice-default Questionnaire/${questionnaireId}`
    );
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
  const [flowQuestionnaires] = await Promise.all([
    searchActiveQuestionnairesByTag(oystehr, PAPERWORK_FLOW_TAG),
    searchServiceCategoryHealthcareServices(oystehr),
  ]);

  return bumpFlowFormVersionRequests({ ...additionalInput, flowQuestionnaires });
}

// A form version bump must also bump every flow that derives from it: flow Questionnaires are
// canonical (versioned) resources too, so rather than patching derivedFrom in place, the previous
// flow version is retired and a new one is minted — identical except for the bumped flow version
// and the updated form canonical in derivedFrom.
// requests to patch and HealthcareServices pointing at the prior version of the form are also made
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
