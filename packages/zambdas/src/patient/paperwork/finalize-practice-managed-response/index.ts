import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Encounter, List, Location, Patient, Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { PageSizes, PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';
import {
  BUCKET_NAMES,
  createFilesDocumentReferences,
  EXPORTED_QUESTIONNAIRE_CODE,
  getFullName,
  MANUAL_TASK,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  OTTEHR_MODULE,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  createPresignedUrl,
  getAuth0Token,
  uploadObjectToZ3,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { makeZ3Url } from '../../../shared/presigned-file-urls';
import { createTask } from '../../../shared/tasks';

const ZAMBDA_NAME = 'finalize-practice-managed-response';

let oystehrToken: string;
let m2mToken: string;

const PAGE_WIDTH = PageSizes.A4[0];
const PAGE_HEIGHT = PageSizes.A4[1];
const MARGIN = 48;
const LINE_HEIGHT = 14;
const BOTTOM_MARGIN = 60;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw new Error('No secrets provided');
  const { questionnaireResponseId } = JSON.parse(input.body) as { questionnaireResponseId: string };
  if (!questionnaireResponseId) throw MISSING_REQUIRED_PARAMETERS(['questionnaireResponseId']);

  if (!oystehrToken) oystehrToken = await getAuth0Token(input.secrets);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createOystehrClient(oystehrToken, input.secrets);

  // 1. Load QR + Questionnaire + Patient + List folders in one search
  const qr = await oystehr.fhir.get<QuestionnaireResponse>({
    resourceType: 'QuestionnaireResponse',
    id: questionnaireResponseId,
  });
  const patientId = qr.subject?.reference?.replace('Patient/', '') || '';
  if (!patientId) throw new Error('QR has no patient subject');

  const canonicalUrl = qr.questionnaire?.split('|')[0];
  if (!canonicalUrl) throw new Error('QR has no questionnaire canonical URL');
  const qBundle = (
    await oystehr.fhir.search<Questionnaire>({
      resourceType: 'Questionnaire',
      params: [
        { name: 'url', value: canonicalUrl },
        { name: '_sort', value: '-_lastUpdated' },
        { name: '_count', value: '1' },
      ],
    })
  ).unbundle();
  const questionnaire = qBundle[0];

  const patient = await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId });

  const listResources = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [
        { name: 'subject', value: `Patient/${patientId}` },
        { name: 'code', value: 'patient-docs-folder' },
      ],
    })
  ).unbundle();

  // 2. Generate PDF bytes
  const pdfBytes = await renderQrPdf(qr, questionnaire, patient);

  // 3. Upload to Z3 (Paperwork bucket)
  const timestamp = DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
  const title = questionnaire?.title || questionnaire?.name || 'Form';
  const fileName = `${slugify(title)}-${qr.id}-${timestamp}.pdf`;
  const baseFileUrl = makeZ3Url({
    secrets: input.secrets,
    fileName,
    bucketName: BUCKET_NAMES.PAPERWORK,
    patientID: patientId,
  });
  const presignedUrl = await createPresignedUrl(m2mToken, baseFileUrl, 'upload');
  await uploadObjectToZ3(pdfBytes, presignedUrl);

  // 4. Create DocumentReference — EXPORTED_QUESTIONNAIRE_CODE auto-links it into the "Paperwork" folder
  // Title includes a completion date so multiple submissions are distinguishable in the Docs UI.
  const completionDate = DateTime.now().toFormat('yyyy-MM-dd');
  const displayTitle = `${title} — ${completionDate}.pdf`;
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
      ...(qr.encounter?.reference ? [{ name: 'encounter', value: qr.encounter.reference }] : []),
    ],
    references: {
      subject: { reference: `Patient/${patientId}` },
      ...(qr.encounter ? { context: { encounter: [qr.encounter] } } : {}),
    },
    oystehr,
    generateUUID: randomUUID,
    listResources,
    meta: { tag: [{ code: OTTEHR_MODULE.IP }, { code: OTTEHR_MODULE.TM }] },
  });

  // 5. Mark QR completed
  await oystehr.fhir.patch({
    resourceType: 'QuestionnaireResponse',
    id: qr.id || '',
    operations: [{ op: 'replace', path: '/status', value: 'completed' }],
  });

  // 6. Create a Patient Follow-up Task announcing the completed form.
  // The Task carries the DocumentReference id as an input so Go To Task can
  // navigate back to this PDF in the patient's Paperwork folder.
  try {
    const docRefId = docRefs[0]?.id;
    const patientName = getFullName(patient);
    const formTitle = questionnaire?.title || questionnaire?.name || 'Form';
    const taskEncounterId = qr.encounter?.reference?.replace('Encounter/', '');
    const locationForTask = await resolveLocationForTask(oystehr, qr, patientId);

    const task = createTask({
      category: MANUAL_TASK.category.patientFollowUp,
      title: `${patientName} completed ${formTitle}`,
      encounterId: taskEncounterId,
      location: locationForTask ? { id: locationForTask.id || '', name: locationForTask.name || '' } : undefined,
      input: [
        { type: MANUAL_TASK.input.title, valueString: `${patientName} completed ${formTitle}` },
        {
          type: MANUAL_TASK.input.patient,
          valueReference: { reference: `Patient/${patientId}`, display: patientName },
        },
        ...(taskEncounterId ? [{ type: MANUAL_TASK.input.encounterId, valueString: taskEncounterId }] : []),
        ...(docRefId ? [{ type: MANUAL_TASK.input.documentReferenceId, valueString: docRefId }] : []),
      ],
    });
    await oystehr.fhir.create(task);
  } catch (taskErr) {
    // Non-fatal by design — the form itself finalized — but a staff follow-up Task
    // silently never appearing is signal-worthy, so report it.
    console.error('Failed to create follow-up task:', taskErr);
    captureException(taskErr);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ documentReferenceId: docRefs[0]?.id, status: 'completed' }),
  };
});

