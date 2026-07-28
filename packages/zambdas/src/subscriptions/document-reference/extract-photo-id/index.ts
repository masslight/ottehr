import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { createOystehrClient, DocumentType, getSecret, PhotoIdExtraction, Secrets, SecretsKeys } from 'utils';
import { getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { invokeChatbotVertexAI, VERTEX_AI_MODEL } from '../../../shared/ai';
import { downloadOcrSourceImage } from '../shared/extraction-helpers';
import {
  buildExtractionPatchOperation,
  EXTRACTION_PROMPT,
  getExistingExtraction,
  parseModelResponse,
  photoIdResponseSchema,
} from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Only the FRONT image is extracted. Other titles sharing the 55188-7 type code (the
// 'photo-id-back' image and the 'fullPhotoIDCard' PDFs) are skipped, not errored.

const ZAMBDA_NAME = 'extract-photo-id';

let oystehrToken: string;

export interface PhotoIdExtractionResult {
  documentReferenceId: string;
  skipped?: boolean;
  skipReason?: string;
  alreadyProcessed?: boolean;
  extracted?: boolean;
  notAPhotoId?: boolean;
  fields?: PhotoIdExtraction['fields'];
}

// The reusable core: takes a caller-provided Oystehr client + token rather than making its own,
// so index() (below) is a thin wrapper and any future caller can reuse an already-warm client.
export async function runPhotoIdExtraction(
  docRefId: string,
  oystehr: Oystehr,
  oystehrToken: string,
  secrets: Secrets | null
): Promise<PhotoIdExtractionResult> {
  // The caller only has an id, not the resource — fetch it to get the title, attachment url, and
  // any existing extension. This also doubles as a freshness check: a search by _id returns
  // nothing for deleted resources, so an ID deleted between upload and extraction is a clean
  // no-op rather than a retry loop.
  const current = (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [{ name: '_id', value: docRefId }],
    })
  ).unbundle()[0];

  if (!current || current.status !== 'current') {
    console.log(
      `[${ZAMBDA_NAME}] DocumentReference/${docRefId} is ${
        current ? current.status : 'gone'
      }; superseded between upload and extraction — skipping`
    );
    return { documentReferenceId: docRefId, skipped: true };
  }

  const title = current.content?.[0]?.attachment?.title;
  if (title !== DocumentType.PhotoIdFront) {
    const skipReason = `attachment title '${title ?? '<none>'}' is not the photo ID front image slot`;
    console.log(`[${ZAMBDA_NAME}] DocumentReference/${docRefId}: ${skipReason}`);
    return { documentReferenceId: docRefId, skipped: true, skipReason };
  }

  const attachmentUrl = current.content?.[0]?.attachment?.url;
  if (!attachmentUrl) {
    console.log(`[${ZAMBDA_NAME}] DocumentReference/${docRefId} has no attachment URL; skipping`);
    return { documentReferenceId: docRefId, skipped: true, skipReason: 'no attachment URL' };
  }

  const { extraction: existingExtraction, extensionIndex } = getExistingExtraction(current.extension);
  if (existingExtraction?.sourceAttachmentUrl === attachmentUrl) {
    console.log(
      `[${ZAMBDA_NAME}] DocumentReference/${docRefId} already carries an extraction for this attachment; skipping (idempotent no-op)`
    );
    return {
      documentReferenceId: docRefId,
      alreadyProcessed: true,
      extracted: existingExtraction.fields != null,
      fields: existingExtraction.fields,
    };
  }

  // Fetch the ID image via presigned Z3 URL. A download failure is often transient (network
  // blip, presigned url race); a caller that treats a thrown error as "try again" gets another
  // attempt (same pattern as the parseModelResponse failure below).
  const startedAt = Date.now();
  let bytes: Buffer;
  let mimeType: string;
  try {
    ({ bytes, mimeType } = await downloadOcrSourceImage({
      attachmentUrl,
      token: oystehrToken,
      fallbackContentType: current.content?.[0]?.attachment?.contentType,
    }));
  } catch (error) {
    console.error(`[${ZAMBDA_NAME}] failed to fetch photo ID image for DocumentReference/${docRefId}:`, error);
    captureException(error);
    throw error;
  }

  console.log(`[${ZAMBDA_NAME}] DocumentReference/${docRefId} mimeType=${mimeType} bytes=${bytes.length}`);

  if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
    // unprocessable content is a permanent condition — write the marker so retries stop
    console.log(`[${ZAMBDA_NAME}] unsupported content type '${mimeType}'; writing notAPhotoId marker`);
    await writeExtraction(oystehr, current, extensionIndex, {
      version: 1,
      isPhotoId: false,
      fields: null,
      notAPhotoId: true,
      sourceDocRefId: docRefId,
      sourceAttachmentUrl: attachmentUrl,
      model: 'none',
      extractedAt: DateTime.now().toISO()!,
    });
    return { documentReferenceId: docRefId, skipped: true, notAPhotoId: true };
  }

  const rawModelResponse = await invokeChatbotVertexAI(
    [{ text: EXTRACTION_PROMPT }, { inlineData: { mimeType, data: bytes.toString('base64') } }],
    secrets,
    photoIdResponseSchema
  );

  let parsed;
  try {
    parsed = parseModelResponse(rawModelResponse);
  } catch (error) {
    // Malformed JSON after the helper's own retries is a transient model-quality failure —
    // re-throw so a caller that retries on error gets another attempt.
    console.error(`[${ZAMBDA_NAME}] failed to parse model response for DocumentReference/${docRefId}`);
    captureException(error);
    throw error;
  }

  const notAPhotoId = !parsed.isPhotoId || parsed.fields === null;
  const extraction: PhotoIdExtraction = {
    version: 1,
    isPhotoId: parsed.isPhotoId,
    fields: notAPhotoId ? null : parsed.fields,
    ...(notAPhotoId ? { notAPhotoId: true } : {}),
    sourceDocRefId: docRefId,
    sourceAttachmentUrl: attachmentUrl,
    model: VERTEX_AI_MODEL,
    extractedAt: DateTime.now().toISO()!,
  };

  await writeExtraction(oystehr, current, extensionIndex, extraction);

  console.log(
    `[${ZAMBDA_NAME}] stored extraction for DocumentReference/${docRefId}: extracted=${!notAPhotoId} notAPhotoId=${notAPhotoId} elapsedMs=${
      Date.now() - startedAt
    }`
  );

  return {
    documentReferenceId: docRefId,
    extracted: !notAPhotoId,
    ...(notAPhotoId && { notAPhotoId }),
    fields: extraction.fields,
  };
}

// Called directly by the EHR frontend with the id of a just-created photo ID DocumentReference;
// runs OCR and returns the suggestions synchronously.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { documentReferenceId, secrets } = validateRequestParameters(input);

    if (!oystehrToken) {
      oystehrToken = await getAuth0Token(secrets);
    }

    const oystehr = createOystehrClient(
      oystehrToken,
      getSecret(SecretsKeys.FHIR_API, secrets),
      getSecret(SecretsKeys.PROJECT_API, secrets)
    );

    const result = await runPhotoIdExtraction(documentReferenceId, oystehr, oystehrToken, secrets);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

async function writeExtraction(
  oystehr: Oystehr,
  documentReference: DocumentReference,
  extensionIndex: number,
  extraction: PhotoIdExtraction
): Promise<void> {
  await oystehr.fhir.patch({
    resourceType: 'DocumentReference',
    id: documentReference.id!,
    operations: [buildExtractionPatchOperation(documentReference.extension, extensionIndex, extraction)],
  });
}
