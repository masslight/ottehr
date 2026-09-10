import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { Bundle, Claim, ClaimSupportingInfo, DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { DEFAULT_CLAIM_ATTACHMENT_REPORT_TYPE_CODE } from 'utils/lib/fhir/billing';
import { Secrets } from 'utils/lib/secrets';
import { sanitizeFileNameForZ3 } from 'utils/lib/utils/file';
import {
  BILLING_APP_BUCKET,
  CLAIM_ATTACHMENT_OBJECT_PATH,
  CLAIM_ATTACHMENT_REPORT_TYPE_CODE_SYSTEM,
  getClaimAttachmentUrl,
} from './shared';

const CLAIM_INFORMATION_CATEGORY_SYSTEM = 'http://terminology.hl7.org/CodeSystem/claiminformationcategory';
const DOCUMENT_REFERENCE_PLACEHOLDER = 'urn:uuid:doc-ref';

export interface AttachClaimDocumentResult {
  documentReferenceId?: string;
  uploadUrl: string;
}

export async function attachClaimDocument({
  oystehr,
  claim,
  name,
  reportTypeCode,
  secrets,
}: {
  oystehr: Oystehr;
  claim: Claim & { id: string };
  name: string;
  reportTypeCode?: string;
  secrets: Secrets;
}): Promise<AttachClaimDocumentResult> {
  const fileName = sanitizeFileNameForZ3(name);
  const extension = fileName.split('.').pop() ?? '';
  const supportingInfo = claim.supportingInfo ?? [];
  const supportingInfoEntry: ClaimSupportingInfo = {
    sequence: supportingInfo.length + 1,
    category: {
      coding: [
        {
          system: CLAIM_INFORMATION_CATEGORY_SYSTEM,
          code: 'attachment',
        },
      ],
    },
    code: {
      coding: [
        {
          system: CLAIM_ATTACHMENT_REPORT_TYPE_CODE_SYSTEM,
          code: reportTypeCode ?? DEFAULT_CLAIM_ATTACHMENT_REPORT_TYPE_CODE,
        },
      ],
    },
    valueReference: {
      reference: DOCUMENT_REFERENCE_PLACEHOLDER,
    },
  };
  const docRef: DocumentReference = {
    resourceType: 'DocumentReference',
    status: 'current',
    date: DateTime.now().toISO(),
    content: [
      {
        attachment: {
          url: getClaimAttachmentUrl(secrets['PROJECT_API'], secrets['PROJECT_ID'], claim.id, fileName),
          contentType: `application/${extension}`,
          title: name,
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
    {
      method: 'POST',
      url: `/DocumentReference`,
      resource: docRef,
      fullUrl: DOCUMENT_REFERENCE_PLACEHOLDER,
    },
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

  const presignedUrlResult = await oystehr.z3.getPresignedUrl({
    bucketName: BILLING_APP_BUCKET(secrets['PROJECT_ID']),
    'objectPath+': CLAIM_ATTACHMENT_OBJECT_PATH(claim.id, fileName),
    action: 'upload',
  });
  return {
    documentReferenceId: createdDocumentReferenceId(result),
    uploadUrl: presignedUrlResult.signedUrl,
  };
}

function createdDocumentReferenceId(result: Bundle<Claim | DocumentReference> | undefined): string | undefined {
  for (const entry of result?.entry ?? []) {
    if (entry.resource?.resourceType === 'DocumentReference' && entry.resource.id) return entry.resource.id;
    const [resourceType, id] = entry.response?.location?.split('/') ?? [];
    if (resourceType === 'DocumentReference' && id) return id;
  }
  return undefined;
}
