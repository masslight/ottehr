import { APIGatewayProxyResult } from 'aws-lambda';
import { createOystehrClient } from '../../shared/helpers';
import { ZambdaInput } from '../../shared';
import { checkOrCreateM2MClientToken } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { Appointment, DocumentReference, Patient } from 'fhir/r4b';
import { VISIT_NOTE_SUMMARY_CODE } from 'utils';

let m2mtoken: string;

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
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);
    console.groupEnd();
    console.debug('checkOrCreateM2MClientToken() then createOystehrClient() success');

    const organizationId = secrets?.ORGANIZATION_ID;
    if (!organizationId) {
      throw new Error('Organization ID was not found in secrets');
    }

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
  } catch (error) {
    console.log(error);
    return {
      body: JSON.stringify({ message: 'Error sending fax' }),
      statusCode: 500,
    };
  }
};
