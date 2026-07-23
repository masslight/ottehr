import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { DocumentReference } from 'fhir/r4b';
import {
  FHIR_RESOURCE_NOT_FOUND,
  getPresignedURL,
  INSURANCE_CARD_IMAGE_ERROR,
  MimeType,
  RotateInsuranceCardImageResponse,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  createPresignedUrl,
  uploadObjectToZ3,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import {
  buildAttachmentMetadataOperations,
  buildExtractionPatchOperation,
  getExistingExtraction,
  sha256Hex,
} from '../../subscriptions/document-reference/extract-insurance-card/helpers';
import {
  RotatedInsuranceCardImage,
  rotateImageClockwise,
} from '../../subscriptions/document-reference/extract-insurance-card/normalize-image';
import { assertRotatableCardImage } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'rotate-insurance-card-image';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

// PHI note: this handler logs only DocRef id, rotation angle, byte lengths, and boolean outcomes.
// It must never log the image payload or any extracted card field value (member IDs / names are PHI).
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { documentReferenceId, rotationDegrees, secrets } = validateRequestParameters(input);
  console.log(`[${ZAMBDA_NAME}] DocumentReference/${documentReferenceId}: rotating ${rotationDegrees}deg clockwise`);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // Search by _id (not read): a deleted DocumentReference yields an empty result rather than an
  // SDK error, so "gone" maps cleanly to the structured not-found error.
  const documentReference = (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [{ name: '_id', value: documentReferenceId }],
    })
  ).unbundle()[0];
  if (!documentReference) {
    throw FHIR_RESOURCE_NOT_FOUND('DocumentReference');
  }

  // throws structured INVALID_INPUT_ERRORs for anything that is not a current card image
  const attachment = assertRotatableCardImage(documentReference);
  const attachmentUrl = attachment.url;

  let bytes: Buffer;
  try {
    const presignedUrl = await getPresignedURL(attachmentUrl, m2mToken);
    const imageResponse = await fetch(presignedUrl);
    if (!imageResponse.ok) {
      throw new Error(
        `Failed to download card image for DocumentReference/${documentReferenceId}: HTTP ${imageResponse.status}`
      );
    }
    bytes = Buffer.from(await imageResponse.arrayBuffer());
  } catch (error) {
    console.error(`[${ZAMBDA_NAME}] failed to fetch card image for DocumentReference/${documentReferenceId}:`, error);
    captureException(error);
    throw INSURANCE_CARD_IMAGE_ERROR('The card image could not be downloaded. Please try again.');
  }

  let rotated: RotatedInsuranceCardImage;
  try {
    rotated = await rotateImageClockwise(bytes, rotationDegrees);
  } catch (error) {
    console.error(`[${ZAMBDA_NAME}] failed to rotate card image for DocumentReference/${documentReferenceId}:`, error);
    captureException(error);
    throw INSURANCE_CARD_IMAGE_ERROR('The card image could not be rotated; it may not be a valid image.');
  }

  // Re-store the rotated bytes to the SAME Z3 object without touching the url itself, so anything
  // that reads the attachment url ON DEMAND (image display, on-demand PDF composition) picks up the
  // fix. NOTE: any PRE-composed and stored artifact — e.g. the fullInsuranceCard PDF composed at
  // paperwork submit and surfaced via get-visit-files — still contains the old pixels and stays
  // stale until it is regenerated. A failure here means the stored object is unchanged, so erroring
  // out is retry-safe.
  try {
    const uploadUrl = await createPresignedUrl(m2mToken, attachmentUrl, 'upload');
    await uploadObjectToZ3(
      new Uint8Array(rotated.bytes.buffer, rotated.bytes.byteOffset, rotated.bytes.byteLength),
      uploadUrl,
      rotated.contentType as MimeType
    );
  } catch (error) {
    console.error(
      `[${ZAMBDA_NAME}] failed to re-store rotated card image for DocumentReference/${documentReferenceId}:`,
      error
    );
    captureException(error);
    throw INSURANCE_CARD_IMAGE_ERROR('The rotated card image could not be stored. Please try again.');
  }

  console.log(
    `[${ZAMBDA_NAME}] re-stored DocumentReference/${documentReferenceId}: ${rotated.width}x${rotated.height} bytes=${rotated.bytes.length}`
  );

  // Keep the DocumentReference honest about the new stored object: attachment contentType/size,
  // plus the insurance-card extraction extension when one exists — the staff member just fixed the
  // orientation by hand, so the model's stale `readable` judgment is reset to null (clearing the
  // "looks rotated" hint) and imageHash is updated to describe the stored bytes. A DocRef without
  // the extraction extension (extraction pending or feature off) skips that part gracefully.
  const operations: Operation[] = buildAttachmentMetadataOperations(
    documentReference,
    rotated.contentType,
    rotated.bytes.length
  );
  const { extraction, extensionIndex } = getExistingExtraction(documentReference.extension);
  if (extraction) {
    operations.push(
      buildExtractionPatchOperation(documentReference.extension, extensionIndex, {
        ...extraction,
        readable: null,
        imageHash: sha256Hex(rotated.bytes),
      })
    );
  }

  if (operations.length > 0) {
    try {
      await oystehr.fhir.patch({ resourceType: 'DocumentReference', id: documentReferenceId, operations });
    } catch (error) {
      // Non-fatal by design: the stored image IS already rotated. Failing the request here would
      // invite the staff member to click rotate again and double-rotate the card, so report the
      // stale metadata and return success.
      console.error(
        `[${ZAMBDA_NAME}] failed to patch DocumentReference/${documentReferenceId} after rotate (image already re-stored):`,
        error
      );
      captureException(error);
    }
  }

  const response: RotateInsuranceCardImageResponse = { documentReferenceId, rotated: true };
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
