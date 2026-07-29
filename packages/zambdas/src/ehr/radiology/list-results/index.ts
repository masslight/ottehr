import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { getPresignedURL, ListRadiologyResultsZambdaOutput, RadiologyResultDTO } from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { searchRadiologyResultDocRefs } from '../shared/result-doc-refs';
import { validateInput, validateSecrets } from './validation';

let m2mToken: string;

const ZAMBDA_NAME = 'radiology-list-results';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const secrets = validateSecrets(unsafeInput.secrets);
  const { body } = validateInput(unsafeInput);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const results = await listResults(body.serviceRequestId, m2mToken, oystehr);

  const output: ListRadiologyResultsZambdaOutput = { results };
  return { statusCode: 200, body: JSON.stringify(output) };
});

const listResults = async (
  serviceRequestId: string,
  token: string,
  oystehr: Oystehr
): Promise<RadiologyResultDTO[]> => {
  const docRefs = await searchRadiologyResultDocRefs(serviceRequestId, oystehr);

  const results = await Promise.all(
    docRefs.map(async (docRef): Promise<RadiologyResultDTO | undefined> => {
      const attachment = docRef.content?.[0]?.attachment;
      if (!docRef.id || !attachment?.url) {
        return undefined;
      }
      const url = await getPresignedURL(attachment.url, token);
      return {
        documentReferenceId: docRef.id,
        title: attachment.title || docRef.description || 'Result',
        url,
      };
    })
  );

  return results.filter((result): result is RadiologyResultDTO => result !== undefined);
};
