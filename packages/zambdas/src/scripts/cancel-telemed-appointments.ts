import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { Appointment, FhirResource } from 'fhir/r4b';
import fs from 'fs';
import { OTTEHR_MODULE } from 'utils';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience, projectApiUrlFromAuth0Audience } from './helpers';

async function main(): Promise<void> {
  const env = process.argv[2];
  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));
  const project_url = secrets.PROJECT_API;

  const token = await getAuth0Token(secrets);
  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
    projectApiUrl: projectApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
  });
  const zambdasList = await oystehr.zambda.list();
  const cancelTelemedAppointmentsZambda = zambdasList.find((zambda) => zambda.name === 'telemed-cancel-appointment');
  if (!cancelTelemedAppointmentsZambda) {
    console.error('Cancel telemed appointment zambda not found');
  }
  console.error(`Cancel telemed appointment zambda id: ${cancelTelemedAppointmentsZambda?.id}`);

  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }

  // filter appointments in fhir
  const resourceBundle = (
    await oystehr.fhir
      .search<Appointment>({
        resourceType: 'Appointment',
        params: [
          {
            name: '_tag',
            value: OTTEHR_MODULE.TM,
          },
          {
            name: 'status',
            value: 'arrived',
          },
        ],
      })
      .catch((error) => {
        captureException(error);
        console.log(error, JSON.stringify(error));
      })
  )?.unbundle();
  console.log('Got Appointment related resources');

  // filter appointments by some special criteria in memory
  const appointments = resourceBundle?.filter(
    (resource: FhirResource) =>
      resource.resourceType === 'Appointment' &&
      (resource as Appointment).participant.find(
        (x) => x.actor?.reference === 'Location/9259b680-0cef-4d2f-805f-2b044f872b41'
      )
  ) as unknown as Appointment[];

  console.log(JSON.stringify(appointments), appointments.length);

  appointments.forEach(async (appt) => {
    console.log(`Cancelling appointment ${appt.id}`);
    const resp = await fetch(`${project_url}/v1/zambda/${cancelTelemedAppointmentsZambda?.id}/execute`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        appointmentID: appt.id,
        cancellationReason: 'Patient improved',
      }),
    }).catch((err) => console.log(err, JSON.stringify(err)));
    console.log(`Response ${JSON.stringify(resp)}`);
  });
}

main()
  .then(() => console.log('Completed processing practitioners'))
  .catch((error) => {
    console.error(error);
    throw error;
  });
