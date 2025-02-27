import { Secrets, topLevelCatch, ZambdaInput } from 'zambda-utils';
import { wrapHandler } from '@sentry/aws-serverless';
import { captureSentryException, configSentry, getAuth0Token } from '../../../../intake/zambdas/src/shared';
import { APIGatewayProxyResult } from 'aws-lambda';
import Oystehr from '@oystehr/sdk';
import { createOystehrClient, validateJsonBody, validateString } from '../shared/helpers';
import { createDocument } from './document';
import { drawDocument } from './draw';
import { DocumentReference } from 'fhir/r4b';

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
    const document = await createDocument(questionnaireResponseId, oystehr);
    const pdfDocument = await drawDocument(document);
    await oystehr.z3.uploadFile({
      bucketName: 'todo',
      'objectPath+': 'todo',
      file: new Blob([new Uint8Array(await pdfDocument.save())]),
    });
    documentReference.content = [
      {
        attachment: {
          url: 'todo',
          contentType: 'application/pdf',
          title: 'todo title',
        },
      },
    ];
    const { id } = await oystehr.fhir.create<DocumentReference>(documentReference);
    return {
      statusCode: 200,
      body: JSON.stringify({
        id: id,
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
