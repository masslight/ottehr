import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Questionnaire, QuestionnaireItem, QuestionnaireResponse } from 'fhir/r4b';
import {
  getAllFhirSearchPages,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  PRACTICE_MANAGED_QR_TAG,
  PRACTICE_MANAGED_QUESTIONNAIRE_TAG,
} from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  getUser,
  userHasAccessToPatient,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';

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
    if (!input.body) throw MISSING_REQUEST_BODY;
    const {
      appointmentId,
      patientId: directPatientId,
      intakeQuestionnaireUrl,
      questionnaireId: directQuestionnaireId,
    } = JSON.parse(input.body) as {
      appointmentId?: string;
      patientId?: string;
      intakeQuestionnaireUrl?: string;
      questionnaireId?: string;
    };

    if (!appointmentId && !directPatientId) {
      throw INVALID_INPUT_ERROR('appointmentId or patientId is required');
    }
    if (!input.secrets) throw new Error('No secrets provided');

    if (!oystehrToken) {
      oystehrToken = await getAuth0Token(input.secrets);
    }
    const oystehr = createOystehrClient(oystehrToken, input.secrets);

    // Resolve encounterId (appointment-scoped) and patientId. Patient-level
    // sends (from the patient profile) pass patientId directly and have no
    // associated encounter.
    let encounterId = '';
    let patientId = directPatientId || '';
    if (appointmentId) {
      const encounters = (
        await oystehr.fhir.search<Encounter>({
          resourceType: 'Encounter',
          params: [{ name: 'appointment', value: appointmentId }],
        })
      ).unbundle();
      const encounter = encounters[0];
      encounterId = encounter?.id || '';
      patientId = patientId || encounter?.subject?.reference?.replace('Patient/', '') || '';
    }

    // Authorization: the caller must be connected to the patient (or be an EHR user —
    // userHasAccessToPatient allows those implicitly). Without this, any authenticated
    // account could read another patient's forms AND their QuestionnaireResponse answers
    // by guessing/replaying an appointment id.
    if (patientId) {
      const callerToken = input.headers?.Authorization?.replace('Bearer ', '');
      const caller = callerToken ? await getUser(callerToken, input.secrets).catch(() => undefined) : undefined;
      const hasAccess = caller ? await userHasAccessToPatient(caller, patientId, oystehr) : false;
      if (!hasAccess) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: 'ACCESS_DENIED', message: 'You do not have access to this form.' }),
        };
      }
    }

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
      const intakeQr = qrs.find(
        (qr) => qr.questionnaire && !qr.meta?.tag?.some((t) => t.code === PRACTICE_MANAGED_QR_TAG.code)
      );
      if (intakeQr?.questionnaire) {
        intakeUrl = intakeQr.questionnaire.split('|')[0];
      }
    }

    // Standalone form by direct id. Works for both visit-scoped
    // (/forms/:appointmentId/:questionnaireId) and patient-scoped
    // (/forms/patient/:patientId/:questionnaireId) URLs and does NOT require
    // an intake QR to already exist on the encounter — sent forms must open
    // before the patient has started intake paperwork.
    if (directQuestionnaireId) {
      const allPracticeManaged = await getAllFhirSearchPages<Questionnaire>(
        {
          resourceType: 'Questionnaire',
          params: [{ name: '_tag', value: PRACTICE_MANAGED_QUESTIONNAIRE_TAG.code }],
        },
        oystehr
      );
      const q = allPracticeManaged.find((pq) => pq.id === directQuestionnaireId && pq.status === 'active');
      if (!q) {
        return { statusCode: 200, body: JSON.stringify({ questionnaires: [], encounterId, patientId }) };
      }

      // Prefer an existing QR on this encounter; fall back to a patient-level
      // QR (no encounter) for patient-scoped sends.
      let matchingQr: QuestionnaireResponse | undefined;
      if (encounterId) {
        const encounterQrs = (
          await oystehr.fhir.search<QuestionnaireResponse>({
            resourceType: 'QuestionnaireResponse',
            params: [
              { name: 'encounter', value: `Encounter/${encounterId}` },
              { name: 'questionnaire', value: q.url || '' },
            ],
          })
        ).unbundle();
        matchingQr = encounterQrs[0];
      }
      if (!matchingQr && patientId) {
        const patientQrs = (
          await oystehr.fhir.search<QuestionnaireResponse>({
            resourceType: 'QuestionnaireResponse',
            params: [
              { name: 'subject', value: `Patient/${patientId}` },
              { name: 'questionnaire', value: q.url || '' },
            ],
          })
        ).unbundle();
        matchingQr = patientQrs.find((qr) => !qr.encounter);
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          questionnaires: [
            {
              id: q.id,
              url: q.url,
              version: q.version,
              title: q.title || q.name || 'Untitled',
              status: q.status,
              questionnaireResponseId: matchingQr?.id,
              questionnaireResponseStatus: matchingQr?.status,
              questionnaireResponseItems: matchingQr?.item,
              item: q.item,
            },
          ],
          encounterId,
          patientId,
        }),
      };
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

    // Find practice-managed questionnaires. Include retired so that existing QRs
    // tied to soft-deleted questionnaires can still be matched and rendered in
    // the EHR, but filter to active for any flow that surfaces a new form.
    const allPracticeManaged = await getAllFhirSearchPages<Questionnaire>(
      {
        resourceType: 'Questionnaire',
        params: [{ name: '_tag', value: PRACTICE_MANAGED_QUESTIONNAIRE_TAG.code }],
      },
      oystehr
    );
    const activePracticeManaged = allPracticeManaged.filter((q) => q.status === 'active');

    // A standalone direct-id request returns just that form. Attaching forms to the intake
    // itself is handled by paperwork flows (a separate change); here that set is empty, but
    // forms with an existing QR on the encounter are still surfaced below (e.g. completed
    // forms sent to the patient, shown in the EHR).
    let associated: Questionnaire[];
    if (directQuestionnaireId) {
      // Standalone form lookups must not serve retired forms to patients.
      associated = activePracticeManaged.filter((q) => q.id === directQuestionnaireId);
    } else {
      associated = [];
    }

    // Check for existing QRs on this encounter
    const existingQrs = encounterId
      ? (
          await oystehr.fhir.search<QuestionnaireResponse>({
            resourceType: 'QuestionnaireResponse',
            params: [{ name: 'encounter', value: `Encounter/${encounterId}` }],
          })
        ).unbundle()
      : [];

    // Also include any practice-managed questionnaires that have existing QRs on this
    // encounter but aren't in the associated set (e.g. standalone forms sent to patient)
    const associatedIds = new Set(associated.map((q) => q.id));
    const withExistingQrs = allPracticeManaged.filter((q) => {
      if (associatedIds.has(q.id!)) return false;
      return existingQrs.some((qr) => qr.questionnaire?.split('|')[0] === q.url);
    });
    const allRelevant = [...associated, ...withExistingQrs];

    const questionnaires = allRelevant.map((q) => {
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
