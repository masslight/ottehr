/**
 * Imports anonymized sample patient data from a FHIR collection bundle into
 * an Oystehr environment.
 *
 * Usage: npx tsx scripts/import-sample-patient-data.ts [options] [path-to-bundle.json]
 *
 * Options:
 *   --env <name>                  Target environment: local (default), demo, e2e, development, staging, testing
 *   --location <id>               FHIR Location ID to use
 *   --practitioner <id>           FHIR Practitioner ID to use
 *   --practitioner-search <name>  Search for practitioner by name
 *
 * The script will:
 *  1. Authenticate to the target environment
 *  2. Fetch available Locations and Practitioners
 *  3. Prompt the user to select a Location and Practitioner (if not provided via CLI)
 *  4. Replace PLACEHOLDER references with the selected IDs
 *  5. Shift all dates so encounters appear as "today"
 *  6. POST each resource via the FHIR API
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const DEFAULT_INPUT = path.join(__dirname, 'data', 'samplePatientData.json');

interface CliArgs {
  input: string;
  env: string;
  locationId?: string;
  practitionerId?: string;
  practitionerSearch?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = { input: DEFAULT_INPUT, env: 'local' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--location' && args[i + 1]) {
      result.locationId = args[++i];
    } else if (args[i] === '--practitioner' && args[i + 1]) {
      result.practitionerId = args[++i];
    } else if (args[i] === '--practitioner-search' && args[i + 1]) {
      result.practitionerSearch = args[++i];
    } else if (args[i] === '--env' && args[i + 1]) {
      result.env = args[++i];
    } else if (!args[i].startsWith('--')) {
      result.input = args[i];
    }
  }
  return result;
}

interface EnvConfig {
  AUTH0_ENDPOINT: string;
  AUTH0_AUDIENCE: string;
  AUTH0_CLIENT: string;
  AUTH0_SECRET: string;
  FHIR_API: string;
  PROJECT_ID: string;
}

function loadEnvConfig(envName: string): EnvConfig {
  const envFilePath = path.join(__dirname, '..', 'packages', 'zambdas', '.env', `${envName}.json`);
  if (!fs.existsSync(envFilePath)) {
    const available = fs
      .readdirSync(path.join(__dirname, '..', 'packages', 'zambdas', '.env'))
      .filter((f) => f.endsWith('.json') && !f.startsWith('zambda-'))
      .map((f) => f.replace('.json', ''));
    console.error(`Environment file not found: ${envFilePath}`);
    console.error(`Available environments: ${available.join(', ')}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(envFilePath, 'utf-8'));

  // Prefer test M2M credentials (AUTH0_CLIENT_TESTS) which have broader access
  const clientId = config.AUTH0_CLIENT_TESTS || config.AUTH0_CLIENT;
  const clientSecret = config.AUTH0_SECRET_TESTS || config.AUTH0_SECRET;

  if (!clientId || !clientSecret || !config.PROJECT_ID) {
    console.error(
      `Missing required fields in ${envFilePath}: AUTH0_CLIENT_TESTS/AUTH0_CLIENT, AUTH0_SECRET_TESTS/AUTH0_SECRET, PROJECT_ID`
    );
    process.exit(1);
  }

  return {
    AUTH0_ENDPOINT: config.AUTH0_ENDPOINT,
    AUTH0_AUDIENCE: config.AUTH0_AUDIENCE,
    AUTH0_CLIENT: clientId,
    AUTH0_SECRET: clientSecret,
    FHIR_API: (config.FHIR_API as string).replace(/\/r4$/, ''),
    PROJECT_ID: config.PROJECT_ID,
  };
}

// ========================= Prompting =========================

function createPrompt(): { ask: (question: string) => Promise<string>; close: () => void } {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return {
    ask: (question: string) => new Promise((resolve) => rl.question(question, resolve)),
    close: () => rl.close(),
  };
}

// ========================= FHIR helpers =========================

let activeEnv: EnvConfig;

async function getToken(): Promise<string> {
  const res = await fetch(activeEnv.AUTH0_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: activeEnv.AUTH0_CLIENT,
      client_secret: activeEnv.AUTH0_SECRET,
      audience: activeEnv.AUTH0_AUDIENCE,
    }),
  });
  return ((await res.json()) as { access_token: string }).access_token;
}

async function fhirSearch(token: string, path: string): Promise<any> {
  const res = await fetch(`${activeEnv.FHIR_API}/r4/${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'x-zapehr-project-id': activeEnv.PROJECT_ID },
  });
  return res.json();
}

async function fhirPost(token: string, resource: any): Promise<any> {
  const cleaned = { ...resource };
  if (cleaned.meta) {
    cleaned.meta = { ...cleaned.meta };
    delete cleaned.meta.versionId;
    delete cleaned.meta.lastUpdated;
    // Remove empty meta fields
    for (const key of Object.keys(cleaned.meta)) {
      const val = cleaned.meta[key];
      if (val === null || val === undefined) delete cleaned.meta[key];
      else if (Array.isArray(val) && val.length === 0) delete cleaned.meta[key];
      else if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0)
        delete cleaned.meta[key];
    }
    if (Object.keys(cleaned.meta).length === 0) delete cleaned.meta;
  }
  // Remove empty objects/arrays that violate FHIR ele-1
  cleanEmptyElements(cleaned);
  delete cleaned.id; // Let server assign new ID

  const res = await fetch(`${activeEnv.FHIR_API}/r4/${resource.resourceType}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-zapehr-project-id': activeEnv.PROJECT_ID,
    },
    body: JSON.stringify(cleaned),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST ${resource.resourceType}: ${res.status} ${err.substring(0, 300)}`);
  }
  return res.json();
}

function cleanEmptyElements(obj: any): void {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (key === 'resourceType') continue;
    const val = obj[key];
    if (val === null || val === undefined) {
      delete obj[key];
      continue;
    }
    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === 'object') cleanEmptyElements(item);
      }
      obj[key] = val.filter((item: any) => {
        if (typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length === 0) return false;
        return true;
      });
      if (obj[key].length === 0) delete obj[key];
    } else if (typeof val === 'object') {
      cleanEmptyElements(val);
      if (Object.keys(val).length === 0) delete obj[key];
    }
  }
}

// ========================= Selection UI =========================

async function selectFromList(
  prompt: { ask: (q: string) => Promise<string> },
  items: { id: string; display: string }[],
  label: string
): Promise<string> {
  console.log(`\nAvailable ${label}s:`);
  for (let i = 0; i < items.length; i++) {
    console.log(`  [${i + 1}] ${items[i].display} (${items[i].id})`);
  }
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const answer = await prompt.ask(`\nSelect ${label} [1-${items.length}]: `);
    const idx = parseInt(answer, 10) - 1;
    if (idx >= 0 && idx < items.length) {
      console.log(`→ Selected: ${items[idx].display}`);
      return items[idx].id;
    }
    console.log('Invalid selection, try again.');
  }
}

// ========================= Date shifting =========================

function shiftDates(resource: any, offsetMs: number): void {
  const SHIFT_KEYS = new Set([
    'start',
    'end',
    'date',
    'effectiveDateTime',
    'authoredOn',
    'recordedDate',
    'issued',
    'sent',
    'received',
    'created',
    'occurredDateTime',
    'performedDateTime',
    'whenHandedOver',
    'whenPrepared',
    'dateTime',
    'lastFillDate',
    'writtenDate',
    'effectiveDate',
  ]);

  function walk(obj: any): void {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(walk);
      return;
    }
    for (const k of Object.keys(obj)) {
      if (k === 'birthDate') continue; // DOB is already anonymized
      const v = obj[k];
      if (typeof v === 'string' && SHIFT_KEYS.has(k) && /^\d{4}-\d{2}-\d{2}/.test(v)) {
        const d = new Date(v);
        if (!isNaN(d.getTime())) {
          obj[k] = new Date(d.getTime() + offsetMs).toISOString();
        }
      } else if (typeof v === 'object') {
        walk(v);
      }
    }
  }
  walk(resource);
}

// ========================= Reference rewriting =========================

function rewriteReferences(
  resource: any,
  idMap: Map<string, string>,
  locationId: string,
  practitionerId: string
): void {
  function walk(obj: any): void {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(walk);
      return;
    }
    if (typeof obj.reference === 'string') {
      // Placeholder substitution
      if (obj.reference === 'Practitioner/PLACEHOLDER_PROVIDER') {
        obj.reference = `Practitioner/${practitionerId}`;
      } else if (obj.reference === 'Location/PLACEHOLDER_LOCATION') {
        obj.reference = `Location/${locationId}`;
      } else {
        // Remap old IDs to new IDs
        for (const [oldRef, newRef] of idMap) {
          if (obj.reference === oldRef) {
            obj.reference = newRef;
            break;
          }
        }
      }
    }
    for (const k of Object.keys(obj)) {
      if (typeof obj[k] === 'object') walk(obj[k]);
    }
  }
  walk(resource);
}

// ========================= Normalize to in-person =========================

function normalizeToInPerson(resource: any): void {
  if (resource.resourceType === 'Appointment') {
    // Replace OTTEHR-TM tag with OTTEHR-IP
    if (resource.meta?.tag) {
      for (const tag of resource.meta.tag) {
        if (tag.code === 'OTTEHR-TM') tag.code = 'OTTEHR-IP';
      }
      // Remove telemed-specific tags (lock/status tags handled by assignVisitStatus)
      resource.meta.tag = resource.meta.tag.filter((t: any) => t.code !== 'video-chat-waiting-room-notification');
    }

    // Replace virtual-service-mode with in-person-service-mode in serviceCategory
    if (resource.serviceCategory) {
      for (const sc of resource.serviceCategory) {
        if (sc.coding) {
          for (const c of sc.coding) {
            if (c.code === 'virtual-service-mode') c.code = 'in-person-service-mode';
          }
        }
      }
    }
  }

  if (resource.resourceType === 'Encounter') {
    // Replace virtual class with in-person (ACUTE)
    if (resource.class?.code === 'VR') {
      resource.class = {
        system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html',
        code: 'ACUTE',
        display: 'inpatient acute',
      };
    }
  }
}

// ========================= Visit status assignment =========================

// Distribute appointments across tracking board statuses, 0 cancelled
// Total should exceed expected appointment count; overflow defaults to "arrived"
const STATUS_DISTRIBUTION = [
  // { apptStatus, encStatus, count, needsAdm, needsAtnd }
  { apptStatus: 'booked', encStatus: 'planned', count: 8 }, // → prebooked
  { apptStatus: 'arrived', encStatus: 'arrived', count: 7 }, // → arrived
  { apptStatus: 'checked-in', encStatus: 'arrived', count: 6 }, // → ready
  { apptStatus: 'checked-in', encStatus: 'in-progress', count: 6 }, // → intake
  { apptStatus: 'checked-in', encStatus: 'in-progress', count: 6, needsAdm: true }, // → ready for provider
  { apptStatus: 'checked-in', encStatus: 'in-progress', count: 6, needsAtnd: true }, // → provider
  { apptStatus: 'fulfilled', encStatus: 'finished', count: 6 }, // → discharged
  // Total: 45. Overflow defaults to arrived.
];

let statusSlotIndex = 0;
let statusSlotCount = 0;
const appointmentStatusMap = new Map<string, (typeof STATUS_DISTRIBUTION)[number]>();

function getNextStatusSlot(): (typeof STATUS_DISTRIBUTION)[number] {
  while (statusSlotIndex < STATUS_DISTRIBUTION.length) {
    const slot = STATUS_DISTRIBUTION[statusSlotIndex];
    if (statusSlotCount < slot.count) {
      statusSlotCount++;
      return slot;
    }
    statusSlotIndex++;
    statusSlotCount = 0;
  }
  // Overflow: default to arrived
  return { apptStatus: 'arrived', encStatus: 'arrived', count: 999 };
}

// Tags that should be stripped or rewritten based on the assigned status
const TAGS_TO_STRIP = new Set(['APPOINTMENT_LOCKED', 'video-chat-waiting-room-notification']);
const TAG_SYSTEMS_TO_STRIP = new Set(['appointment-locked-status', 'status-update', 'critical-update-by']);

function assignVisitStatus(resource: any, _index: number, _total: number, _idMap: Map<string, string>): void {
  if (resource.resourceType === 'Appointment') {
    const slot = getNextStatusSlot();
    appointmentStatusMap.set(resource.id, slot);
    resource.status = slot.apptStatus;

    // Clean up tags that conflict with the new status or leak PHI
    if (resource.meta?.tag) {
      resource.meta.tag = resource.meta.tag.filter(
        (t: any) => !TAGS_TO_STRIP.has(t.code) && !TAG_SYSTEMS_TO_STRIP.has(t.system)
      );
    }

    // Remove cancelationReason if status is no longer cancelled
    if (slot.apptStatus !== 'cancelled') {
      delete resource.cancelationReason;
    }
  }

  if (resource.resourceType === 'Encounter') {
    const apptRef = resource.appointment?.[0]?.reference;
    if (apptRef) {
      const origApptId = apptRef.split('/')[1];
      const slot = appointmentStatusMap.get(origApptId);
      if (slot) {
        resource.status = slot.encStatus;

        // Reset statusHistory — use existing period start so it gets date-shifted correctly
        const periodStart =
          resource.period?.start || resource.statusHistory?.[0]?.period?.start || '2026-01-01T12:00:00.000Z';
        resource.statusHistory = [{ status: slot.encStatus, period: { start: periodStart } }];

        // Reset participants: remove ADM/ATND from source, then add based on status
        resource.participant = (resource.participant || []).filter((p: any) => {
          const code = p.type?.[0]?.coding?.[0]?.code;
          return code !== 'ADM' && code !== 'ATND';
        });

        // Add ATND (provider) once the visit has begun (intake and beyond)
        const hasProvider = slot.encStatus === 'in-progress' || slot.encStatus === 'finished';
        if (hasProvider) {
          resource.participant.push({
            type: [
              { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'ATND' }] },
            ],
            individual: { reference: 'Practitioner/PLACEHOLDER_PROVIDER' },
          });
        }

        // Add ADM (admitter) for "ready for provider" and "provider" statuses
        if (slot.needsAdm) {
          resource.participant.push({
            type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'ADM' }] }],
            individual: { reference: 'Practitioner/PLACEHOLDER_PROVIDER' },
          });
        }
      }
    }
  }
}

// ========================= Main =========================

async function main(): Promise<void> {
  const cliArgs = parseArgs();
  const inputPath = cliArgs.input;

  // Select environment
  const envName = cliArgs.env;
  activeEnv = loadEnvConfig(envName);
  console.log(`Environment: ${envName} (project: ${activeEnv.PROJECT_ID})`);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`Loading bundle from ${inputPath}...`);
  const bundle = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  const entries = bundle.entry || [];
  const resources = entries.map((e: any) => e.resource).filter(Boolean);
  console.log(`Loaded ${resources.length} resources`);

  // Authenticate
  console.log('Authenticating...');
  const token = await getToken();

  // Fetch available locations
  console.log('Fetching locations...');
  const locBundle = await fhirSearch(token, 'Location?_count=50');
  const locations = (locBundle.entry || [])
    .map((e: any) => e.resource)
    .filter((r: any) => r?.name)
    .map((r: any) => ({ id: r.id, display: r.name }));

  if (locations.length === 0) {
    console.error('No locations found in the local environment. Create a location first.');
    process.exit(1);
  }

  let locationId: string;
  let practitionerId: string;

  if (cliArgs.locationId) {
    locationId = cliArgs.locationId;
    console.log(`Using location from CLI: ${locationId}`);
  } else {
    const prompt = createPrompt();
    locationId = await selectFromList(prompt, locations, 'Location');
    prompt.close();
  }

  if (cliArgs.practitionerId) {
    practitionerId = cliArgs.practitionerId;
    console.log(`Using practitioner from CLI: ${practitionerId}`);
  } else {
    let found: { id: string; display: string } | null = null;

    // Try --practitioner-search first
    if (cliArgs.practitionerSearch) {
      const searchTerm = cliArgs.practitionerSearch;
      const firstWord = searchTerm.trim().split(/\s+/)[0];
      const practBundle = await fhirSearch(token, `Practitioner?name=${encodeURIComponent(firstWord)}&_count=50`);
      const matches = (practBundle.entry || [])
        .map((e: any) => e.resource)
        .filter((r: any) => {
          if (!r?.name?.[0]) return false;
          const n = r.name[0];
          const display = [n.given?.join(' '), n.family].filter(Boolean).join(' ').toLowerCase();
          return display.includes(searchTerm.toLowerCase());
        })
        .map((r: any) => {
          const n = r.name[0];
          const display = [n.prefix?.join(' '), n.given?.join(' '), n.family].filter(Boolean).join(' ');
          return { id: r.id, display };
        });
      if (matches.length > 0) {
        found = matches[0];
        console.log(`Found practitioner by search: ${found.display} (${found.id})`);
      } else {
        console.log(`No practitioners found matching "${searchTerm}", falling back to auto-select...`);
      }
    }

    // Fallback: find the first real practitioner (not M2M or E2E test user)
    if (!found) {
      console.log('Searching for a suitable practitioner...');
      const practBundle = await fhirSearch(token, 'Practitioner?_count=200');
      const candidates = (practBundle.entry || [])
        .map((e: any) => e.resource)
        .filter((r: any) => {
          if (!r?.name?.[0]) return false;
          const n = r.name[0];
          const display = [n.given?.join(' '), n.family].filter(Boolean).join(' ').toLowerCase();
          if (display.includes('m2m client')) return false;
          if (display.includes('employeeteste2e')) return false;
          if (display.includes('e2euser')) return false;
          if (!n.family || n.family === 'undefined') return false;
          return true;
        })
        .map((r: any) => {
          const n = r.name[0];
          const display = [n.prefix?.join(' '), n.given?.join(' '), n.family].filter(Boolean).join(' ');
          return { id: r.id, display };
        });

      if (candidates.length > 0) {
        found = candidates[0];
        console.log(`Auto-selected practitioner: ${found.display} (${found.id})`);
      }
    }

    // Last resort: pick any practitioner at all
    if (!found) {
      console.log('No named practitioners found, picking any available practitioner...');
      const anyBundle = await fhirSearch(token, 'Practitioner?_count=1');
      const any = (anyBundle.entry || [])[0]?.resource;
      if (any) {
        const n = any.name?.[0];
        const display = n ? [n.given?.join(' '), n.family].filter(Boolean).join(' ') : any.id;
        found = { id: any.id, display };
        console.log(`Using practitioner: ${found.display} (${found.id})`);
      }
    }

    if (!found) {
      console.error('No practitioners found in the environment. Create one first.');
      process.exit(1);
    }

    practitionerId = found.id;
  }

  // Compute date shift: read reference date from bundle, shift to today
  if (!bundle._summary?.referenceDate) {
    console.error('Bundle is missing _summary.referenceDate. Regenerate the data file.');
    process.exit(1);
  }
  const referenceDate = new Date(bundle._summary.referenceDate);
  const targetDate = new Date();
  const dateShiftMs = targetDate.getTime() - referenceDate.getTime();
  console.log(
    `\nDate shift: ${referenceDate.toISOString().slice(0, 10)} → ${targetDate
      .toISOString()
      .slice(0, 10)} (offset: ${Math.round(dateShiftMs / 3600000)}h)`
  );

  // Skip placeholder resources
  const realResources = resources.filter(
    (r: any) => !r._placeholder && r.resourceType !== 'Practitioner' && r.resourceType !== 'Location'
  );

  // Order by dependency: Patient first, then RelatedPerson, then the rest
  const priority: Record<string, number> = {
    Patient: 0,
    RelatedPerson: 1,
    Appointment: 2,
    Encounter: 3,
    Coverage: 4,
    Consent: 5,
    QuestionnaireResponse: 6,
    ClinicalImpression: 7,
    DocumentReference: 8,
  };
  realResources.sort((a: any, b: any) => (priority[a.resourceType] ?? 10) - (priority[b.resourceType] ?? 10));

  console.log(`\nImporting ${realResources.length} resources...\n`);

  const idMap = new Map<string, string>(); // "Type/oldId" → "Type/newId"
  let success = 0;
  let failed = 0;

  for (let i = 0; i < realResources.length; i++) {
    const resource = JSON.parse(JSON.stringify(realResources[i]));
    const oldId = resource.id;
    const oldRef = `${resource.resourceType}/${oldId}`;

    // Normalize all appointments to in-person and set visit status
    normalizeToInPerson(resource);
    assignVisitStatus(resource, i, realResources.length, idMap);

    // Shift dates to today
    shiftDates(resource, dateShiftMs);

    // Rewrite references
    rewriteReferences(resource, idMap, locationId, practitionerId);

    try {
      const created = await fhirPost(token, resource);
      const newId = created.id;
      idMap.set(oldRef, `${resource.resourceType}/${newId}`);
      success++;
      if (success % 50 === 0 || i < 5) {
        console.log(`  [${success}/${realResources.length}] ${resource.resourceType}/${oldId} → ${newId}`);
      }
    } catch (err: any) {
      failed++;
      // Use identity mapping so downstream refs don't break
      idMap.set(oldRef, oldRef);
      if (failed <= 10) {
        console.error(`  FAIL ${resource.resourceType}/${oldId}: ${err.message.substring(0, 150)}`);
      }
    }
  }

  console.log(`\n=== Import complete ===`);
  console.log(`Success: ${success}, Failed: ${failed}, Total: ${realResources.length}`);

  // Print summary of created patients with their appointment URLs
  const patientMappings = [...idMap.entries()].filter(([old]) => old.startsWith('Patient/'));
  const appointmentMappings = [...idMap.entries()].filter(([old]) => old.startsWith('Appointment/'));
  console.log(`\nCreated ${patientMappings.length} patients and ${appointmentMappings.length} appointments`);
  // Determine base URL for sample links
  const ehrBaseUrl =
    envName === 'local'
      ? 'http://localhost:4002'
      : envName === 'demo'
      ? 'https://ehr.ottehr.com'
      : `https://ehr-${envName}.ottehr.com`;
  console.log(`\nSample appointment URLs:`);
  for (const [, newRef] of appointmentMappings.slice(0, 5)) {
    const newId = newRef.split('/')[1];
    console.log(`  ${ehrBaseUrl}/in-person/${newId}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
