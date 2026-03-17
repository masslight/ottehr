import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DocumentReference, Encounter, List, Task } from 'fhir/r4b';
import Handlebars from 'handlebars';
import { DateTime } from 'luxon';
import path from 'path';
import pdfmakeModule from 'pdfmake';
import {
  BUCKET_NAMES,
  createFilesDocumentReferences,
  getSecret,
  OTTEHR_MODULE,
  Secrets,
  SecretsKeys,
  STATEMENT_CODE,
} from 'utils';
import {
  assertDefined,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  createPresignedUrl,
  getAuth0Token,
  getJSONStatementTemplate,
  getStatementDetails,
  topLevelCatch,
  uploadObjectToZ3,
  validateJsonBody,
  validateString,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { makeZ3Url } from '../../../shared/presigned-file-urls';

const pdfmake = pdfmakeModule as unknown as {
  setFonts: (fonts: Record<string, unknown>) => void;
  setUrlAccessPolicy?: (callback: (url: string) => boolean) => void;
  createPdf: (definition: Record<string, unknown>) => {
    getBuffer: () => Promise<Buffer>;
  };
};

const ZAMBDA_NAME = 'generate-statement';
const STATEMENT = 'Statement';
const RUBIK_MEDIUM_FONT_PATH = path.resolve(process.cwd(), 'assets', 'Rubik-Medium.ttf');
const RUBIK_BOLD_FONT_PATH = path.resolve(process.cwd(), 'assets', 'Rubik-Bold.otf');
const RUBIK_ITALIC_FONT_PATH = path.resolve(process.cwd(), 'assets', 'fonts', 'rubik', 'Rubik-Italic-Variable.ttf');

interface GenerateStatementInputValidated {
  task: Task;
  encounterId: string;
  secrets: Secrets;
}

let oystehrToken: string;
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { task, encounterId, secrets } = validateInput(input);
    const oystehr = await createOystehr(secrets);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

    const encounterReference = `Encounter/${encounterId}`;
    const encounter = await oystehr.fhir.get<Encounter>({
      resourceType: 'Encounter',
      id: encounterId,
    });

    const templatePayload = getJSONStatementTemplate('statement-template');
    const statementDetails = await getStatementDetails({
      encounterId,
      statementType: 'standard',
      secrets,
      oystehr,
    });

    const pdfTemplateContext = {
      ...statementDetails,
      biller: {
        ...statementDetails.biller,
        logoBase64: templatePayload.logoBase64,
      },
    };
    const documentDefinition = buildPdfDocumentDefinition(templatePayload.template, pdfTemplateContext);
    const pdfBytes = await generatePdfFromDocumentDefinition(documentDefinition);

    const timestamp = DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
    const fileName = `Statement-${encounterId}-${timestamp}.pdf`;
    const patientId = encounter.subject?.reference?.split('/')[1];
    if (!patientId) {
      throw new Error(`Patient id not found in "${encounterReference}"`);
    }

    const baseFileUrl = makeZ3Url({
      secrets,
      fileName,
      bucketName: BUCKET_NAMES.STATEMENTS,
      patientID: patientId,
    });

    let presignedUrl: string;
    try {
      presignedUrl = await createPresignedUrl(m2mToken, baseFileUrl, 'upload');
      await uploadObjectToZ3(pdfBytes, presignedUrl);
    } catch (error: unknown) {
      throw new Error('failed uploading pdf to z3', { cause: error });
    }

    const patientReference = `Patient/${patientId}`;
    const listResources = (
      await oystehr.fhir.search<List>({
        resourceType: 'List',
        params: [
          {
            name: 'patient',
            value: patientReference,
          },
        ],
      })
    ).unbundle();

    await supersedeCurrentStatementDocumentReferences(oystehr, encounterReference, patientReference);

    const { docRefs } = await createFilesDocumentReferences({
      files: [
        {
          url: baseFileUrl,
          title: `${STATEMENT}-${statementDetails.visit.date}-${statementDetails.visit.time}`,
        },
      ],
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: STATEMENT_CODE,
            display: STATEMENT,
          },
        ],
        text: STATEMENT,
      },
      dateCreated: DateTime.now().toUTC().toISO(),
      searchParams: [
        {
          name: 'encounter',
          value: encounterReference,
        },
        {
          name: 'subject',
          value: patientReference,
        },
        {
          name: 'type',
          value: STATEMENT_CODE,
        },
      ],
      references: {
        subject: {
          reference: patientReference,
        },
        context: {
          encounter: [
            {
              reference: encounterReference,
            },
          ],
        },
      },
      oystehr,
      generateUUID: randomUUID,
      listResources,
      meta: {
        tag: [{ code: OTTEHR_MODULE.IP }, { code: OTTEHR_MODULE.TM }],
      },
    });

    await patchTaskStatus(oystehr, task.id!, 'completed');

    return {
      statusCode: 200,
      body: JSON.stringify({
        documentReference: `DocumentReference/${docRefs[0].id}`,
      }),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

function validateInput(input: ZambdaInput): GenerateStatementInputValidated {
  const inputJson = validateJsonBody(input);

  if (inputJson.resourceType !== 'Task') {
    throw new Error(`Input needs to be a Task resource`);
  }

  const task = inputJson as Task;
  const taskId = validateString(task.id, 'taskId');

  return {
    task: {
      ...task,
      id: taskId,
    },
    encounterId: validateString(task.encounter?.reference?.split('/')[1], 'encounterId'),
    secrets: assertDefined(input.secrets, 'input.secrets'),
  };
}

async function patchTaskStatus(oystehr: Oystehr, taskId: string, status: Task['status']): Promise<void> {
  await oystehr.fhir.patch<Task>({
    resourceType: 'Task',
    id: taskId,
    operations: [
      {
        op: 'replace',
        path: '/status',
        value: status,
      },
    ],
  });
}

async function supersedeCurrentStatementDocumentReferences(
  oystehr: Oystehr,
  encounterReference: string,
  patientReference: string
): Promise<void> {
  const currentStatementDocRefs = (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        {
          name: 'status',
          value: 'current',
        },
        {
          name: 'encounter',
          value: encounterReference,
        },
        {
          name: 'subject',
          value: patientReference,
        },
        {
          name: 'type',
          value: STATEMENT_CODE,
        },
      ],
    })
  ).unbundle();

  await Promise.all(
    currentStatementDocRefs
      .filter((docRef) => docRef.id)
      .map((docRef) =>
        oystehr.fhir.patch({
          resourceType: 'DocumentReference',
          id: docRef.id!,
          operations: [
            {
              op: 'replace',
              path: '/status',
              value: 'superseded',
            },
          ],
        })
      )
  );
}

