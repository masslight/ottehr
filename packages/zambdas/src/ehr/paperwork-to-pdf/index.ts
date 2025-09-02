import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { DateTime } from 'luxon';
import {
  BUCKET_NAMES,
  createFilesDocumentReferences,
  EXPORTED_QUESTIONNAIRE_CODE,
  getPaperworkResources,
  getSecret,
  OTTEHR_MODULE,
  PAPERWORK_PDF_ATTACHMENT_TITLE,
  PAPERWORK_PDF_BASE_NAME,
  PaperworkToPDFInputValidated,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  createPresignedUrl,
  getAuth0Token,
  topLevelCatch,
  uploadObjectToZ3,
  validateJsonBody,
  validateString,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { makeZ3Url } from '../../shared/presigned-file-urls';
import { createDocument } from './document';
import { generatePdf } from './draw';

const ZAMBDA_NAME = 'paperwork-to-pdf';

let oystehrToken: string;

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { questionnaireResponseId, secrets } = validateInput(input);
    const oystehr = await createOystehr(secrets);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

    const paperworkResources = await getPaperworkResources(oystehr, questionnaireResponseId);
    if (!paperworkResources) throw new Error('Paperwork not submitted');

    const { questionnaireResponse, listResources } = paperworkResources;
    if (!questionnaireResponse) throw new Error('QuestionnaireResponse not found');
    const document = await createDocument(questionnaireResponse, oystehr);
    const pdfDocument = await generatePdf(document);

    const timestamp = DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
    const fileName = `${PAPERWORK_PDF_BASE_NAME}-${questionnaireResponse?.id}-${questionnaireResponse?.meta?.versionId}-${timestamp}.pdf`;

    const baseFileUrl = makeZ3Url({
      secrets,
      fileName,
      bucketName: BUCKET_NAMES.PAPERWORK,
      patientID: document.patientInfo.id,
    });

    console.log('Uploading file to bucket, ', BUCKET_NAMES.PAPERWORK);

    let presignedUrl;
    try {
      presignedUrl = await createPresignedUrl(m2mToken, baseFileUrl, 'upload');
      await uploadObjectToZ3(new Uint8Array(await pdfDocument.save()), presignedUrl);
    } catch (error: any) {
      throw new Error(`failed uploading pdf to z3:  ${JSON.stringify(error.message)}`);
    }

    const { docRefs } = await createFilesDocumentReferences({
      files: [
        {
          url: baseFileUrl,
          title: PAPERWORK_PDF_ATTACHMENT_TITLE,
        },
      ],
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: EXPORTED_QUESTIONNAIRE_CODE,
            display: PAPERWORK_PDF_ATTACHMENT_TITLE,
          },
        ],
        text: PAPERWORK_PDF_ATTACHMENT_TITLE,
      },
      dateCreated: DateTime.now().toUTC().toISO(),
      searchParams: [
        {
          name: 'subject',
          value: `Patient/${document.patientInfo.id}`,
        },
        {
          name: 'type',
          value: EXPORTED_QUESTIONNAIRE_CODE,
        },
        ...(questionnaireResponse.encounter?.reference
          ? [{ name: 'encounter', value: questionnaireResponse.encounter.reference }]
          : []),
      ],
      references: {
        subject: { reference: `Patient/${document.patientInfo.id}` },
        ...(questionnaireResponse.encounter && {
          context: { encounter: [questionnaireResponse.encounter] },
        }),
      },
      oystehr,
      generateUUID: randomUUID,
      listResources: listResources,
      meta: {
        tag: [{ code: OTTEHR_MODULE.IP }, { code: OTTEHR_MODULE.TM }],
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        documentReference: 'DocumentReference/' + docRefs[0].id,
      }),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

function validateInput(input: ZambdaInput): PaperworkToPDFInputValidated {
  const { questionnaireResponseId } = validateJsonBody(input);
  return {
    questionnaireResponseId: validateString(questionnaireResponseId, 'questionnaireResponseId'),
    secrets: input.secrets,
  };
}

async function createOystehr(secrets: Secrets | null): Promise<Oystehr> {
  if (oystehrToken == null) {
    oystehrToken = await getAuth0Token(secrets);
  }
  return createOystehrClient(oystehrToken, secrets);
}
