import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { createOystehrClient, getSecret, PhotoIdExtraction, SecretsKeys } from 'utils';
import { getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { invokeChatbotVertexAI, VERTEX_AI_MODEL } from '../../../shared/ai';
import { downloadOcrSourceImage } from '../shared/extraction-helpers';
import {
  buildExtractionPatchOperation,
  EXTRACTION_PROMPT,
  getExistingExtraction,
  parseModelResponse,
  photoIdResponseSchema,
  sha256Hex,
} from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'extract-photo-id';

// warm-invocation cache, same as other subscription zambdas
let oystehrToken: string;

// PHI note: this handler logs only DocRef id, mime type, byte length, image hash, elapsed ms,
// and boolean outcomes. It must never log the image payload, the raw model response, or any
// extracted field value (names / DOB / license numbers are PHI).
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
    // stale). A search by _id returns nothing for deleted resources, so an ID deleted between
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

    // Fetch the ID image via presigned Z3 URL. A download failure is often transient (network
    // blip, presigned url race); returning 200 here would tell the subscription "handled" and
    // leave the ID permanently unprocessed, so re-throw and let the subscription's retry
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
      console.error(`[${ZAMBDA_NAME}] failed to fetch photo ID image for DocumentReference/${docRefId}:`, error);
      captureException(error);
      throw error;
    }

    const imageHash = sha256Hex(bytes);
    console.log(
      `[${ZAMBDA_NAME}] DocumentReference/${docRefId} mimeType=${mimeType} bytes=${bytes.length} sha256=${imageHash}`
    );

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
        imageHash,
        model: 'none',
        extractedAt: DateTime.now().toISO()!,
      });
      return {
        statusCode: 200,
        body: JSON.stringify({ documentReferenceId: docRefId, skipped: true, notAPhotoId: true }),
      };
    }

    const rawModelResponse = await invokeChatbotVertexAI(
      [{ text: EXTRACTION_PROMPT }, { inlineData: { mimeType, data: bytes.toString('base64') } }],
      secrets,
      photoIdResponseSchema,
      { suppressResponseLogging: true } // response carries ID PHI — never log it
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

    const notAPhotoId = !parsed.isPhotoId || parsed.fields === null;
    const extraction: PhotoIdExtraction = {
      version: 1,
      isPhotoId: parsed.isPhotoId,
      fields: notAPhotoId ? null : parsed.fields,
      ...(notAPhotoId ? { notAPhotoId: true } : {}),
      sourceDocRefId: docRefId,
      sourceAttachmentUrl: attachmentUrl,
      imageHash,
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
      statusCode: 200,
      body: JSON.stringify({
        documentReferenceId: docRefId,
        extracted: !notAPhotoId,
        ...(notAPhotoId && { notAPhotoId }),
      }),
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
  extraction: PhotoIdExtraction
): Promise<void> {
  await oystehr.fhir.patch({
    resourceType: 'DocumentReference',
    id: documentReference.id!,
    operations: [buildExtractionPatchOperation(documentReference.extension, extensionIndex, extraction)],
  });
}
