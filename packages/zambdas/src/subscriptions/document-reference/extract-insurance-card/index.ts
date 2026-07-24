import { createHash } from 'node:crypto';
import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { createOystehrClient, getPresignedURL, getSecret, InsuranceCardExtraction, SecretsKeys } from 'utils';
import { getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { invokeChatbotVertexAI, VERTEX_AI_MODEL } from '../../../shared/ai';
import {
  buildExtractionPatchOperation,
  EXTRACTION_PROMPT,
  getExistingExtraction,
  insuranceCardResponseSchema,
  parseModelResponse,
} from './helpers';
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

    // Fetch the card image via presigned Z3 URL. An unreadable / undownloadable image must not
    // crash the subscription: report it and no-op (no marker is written, so a re-fire or
    // re-upload can still succeed later).
    const startedAt = Date.now();
    let bytes: Buffer;
    let mimeType: string;
    try {
      const presignedUrl = await getPresignedURL(attachmentUrl, oystehrToken);
      const imageResponse = await fetch(presignedUrl);
      if (!imageResponse.ok) {
        throw new Error(
          `Failed to download card image for DocumentReference/${docRefId}: HTTP ${imageResponse.status}`
        );
      }
      bytes = Buffer.from(await imageResponse.arrayBuffer());
      // Z3 returns the generic application/octet-stream when the object's content type wasn't
      // recorded at upload time; that tells us nothing about the actual image, so fall back to
      // the attachment's own contentType instead of treating a real card image as unsupported.
      const fetchedContentType = imageResponse.headers.get('Content-Type')?.split(';')[0].trim();
      mimeType =
        fetchedContentType && fetchedContentType !== 'application/octet-stream'
          ? fetchedContentType
          : current.content?.[0]?.attachment?.contentType?.split(';')[0].trim() ?? 'image/jpeg';
    } catch (error) {
      // Retryable, not a permanent skip: a download failure is often transient (network blip,
      // presigned url race), and returning 200 here would tell the subscription "handled" and
      // leave the card permanently unprocessed. Re-throw so the subscription's retry semantics
      // (same pattern as the parseModelResponse failure below) get another attempt.
      console.error(`[${ZAMBDA_NAME}] failed to fetch card image for DocumentReference/${docRefId}:`, error);
      captureException(error);
      throw error;
    }

    // Uint8Array view (no copy): this workspace's @types/node rejects Buffer for BinaryLike
    const imageHash = createHash('sha256')
      .update(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength))
      .digest('hex');
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
      ...(notACard ? { notACard: true } : {}),
      sourceDocRefId: docRefId,
      sourceAttachmentUrl: attachmentUrl,
      imageHash,
      model: VERTEX_AI_MODEL,
      extractedAt: DateTime.now().toISO()!,
    };

    await writeExtraction(oystehr, current, extensionIndex, extraction);

    console.log(
      `[${ZAMBDA_NAME}] stored extraction for DocumentReference/${docRefId}: extracted=${!notACard} notACard=${notACard} elapsedMs=${
        Date.now() - startedAt
      }`
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
