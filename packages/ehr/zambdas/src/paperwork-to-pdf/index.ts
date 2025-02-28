import { getSecret, Secrets, SecretsKeys, topLevelCatch, ZambdaInput } from 'zambda-utils';
import { wrapHandler } from '@sentry/aws-serverless';
import { captureSentryException, configSentry, getAuth0Token } from '../../../../intake/zambdas/src/shared';
import { APIGatewayProxyResult } from 'aws-lambda';
import Oystehr from '@oystehr/sdk';
import { createOystehrClient, validateJsonBody, validateString } from '../shared/helpers';
import { createDocument } from './document';
import { generatePdf } from './draw';
import { DocumentReference, QuestionnaireResponse } from 'fhir/r4b';
import { BUCKET_PAPERWORK_PDF } from '../../scripts/setup';
import { DateTime } from 'luxon';

interface Input {
  questionnaireResponseId: string;
  documentReference: DocumentReference;
  secrets: Secrets | null;
}

const ZAMBDA_NAME = 'paperwork-to-pdf';

let zapehrToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry(ZAMBDA_NAME, input.secrets);
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const { questionnaireResponseId, documentReference, secrets } = validateInput(input);
    const oystehr = await createOystehr(secrets);
    const questionnaireResponse = await oystehr.fhir.get<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      id: questionnaireResponseId,
    });

    const document = await createDocument(questionnaireResponse, oystehr);
    const pdfDocument = await generatePdf(document);

    const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
    const z3Bucket = projectId + '-' + BUCKET_PAPERWORK_PDF;
    await createZ3Bucket(z3Bucket, oystehr);

    const timestamp = DateTime.now().toUTC().toFormat('yyyy-MM-dd-x');
    const pdfFilePath = `${document.patientInfo.id}/${questionnaireResponse.id}-${questionnaireResponse.meta?.versionId}-${timestamp}.pdf`;
    await oystehr.z3.uploadFile({
      bucketName: z3Bucket,
      'objectPath+': pdfFilePath,
      file: new Blob([new Uint8Array(await pdfDocument.save())]),
    });

    const projectApi = getSecret(SecretsKeys.PROJECT_API, secrets);
    const { id } = await oystehr.fhir.create<DocumentReference>({
      ...documentReference,
      subject: {
        reference: 'Patient/' + document.patientInfo.id,
      },
      content: [
        {
          attachment: {
            url: `${projectApi}/z3/${z3Bucket}/${pdfFilePath}`,
            contentType: 'application/pdf',
            title: 'Paperwork PDF',
          },
        },
      ],
      date: DateTime.now().toUTC().toISO(),
    });
    return {
      statusCode: 200,
      body: JSON.stringify({
        documentReference: 'DocumentReference/' + id,
      }),
    };
  } catch (error: any) {
    return topLevelCatch(ZAMBDA_NAME, error, input.secrets, captureSentryException);
  }
});

function validateInput(input: ZambdaInput): Input {
  const { questionnaireResponseId, documentReference } = validateJsonBody(input);
  if (documentReference.resourceType !== 'DocumentReference') {
    throw new Error('documentReference must be a "DocumentReference" resource');
  }
  return {
    questionnaireResponseId: validateString(questionnaireResponseId, 'questionnaireResponseId'),
    documentReference: documentReference,
    secrets: input.secrets,
  };
}

async function createOystehr(secrets: Secrets | null): Promise<Oystehr> {
  if (zapehrToken == null) {
    zapehrToken = await getAuth0Token(secrets);
  }
  return createOystehrClient(zapehrToken, secrets);
}

async function createZ3Bucket(z3Bucket: string, oystehr: Oystehr): Promise<void> {
  await oystehr.z3
    .createBucket({
      bucketName: z3Bucket,
    })
    .catch((e) => {
      console.error(`Failed to create bucket "${z3Bucket}"`, e);
      return Promise.resolve();
    });
}
