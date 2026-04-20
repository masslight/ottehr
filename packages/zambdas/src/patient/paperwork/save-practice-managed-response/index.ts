import { APIGatewayProxyResult } from 'aws-lambda';
import { QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { createOystehrClient, getAuth0Token, wrapHandler, ZambdaInput } from '../../../shared';

const PRACTICE_MANAGED_QR_TAG = {
  system: 'https://fhir.ottehr.com/CodeSystem/questionnaire-response-type',
  code: 'practice-managed',
};

let oystehrToken: string;

export const index = wrapHandler(
  'save-practice-managed-response',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.body) throw new Error('No request body provided');
    if (!input.secrets) throw new Error('No secrets provided');

    const {
      questionnaireResponseId,
      questionnaireUrl,
      questionnaireVersion,
      encounterId,
      patientId,
      pageIndex,
      answers,
    } = JSON.parse(input.body) as {
      questionnaireResponseId?: string;
      questionnaireUrl: string;
      questionnaireVersion?: string;
      encounterId: string;
      patientId: string;
      pageIndex: number;
      answers: QuestionnaireResponseItem;
    };

    if (!questionnaireUrl) throw new Error('questionnaireUrl is required');
    if (!patientId) throw new Error('patientId is required');
    // encounterId is optional — patient-level forms (sent from the patient
    // profile, not a specific visit) have no associated encounter.

    if (!oystehrToken) {
      oystehrToken = await getAuth0Token(input.secrets);
    }
    const oystehr = createOystehrClient(oystehrToken, input.secrets);

    const canonicalRef = questionnaireVersion ? `${questionnaireUrl}|${questionnaireVersion}` : questionnaireUrl;

    if (questionnaireResponseId) {
      // Patch existing QR — update the page at pageIndex
      const existing = await oystehr.fhir.get<QuestionnaireResponse>({
        resourceType: 'QuestionnaireResponse',
        id: questionnaireResponseId,
      });

      const items = existing.item || [];
      // Ensure the array is large enough
      while (items.length <= pageIndex) {
        items.push({ linkId: `page-${items.length}` });
      }
      items[pageIndex] = answers;

      const updated = await oystehr.fhir.update<QuestionnaireResponse>({
        ...existing,
        item: items,
        status: 'in-progress',
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          questionnaireResponseId: updated.id,
          status: updated.status,
        }),
      };
    } else {
      // Create new QR with practice-managed tag for identification
      const newQr: QuestionnaireResponse = {
        resourceType: 'QuestionnaireResponse',
        meta: { tag: [PRACTICE_MANAGED_QR_TAG] },
        questionnaire: canonicalRef,
        status: 'in-progress',
        subject: { reference: `Patient/${patientId}` },
        ...(encounterId ? { encounter: { reference: `Encounter/${encounterId}` } } : {}),
        item: [answers],
      };

      const created = await oystehr.fhir.create<QuestionnaireResponse>(newQr);

      return {
        statusCode: 200,
        body: JSON.stringify({
          questionnaireResponseId: created.id,
          status: created.status,
        }),
      };
    }
  }
);
