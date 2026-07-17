import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Encounter, List, Location, Patient, Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { StandardFonts } from 'pdf-lib';
import {
  BUCKET_NAMES,
  createFilesDocumentReferences,
  EXPORTED_QUESTIONNAIRE_CODE,
  formatQuestionnaireItemValueToString,
  getFullestAvailableName,
  getQuestionnaireForQR,
  getSecret,
  MANAGED_QUESTIONNAIRE_ERROR,
  MANUAL_TASK,
  Secrets,
  SecretsKeys,
  slugify,
} from 'utils';
import { createPresignedUrl, sendErrors, uploadObjectToZ3 } from '../../../shared';
import { PDF_CLIENT_STYLES } from '../../../shared/pdf/pdf-consts';
import { createPdfClient } from '../../../shared/pdf/pdf-utils';
import { TextStyle } from '../../../shared/pdf/types';
import { makeZ3Url } from '../../../shared/presigned-file-urls';
import { createTask } from '../../../shared/tasks';

type HandleReviewTaskAndPdfInput = {
  questionnaireResponse: QuestionnaireResponse;
  oystehr: Oystehr;
  secrets: Secrets | null;
  oystehrToken: string;
};

export const handleReviewTaskAndPdf = async (input: HandleReviewTaskAndPdfInput): Promise<void> => {
  const { questionnaireResponse, oystehr, secrets, oystehrToken } = input;

  try {
    console.log(
      `grabbing additional resources for handleReviewTaskAndPdf related to QuestionnaireResponse/${questionnaireResponse.id}`
    );
    const {
      questionnaire,
      patient,
      patientId,
      encounterId,
      listResources,
      location: locationForTask,
    } = await getResources(questionnaireResponse, oystehr);
    const NOW = DateTime.now();

    console.log('configuring z3 upload');
    const qrEncounterRef = questionnaireResponse.encounter;
    const pdfBytes = await renderQrPdf(questionnaireResponse, questionnaire, patient, NOW);

    // 1.1 Upload to Z3 (Paperwork bucket)
    const title = questionnaire?.title || questionnaire?.name || 'Form';
    const fileName = `${slugify(title)}-${questionnaireResponse.id}`;
    const baseFileUrl = makeZ3Url({
      secrets,
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
        ...(qrEncounterRef?.reference ? [{ name: 'encounter', value: qrEncounterRef.reference }] : []),
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
      category: MANUAL_TASK.category.patientFollowUp,
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
};

type ResourceConfig = {
  questionnaire: Questionnaire;
  patient: Patient;
  patientId: string;
  encounterId: string;
  listResources: List[];
  location: Location | undefined;
};
const getResources = async (
  questionnaireResponse: QuestionnaireResponse,
  oystehr: Oystehr
): Promise<ResourceConfig> => {
  const encounterId = questionnaireResponse.encounter?.reference?.replace('Encounter/', '');
  const patientId = questionnaireResponse.subject?.reference?.startsWith('Patient/')
    ? questionnaireResponse.subject.reference.replace('Patient/', '')
    : undefined;

  if (!patientId || !encounterId) {
    throw MANAGED_QUESTIONNAIRE_ERROR(
      `Could not parse patientId and/or encounterId from QuestionnaireResponse/${questionnaireResponse.id}`
    );
  }

  const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId });
  const locationId = encounter.location?.[0]?.location?.reference?.replace('Location/', '');
  console.log(`location id parsed from Encounter/${encounter.id}: ${locationId}`);

  const [listResourcesBundle, patient, location, questionnaire] = await Promise.all([
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
    await getQuestionnaireForQR(questionnaireResponse, oystehr),
  ]);
  const listResources = listResourcesBundle.unbundle();

  return { questionnaire, patient, patientId, encounterId, listResources, location };
};

export async function renderQrPdf(
  qr: QuestionnaireResponse,
  questionnaire: Questionnaire | undefined,
  patient: Patient,
  NOW: DateTime
): Promise<Uint8Array> {
  const pdfClient = await createPdfClient(PDF_CLIENT_STYLES);
  const regular = await pdfClient.embedStandardFont(StandardFonts.Helvetica);
  const bold = await pdfClient.embedStandardFont(StandardFonts.HelveticaBold);

  const baseTextStyle: TextStyle = { font: regular, fontSize: 10, spacing: 6, newLineAfter: true };

  const textStyles: Record<string, TextStyle> = {
    title: { ...baseTextStyle, font: bold, fontSize: 16 },
    meta: { ...baseTextStyle, spacing: 2 },
    sectionTitle: { ...baseTextStyle, font: bold, fontSize: 12 },
    label: { ...baseTextStyle, spacing: 2 },
    value: { ...baseTextStyle, font: bold, spacing: 8 },
  };

  // Helvetica can only encode WinAnsi; swap out Unicode characters we emit
  // from calculated expressions (≥, em-dash) for Latin-1 equivalents.
  const draw = (text: string, style: TextStyle): void => {
    pdfClient.drawText(sanitizeForWinAnsi(text), style);
  };
  const drawIndented = (text: string, style: TextStyle, indent: number): void => {
    const leftBound = pdfClient.getLeftBound();
    pdfClient.setLeftBound(leftBound + indent);
    draw(text, style);
    pdfClient.setLeftBound(leftBound);
  };

  const title = questionnaire?.title || questionnaire?.name || 'Form';
  draw(title, textStyles.title);
  const name = (patient.name?.[0]?.given?.join(' ') || '') + ' ' + (patient.name?.[0]?.family || '');
  draw(`Patient: ${name.trim()}${patient.birthDate ? ` (DOB ${patient.birthDate})` : ''}`, textStyles.meta);
  draw(`Completed: ${NOW.toFormat('yyyy-MM-dd HH:mm')}`, textStyles.meta);
  pdfClient.newLine(10);

  // Build a flat list of Q items (for hidden-check) and a map by linkId
  const allQItems: any[] = [];
  const walkQ = (items: any[]): void => {
    for (const it of items || []) {
      allQItems.push(it);
      if (it.item) walkQ(it.item);
    }
  };
  walkQ(questionnaire?.item || []);
  const qItemByLinkId = new Map(allQItems.map((it) => [it.linkId, it]));
  const isHidden = (item: any): boolean =>
    !!item?.extension?.some(
      (e: any) => e.url === 'http://hl7.org/fhir/StructureDefinition/questionnaire-hidden' && e.valueBoolean === true
    );

  // Render each page group
  const pageGroups = (qr.item || []).filter((p) => p.linkId !== 'results');
  for (const p of pageGroups) {
    const qp = qItemByLinkId.get(p.linkId);
    const pageTitle = qp?.text || p.linkId;
    draw(pageTitle, textStyles.sectionTitle);
    for (const child of p.item || []) {
      const qItem = qItemByLinkId.get(child.linkId);
      if (isHidden(qItem)) continue;
      const label = qItem?.text || child.linkId;
      const value = formatQuestionnaireItemValueToString(child);
      drawIndented(label, textStyles.label, 10);
      drawIndented(value, textStyles.value, 10);
    }
    pdfClient.newLine(10);
  }

  return pdfClient.save();
}

function sanitizeForWinAnsi(text: string): string {
  return String(text || '')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u2260/g, '!=')
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, '?');
}
