import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Appointment, QuestionnaireResponse, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getSecret,
  isTelemedAppointment,
  SecretsKeys,
  TASK_INPUT_TYPE_CODES,
  TASK_INPUT_TYPE_SYSTEM,
  TaskIndicator,
} from 'utils';
import { createOystehrClient, getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { PatchPaperworkEffectInput, validatePatchInputs } from '../validateRequestParameters';

// Lifting the token out of the handler function allows it to persist across warm lambda invocations.
export let token: string;

export const index = wrapHandler('patch-paperwork', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const secrets = input.secrets;
    if (!token) {
      console.log('getting token');
      token = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(token, secrets);

    const effectInput = await validatePatchInputs(input, oystehr);

    console.log('effect input', JSON.stringify(effectInput));

    const qr = await performEffect(effectInput, oystehr);
    /*
    todo
    try {
      await createAuditEvent(AuditableZambdaEndpoints.patchPaperwork, oystehr, input, patientId, secrets);
    } catch (e) {
      console.log('error writing audit event', e);
    }
      */

    return {
      statusCode: 200,
      body: JSON.stringify(qr),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('patch-paperwork', error, ENVIRONMENT);
  }
});

const performEffect = async (input: PatchPaperworkEffectInput, oystehr: Oystehr): Promise<QuestionnaireResponse> => {
  const { updatedAnswers, questionnaireResponseId, currentQRStatus, patchIndex, appointmentId } = input;
  console.log('patchIndex:', patchIndex);
  console.log('updatedAnswers', JSON.stringify(updatedAnswers));
  const operations: Operation[] = [
    {
      op: 'add',
      path: `/item/${patchIndex}/item`,
      value: updatedAnswers,
    },
  ];

  if (currentQRStatus === 'completed') {
    operations.push({
      op: 'replace',
      path: '/status',
      value: 'amended',
    });
  }

  // temp fix to harvest paperwork after consent forms page is complete
  if (input.submittedAnswer.linkId === 'consent-forms-page') {
    operations.push(
      {
        op: 'replace',
        path: '/status',
        value: 'completed',
      },
      {
        op: 'add',
        path: '/authored',
        value: DateTime.now().toISO(),
      }
    );
  }

  const appointmentPromise = (async (): Promise<null | Appointment> => {
    if (!appointmentId) return null;
    try {
      const appointment = await oystehr.fhir.get<Appointment>({
        resourceType: 'Appointment',
        id: appointmentId,
      });

      const appointmentStatus = appointment.status;
      const isOttehrTm = isTelemedAppointment(appointment);

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
      captureException(e);
      return null;
    }
  })();
  const qrPromise = oystehr.fhir.patch<QuestionnaireResponse>({
    id: questionnaireResponseId,
    resourceType: 'QuestionnaireResponse',
    operations,
  });

  // todo: add a fhir post request to write a task for harvesting, with input that identifies the page_id
  // https://github.com/masslight/ottehr/issues/5693

  const harvestTask: Task = {
    resourceType: 'Task',
    status: 'requested',
    code: {
      coding: [{ ...TaskIndicator.harvestPaperwork }],
    },
    intent: 'order',
    focus: { reference: `QuestionnaireResponse/${questionnaireResponseId}` },
    input: [
      {
        type: { coding: [{ system: TASK_INPUT_TYPE_SYSTEM, code: TASK_INPUT_TYPE_CODES.PAGE_INDEX }] },
        valueUnsignedInt: patchIndex,
      },
    ],
  };

  const taskPromise = oystehr.fhir.create<Task>(harvestTask);

  // temp fix to harvest paperwork after consent forms page is complete
  const [updatedQR] = await (appointmentId && input.submittedAnswer.linkId === 'consent-forms-page'
    ? Promise.all([qrPromise, taskPromise, appointmentPromise])
    : Promise.all([qrPromise, taskPromise]));

  return updatedQR;
};
