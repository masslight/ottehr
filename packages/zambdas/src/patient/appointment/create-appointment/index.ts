import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  AuditableZambdaEndpoints,
  captureSentryException,
  configSentry,
  createAuditEvent,
  createOystehrClient,
  getAuth0Token,
  getUser,
  topLevelCatch,
  ZambdaInput,
} from '../../../shared';
import '../../../shared/instrument.mjs';
import { createAppointmentComplexValidation, validateCreateAppointmentParams } from './validateRequestParameters';
import { createAppointment } from 'utils';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;
export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('create-appointment', input.secrets);
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    console.group('validateRequestParameters');
    // Step 1: Validate input
    console.log('getting user');

    const token = input.headers.Authorization.replace('Bearer ', '');
    const user = await getUser(token, input.secrets);

    const validatedParameters = validateCreateAppointmentParams(input, user);
    const { secrets, unconfirmedDateOfBirth, language } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(input.secrets);
    } else {
      console.log('already have token');
    }
    const oystehr = createOystehrClient(zapehrToken, input.secrets);

    console.time('performing-complex-validation');
    const effectInput = await createAppointmentComplexValidation(validatedParameters, oystehr);
    const { slot, scheduleOwner, serviceMode, patient, questionnaireCanonical, visitType } = effectInput;
    console.log('effectInput', effectInput);
    console.timeEnd('performing-complex-validation');

    console.log('creating appointment');

    const data_appointment = await createAppointment(
      {
        slot,
        scheduleOwner,
        patient,
        serviceMode,
        user,
        language,
        secrets,
        visitType,
        unconfirmedDateOfBirth,
        questionnaireCanonical,
      },
      oystehr
    );

    console.log('appointment created');

    const { message, appointment, fhirPatientId, questionnaireResponseId, encounterId, resources, relatedPersonId } =
      data_appointment;

    await createAuditEvent(
      AuditableZambdaEndpoints.appointmentCreate,
      oystehr,
      input,
      fhirPatientId,
      validatedParameters.secrets
    );

    const response = {
      message,
      appointment,
      fhirPatientId,
      questionnaireResponseId,
      encounterId,
      resources,
      relatedPersonId,
    };

    console.log(`fhirAppointment = ${JSON.stringify(response)}`, visitType);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    return topLevelCatch('create-appointment', error, input.secrets, captureSentryException);
  }
});
