import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ClaimSupportingInfo, DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { AddClaimAttachmentResponse } from 'utils/lib/types/data/billing/billing.types';
import { sanitizeFileNameForZ3 } from 'utils/lib/utils/file';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import {
  BILLING_APP_BUCKET,
  CLAIM_ATTACHMENT_OBJECT_PATH,
  CLAIM_ATTACHMENT_REPORT_TYPE_CODE_SYSTEM,
  createBillingClient,
  fetchById,
  getClaimAttachmentUrl,
} from '../shared';
import { AddClaimAttachmentParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('add-claim-attachment', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const result = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(result) };
});

export async function performEffect(
  oystehr: Oystehr,
  params: AddClaimAttachmentParams
): Promise<AddClaimAttachmentResponse> {
  const nameParts = params.name.split('.');
  const extension = nameParts[nameParts.length - 1];
  const claim = await fetchById<Claim>(oystehr, 'Claim', params.claimId);
  const supportingInfo = claim.supportingInfo ?? [];
  const supportingInfoEntry: ClaimSupportingInfo = {
    sequence: supportingInfo.length + 1,
    category: {
      coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claiminformationcategory', code: 'attachment' }],
    },
    code: {
      coding: [
        {
          system: CLAIM_ATTACHMENT_REPORT_TYPE_CODE_SYSTEM,
          code: params.reportTypeCode ?? 'OZ',
        },
      ],
    },
    valueReference: {
      reference: 'urn:uuid:doc-ref',
    },
  };
  const docRef: DocumentReference = {
    resourceType: 'DocumentReference',
    status: 'current',
    date: DateTime.now().toISO(),
    content: [
      {
        attachment: {
          url: getClaimAttachmentUrl(
            params.secrets['PROJECT_API'],
            params.secrets['PROJECT_ID'],
            claim.id,
            sanitizeFileNameForZ3(params.name)
          ),
          contentType: `application/${extension}`,
          title: params.name,
        },
      },
    ],
    context: {
      related: [
        {
          reference: `Claim/${claim.id}`,
        },
      ],
    },
  };

  const requests: BatchInputRequest<Claim | DocumentReference>[] = [
    { method: 'POST', url: `/DocumentReference`, resource: docRef, fullUrl: 'urn:uuid:doc-ref' },
    {
      method: 'PATCH',
      url: `/Claim/${claim.id}`,
      operations: [
        {
          op: 'add',
          path: supportingInfo.length ? '/supportingInfo/-' : '/supportingInfo',
          value: supportingInfo.length ? supportingInfoEntry : [supportingInfoEntry],
        },
      ],
    },
  ];

  await oystehr.fhir.transaction<Claim | DocumentReference>({ requests });

  const presignedUrlResult = await oystehr.z3.getPresignedUrl({
    bucketName: BILLING_APP_BUCKET(params.secrets['PROJECT_ID']),
    'objectPath+': CLAIM_ATTACHMENT_OBJECT_PATH(claim.id, params.name),
    action: 'upload',
  });
  return {
    uploadUrl: presignedUrlResult.signedUrl,
  };
}
