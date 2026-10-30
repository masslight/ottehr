import { BatchInputRequest } from '@oystehr/sdk';
import { Claim, ClaimSupportingInfo, DocumentReference, FhirResource, ProvenanceAgent } from 'fhir/r4b';
import { DEFAULT_CLAIM_ATTACHMENT_REPORT_TYPE_CODE } from 'utils/lib/fhir/billing';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { Secrets } from 'utils/lib/secrets';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import {
  buildAttachmentDocumentReference,
  CLAIM_ATTACHMENT_PATH_PREFIX,
  newAttachmentLocation,
  presignAttachment,
  resolveAttachmentContentType,
} from './attachments';
import { claimEventProvenanceRequest } from './provenance';
import { BillingOystehr, CLAIM_ATTACHMENT_REPORT_TYPE_CODE_SYSTEM } from './shared';

const CLAIM_INFORMATION_CATEGORY_SYSTEM = 'http://terminology.hl7.org/CodeSystem/claiminformationcategory';
const DOCUMENT_REFERENCE_PLACEHOLDER = 'urn:uuid:doc-ref';

// Records a document on the claim (a DocumentReference plus a supportingInfo entry pointing at it) and
// returns where to upload the file. `name` is the title billers see and can rename; `fileName` is the
// uploaded file's own name, which names the stored object and gives its content type when the browser
// didn't report one. The upload URL comes first: once the records are written, the client must get the
// id back to clean them up when its upload fails.
export async function attachClaimDocument({
  oystehr,
  claim,
  name,
  fileName,
  reportTypeCode,
  contentType,
  secrets,
  agent,
}: {
  oystehr: BillingOystehr;
  claim: Claim & { id: string };
  name: string;
  fileName: string;
  reportTypeCode?: string;
  contentType?: string;
  secrets: Secrets;
  agent: ProvenanceAgent;
}): Promise<{ documentReferenceId: string; uploadUrl: string }> {
  const location = newAttachmentLocation(secrets['PROJECT_ID'], CLAIM_ATTACHMENT_PATH_PREFIX, claim.id, fileName);
  const uploadUrl = await presignAttachment(oystehr, location, 'upload');
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
  const docRef = buildAttachmentDocumentReference({
    location,
    projectApi: secrets['PROJECT_API'],
    title: name,
    contentType: resolveAttachmentContentType(fileName, contentType),
    relatedReference: `Claim/${claim.id}`,
  });
  const provenance = claimEventProvenanceRequest({
    targetReference: DOCUMENT_REFERENCE_PLACEHOLDER,
    claimId: claim.id,
    after: docRef,
    agent,
    activity: 'create',
  });

  const requests: BatchInputRequest<FhirResource>[] = [
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
    ...(provenance ? [provenance] : []),
  ];

  const result = await oystehr.fhir.transaction<FhirResource>({ requests });
  const documentReferenceId = result.unbundle().find((resource) => resource.resourceType === 'DocumentReference')?.id;
  if (!documentReferenceId) throw new Error('The claim attachment was created without an id');

  return { documentReferenceId, uploadUrl };
}

export function attachedClaimId(documentReference: DocumentReference): string {
  const claimId = (documentReference.context?.related ?? [])
    .map((related) => removePrefix('Claim/', related.reference ?? ''))
    .find(Boolean);
  if (!claimId) throw INVALID_INPUT_ERROR(`DocumentReference ${documentReference.id} is not attached to a claim`);
  return claimId;
}
