import Oystehr from '@oystehr/sdk';
// import { Appointment, Encounter, Patient, Task } from 'fhir/r4b';
import { Task } from 'fhir/r4b';
import * as fs from 'fs';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

async function getTasksByType(oystehr: Oystehr, code: string): Promise<Task[]> {
  console.log(`Fetching tasks for code: ${code}`);

  let currentIndex = 0;
  let total = 1;
  const result: Task[] = [];

  while (currentIndex < total) {
    try {
      const bundledResponse = await oystehr.fhir.search<Task>({
        resourceType: 'Task',
        params: [
          {
            name: 'code',
            value: code,
          },
          {
            name: '_sort',
            value: '-_lastUpdated',
          },
          {
            name: '_offset',
            value: currentIndex,
          },
          {
            name: '_count',
            value: 1000,
          },
          {
            name: '_total',
            value: 'accurate',
          },
        ],
      });

      total = bundledResponse.total || 0;
      const unbundled = bundledResponse.unbundle();
      result.push(...unbundled);
      currentIndex += unbundled.length;

      console.log(`Fetched ${unbundled.length} Tasks (${result.length}/${total} total)`);
    } catch (error) {
      console.error(`Error fetching Tasks at offset ${currentIndex}:`, error);
      break;
    }
  }

  console.log(`Found ${result.length} Tasks for code: ${code}`);

  return result;
}

// Helper function to format date from YYYYMMDD to YYYY-MM-DD
// function formatDate(dateString: string): string | null {
//   if (!dateString || dateString.length !== 8) {
//     return null;
//   }

//   const year = dateString.substring(0, 4);
//   const month = dateString.substring(4, 6);
//   const day = dateString.substring(6, 8);

//   return `${year}-${month}-${day}`;
// }

// Add interface for the result
// interface AppointmentContext {
//   appointment: Appointment;
//   encounter?: Encounter;
//   patient?: Patient;
// }

// async function getAppointmentContext(
//   oystehr: Oystehr,
//   appointmentId: string,
// ): Promise<AppointmentContext | null> {
//   try {
//     console.log(`\n🔍 Fetching appointment context for: ${appointmentId}`);

//     // Fetch the Appointment
//     const appointment = await oystehr.fhir.get({
//       resourceType: 'Appointment',
//       id: appointmentId,
//     }) as Appointment;

//     console.log(`✅ Found appointment: ${appointmentId}`);

//     const context: AppointmentContext = {
//       appointment,
//     };

//     // Search for Encounter that references this Appointment
//     const encounterResponse = await oystehr.fhir.search<Encounter>({
//       resourceType: 'Encounter',
//       params: [
//         {
//           name: 'appointment',
//           value: `Appointment/${appointmentId}`,
//         },
//         {
//           name: '_count',
//           value: 1,
//         },
//       ],
//     });

//     const encounters = encounterResponse.unbundle();

//     if (encounters.length > 0) {
//       const encounter = encounters[0];
//       context.encounter = encounter;
//       console.log(`✅ Found encounter: ${encounter.id}`);

//       // Get Patient from Encounter subject
//       if (encounter.subject?.reference) {
//         const patientReference = encounter.subject.reference;
//         const patientId = patientReference.replace('Patient/', '');

//         try {
//           const patient = await oystehr.fhir.get({
//             resourceType: 'Patient',
//             id: patientId,
//           }) as Patient;

//           context.patient = patient;
//           console.log(
//             `✅ Found patient: ${patient.id} - ${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family}`,
//           );
//         } catch (patientError) {
//           console.warn(`⚠️ Failed to fetch patient ${patientId}:`, patientError);
//         }
//       } else {
//         console.warn(`⚠️ Encounter ${encounter.id} has no subject reference`);
//       }
//     } else {
//       console.warn(`⚠️ No encounter found for appointment ${appointmentId}`);
//     }

//     return context;
//   } catch (error) {
//     console.error(`❌ Error fetching appointment context for ${appointmentId}:`, error);
//     return null;
//   }
// }

async function main(): Promise<void> {
  const env = process.argv[2];

  if (!env) {
    throw new Error('❌ Environment is required. Usage: npm run script get-rcm-tasks <env>');
  }

  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));

  const token = await getAuth0Token(secrets);

  if (!token) {
    throw new Error('❌ Failed to fetch auth token.');
  }

  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
  });

  // Fetch all tasks for RCM
  const tasks = await getTasksByType(oystehr, 'send-claim');

  if (tasks.length === 0) {
    console.log('No tasks found for code: send-claim');
    return;
  }

  console.log(`\n📋 Tasks for send-claim (${tasks.length} total):`);
  console.log('='.repeat(140));

  const failedTasks: Task[] = [];

  for (const task of tasks) {
    const taskId = task.id || 'N/A';
    const status = task.status || 'N/A';
    const focusReference = task.focus?.reference || 'N/A';

    if (status === 'failed') {
      const appointmentRef = task.focus?.reference || 'N/A';
      const statusReasonCode = task.statusReason?.coding?.[0]?.code || 'No reason provided';

      console.log(
        `Task: ${taskId.padEnd(40)} | Status: ${status.padEnd(15)} | Appointment: ${appointmentRef.padEnd(
          50
        )} | Reason: ${statusReasonCode}`
      );
      failedTasks.push(task);
    } else {
      console.log(`Task: ${taskId.padEnd(40)} | Status: ${status.padEnd(15)} | Focus: ${focusReference}`);
    }
  }

  console.log('='.repeat(140));

  // Print summary by status
  console.log('\n📊 Summary by Status:');
  const statusCounts = new Map<string, number>();

  for (const task of tasks) {
    const status = task.status || 'unknown';
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  }

  for (const [status, count] of Array.from(statusCounts.entries()).sort()) {
    console.log(`   ${status.padEnd(20)} ${count} tasks`);
  }

  console.log(`\nTotal Failed Tasks: ${failedTasks.length}`);
}

main()
  .then(() => console.log('\n✅ This is all the tasks for sending claims.'))
  .catch((error) => {
    console.error(error);
    throw error;
  });
