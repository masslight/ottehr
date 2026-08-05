import Oystehr from '@oystehr/sdk';
import { FhirResource, Questionnaire, QuestionnaireItem, QuestionnaireResponse } from 'fhir/r4b';
import inPersonIntakeQuestionnaireArchive from '../../../../config/oystehr/in-person-intake-questionnaire-archive.json' assert { type: 'json' };
import virtualIntakeQuestionnaireArchive from '../../../../config/oystehr/virtual-intake-questionnaire-archive.json' assert { type: 'json' };
import {
  IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE,
  IN_PERSON_INTAKE_PAPERWORK_URL,
  PATIENT_RECORD_QUESTIONNAIRE,
  VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE,
  VIRTUAL_INTAKE_PAPERWORK_URL,
} from '../ottehr-config';
import { CanonicalUrl } from '../types';
import { INTAKE_PAPERWORK_QR_TAG } from './constants';

// todo: refactor this to avoid dependency on Oystehr client in utils (take all Q literals from config, stop relying on literal historic resources)
const getQuestionnaires = (): Array<Questionnaire> => [
  IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE(),
  PATIENT_RECORD_QUESTIONNAIRE(),
  VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE(),
  ...Object.values(virtualIntakeQuestionnaireArchive.fhirResources).map((r) => r.resource as Questionnaire),
  ...Object.values(inPersonIntakeQuestionnaireArchive.fhirResources).map((r) => r.resource as Questionnaire),
];

// throws an error if unable to find exactly 1 matching resource
export const getCanonicalQuestionnaire = async (
  canonical: CanonicalUrl,
  oystehrClient: Oystehr
): Promise<Questionnaire> => {
  const { url, version } = canonical;

  const maybeQuestionnaireFromFile = getQuestionnaires().find((q) => q.url === url && q.version === version);
  // if we found the Q in the local file, return it
  console.log('looking for questionnaire locally', url, version);
  if (maybeQuestionnaireFromFile) {
    console.log('found questionnaire locally');
    return JSON.parse(JSON.stringify(maybeQuestionnaireFromFile));
  }
  console.log('questionnaire not found locally, fetching from FHIR server');

  // otherwise, fetch from the FHIR server
  const questionnaireSearch = (
    await oystehrClient.fhir.search<Questionnaire>({
      resourceType: 'Questionnaire',
      params: [
        {
          name: 'url',
          value: url,
        },
        {
          name: 'version',
          value: version,
        },
      ],
    })
  ).unbundle();
  // if we do not get exactly one result, throw an error
  if (questionnaireSearch.length < 1) {
    throw new Error(`Could not find questionnaire with canonical url ${url}|${version}`);
  } else if (questionnaireSearch.length > 1) {
    throw new Error(`Found multiple Questionnaires with same canonical url: ${url}|${version}`);
  }
  const questionnaire: Questionnaire | undefined = questionnaireSearch[0];
  if (!questionnaire.id) {
    throw new Error('Questionnaire does not have ID');
  }
  if (!questionnaire.url) {
    throw new Error('Questionnaire does not have a url');
  }
  if (!questionnaire.version) {
    throw new Error('Questionnaire does not have a version');
  }
  return questionnaire;
};

/**
 * True when a QuestionnaireResponse is the patient's intake paperwork response. Recognized either by
 * the INTAKE_PAPERWORK_QR_TAG meta.tag (stamped at booking — this is what identifies a paperwork-flow
 * QR, whose canonical is the flow url rather than an intake-paperwork url) or, for QRs created before
 * the tag existed, by a canonical matching the in-person / virtual intake paperwork Questionnaire urls.
 */
export const isIntakePaperworkQuestionnaireResponse = (qr: QuestionnaireResponse): boolean => {
  const hasIntakeTag = (qr.meta?.tag ?? []).some(
    (tag) => tag.system === INTAKE_PAPERWORK_QR_TAG.system && tag.code === INTAKE_PAPERWORK_QR_TAG.code
  );
  if (hasIntakeTag) {
    return true;
  }
  const questionnaireUrl = qr.questionnaire;
  if (!questionnaireUrl) {
    return false;
  }
  return (
    questionnaireUrl.startsWith(IN_PERSON_INTAKE_PAPERWORK_URL) ||
    questionnaireUrl.startsWith(VIRTUAL_INTAKE_PAPERWORK_URL)
  );
};

export const selectIntakeQuestionnaireResponse = (resources: FhirResource[]): QuestionnaireResponse | undefined => {
  return resources.find(
    (res) => res.resourceType === 'QuestionnaireResponse' && isIntakePaperworkQuestionnaireResponse(res)
  ) as QuestionnaireResponse | undefined;
};

