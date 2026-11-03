import { randomBytes } from 'node:crypto';
import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Questionnaire } from 'fhir/r4b';
import { PAPERWORK_FLOW_TAG, PRACTICE_MANAGED_QUESTIONNAIRE_TAG } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  FormPlacement,
  getFormPlacement,
  PRACTICE_MANAGED_QUESTIONNAIRE_BASE_VERSION,
  withFormPlacement,
} from 'utils/lib/helpers/practice-managed-questionnaires';
import { MANAGED_QUESTIONNAIRE_ERROR } from 'utils/lib/types/errors';
import { compareVersions } from '../../../shared/fhir';
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

export const patchQuestionnaireVersion = (version: string): string => {
  const [major, minor, patch] = version.split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
};

/** Patches moving each version of a form to `placement`; a response follows the version it answered. */
export const placementTagOperations = (versions: Questionnaire[], placement: FormPlacement): Map<string, Operation[]> =>
  new Map(
    versions
      .filter((version) => version.id && getFormPlacement(version) !== placement)
      .map((version): [string, Operation[]] => [
        version.id!,
        [
          {
            op: version.meta?.tag ? 'replace' : 'add',
            path: '/meta/tag',
            value: withFormPlacement(version.meta?.tag, placement),
          },
        ],
      ])
  );

/** Retires the previous version, moving every version of the form to `placement` in the same requests. */
export async function supersedeVersionRequests(input: {
  url: string;
  previousId: string;
  placement: FormPlacement;
  oystehr: Oystehr;
}): Promise<BatchInputPatchRequest<Questionnaire>[]> {
  const { url, previousId, placement, oystehr } = input;
  const versions = await getAllFhirSearchPages<Questionnaire>(
    { resourceType: 'Questionnaire', params: [{ name: 'url', value: url }] },
    oystehr
  );
  const retagOperations = placementTagOperations(versions, placement);
  return [
    {
      method: 'PATCH',
      url: `Questionnaire/${previousId}`,
      operations: [{ op: 'replace', path: '/status', value: 'retired' }, ...(retagOperations.get(previousId) ?? [])],
    },
    ...[...retagOperations]
      .filter(([id]) => id !== previousId)
      .map(
        ([id, operations]): BatchInputPatchRequest<Questionnaire> => ({
          method: 'PATCH',
          url: `Questionnaire/${id}`,
          operations,
        })
      ),
  ];
}

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

export const ensureUniqueQuestionnaire = async (
  questionnaire: Questionnaire,
  oystehr: Oystehr
): Promise<Questionnaire> => {
  const url = questionnaire.url;
  // this should never happen so throw a real error
  if (!url) throw new Error('ensureUniqueQuestionnaire requires a questionnaire with a url');

  console.log(`Validating that Questionnaire has been sent with a unique canonical url ${url}`);

  // url is the identifier used to grab forms / paperwork we should just check on url not url|version because
  // maybe we will get lucky with url|1.0.0 but then have an issue with url|1.0.1 (in reality this shouldn't happen but handling for an edge case)
  const questionnaireSearch = (
    await oystehr.fhir.search<Questionnaire>({
      resourceType: 'Questionnaire',
      params: [
        {
          name: 'url',
          value: url,
        },
      ],
    })
  ).unbundle();

  if (questionnaireSearch.length === 0) return questionnaire;

  // url is taken: append a random suffix to the url so the canonical is unique
  console.log(
    `Duplicate questionnaire found: ${questionnaireSearch.map((q) => `Questionnaire/${q.id}`)}. Appending suffix to url`
  );

  // if we hit a collision on the url, i think the chances of hitting another one on the url with then random index
  // is so unlikely it is not worth another check
  const suffix = randomBytes(3).toString('hex'); // e.g. "a3f9c1"

  return { ...questionnaire, url: `${url}-${suffix}` };
};
