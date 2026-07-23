import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { createOystehrClient, getSecret, InsuranceCardExtraction, MimeType, SecretsKeys } from 'utils';
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
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'extract-insurance-card';

// warm-invocation cache, same as other subscription zambdas
let oystehrToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`[${ZAMBDA_NAME}] handler start, body length: ${input.body?.length ?? 0}`);

  try {
    const validated = validateRequestParameters(input);
    const { secrets, documentReference } = validated;

    if (validated.skip) {
      console.log(`[${ZAMBDA_NAME}] skipping DocumentReference/${documentReference.id}: ${validated.skipReason}`);
      return {
        statusCode: 200,
        body: JSON.stringify({ documentReferenceId: documentReference.id, skipped: true }),
      };
    }

    const { cardSlot } = validated;
    const docRefId = documentReference.id!;

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(
      oystehrToken,
      getSecret(SecretsKeys.FHIR_API, secrets),
      getSecret(SecretsKeys.PROJECT_API, secrets)
    );

    // Idempotency, phase 1 (cheap): re-read the DocumentReference (subscription payloads can be
    // stale). A search by _id returns nothing for deleted resources, so a card deleted between
    // trigger and execution is a clean no-op rather than a retry loop.
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
        }; superseded between trigger and execution — skipping`
      );
      return {
        statusCode: 200,
        body: JSON.stringify({ documentReferenceId: docRefId, skipped: true }),
      };
    }

    // Re-uploads supersede the old DocRef and create a new one, so on the same DocRef a matching
    // sourceAttachmentUrl means this is a repeat fire, not new content.
    const attachmentUrl = current.content?.[0]?.attachment?.url ?? validated.attachmentUrl;
    const { extraction: existingExtraction, extensionIndex } = getExistingExtraction(current.extension);
    if (existingExtraction?.sourceAttachmentUrl === attachmentUrl) {
      console.log(
        `[${ZAMBDA_NAME}] DocumentReference/${docRefId} already carries an extraction for this attachment; skipping (idempotent no-op)`
      );
      return {
        statusCode: 200,
        body: JSON.stringify({ documentReferenceId: docRefId, alreadyProcessed: true }),
      };
    }

    // Fetch the card image via presigned Z3 URL. A download failure is often transient (network
    // blip, presigned url race); returning 200 here would tell the subscription "handled" and
    // leave the card permanently unprocessed, so re-throw and let the subscription's retry
    // semantics (same pattern as the parseModelResponse failure below) get another attempt.
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
      return {
        statusCode: 200,
        body: JSON.stringify({ documentReferenceId: docRefId, skipped: true, notACard: true }),
      };
    }

    // Normalize the stored image (bake the EXIF orientation into the pixels, downscale oversized
    // photos) so display, OCR, and the PDF composer all get an upright, right-sized image. The
    // normalized bytes are re-stored to the SAME Z3 object, so the attachment URL — the extraction
    // idempotency key above — never changes; and because this subscription fires on CREATE only
    // (SubscriptionTriggerEvent=create in config/oystehr-core/zambdas.json), patching the
    // DocumentReference here cannot re-trigger this zambda. A normalization or re-store failure is
    // reported and the pipeline falls back to the ORIGINAL bytes: an upside-down card must never
    // block extraction.
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
      // Malformed JSON after the helper's own retries is a transient model-quality failure:
      // report it and re-throw so the subscription's retry semantics get another attempt.
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
      statusCode: 200,
      body: JSON.stringify({ documentReferenceId: docRefId, extracted: !notACard, ...(notACard && { notACard }) }),
    };
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