/** uses the canonical url (QuestionnaireResponse.questionnaire) to fetch the related Questionnaire resource */
export const getQuestionnaireForQR = async (qr: QuestionnaireResponse, oystehr: Oystehr): Promise<Questionnaire> => {
  const [sourceQuestionnaireUrl, sourceQuestionnaireVersion] = qr.questionnaire?.split('|') ?? [null, null];

  if (!sourceQuestionnaireUrl || !sourceQuestionnaireVersion) {
    throw new Error(
      `Questionnaire for QR is not well defined: ${sourceQuestionnaireUrl}|${sourceQuestionnaireVersion}`
    );
  }
  console.log('currentQuestionnaireUrl', sourceQuestionnaireUrl, sourceQuestionnaireVersion);

  const questionnaire = await getCanonicalQuestionnaire(
    { version: sourceQuestionnaireVersion, url: sourceQuestionnaireUrl },
    oystehr
  );

  return questionnaire;
};

/**
 * Assembles a paperwork flow's constituent forms into a single ordered top-level item list. For each
 * canonical in `flowQuestionnaire.derivedFrom` the referenced form Questionnaire is resolved
 * and its top-level items are concatenated. Any top-level linkId that appears in more than one form is
 * de-duplicated, keeping only its last occurrence and dropping earlier ones.
 */
export const assembleFlowQuestionnaireItems = async (
  flowQuestionnaire: Questionnaire,
  oystehr: Oystehr
): Promise<QuestionnaireItem[]> => {
  const derivedFrom = flowQuestionnaire.derivedFrom ?? [];

  const results = await Promise.allSettled(
    derivedFrom.map(async (canonical) => {
      const { url, version } = deconstructCanonicalUrl(canonical, flowQuestionnaire);
      const form = await getCanonicalQuestionnaire({ url, version }, oystehr);
      return form.item ?? [];
    })
  );

  const failures = results.flatMap((result, index) =>
    result.status === 'rejected' ? [{ canonical: derivedFrom[index], reason: result.reason }] : []
  );
  if (failures.length > 0) {
    const details = failures
      .map(({ canonical, reason }) => `"${canonical}": ${reason instanceof Error ? reason.message : String(reason)}`)
      .join('; ');
    throw new Error(
      `Failed to resolve constituent form(s) for paperwork flow Questionnaire/${flowQuestionnaire.id}: ${details}`
    );
  }

  const formItemLists = (results as PromiseFulfilledResult<QuestionnaireItem[]>[]).map((result) => result.value);
  const assembledItems = formItemLists.flat();
  return handleFlowQuestionnaireItem(assembledItems);
};

export const handleFlowQuestionnaireItem = (assembledItems: QuestionnaireItem[]): QuestionnaireItem[] => {
  // where page linkIds are duplicated, keep the last occurrence (a common example of this is the consent page)
  // we in order to get the consent page to show up at the end of a flow that holds a form with the consent page contained
  // the user must add consent only form at the end of the flow
  // this could be a strange user experience for other pages but we have decided that its probably an unlikely occurrence
  // and better to handle gracefully than error when trying to enter paperwork
  const occurrencesRemaining = new Map<string, number>();
  for (const item of assembledItems) {
    occurrencesRemaining.set(item.linkId, (occurrencesRemaining.get(item.linkId) ?? 0) + 1);
  }
  return assembledItems.filter((item) => {
    const remaining = occurrencesRemaining.get(item.linkId)! - 1;
    occurrencesRemaining.set(item.linkId, remaining);
    return remaining === 0;
  });
};

/**
 * Returns the effective Questionnaire to render / pre-fill against.
 * If the questionnaire has no derivedFrom property then there's nothing to flatten and the function will returns the questionnaire unchanged.
 * If the questionnaire passed does have derivedFrom this returns a copy with `item` assembled from its constituent forms in derivedFrom order
 */
export const resolveEffectiveQuestionnaire = async (
  questionnaire: Questionnaire,
  oystehr: Oystehr
): Promise<Questionnaire> => {
  if (!questionnaire.derivedFrom) return questionnaire;

  const item = await assembleFlowQuestionnaireItems(questionnaire, oystehr);
  return { ...questionnaire, item };
};

export const deconstructCanonicalUrl = (
  canonical: string,
  questionnaire: Questionnaire
): { url: string; version: string } => {
  const [url, version] = canonical.split('|');
  if (!url || !version) {
    throw new Error(`Malformed derivedFrom canonical "${canonical}" on Questionnaire/${questionnaire.id}`);
  }

  return { url, version };
};
