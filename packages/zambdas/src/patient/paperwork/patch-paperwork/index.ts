import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Appointment, QuestionnaireResponse, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getSecret,
  isTelemedAppointment,
  pageHarvestStrategy,
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

  const updateAppointmentStatus = async (): Promise<void> => {
    if (!appointmentId) return;
    try {
      const appointment = await oystehr.fhir.get<Appointment>({
        resourceType: 'Appointment',
        id: appointmentId,
      });

      const isOttehrTm = isTelemedAppointment(appointment);

      if (isOttehrTm && appointment.status === 'proposed') {
        await oystehr.fhir.patch<Appointment>({
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
    } catch (e) {
      console.log('error updating appointment status', JSON.stringify(e, null, 2));
      captureException(e);
    }
  };

  // Patch QR first, then create the harvest Task serially so the subscription reads up-to-date QR data.
  const promises: Promise<unknown>[] = [];

  // temp fix to harvest paperwork after consent forms page is complete
  if (appointmentId && input.submittedAnswer.linkId === 'consent-forms-page') {
    promises.push(updateAppointmentStatus());
  }

  const updatedQR = await oystehr.fhir.patch<QuestionnaireResponse>({
    id: questionnaireResponseId,
    resourceType: 'QuestionnaireResponse',
    operations,
  });

  if (pageHarvestStrategy[input.submittedAnswer.linkId]) {
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
    promises.push(oystehr.fhir.create<Task>(harvestTask));
  }

  // We wrap this in a try catch and make sure that we log that it happened in sentry, but allow
  // the main thread to continue, since the failure would prevent a patient from completing their paperwork
  // and needlessly interrupt a crucial business process.
  try {
    await Promise.all(promises);
  } catch (e) {
    console.log('error creating harvest task', JSON.stringify(e, null, 2));
    captureException(e);
  }

  return updatedQR;
};
