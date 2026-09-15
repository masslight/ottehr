import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { BillingFhirResource, createBillingClient, fetchById } from '../shared';
import { RenameClaimAttachmentParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'rename-claim-attachment',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const params = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
    const oystehr = createBillingClient(m2mToken, params.secrets);

    await performEffect(oystehr, params);
    return { statusCode: 200, body: JSON.stringify({ deleted: true }) };
  }
);

export async function performEffect(oystehr: Oystehr, params: RenameClaimAttachmentParams): Promise<void> {
  const documentReference = await fetchById<DocumentReference>(
    oystehr,
    'DocumentReference',
    params.documentReferenceId
  );
  const content = documentReference.content[0];
  if (!content) {
    throw INVALID_INPUT_ERROR(`Missing attachment information for DocumentReference ${documentReference.id}`);
  }

  const requests: BatchInputRequest<BillingFhirResource>[] = [
    {
      method: 'PATCH',
      url: `/DocumentReference/${documentReference.id}`,
      operations: [
        {
          op: 'replace',
          path: `/content`,
          value: [
            {
              attachment: {
                ...content.attachment,
                title: params.name,
              },
            },
          ],
        },
      ],
    },
  ];

  await oystehr.fhir.transaction<BillingFhirResource>({ requests });
}
