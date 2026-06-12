import { APIGatewayProxyResult } from 'aws-lambda';
import { QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS, PRACTICE_MANAGED_QR_TAG } from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  getUser,
  userHasAccessToPatient,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';

let oystehrToken: string;

export const index = wrapHandler(
  'save-practice-managed-response',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    if (!input.body) throw MISSING_REQUEST_BODY;
    if (!input.secrets) throw new Error('No secrets provided');

    const {
      questionnaireResponseId,
      questionnaireUrl,
      questionnaireVersion,
      encounterId,
      patientId,
      pageIndex,
      answers,
      complete,
    } = JSON.parse(input.body) as {
      questionnaireResponseId?: string;
      questionnaireUrl: string;
      questionnaireVersion?: string;
      encounterId: string;
      patientId: string;
      pageIndex: number;
      answers: QuestionnaireResponseItem;
      /** Set on the final page save of an in-visit form so the QR finishes 'completed' —
       *  otherwise the intake's insertion check re-enters the form forever. */
      complete?: boolean;
    };

    if (!questionnaireUrl) throw MISSING_REQUIRED_PARAMETERS(['questionnaireUrl']);
    if (!patientId) throw MISSING_REQUIRED_PARAMETERS(['patientId']);
    // encounterId is optional — patient-level forms (sent from the patient
    // profile, not a specific visit) have no associated encounter.

    if (!oystehrToken) {
      oystehrToken = await getAuth0Token(input.secrets);
    }
    const oystehr = createOystehrClient(oystehrToken, input.secrets);

    const canonicalRef = questionnaireVersion ? `${questionnaireUrl}|${questionnaireVersion}` : questionnaireUrl;

    // Authorization: writes are gated on the caller being connected to the patient (EHR
    // users pass implicitly). For updates the QR's own subject is authoritative — the body
    // patientId is caller-supplied and must not be trusted to authorize writing someone
    // else's response.
    const existing = questionnaireResponseId
      ? await oystehr.fhir.get<QuestionnaireResponse>({
          resourceType: 'QuestionnaireResponse',
          id: questionnaireResponseId,
        })
      : undefined;
    const patientIdToAuthorize = existing?.subject?.reference?.replace('Patient/', '') || patientId;
    const callerToken = input.headers?.Authorization?.replace('Bearer ', '');
    const caller = callerToken ? await getUser(callerToken, input.secrets).catch(() => undefined) : undefined;
    const hasAccess = caller ? await userHasAccessToPatient(caller, patientIdToAuthorize, oystehr) : false;
    if (!hasAccess) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'ACCESS_DENIED', message: 'You do not have access to this form.' }),
      };
    }

    if (existing) {
      // Patch existing QR — update the page at pageIndex

      const items = existing.item || [];
      // Ensure the array is large enough
      while (items.length <= pageIndex) {
        items.push({ linkId: `page-${items.length}` });
      }
      items[pageIndex] = answers;

      const updated = await oystehr.fhir.update<QuestionnaireResponse>({
        ...existing,
        item: items,
        status: complete ? 'completed' : 'in-progress',
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
        status: complete ? 'completed' : 'in-progress',
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
