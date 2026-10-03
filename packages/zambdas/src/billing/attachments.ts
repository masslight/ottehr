import { randomUUID } from 'node:crypto';
import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { getMimeType, MIME_TYPES, sanitizeFileNameForZ3 } from 'utils/lib/utils/file';
import { BILLING_APP_BUCKET, getClaimAttachmentBucketAndPathFromZ3Url } from './shared';

// Files billers attach in the billing app (claim documentation, remit scans) live in the billing
// app bucket under <prefix>/<owner id>/, one DocumentReference each whose context.related points at
// the owning resource. Upload and download go through presigned URLs these helpers mint.

export const CLAIM_ATTACHMENT_PATH_PREFIX = 'claim-attachments';
export const ERA_ATTACHMENT_PATH_PREFIX = 'era-attachments';

// What a paper remit scan can be.
export const ERA_ATTACHMENT_CONTENT_TYPES: readonly string[] = [
  MIME_TYPES.PDF,
  MIME_TYPES.PNG,
  MIME_TYPES.JPEG,
  'image/tiff',
];

const FALLBACK_CONTENT_TYPE = 'application/octet-stream';

export interface Z3Location {
  bucketName: string;
  path: string;
}

// Content type for an upload: the browser's File.type when it sent one, else a guess from the file
// name. With `allowed`, anything outside the list is refused.
export function resolveAttachmentContentType(
  fileName: string,
  declared: string | undefined,
  allowed?: readonly string[]
): string {
  const normalizedDeclared = declared?.trim().toLowerCase();
  const fromName = getMimeType(fileName) ?? (/\.tiff?$/i.test(fileName) ? 'image/tiff' : undefined);
  // browsers report some JPEGs as the non-standard image/jpg
  const contentType = (normalizedDeclared || fromName || FALLBACK_CONTENT_TYPE).replace(
    /^image\/jpg$/,
    MIME_TYPES.JPEG
  );
  if (allowed && !allowed.includes(contentType)) {
    throw INVALID_INPUT_ERROR(`Files of type ${contentType} can't be attached here`);
  }
  return contentType;
}

// Where a new attachment goes. The random prefix keeps two uploads with the same name apart, and the
// sanitized name is used for both the upload and the stored URL, so they always agree.
export function newAttachmentLocation(
  projectId: string,
  prefix: string,
  ownerId: string,
  fileName: string
): Z3Location {
  return {
    bucketName: BILLING_APP_BUCKET(projectId),
    path: `${prefix}/${ownerId}/${randomUUID()}-${sanitizeFileNameForZ3(fileName)}`,
  };
}

export function z3UrlFor(projectApi: string, location: Z3Location): string {
  return `${projectApi}/z3/${location.bucketName}/${location.path}`;
}

export function buildAttachmentDocumentReference(args: {
  location: Z3Location;
  projectApi: string;
  title: string;
  contentType: string;
  relatedReference: string;
}): DocumentReference {
  return {
    resourceType: 'DocumentReference',
    status: 'current',
    date: DateTime.now().toISO(),
    content: [
      {
        attachment: {
          url: z3UrlFor(args.projectApi, args.location),
          contentType: args.contentType,
          title: args.title,
        },
      },
    ],
    context: { related: [{ reference: args.relatedReference }] },
  };
}

// The stored file behind a DocumentReference, after checking the document belongs to the given owner
// (context.related) and its file sits under that owner's folder of the billing app bucket, so one
// resource's attachment can't be reached through another's.
export function ownedAttachmentLocation(
  documentReference: DocumentReference,
  owner: { reference: string; projectApi: string; projectId: string; prefix: string; ownerId: string }
): Z3Location {
  const related = documentReference.context?.related ?? [];
  if (!related.some((ref) => ref.reference === owner.reference)) {
    throw INVALID_INPUT_ERROR(`DocumentReference ${documentReference.id} is not attached to ${owner.reference}`);
  }
  const z3Url = documentReference.content[0]?.attachment.url;
  if (!z3Url) {
    throw INVALID_INPUT_ERROR(`Missing z3 URL in DocumentReference ${documentReference.id}`);
  }
  const [bucketName, path] = getClaimAttachmentBucketAndPathFromZ3Url(owner.projectApi, z3Url);
  if (
    !bucketName ||
    !path ||
    bucketName !== BILLING_APP_BUCKET(owner.projectId) ||
    !path.startsWith(`${owner.prefix}/${owner.ownerId}/`)
  ) {
    throw INVALID_INPUT_ERROR(`Invalid Z3 URL in DocumentReference ${documentReference.id}`);
  }
  return { bucketName, path };
}

export async function presignAttachment(
  oystehr: Oystehr,
  location: Z3Location,
  action: 'upload' | 'download'
): Promise<string> {
  const result = await oystehr.z3.getPresignedUrl({
    bucketName: location.bucketName,
    'objectPath+': location.path,
    action,
  });
  return result.signedUrl;
}

// The upload happens in the browser, so the file may never have reached Z3; a missing object must
// not block removing the record.
export async function deleteAttachmentObject(oystehr: Oystehr, location: Z3Location): Promise<void> {
  try {
    await oystehr.z3.deleteObject({ bucketName: location.bucketName, 'objectPath+': location.path });
  } catch (err) {
    console.error(`Could not delete ${location.path} from z3`, err);
  }
}

// The attachment content with a new display title (the stored file keeps its name).
export function renamedAttachmentContent(
  documentReference: DocumentReference,
  title: string
): DocumentReference['content'] {
  const content = documentReference.content[0];
  if (!content) {
    throw INVALID_INPUT_ERROR(`Missing attachment information for DocumentReference ${documentReference.id}`);
  }
  return [{ ...content, attachment: { ...content.attachment, title } }, ...documentReference.content.slice(1)];
}
