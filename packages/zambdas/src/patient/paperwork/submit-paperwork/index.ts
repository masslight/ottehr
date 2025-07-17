import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, QuestionnaireResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FHIR_EXTENSION, getSecret, OTTEHR_MODULE, SecretsKeys } from 'utils';
import { createOystehrClient, getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { AuditableZambdaEndpoints, createAuditEvent } from '../../../shared/userAuditLog';
import { SubmitPaperworkEffectInput, validateSubmitInputs } from '../validateRequestParameters';

// Lifting the token out of the handler function allows it to persist across warm lambda invocations.
export let token: string;

export const index = wrapHandler('submit-paperwork', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const secrets = input.secrets;
    if (!token) {
      console.log('getting token');
      token = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(token, secrets);

    const effectInput = await validateSubmitInputs(input, oystehr);

    console.log('effect input', JSON.stringify(effectInput));

    const qr = await performEffect(effectInput, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify(qr),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('submit-paperwork', error, ENVIRONMENT);
  }
});

const performEffect = async (input: SubmitPaperworkEffectInput, oystehr: Oystehr): Promise<QuestionnaireResponse> => {
  const { updatedAnswers, questionnaireResponseId, ipAddress, secrets, currentQRStatus, appointmentId } = input;

  let newStatus = 'completed';
  if (currentQRStatus === 'completed' || currentQRStatus === 'amended') {
    newStatus = 'amended';
  }

  const updatePaperworkAndAppointment = async (): Promise<[QuestionnaireResponse, Appointment | null]> => {
    const paperworkPromise = oystehr.fhir.patch<QuestionnaireResponse>({
      id: questionnaireResponseId,
      resourceType: 'QuestionnaireResponse',
      operations: [
        {
          op: 'add',
          path: '/item',
          value: updatedAnswers,
        },
        {
          op: 'replace',
          path: '/status',
          value: newStatus,
        },
        {
          op: 'add',
          path: '/authored',
          value: DateTime.now().toISO(),
        },
        {
          op: 'add',
          path: '/extension',
          value: [
            {
              ...FHIR_EXTENSION.Paperwork.submitterIP,
              valueString: ipAddress,
            },
          ],
        },
      ],
    });

    const appointmentPromise = appointmentId
      ? (async (): Promise<null | Appointment> => {
          try {
            const appointment = await oystehr.fhir.get<Appointment>({
              resourceType: 'Appointment',
              id: appointmentId,
            });

            const appointmentStatus = appointment.status;
            const isOttehrTm = appointment?.meta?.tag?.some((tag) => tag.code === OTTEHR_MODULE.TM);

            if (isOttehrTm && appointmentStatus === 'proposed') {
              return oystehr.fhir.patch<Appointment>({
                id: appointmentId,
                resourceType: 'Appointment',
                operations: [
                  {
                    op: 'replace',
                    path: '/status',
                    value: 'arrived',
                  },
                ],
              });
            }
            return null;
          } catch (e) {
            console.log('error updating appointment status', JSON.stringify(e, null, 2));
            return null;
          }
        })()
      : Promise.resolve(null);

    return Promise.all([paperworkPromise, appointmentPromise]);
  };

  const [patchedPaperwork] = await updatePaperworkAndAppointment();

  const patientId = patchedPaperwork?.subject?.reference?.replace('Patient/', '') ?? '';
  try {
    await createAuditEvent(AuditableZambdaEndpoints.submitPaperwork, oystehr, input, patientId, secrets);
  } catch (e) {
    console.log('error writing audit event', JSON.stringify(e, null, 2));
  }
  return patchedPaperwork;
};
