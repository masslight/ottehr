// Hand the eRx service's pharmacy refill (renewal) and change request Tasks to the LOCAL erx-refill-request
// subscription handler, exactly as the FHIR subscription would. Safe to run again: the handler makes an Ottehr task
// only when the request has none (or the pharmacy asked again), and completes it once the request is closed.
// Usage: tsx scripts/process-erx-requests.ts [hours=24] [secrets=.env/zambda-secrets-local.json]
import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { readFileSync } from 'fs';
import { DateTime } from 'luxon';
import {
  ERX_CHANGE_REQUEST_TASK_CODE,
  ERX_RENEWAL_REQUEST_TASK_CODE,
  ERX_REQUEST_TASK_CODE_SYSTEM,
} from 'utils/lib/fhir/constants';
import { getAuth0Token } from '../src/shared/getAuth0Token';

const LOCAL_ZAMBDA = 'http://localhost:3000/local/zambda/erx-refill-request-subscription/execute-public';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const hours = Number(args.find((a) => a.startsWith('hours='))?.split('=')[1] ?? 24);
  const secretsArg = args.find((a) => a.startsWith('secrets='))?.split('=')[1] ?? '.env/zambda-secrets-local.json';
  const secrets = JSON.parse(readFileSync(secretsArg, 'utf-8'));

  const oystehr = new Oystehr({
    accessToken: await getAuth0Token(secrets),
    fhirApiUrl: secrets.FHIR_API.replace(/\/r4/g, ''),
    projectApiUrl: secrets.PROJECT_API,
  });

  const since = DateTime.utc().minus({ hours }).toISO()!;
  const tasks = (
    await oystehr.fhir.search<Task>({
      resourceType: 'Task',
      params: [
        {
          name: 'code',
          value: [ERX_RENEWAL_REQUEST_TASK_CODE, ERX_CHANGE_REQUEST_TASK_CODE]
            .map((code) => `${ERX_REQUEST_TASK_CODE_SYSTEM}|${code}`)
            .join(','),
        },
        { name: '_lastUpdated', value: `ge${since}` },
        { name: '_count', value: '100' },
      ],
    })
  ).unbundle();
  console.log(`${tasks.length} eRx request Task(s) updated in the last ${hours} h`);

  for (const task of tasks) {
    const resp = await fetch(LOCAL_ZAMBDA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    const code = task.code?.coding?.[0]?.code;
    console.log(
      `Task/${task.id} (${code}, ${task.status}) → HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