async function createOystehr(secrets: Secrets | null): Promise<Oystehr> {
  if (oystehrToken == null) {
    oystehrToken = await getAuth0Token(secrets);
  }
  return createOystehrClient(oystehrToken, secrets);
}

function buildPdfDocumentDefinition(template: string, context: Record<string, unknown>): Record<string, unknown> {
  const parsedTemplate = JSON.parse(template) as unknown;
  const expandedTemplate = processTemplateNode(parsedTemplate, context);
  const expandedTemplateString = JSON.stringify(expandedTemplate);
  const compiledTemplate = Handlebars.compile(expandedTemplateString)(context);
  const documentDefinition = JSON.parse(compiledTemplate) as Record<string, unknown>;
  applyLayoutResolvers(documentDefinition);
  return documentDefinition;
}

function processTemplateNode(node: unknown, context: Record<string, unknown>): unknown {
  if (Array.isArray(node)) {
    const processedArray: unknown[] = [];

    for (const item of node) {
      if (isLoopDirective(item)) {
        processedArray.push(...expandLoop(item, context));
        continue;
      }

      const processedItem = processTemplateNode(item, context);
      if (processedItem !== null) {
        processedArray.push(processedItem);
      }
    }

    return processedArray;
  }

  if (!isRecord(node)) {
    return node;
  }

  if (!passesTemplateConditions(node, context)) {
    return null;
  }

  const processedObject: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('__')) {
      continue;
    }

    const processedValue = processTemplateNode(value, context);
    if (processedValue !== null) {
      processedObject[key] = processedValue;
    }
  }

  return processedObject;
}

function expandLoop(loopDirective: LoopDirective, context: Record<string, unknown>): unknown[] {
  const source = getValueByPath(context, loopDirective.__loop);
  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((item) => {
      const rowTemplate = JSON.stringify(loopDirective.__row);
      const compiledRow = Handlebars.compile(rowTemplate)(item as Record<string, unknown>);
      const parsedRow = JSON.parse(compiledRow) as unknown;
      return processTemplateNode(parsedRow, context);
    })
    .filter((row): row is Exclude<typeof row, null> => row !== null);
}

function passesTemplateConditions(templateNode: Record<string, unknown>, context: Record<string, unknown>): boolean {
  const includeWhen = templateNode.__condition;
  if (typeof includeWhen === 'string' && !isTruthyForTemplate(getValueByPath(context, includeWhen))) {
    return false;
  }

  const excludeWhen = templateNode.__conditionNot;
  if (typeof excludeWhen === 'string' && isTruthyForTemplate(getValueByPath(context, excludeWhen))) {
    return false;
  }

  return true;
}

