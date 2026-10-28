import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Location, Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { FORM_PLACEMENT_TAG_SYSTEM, PAPERWORK_FLOW_TAG } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getCanonicalQuestionnaire } from 'utils/lib/fhir/questionnaires';
import {
  hasAnyAnswer,
  isPracticeManagedQ,
  makeStandaloneFormDTO,
  qrSentManually,
} from 'utils/lib/helpers/practice-managed-questionnaires';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import {
  PatientFormResponse,
  StandaloneFormDTO,
  TaggedFormPlacement,
} from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { getTimezone } from 'utils/lib/utils/scheduleUtils';
import { sendErrors } from './errors';

/** Fetches each canonical Questionnaire once per request; a patient's visits mostly share form versions. */
export const makeQuestionnaireLoader = (oystehr: Oystehr): ((canonical: string) => Promise<Questionnaire>) => {
  const cache = new Map<string, Promise<Questionnaire>>();
  return (canonical) => {
    if (!cache.has(canonical)) {
      const [url, version] = canonical.split('|');
      if (!url || !version)
        return Promise.reject(new Error(`Questionnaire canonical is not well defined: ${canonical}`));
      cache.set(canonical, getCanonicalQuestionnaire({ url, version }, oystehr));
    }
    return cache.get(canonical)!;
  };
};

/** Forms staff sent or filled out on their own, one per response. */
export const getStandaloneForms = async (
  questionnaireResponses: QuestionnaireResponse[],
  loadQuestionnaire: (canonical: string) => Promise<Questionnaire>
): Promise<StandaloneFormDTO[]> => {
  const results = await Promise.allSettled(
    questionnaireResponses
      .filter((qr) => qrSentManually(qr) && qr.status !== 'entered-in-error')
      .map(async (qr) => makeStandaloneFormDTO(await loadQuestionnaire(qr.questionnaire ?? ''), qr))
  );
  results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').forEach((r) => console.error(r.reason));
  return results
    .filter((r): r is PromiseFulfilledResult<StandaloneFormDTO> => r.status === 'fulfilled')
    .map((r) => r.value);
};

/**
 * Builds one StandaloneFormDTO per form bundled in the visit's paperwork so those responses render in the Custom Paperwork area alongside standalone forms.
 */
