import Oystehr from '@oystehr/sdk';
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

  // for (let i = 0; length !== 0; i += BATCH_SIZE) {
  //   console.log(`Processing practitioners ${i / BATCH_SIZE} batch`);
  //   const batch = await getPractitionersBatch(oystehr, i, BATCH_SIZE);
  //   const batchRequests: BatchInputRequest[] = [];
  //   length = batch.length;
  //   if (length >= 0) {
  //     batch.forEach((practitioner) => {
  //       const extIndex = practitioner.extension?.findIndex(
  //         (ext) => ext.url === FHIR_EXTENSION.Practitioner.isEnrolledInPhoton.url
  //       );
  //       const ext = practitioner?.extension?.[extIndex || 0];
  //       if (ext && ext.valueBoolean === true) {
  //         console.log(
  //           `Will update practitioner with id: ${practitioner.id}, name: ${practitioner.name?.[0]?.given?.[0]} ${practitioner.name?.[0]?.family}`
  //         );
  //         batchRequests.push(
  //           getPatchBinary({
  //             resourceId: practitioner.id!,
  //             resourceType: 'Practitioner',
  //             patchOperations: [
  //               {
  //                 op: 'replace',
  //                 path: `/extension/${extIndex}`,
  //                 value: <Extension>{ url: FHIR_EXTENSION.Practitioner.isEnrolledInPhoton.url, valueBoolean: false },
  //               },
  //             ],
  //           })
  //         );
  //       }
  //     });
  //     if (batchRequests.length) {
  //       console.log('Performing updates for this batch.');
  //       const result = await oystehr.fhir.batch({ requests: batchRequests });
  //       console.debug(`Response: ${JSON.stringify(result)}`);
  //     }
  //   }
  // }
}

main()
  .then(() => console.log('Completed processing practitioners'))
  .catch((error) => {
    console.error(error);
    throw error;
  });
