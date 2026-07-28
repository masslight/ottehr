import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  createOystehrClient,
  DocumentType,
  getSecret,
  InsuranceCardExtraction,
  MimeType,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  createPresignedUrl,
  getAuth0Token,
  topLevelCatch,
  uploadObjectToZ3,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { invokeChatbotVertexAI, VERTEX_AI_MODEL } from '../../../shared/ai';
import { downloadOcrSourceImage } from '../shared/extraction-helpers';
import {
  buildAttachmentMetadataOperations,
  buildExtractionPatchOperation,
  EXTRACTION_PROMPT,
  getExistingExtraction,
  insuranceCardResponseSchema,
  parseModelResponse,
  sha256Hex,
} from './helpers';
import { NORMALIZABLE_CONTENT_TYPES, normalizeInsuranceCardImage } from './normalize-image';
import { CARD_IMAGE_TITLES, validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'extract-insurance-card';

// warm-invocation cache, persisted across warm Lambda invocations
let oystehrToken: string;

export interface InsuranceCardExtractionResult {
  documentReferenceId: string;
  skipped?: boolean;
  skipReason?: string;
  alreadyProcessed?: boolean;
  extracted?: boolean;
  notACard?: boolean;
  fields?: InsuranceCardExtraction['fields'];
}

// The reusable core: takes a caller-provided Oystehr client + token rather than making its own,
// so index() (below) is a thin wrapper and any future caller can reuse an already-warm client.
export async function runInsuranceCardExtraction(
  docRefId: string,
  oystehr: Oystehr,
  oystehrToken: string,
  secrets: Secrets | null
): Promise<InsuranceCardExtractionResult> {
  // Idempotency, phase 1 (cheap): re-read the DocumentReference (a caller-supplied id can be
  // stale). A search by _id returns nothing for deleted resources, so a card deleted between
  // upload and extraction is a clean no-op rather than a retry loop.
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

  const cardSlot = current.content?.[0]?.attachment?.title;
  if (!cardSlot || !CARD_IMAGE_TITLES.includes(cardSlot as DocumentType)) {
    const skipReason = `attachment title '${cardSlot ?? '<none>'}' is not an insurance card image slot`;
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

  // Fetch the card image via presigned Z3 URL. A download failure is often transient (network
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
    console.error(`[${ZAMBDA_NAME}] failed to fetch card image for DocumentReference/${docRefId}:`, error);
    captureException(error);
    throw error;
  }

  let imageHash = sha256Hex(bytes);
  console.log(
    `[${ZAMBDA_NAME}] DocumentReference/${docRefId} slot=${cardSlot} mimeType=${mimeType} bytes=${bytes.length} sha256=${imageHash}`
  );

  if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
    // unprocessable content is a permanent condition — write the marker so retries stop
    console.log(`[${ZAMBDA_NAME}] unsupported content type '${mimeType}'; writing notACard marker`);
    await writeExtraction(oystehr, current, extensionIndex, {
      version: 1,
      isInsuranceCard: false,
      fields: null,
      readable: null,
      notACard: true,
      sourceDocRefId: docRefId,
      sourceAttachmentUrl: attachmentUrl,
      imageHash,
      model: 'none',
      extractedAt: DateTime.now().toISO()!,
    });
    return { documentReferenceId: docRefId, skipped: true, notACard: true };
  }

  // Normalize the stored image (bake the EXIF orientation into the pixels, downscale oversized
  // photos) so display, OCR, and the PDF composer all get an upright, right-sized image. The
  // normalized bytes are re-stored to the SAME Z3 object, so the attachment URL — the extraction
  // idempotency key above — never changes. A normalization or re-store failure is reported and
  // the pipeline falls back to the ORIGINAL bytes: an upside-down card must never block extraction.
  if ((NORMALIZABLE_CONTENT_TYPES as readonly string[]).includes(mimeType)) {
    let normalized;
    try {
      normalized = await normalizeInsuranceCardImage(bytes, mimeType);
    } catch (error) {
      console.error(
        `[${ZAMBDA_NAME}] image normalization failed for DocumentReference/${docRefId}; continuing with the original image:`,
        error
      );
      captureException(error);
    }

    if (normalized?.changed) {
      try {
        const uploadUrl = await createPresignedUrl(oystehrToken, attachmentUrl, 'upload');
        await uploadObjectToZ3(
          new Uint8Array(normalized.bytes.buffer, normalized.bytes.byteOffset, normalized.bytes.byteLength),
          uploadUrl,
          normalized.contentType as MimeType
        );

        // The stored object is now the normalized image: OCR and the stored imageHash must
        // describe it, not the original upload.
        bytes = normalized.bytes;
        mimeType = normalized.contentType;
        imageHash = sha256Hex(bytes);
        console.log(
          `[${ZAMBDA_NAME}] normalized card image for DocumentReference/${docRefId}: ${normalized.width}x${normalized.height} mimeType=${mimeType} bytes=${bytes.length} sha256=${imageHash}`
        );

        // Keep the attachment metadata honest. Non-fatal: the object itself is already
        // normalized, so a failed metadata patch must not abandon the normalized bytes.
        const metadataOperations = buildAttachmentMetadataOperations(current, mimeType, bytes.length);
        if (metadataOperations.length > 0) {
          try {
            await oystehr.fhir.patch({
              resourceType: 'DocumentReference',
              id: docRefId,
              operations: metadataOperations,
            });
          } catch (error) {
            console.error(
              `[${ZAMBDA_NAME}] failed to patch attachment metadata for DocumentReference/${docRefId}:`,
              error
            );
            captureException(error);
          }
        }
      } catch (error) {
        // Re-store failed, so the stored object is still the original upload: fall back to the
        // original bytes for both OCR and imageHash so the hash matches what is actually stored.
        console.error(
          `[${ZAMBDA_NAME}] failed to re-store normalized card image for DocumentReference/${docRefId}; continuing with the original image:`,
          error
        );
        captureException(error);
      }
    } else if (normalized) {
      console.log(`[${ZAMBDA_NAME}] card image for DocumentReference/${docRefId} is already normalized`);
    }
  }

  const rawModelResponse = await invokeChatbotVertexAI(
    [{ text: EXTRACTION_PROMPT }, { inlineData: { mimeType, data: bytes.toString('base64') } }],
    secrets,
    insuranceCardResponseSchema
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

  const notACard = !parsed.isInsuranceCard || parsed.fields === null;
  const extraction: InsuranceCardExtraction = {
    version: 1,
    isInsuranceCard: parsed.isInsuranceCard,
    fields: notACard ? null : parsed.fields,
    // orientation signal from the same model call; parseModelResponse already nulls it on the
    // notACard / all-null paths so nothing is fabricated
    readable: notACard ? null : parsed.readable,
    ...(notACard ? { notACard: true } : {}),
    sourceDocRefId: docRefId,
    sourceAttachmentUrl: attachmentUrl,
    imageHash,
    model: VERTEX_AI_MODEL,
    extractedAt: DateTime.now().toISO()!,
  };

  await writeExtraction(oystehr, current, extensionIndex, extraction);

  console.log(
    `[${ZAMBDA_NAME}] stored extraction for DocumentReference/${docRefId}: extracted=${!notACard} notACard=${notACard} readable=${
      extraction.readable
    } elapsedMs=${Date.now() - startedAt}`
  );

  return {
    documentReferenceId: docRefId,
    extracted: !notACard,
    ...(notACard && { notACard }),
    fields: extraction.fields,
  };
}

// Called directly by the EHR frontend with the id of a just-created card DocumentReference;
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

    const result = await runInsuranceCardExtraction(documentReferenceId, oystehr, oystehrToken, secrets);
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
  extraction: InsuranceCardExtraction
): Promise<void> {
  await oystehr.fhir.patch({
    resourceType: 'DocumentReference',
    id: documentReference.id!,
    operations: [buildExtractionPatchOperation(documentReference.extension, extensionIndex, extraction)],
  });
}
