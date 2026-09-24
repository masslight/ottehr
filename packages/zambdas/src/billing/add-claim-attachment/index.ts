import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, ClaimSupportingInfo, DocumentReference } from 'fhir/r4b';
import { AddClaimAttachmentResponse } from 'utils/lib/types/data/billing/billing.types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import {
  buildAttachmentDocumentReference,
  CLAIM_ATTACHMENT_PATH_PREFIX,
  newAttachmentLocation,
  presignAttachment,
  resolveAttachmentContentType,
} from '../attachments';
import { CLAIM_ATTACHMENT_REPORT_TYPE_CODE_SYSTEM, createBillingClient, fetchById } from '../shared';
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
  const claim = await fetchById<Claim>(oystehr, 'Claim', params.claimId);
  const location = newAttachmentLocation(
    params.secrets['PROJECT_ID'],
    CLAIM_ATTACHMENT_PATH_PREFIX,
    claim.id,
    params.name
  );
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
  const docRef = buildAttachmentDocumentReference({
    location,
    projectApi: params.secrets['PROJECT_API'],
    title: params.name,
    contentType: resolveAttachmentContentType(params.name, params.contentType),
    relatedReference: `Claim/${claim.id}`,
  });

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

  const result = await oystehr.fhir.transaction<Claim | DocumentReference>({ requests });
  const documentReferenceId =
    result.unbundle().find((resource) => resource.resourceType === 'DocumentReference')?.id ?? '';

  return {
    documentReferenceId,
    uploadUrl: await presignAttachment(oystehr, location, 'upload'),
  };
}