function isTruthyForTemplate(value: unknown): boolean {
  if (typeof value === 'string') {
    const normalized = value.replace(/[$,\s]/g, '');
    if (normalized.length === 0) {
      return false;
    }
    const asNumber = Number(normalized);
    if (!Number.isNaN(asNumber) && asNumber === 0) {
      return false;
    }
    return true;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return Boolean(value);
}

function applyLayoutResolvers(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach((item) => applyLayoutResolvers(item));
    return;
  }

  if (!isRecord(node)) {
    return;
  }

  const layout = isRecord(node.layout) ? node.layout : null;
  if (layout && layout.hLineWidth === '__hLineWidth') {
    layout.hLineWidth = (rowIndex: number, tableNode: { table?: { body?: unknown[] } }): number => {
      const body = tableNode?.table?.body;
      const rowCount = Array.isArray(body) ? body.length : 0;
      if (rowIndex <= 1 || rowIndex === rowCount) {
        return 0.5;
      }
      return 0.25;
    };
  }

  if (layout && layout.hLineColor === '__hLineColor') {
    layout.hLineColor = (rowIndex: number, tableNode: { table?: { body?: unknown[] } }): string => {
      const body = tableNode?.table?.body;
      const rowCount = Array.isArray(body) ? body.length : 0;
      if (rowIndex <= 1 || rowIndex === rowCount) {
        return '#1e2d4a';
      }
      return '#eef1f6';
    };
  }

  if (layout) {
    normalizeTableLayoutFunctions(layout);
  }

  Object.values(node).forEach((value) => applyLayoutResolvers(value));
}

function normalizeTableLayoutFunctions(layout: Record<string, unknown>): void {
  const hLineWidth = layout.hLineWidth;
  if (typeof hLineWidth === 'number') {
    layout.hLineWidth = (): number => hLineWidth;
  }

  const vLineWidth = layout.vLineWidth;
  if (typeof vLineWidth === 'number') {
    layout.vLineWidth = (): number => vLineWidth;
  }

  const hLineColor = layout.hLineColor;
  if (typeof hLineColor === 'string') {
    layout.hLineColor = (): string => hLineColor;
  }

  const vLineColor = layout.vLineColor;
  if (typeof vLineColor === 'string') {
    layout.vLineColor = (): string => vLineColor;
  }

  const paddingLeft = layout.paddingLeft;
  if (typeof paddingLeft === 'number') {
    layout.paddingLeft = (): number => paddingLeft;
  }

  const paddingRight = layout.paddingRight;
  if (typeof paddingRight === 'number') {
    layout.paddingRight = (): number => paddingRight;
  }

  const paddingTop = layout.paddingTop;
  if (typeof paddingTop === 'number') {
    layout.paddingTop = (): number => paddingTop;
  }

  const paddingBottom = layout.paddingBottom;
  if (typeof paddingBottom === 'number') {
    layout.paddingBottom = (): number => paddingBottom;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface LoopDirective {
  __loop: string;
  __row: unknown;
}

function isLoopDirective(value: unknown): value is LoopDirective {
  return isRecord(value) && typeof value.__loop === 'string' && Object.prototype.hasOwnProperty.call(value, '__row');
}

function getValueByPath(context: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((currentValue, segment) => {
    if (!isRecord(currentValue)) {
      return undefined;
    }
    return currentValue[segment];
  }, context);
}

async function generatePdfFromDocumentDefinition(documentDefinition: Record<string, unknown>): Promise<Uint8Array> {
  pdfmake.setFonts({
    Rubik: {
      normal: RUBIK_MEDIUM_FONT_PATH,
      bold: RUBIK_BOLD_FONT_PATH,
      italics: RUBIK_ITALIC_FONT_PATH,
      bolditalics: RUBIK_BOLD_FONT_PATH,
    },
    CodeMono: {
      normal: RUBIK_MEDIUM_FONT_PATH,
      bold: RUBIK_BOLD_FONT_PATH,
      italics: RUBIK_ITALIC_FONT_PATH,
      bolditalics: RUBIK_BOLD_FONT_PATH,
    },
  });

  // Disable external URL downloads for deterministic and secure server-side rendering.
  pdfmake.setUrlAccessPolicy?.(() => false);

  const pdfBuffer = await pdfmake.createPdf(documentDefinition).getBuffer();
  return Uint8Array.from(pdfBuffer);
}
