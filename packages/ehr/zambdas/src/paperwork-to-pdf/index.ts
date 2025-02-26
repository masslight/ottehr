import { Secrets, topLevelCatch, ZambdaInput } from 'zambda-utils';
import { wrapHandler } from '@sentry/aws-serverless';
import { captureSentryException, configSentry, getAuth0Token } from '../../../../intake/zambdas/src/shared';
import { APIGatewayProxyResult } from 'aws-lambda';
import Oystehr from '@oystehr/sdk';
import { createOystehrClient, validateJsonBody, validateString } from '../shared/helpers';
import { createDocument } from './document';
import { drawDocument } from './draw';

interface Input {
  questionnaireResponseId: string;
  secrets: Secrets | null;
}

const ZAMBDA_NAME = 'paperwork-to-pdf';

let zapehrToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry(ZAMBDA_NAME, input.secrets);
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const { questionnaireResponseId, secrets } = validateInput(input);
    const oystehr = await createOystehr(secrets);
    const document = await createDocument(questionnaireResponseId, oystehr);
    const pdfDocument = await drawDocument(document);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/pdf' },
      body: Buffer.from(await pdfDocument.save()).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error: any) {
    return topLevelCatch(ZAMBDA_NAME, error, input.secrets, captureSentryException);
  }
});

function validateInput(input: ZambdaInput): Input {
  const { questionnaireResponseId } = validateJsonBody(input);
  return {
    questionnaireResponseId: validateString(questionnaireResponseId, 'questionnaireResponseId'),
    secrets: input.secrets,
  };
}

async function createOystehr(secrets: Secrets | null): Promise<Oystehr> {
  if (zapehrToken == null) {
    zapehrToken = await getAuth0Token(secrets);
  }
  return createOystehrClient(zapehrToken, secrets);
}
