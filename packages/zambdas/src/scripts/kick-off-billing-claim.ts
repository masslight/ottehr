// Kick off Ottehr billing claim generation for an appointment, replaying exactly what
// sign-appointment does after a provider signs when Ottehr billing is enabled: execute the
// create-billing-claim-task zambda for the visit's encounter. That zambda is idempotent — it
// returns the existing claim or billing Task if one already exists, otherwise creates the Task
// that the sub-billing-claim-task subscription turns into a claim.
//
// Usage (from packages/zambdas):
//   npm run kick-off-billing-claim -- project=<projectId> appointment=<appointmentId> [encounter=<encounterId>]
// The access token is read via a masked terminal prompt (or the OYSTEHR_TOKEN env var) so it
// never appears on the command line or in shell history.
import * as readline from 'node:readline';
import Oystehr from '@oystehr/sdk';
import { Encounter } from 'fhir/r4b';
import { isAnnotationFollowupEncounter } from 'utils/lib/fhir/encounter';

const FHIR_API_URL = process.env.OYSTEHR_FHIR_API_URL ?? 'https://fhir-api.zapehr.com';
const PROJECT_API_URL = process.env.OYSTEHR_PROJECT_API_URL ?? 'https://project-api.zapehr.com/v1';

function getArg(name: string): string | undefined {
  const match = process.argv.slice(2).find((a) => a.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}

/** Prompt on the terminal with the typed characters masked. */
function promptHidden(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const rlAny = rl as unknown as { _writeToOutput: (s: string) => void };
  rlAny._writeToOutput = (stringToWrite: string) => {
    if (stringToWrite.includes(question)) process.stdout.write(question);
  };
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      process.stdout.write('\n');
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main(): Promise<void> {
  const projectId = getArg('project');
  const appointmentId = getArg('appointment');
  let encounterId = getArg('encounter');

  if (!projectId || !appointmentId) {
    console.error(
      'Usage: npm run kick-off-billing-claim -- project=<projectId> appointment=<appointmentId> [encounter=<encounterId>]\n' +
        'The access token is prompted for interactively (or set OYSTEHR_TOKEN).'
    );
    process.exit(1);
  }

  const token = process.env.OYSTEHR_TOKEN?.trim() || (await promptHidden('Oystehr access token: '));
  if (!token) throw new Error('An access token is required');

  const oystehr = new Oystehr({
    accessToken: token,
    projectId,
    services: { fhirApiUrl: FHIR_API_URL, projectApiUrl: PROJECT_API_URL },
  });

  if (!encounterId) {
    const encounters = (
      await oystehr.fhir.search<Encounter>({
        resourceType: 'Encounter',
        params: [{ name: 'appointment', value: `Appointment/${appointmentId}` }],
      })
    ).unbundle();
    // Follow-up encounters never generate claims in the sign flow, so exclude them here too.
    const candidates = encounters.filter((e) => !isAnnotationFollowupEncounter(e));
    if (candidates.length === 0) {
      throw new Error(`No claim-eligible encounter found for Appointment/${appointmentId}`);
    }
    if (candidates.length > 1) {
      console.error(`Multiple encounters found for Appointment/${appointmentId}; re-run with encounter=<id>:`);
      candidates.forEach((e) => console.error(`  Encounter/${e.id} (status: ${e.status})`));
      process.exit(1);
    }
    encounterId = candidates[0].id;
  }
  console.log(`Using Encounter/${encounterId}`);

  // Same call sign-appointment makes when shouldUseOttehrBilling() is true.
  const result = await oystehr.zambda.execute({ id: 'create-billing-claim-task', encounterId });
  console.log('create-billing-claim-task response:', JSON.stringify(result.output ?? result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