// Resolve a Location for the new Task. Preference order:
//   1. If the QR has an encounter, use that encounter's location (via
//      encounter.location[0].location).
//   2. Else, find the patient's most recent Appointment and use its location
//      (via the Encounter associated with that Appointment).
async function resolveLocationForTask(
  oystehr: ReturnType<typeof createOystehrClient>,
  qr: QuestionnaireResponse,
  patientId: string
): Promise<Location | undefined> {
  const fetchLocation = async (ref: string): Promise<Location | undefined> => {
    const id = ref.replace('Location/', '');
    if (!id) return undefined;
    try {
      return await oystehr.fhir.get<Location>({ resourceType: 'Location', id });
    } catch {
      return undefined;
    }
  };

  // Path 1: QR's own encounter
  const encounterRef = qr.encounter?.reference;
  if (encounterRef) {
    try {
      const encounter = await oystehr.fhir.get<Encounter>({
        resourceType: 'Encounter',
        id: encounterRef.replace('Encounter/', ''),
      });
      const locRef = encounter.location?.[0]?.location?.reference;
      if (locRef) return await fetchLocation(locRef);
    } catch {
      // fall through to path 2
    }
  }

  // Path 2: patient's most recent Encounter with a location
  try {
    const encounters = (
      await oystehr.fhir.search<Encounter>({
        resourceType: 'Encounter',
        params: [
          { name: 'subject', value: `Patient/${patientId}` },
          { name: '_sort', value: '-date' },
          { name: '_count', value: '10' },
        ],
      })
    ).unbundle();
    for (const enc of encounters) {
      const locRef = enc.location?.[0]?.location?.reference;
      if (locRef) return await fetchLocation(locRef);
    }
  } catch {
    // no location found
  }
  return undefined;
}

