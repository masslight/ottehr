import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DocumentReference, Encounter, List, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import type { Browser } from 'puppeteer';
import puppeteer from 'puppeteer';
import {
  BUCKET_NAMES,
  createFilesDocumentReferences,
  generateStatement,
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
  getStatementDetails,
  getStatementTemplate,
  topLevelCatch,
  uploadObjectToZ3,
  validateJsonBody,
  validateString,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { makeZ3Url } from '../../../shared/presigned-file-urls';

const ZAMBDA_NAME = 'generate-statement';
const STATEMENT = 'Statement';

interface GenerateStatementInputValidated {
  encounterId: string;
  secrets: Secrets;
}

let oystehrToken: string;
let m2mToken: string;
let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;
let browserLeaseQueue: Promise<void> = Promise.resolve();

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const releaseBrowserLease = await acquireBrowserLease();
  try {
    const { encounterId, secrets } = validateInput(input);
    const oystehr = await createOystehr(secrets);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

    const encounterReference = `Encounter/${encounterId}`;
    const encounter = await oystehr.fhir.get<Encounter>({
      resourceType: 'Encounter',
      id: encounterId,
    });

    const templatePayload = getStatementTemplate('statement-template');
    const statementDetails = await getStatementDetails({
      encounterId,
      statementType: 'standard',
      secrets,
      oystehr,
    });

    const html = generateStatement(templatePayload.template, statementDetails);
    const pdfBytes = await generatePdfFromHtml(html);

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

    return {
      statusCode: 200,
      body: JSON.stringify({
        documentReference: `DocumentReference/${docRefs[0].id}`,
      }),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  } finally {
    releaseBrowserLease();
  }
});

function validateInput(input: ZambdaInput): GenerateStatementInputValidated {
  const inputJson = validateJsonBody(input);

  if (inputJson.resourceType !== 'Task') {
    throw new Error(`Input needs to be a Task resource`);
  }

  const task = inputJson as Task;

  return {
    encounterId: validateString(task.encounter?.reference?.split('/')[1], 'encounterId'),
    secrets: assertDefined(input.secrets, 'input.secrets'),
  };
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

async function generatePdfFromHtml(html: string): Promise<Uint8Array> {
  const browser = await getOrCreateBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
    });
    return pdf;
  } finally {
    await page.close();
  }
}

async function acquireBrowserLease(): Promise<() => void> {
  const previousLease = browserLeaseQueue;
  let releaseCurrentLease: (() => void) | undefined;

  browserLeaseQueue = new Promise<void>((resolve) => {
    releaseCurrentLease = resolve;
  });

  await previousLease;

  return () => {
    releaseCurrentLease?.();
  };
}

async function getOrCreateBrowser(): Promise<Browser> {
  if (browserInstance?.connected) {
    return browserInstance;
  }

  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  browserLaunchPromise = puppeteer
    .launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    .then((browser) => {
      browserInstance = browser;
      browser.on('disconnected', () => {
        if (browserInstance === browser) {
          browserInstance = null;
        }
      });
      return browser;
    })
    .finally(() => {
      browserLaunchPromise = null;
    });

  return browserLaunchPromise;
}
