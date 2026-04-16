import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Questionnaire, QuestionnaireItem, QuestionnaireResponse } from 'fhir/r4b';
import { createOystehrClient, getAuth0Token, wrapHandler, ZambdaInput } from '../../../shared';

const PRACTICE_MANAGED_TAG_CODE = 'practice-managed';
const ASSOCIATED_QUESTIONNAIRE_EXTENSION_URL = 'https://fhir.ottehr.com/StructureDefinitions/associated-questionnaire';

/**
 * Determines the linkId of the last "data collection" page in the intake questionnaire.
 * Practice-managed forms should be inserted after this page.
 *
 * Finalization pages are identified by their content:
 * - Pages containing signature fields (linkId includes 'signature' or 'full-name' as direct children of consent groups)
 * - Pages containing consent checkboxes (linkId includes 'consent')
 * - Pages with the medical-history chatbot (linkId includes 'medical-history' with a boolean-type child)
 *
 * The last page before the first finalization page is the insertion point.
 */
function findInsertionPoint(items: QuestionnaireItem[]): string | undefined {
  const isFinalizationPage = (page: QuestionnaireItem): boolean => {
    const linkId = (page.linkId || '').toLowerCase();
    // Consent/signature pages
    if (linkId.includes('consent')) return true;
    // Medical history chatbot page (typically has a single boolean item)
    if (linkId.includes('medical-history')) return true;
    // Check children for signature-type fields
    const hasSignature = page.item?.some((child) => {
      const childLinkId = (child.linkId || '').toLowerCase();
      return childLinkId.includes('signature') || childLinkId === 'full-name';
    });
    if (hasSignature) return true;
    return false;
  };

  // Walk pages in order; return the linkId of the page just before the first finalization page
  const pages = items.filter((item) => item.type === 'group');
  for (let i = 0; i < pages.length; i++) {
    if (isFinalizationPage(pages[i])) {
      // Return the previous page's linkId, or undefined if finalization is the first page
      return i > 0 ? pages[i - 1].linkId : undefined;
    }
  }
  // No finalization pages found — insert after the last page
  return pages.length > 0 ? pages[pages.length - 1].linkId : undefined;
}

let oystehrToken: string;

export const index = wrapHandler(
  'get-practice-managed-questionnaires',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.body) throw new Error('No request body provided');
    const { appointmentId, intakeQuestionnaireUrl } = JSON.parse(input.body) as {
      appointmentId: string;
      intakeQuestionnaireUrl?: string;
    };

    if (!appointmentId) throw new Error('appointmentId is required');
    if (!input.secrets) throw new Error('No secrets provided');

    if (!oystehrToken) {
      oystehrToken = await getAuth0Token(input.secrets);
    }
    const oystehr = createOystehrClient(oystehrToken, input.secrets);

    // Look up the encounter for this appointment to get encounterId and patientId
    const encounters = (
      await oystehr.fhir.search<Encounter>({
        resourceType: 'Encounter',
        params: [{ name: 'appointment', value: appointmentId }],
      })
    ).unbundle();
    const encounter = encounters[0];
    const encounterId = encounter?.id || '';
    const patientId = encounter?.subject?.reference?.replace('Patient/', '') || '';

    // If the caller didn't provide the intake questionnaire URL, look it up from the encounter's QR
    let intakeUrl = intakeQuestionnaireUrl;
    if (!intakeUrl && encounterId) {
      const qrs = (
        await oystehr.fhir.search<QuestionnaireResponse>({
          resourceType: 'QuestionnaireResponse',
          params: [
            { name: 'encounter', value: `Encounter/${encounterId}` },
            { name: '_sort', value: '-_lastUpdated' },
            { name: '_count', value: '10' },
          ],
        })
      ).unbundle();

      // Find the intake QR by excluding practice-managed tagged QRs
      const PRACTICE_MANAGED_QR_TAG_CODE = 'practice-managed';
      const intakeQr = qrs.find(
        (qr) => qr.questionnaire && !qr.meta?.tag?.some((t) => t.code === PRACTICE_MANAGED_QR_TAG_CODE)
      );
      if (intakeQr?.questionnaire) {
        intakeUrl = intakeQr.questionnaire.split('|')[0];
      }
    }

    if (!intakeUrl) {
      return {
        statusCode: 200,
        body: JSON.stringify({ questionnaires: [], encounterId, patientId }),
      };
    }

    // Fetch the intake questionnaire to determine the insertion point
    const intakeQuestionnaires = (
      await oystehr.fhir.search<Questionnaire>({
        resourceType: 'Questionnaire',
        params: [
          { name: 'url', value: intakeUrl },
          { name: '_sort', value: '-_lastUpdated' },
          { name: '_count', value: '1' },
        ],
      })
    ).unbundle();
    const intakeQuestionnaire = intakeQuestionnaires[0];
    const insertAfterPageLinkId = intakeQuestionnaire ? findInsertionPoint(intakeQuestionnaire.item || []) : undefined;

    // Find practice-managed questionnaires associated with this intake URL
    const allPracticeManaged = (
      await oystehr.fhir.search<Questionnaire>({
        resourceType: 'Questionnaire',
        params: [
          { name: '_tag', value: PRACTICE_MANAGED_TAG_CODE },
          { name: 'status', value: 'active' },
        ],
      })
    ).unbundle();

    const associated = allPracticeManaged.filter(
      (q) =>
        q.extension?.some((ext) => ext.url === ASSOCIATED_QUESTIONNAIRE_EXTENSION_URL && ext.valueUri === intakeUrl)
    );

    if (associated.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ questionnaires: [] }),
      };
    }

    // Check for existing QRs for each practice-managed questionnaire on this encounter
    const existingQrs = encounterId
      ? (
          await oystehr.fhir.search<QuestionnaireResponse>({
            resourceType: 'QuestionnaireResponse',
            params: [{ name: 'encounter', value: `Encounter/${encounterId}` }],
          })
        ).unbundle()
      : [];

    const questionnaires = associated.map((q) => {
      const matchingQr = existingQrs.find((qr) => qr.questionnaire?.split('|')[0] === q.url);
      return {
        id: q.id,
        url: q.url,
        version: q.version,
        title: q.title || q.name || 'Untitled',
        status: q.status,
        questionnaireResponseId: matchingQr?.id,
        questionnaireResponseStatus: matchingQr?.status,
        questionnaireResponseItems: matchingQr?.item,
        item: q.item,
      };
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ questionnaires, encounterId, patientId, insertAfterPageLinkId }),
    };
  }
);
