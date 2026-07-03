import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Encounter, List, Location, Patient, Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BUCKET_NAMES,
  createFilesDocumentReferences,
  EXPORTED_QUESTIONNAIRE_CODE,
  getFullestAvailableName,
  getSecret,
  MANUAL_TASK,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  PRACTICE_MANAGED_QR_TAG,
  SavePracticeManagedPaperworkResponseOutput,
  SecretsKeys,
  slugify,
} from 'utils';
import {
  createOystehrClient,
  createPresignedUrl,
  getAuth0Token,
  getUser,
  sendErrors,
  uploadObjectToZ3,
  userHasAccessToPatient,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { makeZ3Url } from '../../../shared/presigned-file-urls';
import { createTask } from '../../../shared/tasks';
import { renderQrPdf } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let oystehrToken: string;
const ZAMBDA_NAME = 'save-practice-managed-paperwork-response';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);

  const validatedParameters = validateRequestParameters(input);

  const { pageAnswers, questionnaireId, complete, appointmentId, secrets } = validatedParameters;

  console.log('validateRequestParameters success');

  if (!oystehrToken) {
    oystehrToken = await getAuth0Token(secrets);
  }

  const oystehr = createOystehrClient(oystehrToken, secrets);

  const NOW = DateTime.now();

  const {
    patientId,
    questionnaire,
    canonicalQuestionnaireUrl,
    encounter,
    encounterId,
    questionnaireResponse: existing,
  } = await getResources(oystehr, appointmentId, questionnaireId);

  // Authorization: writes are gated on the caller being connected to the patient (EHR
  // users pass implicitly).
  const callerToken = input.headers?.Authorization?.replace('Bearer ', '');
  const caller = callerToken ? await getUser(callerToken, input.secrets).catch(() => undefined) : undefined;
  const hasAccess = caller ? await userHasAccessToPatient(caller, patientId, oystehr) : false;
  console.log('hasAccess', hasAccess);
  if (!hasAccess) {
    throw NO_READ_ACCESS_TO_PATIENT_ERROR;
  }

  console.log(
    `handling responses to Questionnaire with url ${canonicalQuestionnaireUrl} (Questionnaire/${questionnaire.id})`
  );

  let response: SavePracticeManagedPaperworkResponseOutput | undefined;

  if (existing) {
    console.log(`will update existing QuestionnaireResponse/${existing.id}`);
    const items = existing.item || [];

    // find the page being updated
    const pageLinkId = pageAnswers.linkId;
    const pageIndexFound = items.findIndex((item) => item.linkId === pageLinkId);
    const pageIndex = pageIndexFound >= 0 ? pageIndexFound : items.length;
    console.log(`Updating page with linkId ${pageLinkId} at index ${pageIndex}`);

    items[pageIndex] = pageAnswers;

    const updated = await oystehr.fhir.update<QuestionnaireResponse>({
      ...existing,
      item: items,
      status: complete ? 'completed' : 'in-progress',
    });

    response = {
      questionnaireResponse: updated,
    };
  } else {
    console.log(`will create a new QuestionnaireResponse for Patient/${patientId} Encounter/${encounterId}`);
    // Create new QR with practice-managed tag for identification
    const newQr: QuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      meta: { tag: [PRACTICE_MANAGED_QR_TAG] },
      questionnaire: canonicalQuestionnaireUrl,
      status: complete ? 'completed' : 'in-progress',
      subject: { reference: `Patient/${patientId}` },
      encounter: { reference: `Encounter/${encounterId}` },
      item: [pageAnswers],
    };

    const created = await oystehr.fhir.create<QuestionnaireResponse>(newQr);

    response = {
      questionnaireResponse: created,
    };
  }

  // get resources for pdf generation and task creation
  const {
    listResources,
    patient,
    location: locationForTask,
  } = await getResourcesForPdfAndTask(oystehr, patientId, encounter);

  // ================ PDF GENERATION ============================
  if (complete) {
    console.log('generating form pdf & creating review task');
    try {
      console.log('configuring z3 upload');
      const qrForPdfGeneration = response.questionnaireResponse;
      const qrEncounterRef = qrForPdfGeneration.encounter?.reference;
      const pdfBytes = await renderQrPdf(qrForPdfGeneration, questionnaire, patient, NOW);

      // 1.1 Upload to Z3 (Paperwork bucket)
      const title = questionnaire?.title || questionnaire?.name || 'Form';
      const fileName = `${slugify(title)}-${qrForPdfGeneration.id}`;
      const baseFileUrl = makeZ3Url({
        secrets: input.secrets,
        fileName,
        bucketName: BUCKET_NAMES.PAPERWORK,
        patientID: patientId,
      });
      const presignedUrl = await createPresignedUrl(oystehrToken, baseFileUrl, 'upload');
      await uploadObjectToZ3(pdfBytes, presignedUrl);
      console.log('form pdf z3 upload complete');

      // 1.2 Create DocumentReference
      const displayTitle = `${title} — ${NOW.toFormat('yyyy-MM-dd')}.pdf`;
      const { docRefs } = await createFilesDocumentReferences({
        files: [{ url: baseFileUrl, title: displayTitle }],
        type: {
          coding: [{ system: 'http://loinc.org', code: EXPORTED_QUESTIONNAIRE_CODE, display: title }],
          text: title,
        },
        dateCreated: DateTime.now().toUTC().toISO() || new Date().toISOString(),
        searchParams: [
          { name: 'subject', value: `Patient/${patientId}` },
          { name: 'type', value: EXPORTED_QUESTIONNAIRE_CODE },
          ...(qrEncounterRef ? [{ name: 'encounter', value: qrEncounterRef }] : []),
        ],
        references: {
          subject: { reference: `Patient/${patientId}` },
          ...(qrEncounterRef ? { context: { encounter: [qrEncounterRef] } } : {}),
        },
        oystehr,
        generateUUID: randomUUID,
        listResources,
      });

      console.log(
        'docRefs created:',
        docRefs.map((dr) => `DocumentReference/${dr.id}`)
      );

      // 2. Create review task
      console.log('configuring review task');
      const docRefId = docRefs[0]?.id;
      const patientName = getFullestAvailableName(patient);

      const task = createTask({
        category: MANUAL_TASK.category.patientFollowUp, // todo sarah i think this needs its own category
        title: `${patientName} completed ${title}`,
        encounterId: encounterId,
        location: locationForTask ? { id: locationForTask.id || '', name: locationForTask.name || '' } : undefined,
        input: [
          { type: MANUAL_TASK.input.title, valueString: `${patientName} completed ${title}` },
          {
            type: MANUAL_TASK.input.patient,
            valueReference: { reference: `Patient/${patientId}`, display: patientName },
          },
          { type: MANUAL_TASK.input.encounterId, valueString: encounterId },
          ...(docRefId ? [{ type: MANUAL_TASK.input.documentReferenceId, valueString: docRefId }] : []),
        ],
      });
      await oystehr.fhir.create(task);
      console.log('task created successfully');
    } catch (error: unknown) {
      // Non-fatal by design — the form itself finalized — but either pdf generation or staff follow-up Task failed to create
      // we don't want to error to the patient but we will alert sentry via sendErrors
      console.error('Failed to generate pdf or create follow-up task:', error, JSON.stringify(error));
      const errorMessage = error instanceof Error ? error.message : String(error);
      const messageToSend = `Erroring handling form finalization during create pdf / create task step: ${errorMessage}`;
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
      await sendErrors(messageToSend, ENVIRONMENT);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

type ResourceConfig = {
  patientId: string;
  questionnaire: Questionnaire;
  canonicalQuestionnaireUrl: string;
  encounter: Encounter;
  encounterId: string;
  questionnaireResponse: QuestionnaireResponse | undefined;
};

const getResources = async (
  oystehr: Oystehr,
  appointmentId: string,
  questionnaireId: string
): Promise<ResourceConfig> => {
  console.log(`getting resources for Appointment/${appointmentId}`);
  const [encountersBundle, questionnaire] = await Promise.all([
    oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [{ name: 'appointment', value: appointmentId }],
    }),
    oystehr.fhir.get<Questionnaire>({
      resourceType: 'Questionnaire',
      id: questionnaireId,
    }),
  ]);
  const encounters = encountersBundle.unbundle();

  // todo sarah maybe don't throw error? need to comply with requirement to not disrupt booking flow
  if (encounters.length !== 1) {
    throw new Error(`unexpected number of encounters returned for Appointment/${appointmentId}: ${encounters.length}`);
  }

  // get the encounter, so we can pull the patientId and verify access
  const encounter = encounters[0];
  const encounterId = encounter.id;
  const patientId = encounter.subject?.reference?.replace('Patient/', '');
  const canonicalQuestionnaireUrl = questionnaire.url;

  // todo sarah maybe don't throw error? need to comply with requirement to not disrupt booking flow
  if (!patientId || !encounterId) {
    throw new Error(`patientId could not be resolved for for Appointment/${appointmentId}`);
  }
  // todo sarah maybe don't throw error? need to comply with requirement to not disrupt booking flow
  if (!canonicalQuestionnaireUrl) {
    throw new Error(`canonicalQuestionnaireUrl could not be resolved for for Questionnaire/${questionnaireId}`);
  }

  // check if theres an existing questionnaireResponse for this encounter / questionnaire
  const questionnaireResponses = (
    await oystehr.fhir.search<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      params: [
        {
          name: 'subject',
          value: `Patient/${patientId}`,
        },
        {
          name: 'encounter',
          value: `Encounter/${encounter.id}`,
        },
        {
          name: '_tag',
          value: PRACTICE_MANAGED_QR_TAG.code,
        },
        {
          name: 'questionnaire',
          value: canonicalQuestionnaireUrl,
        },
      ],
    })
  ).unbundle();

  const questionnaireResponse = questionnaireResponses?.[0];

  return { patientId, questionnaire, canonicalQuestionnaireUrl, encounter, encounterId, questionnaireResponse };
};

type PdfAndTaskResourceConfig = {
  listResources: List[];
  patient: Patient;
  location: Location | undefined;
};

const getResourcesForPdfAndTask = async (
  oystehr: Oystehr,
  patientId: string,
  encounter: Encounter
): Promise<PdfAndTaskResourceConfig> => {
  const locationId = encounter.location?.[0]?.location?.reference?.replace('Location/', '');
  console.log(`location id parsed from Encounter/${encounter.id}: ${locationId}`);

  const [listResourcesBundle, patient, location] = await Promise.all([
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [
        { name: 'subject', value: `Patient/${patientId}` },
        { name: 'code', value: 'patient-docs-folder' },
      ],
    }),
    await oystehr.fhir.get<Patient>({
      resourceType: 'Patient',
      id: patientId,
    }),
    locationId
      ? oystehr.fhir.get<Location>({
          resourceType: 'Location',
          id: locationId,
        })
      : Promise.resolve(undefined),
  ]);
  const listResources = listResourcesBundle.unbundle();

  return { listResources, patient, location };
};
