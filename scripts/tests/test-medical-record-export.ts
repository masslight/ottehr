/**
 * Manual driver for the background medical-record export.
 *
 * Nothing fires FHIR subscriptions locally, so this stands in for the platform: it kicks the export
 * off, invokes the worker with the Task as its payload the way the Subscription would, then polls
 * until the Task reaches a terminal state and reports the download url.
 *
 * Requires the local zambda server:
 *   npm run zambdas:start
 *
 * Usage:
 *   npx tsx scripts/tests/test-medical-record-export.ts <patientId> [--env local] [--download]
 */

import { Task } from 'fhir/r4b';
import * as fs from 'fs';
import * as path from 'path';
import { createOystehrClient } from 'utils';
import { GetPatientMedicalRecordOutput } from 'utils/lib/types/data/get-patient-medical-record.types';
import { callZambda, getToken } from './shared';

const BASE_URL = 'http://localhost:3000/local/zambda';

const patientId = process.argv[2];
if (!patientId || patientId.startsWith('--')) {
  console.error('Usage: npx tsx scripts/tests/test-medical-record-export.ts <patientId> [--env local] [--download]');
  process.exit(1);
}

const envFlag = process.argv.indexOf('--env');
const env = envFlag !== -1 ? process.argv[envFlag + 1] : 'local';
const shouldDownload = process.argv.includes('--download');
const envFilePath = path.resolve(__dirname, '../../packages/zambdas/.env', `zambda-secrets-${env}.json`);
const envConfig = JSON.parse(fs.readFileSync(envFilePath, 'utf8'));

/**
 * Subscription zambdas are registered locally as `execute-public` and take the triggering resource as
 * their raw body — which is what the platform posts.
 */
async function invokeWorker(task: Task): Promise<void> {
  const response = await fetch(`${BASE_URL}/sub-export-medical-record/execute-public`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`worker invocation failed: ${response.status} ${text}`);
  console.log(`worker returned: ${text.slice(0, 500)}`);
}

async function main(): Promise<void> {
  const token = await getToken(envConfig);
  const oystehr = createOystehrClient(token, envConfig.FHIR_API, envConfig.PROJECT_API);

  console.log(`kicking off export for Patient/${patientId}`);
  const kickoffStarted = Date.now();
  const kickoff = await callZambda<GetPatientMedicalRecordOutput>('get-patient-medical-record', token, { patientId });
  // The whole point of the refactor: this call must return in well under the 27 s gateway ceiling.
  console.log(`kickoff -> taskId=${kickoff.taskId} status=${kickoff.status} in ${Date.now() - kickoffStarted}ms`);

  const task = await oystehr.fhir.get<Task>({ resourceType: 'Task', id: kickoff.taskId });
  if (task.status !== 'requested') {
    console.log(`Task is already ${task.status}; not re-invoking the worker.`);
  } else {
    console.log('invoking the worker the way the Subscription would...');
    // Deliberately not awaited: polling should show progress advance while it runs.
    void invokeWorker(task).catch((error) => console.error(String(error)));
  }

  const startedAt = Date.now();
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const status = await callZambda<GetPatientMedicalRecordOutput>('get-patient-medical-record', token, {
      taskId: kickoff.taskId,
      patientId,
    });
    console.log(
      `t=${Date.now() - startedAt}ms status=${status.status} progress=${status.processed ?? '-'}/${
        status.total ?? '-'
      }` + `${status.skipped ? ` skipped=${status.skipped}` : ''}`
    );

    if (status.status === 'failed') {
      console.error(`export failed: ${status.error}`);
      process.exit(1);
    }

    if (status.status === 'completed') {
      console.log(`fileName=${status.fileName} documents=${status.total} skipped=${status.skipped ?? 0}`);
      if (!status.downloadUrl) {
        console.log('no archive produced (patient has no documents)');
        return;
      }
      console.log(`downloadUrl=${status.downloadUrl.slice(0, 120)}...`);

      if (shouldDownload) {
        const archive = await fetch(status.downloadUrl);
        const bytes = Buffer.from(await archive.arrayBuffer());
        const outPath = path.join('/tmp', status.fileName ?? 'medical_record.zip');
        fs.writeFileSync(outPath, bytes);
        console.log(`wrote ${bytes.length} bytes to ${outPath} — verify with: unzip -t ${outPath}`);
      }
      return;
    }
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
