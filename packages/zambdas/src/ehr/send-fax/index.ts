import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, DocumentReference, Patient } from 'fhir/r4b';
import { getSecret, SecretsKeys, VISIT_NOTE_SUMMARY_CODE } from 'utils';
import { topLevelCatch, ZambdaInput } from '../../shared';
import { checkOrCreateM2MClientToken } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.group('validateRequestParameters()');
    const { appointmentId, faxNumber, secrets } = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters() success');
    console.log('appointmentId', appointmentId);
    console.log('faxNumber', faxNumber);

    console.group('checkOrCreateM2MClientToken() then createOystehrClient()');
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    console.groupEnd();
    console.debug('checkOrCreateM2MClientToken() then createOystehrClient() success');

    const organizationId = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);

    console.log('searching fhir for patient, and visit note');
    // also includes other actors but i'm not using them so i won't include their types
    const bundle = (
      await oystehr.fhir.search<Appointment | DocumentReference | Patient>({
        resourceType: 'Appointment',
        params: [
          {
            name: '_id',
            value: appointmentId,
          },
          {
            name: '_include',
            value: 'Appointment:actor',
          },
          {
            name: '_revinclude',
            value: 'DocumentReference:related',
          },
        ],
      })
    ).unbundle();

    const patient = bundle.find((resource) => resource.resourceType === 'Patient') as Patient;
    const visitNote = bundle.find(
      (resource) =>
        resource.resourceType === 'DocumentReference' &&
        resource.type?.coding?.find((coding) => coding.code === VISIT_NOTE_SUMMARY_CODE)
    ) as DocumentReference;

    const patientId = patient?.id;
    const media = visitNote?.content[0].attachment.url;
    if (!patientId || !media) {
      return {
        body: JSON.stringify({ message: 'Patient or visit note url not found' }),
        statusCode: 404,
      };
    }
    console.log('patient id', patient.id);
    console.log('media url', media);

    console.log('Sending fax to', faxNumber);
    await oystehr.fax.send({
      media,
      quality: 'standard',
      patient: `Patient/${patientId}`,
      recipientNumber: faxNumber,
      sender: `Organization/${organizationId}`,
    });
    console.log('Fax sent successfully');

    return {
      body: JSON.stringify('Fax sent'),
      statusCode: 200,
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('send-fax', error, ENVIRONMENT);
  }
};
