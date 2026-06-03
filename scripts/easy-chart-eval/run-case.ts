/**
 * run-case.ts — feed an ambient-scribe transcript through the REAL note-generation
 * code path the server uses (createResourcesFromAiInterview in shared/ai.ts) and print
 * the generated structured note JSON for comparison against the clinician's actual note.
 *
 * Creates a throwaway Patient + Encounter (so the prompt gets the right age/sex), runs the
 * generation, captures the AI JSON (sniffed from the AI response log), then deletes
 * everything it created.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/local.json \
 *     npx tsx scripts/easy-chart-eval/run-case.ts <transcriptFile> <ageYears> <male|female>
 */
import Oystehr from '@oystehr/sdk';
import { readFileSync } from 'fs';
import { DateTime } from 'luxon';
import secrets from '../../packages/zambdas/.env/local.json';
import { createResourcesFromAiInterview } from '../../packages/zambdas/src/shared/ai';

function need(n: string): string {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env: ${n}`);
  return v;
}

async function main(): Promise<void> {
  const [transcriptFile, ageStr, sex] = process.argv.slice(2);
  if (!transcriptFile || !ageStr || !sex) {
    console.error('Usage: tsx run-case.ts <transcriptFile> <ageYears> <male|female>');
    process.exit(1);
  }
  const transcript = readFileSync(transcriptFile, 'utf-8');
  const ageYears = parseInt(ageStr, 10);
  const birthDate = DateTime.now().minus({ years: ageYears, months: 1 }).toISODate();

  // Capture the AI JSON: createResourcesFromAiInterview logs `AI response: "..."`.
  let capturedAi = '';
  const origLog = console.log.bind(console);
  console.log = (...args: any[]): void => {
    const first = args[0];
    if (typeof first === 'string' && first.startsWith('AI response:')) {
      capturedAi = first.replace(/^AI response:\s*"?/, '').replace(/"$/, '');
    }
    // suppress the noisy transaction dump but keep other logs on stderr
    if (typeof first === 'string' && first.startsWith('Transaction requests:')) return;
    console.error(...args);
  };

  const tokenRes = await fetch(need('AUTH0_ENDPOINT'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: need('AUTH0_CLIENT'),
      client_secret: need('AUTH0_SECRET'),
      audience: need('AUTH0_AUDIENCE'),
      grant_type: 'client_credentials',
    }),
  });
  if (!tokenRes.ok) throw new Error(`auth failed: ${tokenRes.status}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const oystehr = new Oystehr({
    accessToken: access_token,
    projectId: need('PROJECT_ID'),
    fhirApiUrl: need('FHIR_API').replace(/\/r4/g, ''),
    projectApiUrl: need('PROJECT_API'),
  } as any);

  const patient = await oystehr.fhir.create<any>({
    resourceType: 'Patient',
    gender: sex,
    birthDate,
    name: [{ family: 'EvalThrowaway', given: ['Case'] }],
  });
  const encounter = await oystehr.fhir.create<any>({
    resourceType: 'Encounter',
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
    subject: { reference: `Patient/${patient.id}` },
  });
  console.error(`[throwaway] patient=${patient.id} encounter=${encounter.id} dob=${birthDate} sex=${sex}`);

  try {
    await createResourcesFromAiInterview(
      oystehr,
      encounter.id,
      transcript,
      null,
      undefined,
      null,
      null, // providerUserProfile -> source='chat'
      secrets
    );
  } finally {
    console.log = origLog;
    try {
      for (const type of ['Observation', 'DocumentReference', 'Condition']) {
        const found = (
          await oystehr.fhir.search({
            resourceType: type as any,
            params: [{ name: 'subject', value: `Patient/${patient.id}` }],
          })
        ).unbundle() as any[];
        for (const r of found) await oystehr.fhir.delete({ resourceType: type as any, id: r.id });
      }
      await oystehr.fhir.delete({ resourceType: 'Encounter', id: encounter.id });
      await oystehr.fhir.delete({ resourceType: 'Patient', id: patient.id });
      console.error('[cleanup] throwaway resources deleted');
    } catch (e) {
      console.error('[cleanup] failed:', e instanceof Error ? e.message : e);
    }
  }

  origLog('===== GENERATED NOTE (AI JSON) =====');
  try {
    origLog(JSON.stringify(JSON.parse(capturedAi), null, 2));
  } catch {
    origLog(capturedAi || '(no AI JSON captured)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