function slugify(s: string): string {
  return (s || 'form')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

async function renderQrPdf(
  qr: QuestionnaireResponse,
  questionnaire: Questionnaire | undefined,
  patient: Patient
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = (): void => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };
  const ensureSpace = (needed: number): void => {
    if (y - needed < BOTTOM_MARGIN) newPage();
  };
  const drawLine = (text: string, opts: { font?: PDFFont; size?: number; indent?: number } = {}): void => {
    const font = opts.font || regular;
    const size = opts.size || 10;
    const indent = opts.indent || 0;
    // Helvetica can only encode WinAnsi; swap out Unicode characters we emit
    // from calculated expressions (≥, em-dash) for Latin-1 equivalents.
    const safe = sanitizeForWinAnsi(text);
    const lines = wrapText(safe, font, size, PAGE_WIDTH - MARGIN * 2 - indent);
    for (const line of lines) {
      ensureSpace(size + 2);
      page.drawText(line, { x: MARGIN + indent, y, size, font });
      y -= LINE_HEIGHT;
    }
  };

  const title = questionnaire?.title || questionnaire?.name || 'Form';
  drawLine(title, { font: bold, size: 16 });
  y -= 4;
  const name = (patient.name?.[0]?.given?.join(' ') || '') + ' ' + (patient.name?.[0]?.family || '');
  drawLine(`Patient: ${name.trim()}${patient.birthDate ? ` (DOB ${patient.birthDate})` : ''}`, {
    font: regular,
    size: 10,
  });
  drawLine(`Completed: ${DateTime.now().toFormat('yyyy-MM-dd HH:mm')}`, { font: regular, size: 10 });
  y -= 10;

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
    ensureSpace(20);
    drawLine(pageTitle, { font: bold, size: 12 });
    y -= 2;
    for (const child of p.item || []) {
      const qItem = qItemByLinkId.get(child.linkId);
      if (isHidden(qItem)) continue;
      const label = qItem?.text || child.linkId;
      const value = formatAnswer(child);
      drawLine(label, { font: regular, size: 10, indent: 10 });
      drawLine(`  ${value}`, { font: bold, size: 10, indent: 10 });
      y -= 4;
    }
    y -= 6;
  }

  // Render "Screening Results" if present
  const results = (qr.item || []).find((p) => p.linkId === 'results');
  if (results?.item?.length) {
    ensureSpace(20);
    drawLine('Screening Results', { font: bold, size: 12 });
    y -= 2;
    // Pair each computed item with its rationale (same convention as the viewer)
    const resultMap = new Map((results.item || []).map((i) => [i.linkId, i]));
    const rendered = new Set<string>();
    for (const item of results.item) {
      if (rendered.has(item.linkId)) continue;
      if (item.linkId.endsWith('-rationale')) continue;
      rendered.add(item.linkId);
      const q = qItemByLinkId.get(item.linkId);
      const label = q?.text || item.linkId;
      const value = formatAnswer(item);
      drawLine(`${label}: ${value}`, { font: regular, size: 10, indent: 10 });
      const rationale = resultMap.get(`${item.linkId}-rationale`);
      if (rationale) {
        rendered.add(rationale.linkId);
        const r = rationale.answer?.[0]?.valueString;
        if (r) drawLine(r, { font: regular, size: 9, indent: 20 });
      }
    }
  }

  return pdf.save();
}

function formatAnswer(item: any): string {
  const a = item.answer?.[0];
  if (!a) return '';
  if (a.valueCoding?.display) return a.valueCoding.display;
  if (a.valueString !== undefined) return a.valueString;
  if (a.valueBoolean !== undefined) return a.valueBoolean ? 'Positive' : 'Negative';
  if (a.valueInteger !== undefined) return String(a.valueInteger);
  if (a.valueDecimal !== undefined) return String(a.valueDecimal);
  if (a.valueDate) return a.valueDate;
  if (a.valueDateTime) return a.valueDateTime;
  return '';
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

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = String(text || '').split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}