export const getIntakePaperworkFlowForms = async (
  qr: QuestionnaireResponse,
  loadQuestionnaire: (canonical: string) => Promise<Questionnaire>,
  secrets: Secrets | null
): Promise<StandaloneFormDTO[] | undefined> => {
  let questionnaire: Questionnaire | undefined;

  // this really shouldn't happen, but if it does it should not kill get-visit-details
  try {
    questionnaire = await loadQuestionnaire(qr.questionnaire ?? '');
  } catch (e) {
    console.log(`Error getting Questionnaire for QuestionnaireResponse/${qr.id}`, e);
    const errorMessage = `Error getting Questionnaire for QuestionnaireResponse/${qr.id}`;
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
    // no need to error and fail the call but this would be odd so alerting
    await sendErrors(errorMessage, ENVIRONMENT);
  }

  if (!questionnaire || !questionnaire.derivedFrom) return;

  const results = await Promise.allSettled(questionnaire.derivedFrom.map((canonical) => loadQuestionnaire(canonical)));

  results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').forEach((r) => console.error(r.reason));

  const forms = results
    .filter((r): r is PromiseFulfilledResult<Questionnaire> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((form) => isPracticeManagedQ(form))
    .map((form) => makeStandaloneFormDTO(form, qr));

  return forms.length > 0 ? forms : undefined;
};

/** One visit's answered practice-form responses, standalone and paperwork-flow, for the visit note. */
export const getEncounterFormResponses = async (
  oystehr: Oystehr,
  encounterId: string,
  intakeQr: QuestionnaireResponse | undefined,
  secrets: Secrets | null
): Promise<StandaloneFormDTO[]> => {
  const questionnaireResponses = await getAllFhirSearchPages<QuestionnaireResponse>(
    {
      resourceType: 'QuestionnaireResponse',
      params: [{ name: 'encounter', value: `Encounter/${encounterId}` }],
    },
    oystehr
  );
  const loadQuestionnaire = makeQuestionnaireLoader(oystehr);
  const ownIntakeQr = intakeQr?.encounter?.reference === `Encounter/${encounterId}` ? intakeQr : undefined;
  const [standalone, flowForms] = await Promise.all([
    getStandaloneForms(questionnaireResponses, loadQuestionnaire),
    ownIntakeQr ? getIntakePaperworkFlowForms(ownIntakeQr, loadQuestionnaire, secrets) : undefined,
  ]);
  return [...standalone, ...(flowForms ?? [])].filter(hasAnyAnswer);
};

/**
 * Every response, across all of the patient's visits, to forms whose answers appear in one of `placements`.
 * Three searches regardless of history length: the forms with those placements (all versions), the paperwork
 * flows that contain them, then this patient's responses to exactly those forms and flows.
 */
export const getPatientFormResponses = async (input: {
  patientId: string;
  placements: TaggedFormPlacement[];
  oystehr: Oystehr;
}): Promise<PatientFormResponse[]> => {
  const { patientId, placements, oystehr } = input;
  const [forms, flows] = await Promise.all([
    getAllFhirSearchPages<Questionnaire>(
      {
        resourceType: 'Questionnaire',
        params: [{ name: '_tag', value: placements.map((p) => `${FORM_PLACEMENT_TAG_SYSTEM}|${p}`).join(',') }],
      },
      oystehr
    ),
    getAllFhirSearchPages<Questionnaire>(
      {
        resourceType: 'Questionnaire',
        params: [
          { name: '_tag', value: `${PAPERWORK_FLOW_TAG.system}|${PAPERWORK_FLOW_TAG.code}` },
          { name: '_elements', value: 'url,version,derivedFrom' },
        ],
      },
      oystehr
    ),
  ]);
  const formsByCanonical = new Map(forms.map((form) => [`${form.url}|${form.version}`, form]));
  const flowForms = new Map(
    flows.map((flow) => [
      `${flow.url}|${flow.version}`,
      (flow.derivedFrom ?? []).flatMap((canonical) => formsByCanonical.get(canonical) ?? []),
    ])
  );
  const relevantFlows = [...flowForms].filter(([, contained]) => contained.length > 0).map(([canonical]) => canonical);
  const canonicals = [...formsByCanonical.keys(), ...relevantFlows];
  if (canonicals.length === 0) return [];

  const resources = await getAllFhirSearchPages<QuestionnaireResponse | Encounter | Appointment | Location>(
    {
      resourceType: 'QuestionnaireResponse',
      params: [
        { name: 'subject', value: `Patient/${patientId}` },
        { name: 'questionnaire', value: canonicals.join(',') },
        { name: '_include', value: 'QuestionnaireResponse:encounter' },
        { name: '_include:iterate', value: 'Encounter:appointment' },
        { name: '_include:iterate', value: 'Appointment:location' },
      ],
    },
    oystehr
  );
  const byReference = new Map(resources.map((r) => [`${r.resourceType}/${r.id}`, r]));
  const find = <T extends Encounter | Appointment | Location>(
    type: T['resourceType'],
    reference: string | undefined
  ): T | undefined => {
    const resource = reference ? byReference.get(reference) : undefined;
    return resource?.resourceType === type ? (resource as T) : undefined;
  };

  return resources
    .filter((r): r is QuestionnaireResponse => r.resourceType === 'QuestionnaireResponse')
    .filter((qr) => qr.status !== 'entered-in-error' && qr.encounter?.reference)
    .flatMap((qr): PatientFormResponse[] => {
      const encounter = find<Encounter>('Encounter', qr.encounter?.reference);
      if (!encounter) return [];
      const appointment = find<Appointment>('Appointment', encounter.appointment?.[0]?.reference);
      const location = appointment?.participant
        ?.map((p) => find<Location>('Location', p.actor?.reference))
        .find((l) => l !== undefined);
      const visit = {
        encounterId: encounter.id!,
        appointmentId: appointment?.id,
        // A follow-up note shares its visit's appointment, so it is dated by its own encounter.
        visitDate:
          (encounter.partOf ? encounter.period?.start : undefined) ?? appointment?.start ?? encounter.period?.start,
        visitTimezone: location ? getTimezone(location) : undefined,
      };
      const sentForm = qrSentManually(qr) ? formsByCanonical.get(qr.questionnaire ?? '') : undefined;
      if (sentForm) return [{ ...makeStandaloneFormDTO(sentForm, qr), ...visit, deletable: true }];
      // Answered inside the visit's paperwork: one entry per relevant form in the flow, deleted only with it.
      return (flowForms.get(qr.questionnaire ?? '') ?? []).map((form) => ({
        ...makeStandaloneFormDTO(form, qr),
        ...visit,
        deletable: false,
      }));
    });
};
