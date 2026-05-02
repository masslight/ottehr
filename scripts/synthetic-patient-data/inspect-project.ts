/**
 * inspect-project.ts — read-only inventory of an Oystehr project.
 *
 * Lists the resources a synthesis scenario typically references, so you can
 * pick real names when writing or updating a scenario JSON.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/<env>.json \
 *     npx tsx scripts/synthetic-patient-data/inspect-project.ts [--limit 20]
 *
 * Env (required):
 *   AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE,
 *   PROJECT_ID, PROJECT_API
 *
 * Read-only — performs only FHIR searches and a list-templates zambda call.
 */
import Oystehr from '@oystehr/sdk';
import type { Location, Medication, Organization, Practitioner, Schedule } from 'fhir/r4b';

// ── Args ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const limitFlag = args.indexOf('--limit');
const limit = limitFlag !== -1 && args[limitFlag + 1] ? parseInt(args[limitFlag + 1], 10) : 20;

// ── SDK setup ─────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function createOystehr(): Promise<Oystehr> {
  // Env var names are AUTH0_* for compatibility with the broader Ottehr
  // .env files, but the surface here is "Oystehr IAM": an OAuth 2.0 client-
  // credentials exchange for an M2M access token.
  const oystehrAuthEndpoint = requireEnv('AUTH0_ENDPOINT');
  const oystehrAuthClient = requireEnv('AUTH0_CLIENT');
  const oystehrAuthSecret = requireEnv('AUTH0_SECRET');
  const oystehrAuthAudience = requireEnv('AUTH0_AUDIENCE');
  const projectId = requireEnv('PROJECT_ID');
  const projectApi = requireEnv('PROJECT_API');
  const zambdaApi = process.env.ZAMBDA_API ?? projectApi;

  const tokenResponse = await fetch(oystehrAuthEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: oystehrAuthClient,
      client_secret: oystehrAuthSecret,
      audience: oystehrAuthAudience,
      grant_type: 'client_credentials',
    }),
  });
  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Oystehr IAM token request failed: ${tokenResponse.status} ${errorText}`);
  }
  const tokenData = (await tokenResponse.json()) as { access_token: string };
  return new Oystehr({
    accessToken: tokenData.access_token,
    projectId,
    services: { projectApiUrl: projectApi, zambdaApiUrl: zambdaApi },
  });
}

// ── Output helper ─────────────────────────────────────────────────────────────

function section(title: string): void {
  console.log('');
  console.log(`── ${title} ${'─'.repeat(Math.max(0, 70 - title.length))}`);
}

function nameOfPractitioner(p: Practitioner): string {
  const n = p.name?.[0];
  if (!n) return '(no name)';
  return [n.prefix?.join(' '), n.given?.join(' '), n.family, n.suffix?.join(' ')].filter(Boolean).join(' ').trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`Project: ${process.env.PROJECT_ID}`);
  console.log('Authenticating...');
  const oystehr = await createOystehr();
  console.log('Authenticated.');

  // Locations
  section('Locations');
  const locations = (
    await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [{ name: '_count', value: String(limit) }],
    })
  ).unbundle();
  if (locations.length === 0) {
    console.log('  (none)');
  } else {
    for (const loc of locations) {
      const status = loc.status ?? '?';
      const mode = loc.mode ?? '?';
      console.log(`  ${loc.id}  [${status}/${mode}]  ${loc.name ?? '(unnamed)'}`);
    }
  }

  // Schedules
  section('Schedules');
  const schedules = (
    await oystehr.fhir.search<Schedule>({
      resourceType: 'Schedule',
      params: [{ name: '_count', value: String(limit) }],
    })
  ).unbundle();
  if (schedules.length === 0) {
    console.log('  (none)');
  } else {
    for (const s of schedules) {
      const actor = s.actor?.[0]?.reference ?? '(no actor)';
      console.log(`  ${s.id}  → ${actor}`);
    }
  }

  // Practitioners
  section('Practitioners');
  const practitioners = (
    await oystehr.fhir.search<Practitioner>({
      resourceType: 'Practitioner',
      params: [{ name: '_count', value: String(limit) }],
    })
  ).unbundle();
  if (practitioners.length === 0) {
    console.log('  (none)');
  } else {
    for (const p of practitioners) {
      const npi = p.identifier?.find((i) => i.system?.includes('npi'))?.value ?? '';
      const npiDisplay = npi ? ` NPI=${npi}` : '';
      console.log(`  ${p.id}  ${nameOfPractitioner(p)}${npiDisplay}`);
    }
  }

  // Organizations
  section('Organizations (potential payers)');
  const organizations = (
    await oystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [{ name: '_count', value: String(limit) }],
    })
  ).unbundle();
  if (organizations.length === 0) {
    console.log('  (none)');
  } else {
    for (const o of organizations) {
      console.log(`  ${o.id}  ${o.name ?? '(unnamed)'}`);
    }
  }

  // Medications (vaccines + others)
  section('Medications (vaccine catalog and other formulary items)');
  const medications = (
    await oystehr.fhir.search<Medication>({
      resourceType: 'Medication',
      params: [{ name: '_count', value: String(limit) }],
    })
  ).unbundle();
  if (medications.length === 0) {
    console.log('  (none)');
  } else {
    for (const m of medications) {
      const codeText = m.code?.text ?? m.code?.coding?.[0]?.display ?? '(no code text)';
      const code = m.code?.coding?.[0]?.code ?? '';
      const codeDisplay = code ? ` [${code}]` : '';
      console.log(`  ${m.id}  ${codeText}${codeDisplay}`);
    }
  }

  // Templates (in-person + telemed)
  section('Global templates (in-person)');
  try {
    const inPersonResult = (await oystehr.zambda.execute({
      id: 'list-templates',
      examType: 'inPerson',
      includeVersionData: false,
    })) as {
      status?: number;
      output?: { templates?: Array<{ title?: string; name?: string; id?: string }> };
      templates?: Array<{ title?: string; name?: string; id?: string }>;
    };
    const inPerson = inPersonResult.output?.templates ?? inPersonResult.templates ?? [];
    if (inPerson.length === 0) {
      console.log('  (none)');
    } else {
      for (const t of inPerson) {
        console.log(`  ${t.id ?? '(no id)'}  "${t.title ?? t.name ?? '(no name)'}"`);
      }
    }
  } catch (err) {
    console.log(`  (list-templates failed: ${err instanceof Error ? err.message : err})`);
  }

  section('Global templates (telemed)');
  try {
    const telemedResult = (await oystehr.zambda.execute({
      id: 'list-templates',
      examType: 'telemed',
      includeVersionData: false,
    })) as {
      status?: number;
      output?: { templates?: Array<{ title?: string; name?: string; id?: string }> };
      templates?: Array<{ title?: string; name?: string; id?: string }>;
    };
    const telemed = telemedResult.output?.templates ?? telemedResult.templates ?? [];
    if (telemed.length === 0) {
      console.log('  (none)');
    } else {
      for (const t of telemed) {
        console.log(`  ${t.id ?? '(no id)'}  "${t.title ?? t.name ?? '(no name)'}"`);
      }
    }
  } catch (err) {
    console.log(`  (list-templates failed: ${err instanceof Error ? err.message : err})`);
  }

  console.log('');
  console.log('Done. Use these names/IDs when authoring or updating scenario JSONs.');
}

main().catch((err) => {
  console.error('');
  console.error('Fatal error:', err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) {
    console.error(err.stack.split('\n').slice(1, 4).join('\n'));
  }
  process.exit(1);
});
