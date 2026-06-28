import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, FhirResource, Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import {
  GetAllManagedPaperworkOutput,
  GetManagedPaperworkForQuestionnaireOutput,
  // APPOINTMENT_PAPERWORK_FLOW_EXTENSION_URL,
  // composeFormIds,
  // fhirQuestionnaireItemToManaged,
  // fhirQuestionnaireToManaged,
  // getAllFhirSearchPages,
  ManagedPaperworkDTO,
  // IN_PERSON_INTAKE_PAPERWORK_URL,
  // isNonPaperworkQuestionnaireResponse,
  // ManagedQuestionnaireItem,
  // INVALID_INPUT_ERROR,
  // MISSING_REQUEST_BODY,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  // PAPERWORK_FLOW_TAG,
  PRACTICE_MANAGED_QR_TAG,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
  // RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR,
  // toPaperworkFlowRecord,
} from 'utils';
import {
  // checkOrCreateM2MClientToken,
  createOystehrClient,
  getAuth0Token,
  getUser,
  userHasAccessToPatient,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

// /**
//  * Determines the linkId of the last "data collection" page in the intake questionnaire.
//  * Practice-managed forms should be inserted after this page.
//  *
//  * Finalization pages are identified by their content:
//  * - Pages containing signature fields (linkId includes 'signature' or 'full-name' as direct children of consent groups)
//  * - Pages containing consent checkboxes (linkId includes 'consent')
//  * - Pages with the medical-history chatbot (linkId includes 'medical-history' with a boolean-type child)
//  *
//  * The last page before the first finalization page is the insertion point.
//  */
// function findInsertionPoint(items: QuestionnaireItem[]): string | undefined {
//   const isFinalizationPage = (page: QuestionnaireItem): boolean => {
//     const linkId = (page.linkId || '').toLowerCase();
//     // Consent/signature pages
//     if (linkId.includes('consent')) return true;
//     // Medical history chatbot page (typically has a single boolean item)
//     if (linkId.includes('medical-history')) return true;
//     // Check children for signature-type fields
//     const hasSignature = page.item?.some((child) => {
//       const childLinkId = (child.linkId || '').toLowerCase();
//       return childLinkId.includes('signature') || childLinkId === 'full-name';
//     });
//     if (hasSignature) return true;
//     return false;
//   };

//   // Walk pages in order; return the linkId of the page just before the first finalization page
//   const pages = items.filter((item) => item.type === 'group');
//   for (let i = 0; i < pages.length; i++) {
//     if (isFinalizationPage(pages[i])) {
//       // Return the previous page's linkId, or undefined if finalization is the first page
//       return i > 0 ? pages[i - 1].linkId : undefined;
//     }
//   }
//   // No finalization pages found — insert after the last page
//   return pages.length > 0 ? pages[pages.length - 1].linkId : undefined;
// }

// /**
//  * If the encounter was booked with a practice paperwork flow (OTR-2309), return the flow's ordered
//  * form Questionnaire ids; otherwise undefined (so the caller falls back to per-canonical association).
//  * The flow id is stamped on the booked Encounter at create-appointment time.
//  */
// async function resolveFlowFormIds(oystehr: Oystehr, encounterId: string): Promise<string[] | undefined> {
//   // Lookup failures fall back to no-service-flow rather than breaking paperwork, but a
//   // transient error here silently drops the flow's forms — log so the signal isn't lost.
//   const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId }).catch((err) => {
//     console.warn(`resolveFlowFormIds: failed to fetch Encounter/${encounterId}:`, err);
//     return null;
//   });
//   const flowId = (encounter?.extension ?? []).find((e) => e.url === APPOINTMENT_PAPERWORK_FLOW_EXTENSION_URL)
//     ?.valueString;
//   if (!flowId) return undefined;
//   const flowList = await oystehr.fhir.get<List>({ resourceType: 'List', id: flowId }).catch((err) => {
//     console.warn(`resolveFlowFormIds: failed to fetch flow List/${flowId}:`, err);
//     return null;
//   });
//   const record = flowList ? toPaperworkFlowRecord(flowList) : null;
//   return record?.formIds;
// }

// /**
//  * The base intake's attached form ids (OTR-2309 v2): the base flow bound to `intakeUrl` (the
//  * booking's resolved base canonical). These compose onto every booking on that base intake,
//  * regardless of service flow. Returns [] when no base flow / no forms.
//  */
// async function resolveBaseFlowForms(oystehr: Oystehr, intakeUrl: string): Promise<string[]> {
//   const lists = await getAllFhirSearchPages<List>(
//     {
//       resourceType: 'List',
//       params: [{ name: '_tag', value: PAPERWORK_FLOW_TAG.code }],
//     },
//     oystehr
//   );
//   for (const list of lists) {
//     const record = toPaperworkFlowRecord(list);
//     if (record?.canonical === intakeUrl) return record.formIds;
//   }
//   return [];
// }

let oystehrToken: string;
const ZAMBDA_NAME = 'get-managed-paperwork';

const EMPTY_RESPONSE: ManagedPaperworkDTO = {
  questionnaireTitle: '',
  questionnaireId: '',
  questionnaireItems: [],
  questionnaireResponse: undefined,
};

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);

  const validatedParameters = validateRequestParameters(input);

  const { appointmentId, questionnaireId, secrets } = validatedParameters;

  console.log('validateRequestParameters success');

  if (!oystehrToken) {
    oystehrToken = await getAuth0Token(secrets);
  }

  const oystehr = createOystehrClient(oystehrToken, secrets);

  const { patientId, questionnaireResponses } = await getResources(oystehr, appointmentId);

  // Authorization: the caller must be connected to the patient (or be an EHR user —
  // userHasAccessToPatient allows those implicitly). Without this, any authenticated
  // account could read another patient's forms AND their QuestionnaireResponse answers
  // by guessing/replaying an appointment id.
  const callerToken = input.headers?.Authorization?.replace('Bearer ', '');
  const caller = callerToken ? await getUser(callerToken, input.secrets).catch(() => undefined) : undefined;
  const hasAccess = caller ? await userHasAccessToPatient(caller, patientId, oystehr) : false;
  console.log('hasAccess', hasAccess);
  if (!hasAccess) {
    throw NO_READ_ACCESS_TO_PATIENT_ERROR;
  }

  // Standalone form by direct id. (/forms/:appointmentId/:questionnaireId)
  if (questionnaireId) {
    console.log(`getting managed paperwork for specific form: Questionnaire/${questionnaireId}`);
    const questionnaire = await oystehr.fhir.get<Questionnaire>({ resourceType: 'Questionnaire', id: questionnaireId });
    const isManaged = hasTag(questionnaire, PRACTICE_MANAGED_QUESTIONNAIRE_TAG);
    if (!isManaged) {
      // this would be a weird edge case where we got an id for a non managed questionnaire response
      // front end will display "not found"
      console.log(`questionnaire is not managed, Questionnaire/${questionnaire.id}`);
      return { statusCode: 200, body: JSON.stringify(EMPTY_RESPONSE) };
    }

    const relatedQR = questionnaireResponses.find((qr) => qr.questionnaire === questionnaire.url);
    console.log(`related questionnaire response: ${relatedQR ? `QuestionnaireResponse/${relatedQR.id}` : 'none'}`);

    const managedPaperwork = makeManagedPaperworkDTO(questionnaire, relatedQR);
    const response: GetManagedPaperworkForQuestionnaireOutput = { managedPaperwork };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  }

  // if no specific questionnaireId is passed as a param all managed paperwork for the appointment / encounter will be returned
  console.log(`getting all managed paperwork for Appointment/${appointmentId}`);

  if (questionnaireResponses.length === 0) {
    console.log('no custom paperwork has been completed for this visit');
    return { statusCode: 200, body: JSON.stringify(EMPTY_RESPONSE) };
  } else {
    console.log(`fetching questionnaires for ${questionnaireResponses.map((qr) => `QuestionnaireResponse/${qr.id}`)}`);
    // need to fetch the questionnaires for each response
    const promises = questionnaireResponses.map(async (qr) => {
      const questionnaires = (
        await oystehr.fhir.search<Questionnaire>({
          resourceType: 'Questionnaire',
          params: [{ name: 'url', value: qr.questionnaire ?? '' }],
        })
      ).unbundle();
      // todo sarah fix 0 thing
      const managedPaperwork = makeManagedPaperworkDTO(questionnaires[0], qr);
      return managedPaperwork;
    });

    const managedPaperwork = (await Promise.all(promises)).filter(hasQuestionnaireResponse);
    const response: GetAllManagedPaperworkOutput = { managedPaperwork };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  }

  // // Fetch the intake questionnaire to determine the insertion point
  // const intakeQuestionnaires = (
  //   await oystehr.fhir.search<Questionnaire>({
  //     resourceType: 'Questionnaire',
  //     params: [
  //       { name: 'url', value: intakeUrl },
  //       { name: '_sort', value: '-_lastUpdated' },
  //       { name: '_count', value: '1' },
  //     ],
  //   })
  // ).unbundle();
  // const intakeQuestionnaire = intakeQuestionnaires[0];
  // const insertAfterPageLinkId = intakeQuestionnaire ? findInsertionPoint(intakeQuestionnaire.item || []) : undefined;

  // // Find practice-managed questionnaires. Include retired so that existing QRs
  // // tied to soft-deleted questionnaires can still be matched and rendered in
  // // the EHR, but filter to active for any flow that surfaces a new form.
  // const allPracticeManaged = await getAllFhirSearchPages<Questionnaire>(
  //   {
  //     resourceType: 'Questionnaire',
  //     params: [{ name: '_tag', value: PRACTICE_MANAGED_QUESTIONNAIRE_TAG.code }],
  //   },
  //   oystehr
  // );
  // const activePracticeManaged = allPracticeManaged.filter((q) => q.status === 'active');

  // // Compose the forms this booking shows (OTR-2309 v2):
  // //   base intake forms (the base flow bound to the resolved canonical, on every such booking)
  // //   + service flow forms (the flow stamped on the encounter, if any),
  // // base-first, de-duped keep-first. A standalone direct-id request bypasses composition.
  // let associated: Questionnaire[];
  // if (questionnaireId) {
  //   // Standalone form lookups must not serve retired forms to patients.
  //   associated = activePracticeManaged.filter((q) => q.id === questionnaireId); // todo sarah what the heck is happening here?
  // } else {
  //   const baseFormIds = await resolveBaseFlowForms(oystehr, intakeUrl);
  //   const serviceFormIds = (encounterId ? await resolveFlowFormIds(oystehr, encounterId) : undefined) ?? [];
  //   const byId = new Map(activePracticeManaged.map((q) => [q.id, q]));
  //   associated = composeFormIds(baseFormIds, serviceFormIds)
  //     .map((id) => byId.get(id))
  //     .filter((q): q is Questionnaire => q !== undefined);
  // }

  // // Check for existing QRs on this encounter
  // const existingQrs = encounterId
  //   ? (
  //       await oystehr.fhir.search<QuestionnaireResponse>({
  //         resourceType: 'QuestionnaireResponse',
  //         params: [{ name: 'encounter', value: `Encounter/${encounterId}` }],
  //       })
  //     ).unbundle()
  //   : [];

  // // Also include any practice-managed questionnaires that have existing QRs on this
  // // encounter but aren't in the associated set (e.g. standalone forms sent to patient)
  // const associatedIds = new Set(associated.map((q) => q.id));
  // const withExistingQrs = allPracticeManaged.filter((q) => {
  //   if (associatedIds.has(q.id!)) return false;
  //   return existingQrs.some((qr) => qr.questionnaire?.split('|')[0] === q.url);
  // });
  // const allRelevant = [...associated, ...withExistingQrs];

  // const questionnaires = allRelevant.map((q) => {
  //   const matchingQr = existingQrs.find((qr) => qr.questionnaire?.split('|')[0] === q.url);
  //   return {
  //     id: q.id,
  //     url: q.url,
  //     version: q.version,
  //     title: q.title || q.name || 'Untitled',
  //     status: q.status,
  //     questionnaireResponseId: matchingQr?.id,
  //     questionnaireResponseStatus: matchingQr?.status,
  //     questionnaireResponseItems: matchingQr?.item,
  //     item: q.item,
  //   };
  // });

  // return {
  //   statusCode: 200,
  //   body: JSON.stringify({ questionnaires, encounterId, patientId, insertAfterPageLinkId }),
  // };
});

type ResourceConfig = {
  encounter: Encounter;
  encounterId: string;
  patientId: string;
  questionnaireResponses: QuestionnaireResponse[];
};

const getResources = async (oystehr: Oystehr, appointmentId: string): Promise<ResourceConfig> => {
  console.log(`getting resources for Appointment/${appointmentId}`);

  const resources = (
    await oystehr.fhir.search<Encounter | QuestionnaireResponse>({
      resourceType: 'Encounter',
      params: [
        { name: 'appointment', value: appointmentId },
        { name: '_revinclude', value: 'QuestionnaireResponse:encounter' },
      ],
    })
  ).unbundle();

  const { encounters, questionnaireResponses } = resources.reduce(
    (acc: { encounters: Encounter[]; questionnaireResponses: QuestionnaireResponse[] }, resource) => {
      if (resource.resourceType === 'Encounter') acc.encounters.push(resource);
      if (resource.resourceType === 'QuestionnaireResponse') {
        if (hasTag(resource, PRACTICE_MANAGED_QR_TAG)) acc.questionnaireResponses.push(resource);
      }

      return acc;
    },
    { encounters: [], questionnaireResponses: [] }
  );

  // todo sarah maybe don't throw error? need to comply with requirement to not disrupt booking flow
  if (encounters.length !== 1) {
    throw new Error(`unexpected number of encounters returned for Appointment/${appointmentId}: ${encounters.length}`);
  }

  const encounter = encounters[0];
  const encounterId = encounter?.id || '';
  const patientId = encounter?.subject?.reference?.replace('Patient/', '') || '';

  if (!patientId || !encounterId) {
    throw new Error(
      `patientId and/or encounterId could not be resolved for for Appointment/${appointmentId}: ${patientId} ${encounterId}`
    );
  }

  return { encounter, encounterId, patientId, questionnaireResponses };
};

function makeManagedPaperworkDTO(
  questionnaire: Questionnaire,
  questionnaireResponse: QuestionnaireResponse | undefined
): ManagedPaperworkDTO {
  return {
    questionnaireTitle: questionnaire.title ?? '',
    questionnaireId: questionnaire.id ?? '',
    questionnaireItems: questionnaire.item ?? [],
    questionnaireResponse: questionnaireResponse,
  };
}

function hasQuestionnaireResponse(
  dto: ManagedPaperworkDTO
): dto is ManagedPaperworkDTO & { questionnaireResponse: QuestionnaireResponse } {
  return dto.questionnaireResponse !== undefined;
}

function hasTag(resource: FhirResource, tag: { system: string; code: string }): boolean {
  const { system, code } = tag;
  return Boolean(resource.meta?.tag?.some((t) => t.code === code && t.system === system));
}
