/**
 * synthesize-visit.ts — Stage 2 of the synthetic-patient-data pipeline.
 *
 * Reads a VisitScenario JSON, validates it against the Zod schema, and walks
 * through the synthesis plan documented in README.md (§9). Each phase is a
 * function that takes a SynthesisContext and either logs the planned call
 * (--dry-run) or actually executes it against an Oystehr environment
 * (--execute), threading resolved IDs through the context.
 *
 * Currently implemented for --execute:
 *   Phase 0   — Prerequisite lookups (read-only FHIR searches + list-templates).
 *   Phase 0.5 — Create slot on the resolved schedule.
 *   Phase 1   — create-appointment (creates Patient, Coverage, Appointment,
 *               Encounter, initial QuestionnaireResponse, RelatedPerson).
 *   Phase 1.5 — Intake QR fill: uploads scenario fixture images (ID cards,
 *               insurance cards) to Z3 via get-presigned-file-url + signed
 *               PUT, slots the Z3 URLs into the QR's photo-id and insurance
 *               pages as valueAttachments, and walks the QR page-by-page
 *               via patch-paperwork. Final consent-page submission triggers
 *               sub-intake-harvest, which converts attachments into
 *               DocumentReferences on the patient's photo-ID/insurance Lists.
 *   Phase 1.7 — assign-practitioner (ATND): attending practitioner assigned
 *               early so later module phases that require an attender work.
 *               (Formal lifecycle assigns at Phase 13 — pulled forward.)
 *   Phase 3   — save-chart-data Pass 1: vitals, allergies, medications, PMH
 *               (conditions), surgical history, hospitalizations, screening,
 *               css-notes, reason-for-visit, patient-info-confirmed.
 *   Phase 4   — apply-template: applies a global template to the encounter
 *               (CC/HPI/ROS/exam/MDM/diagnoses/CPT/E&M/instructions). The
 *               zambda returns an empty body — created resource IDs are
 *               recovered via FHIR search in Phase 5.
 *   Phase 5   — save-chart-data Pass 2: procedures (Procedures-screen
 *               ServiceRequests) cross-referencing template-created
 *               Conditions/CPT Procedures, plus disposition + follow-ups.
 *   Phase 6   — In-house lab orders: get test catalog, create order, collect
 *               specimen. Final result entry (handle-in-house-lab-results)
 *               not yet wired — needs ResultEntryInput keyed by
 *               observationDefinitionId from testItem.components.
 *   Phase 7   — In-house medication orders (resolves Medication by name,
 *               maps route abbreviations to SNOMED).
 *   Phase 8   — Immunization orders (create + administer).
 *   Phase 9   — Radiology orders (create + preliminary report).
 *   Phase 10  — Eligibility & pricing: charge-master + fee-schedule setup
 *               via RCM zambdas (idempotent), Coverage enrichment with
 *               plan/group class entries, payer Organization telecom
 *               backfill, and synthesis of CoverageEligibilityRequest +
 *               CoverageEligibilityResponse with realistic copay/deductible/
 *               OOP-max benefits (raw-request/raw-response extensions
 *               shaped like the pVerify/Candid response the EHR parses).
 *   Phase 13  — Visit-status walk + intake-practitioner assignment:
 *               arrived → ready → intake → ready for provider → provider
 *               → discharged → completed. The walk truncates at
 *               `scenario.visit.targetStatus` (default 'completed') so
 *               scenarios can be parked at any lifecycle state for
 *               dashboard-distribution demos. Clinical phases (3–12) ALWAYS
 *               run regardless — chart can be fully populated even on
 *               early-lifecycle visits, mirroring real EHR workflow where
 *               intake nurses enter vitals while the provider is still away.
 *   Phase 13.5 — Backdate Encounter.statusHistory with realistic LOS gaps.
 *               The change-in-person-visit-status zambda stamps every
 *               transition with DateTime.now() (correct for prod, useless
 *               for synth — every in-room phase ends up at 0 mins). PATCHes
 *               Encounter.statusHistory directly to spread the lifecycle
 *               over realistic minute gaps anchored to appointment.start.
 *               (See README §2.3.5; this is one of the two documented
 *               exceptions to the "drive everything through zambdas" rule.)
 *   Phase 14  — Sign-off (sign-appointment, locks the visit, triggers
 *               visit-note PDF subscription). Skipped when targetStatus is
 *               not 'completed' so the visit remains editable / unlocked.
 *
 * Phase 2 (Z3 fixture uploads — superseded by Phase 1.5, kept as a no-op
 * narrative log for compatibility with the README phase numbering),
 * Phase 11 (appointment notes), and Phase 12 (patient education) are
 * plan-only — they log what they would do but do NOT write to the FHIR
 * datastore.
 *
 * Use --execute against an environment to run the full pipeline (Phase 0
 * through Phase 14 sign-off), producing a complete signed visit on the target
 * project: Patient + Appointment + Encounter + intake-harvested demographics,
 * Coverage, RelatedPerson, photo-ID/insurance DocumentReferences, chart-data
 * (vitals/allergies/etc.), template-applied narrative, orders (in-house
 * meds/labs, immunizations, radiology), full status walk, and visit-note PDF.
 *
 * Usage:
 *   npx tsx scripts/synthetic-patient-data/synthesize-visit.ts <scenario.json> [--execute]
 *
 * Defaults to dry-run.
 *
 * Env (required when --execute):
 *   AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE,
 *   PROJECT_ID, PROJECT_API
 *   ZAMBDA_API (optional — defaults to http://localhost:3000/local so zambda
 *               calls hit the local-server emulator running your current
 *               source. The /local suffix is REQUIRED for the emulator to
 *               match routes; do not strip it. Override only if you want to
 *               exercise the deployed cloud zambdas (rare; in that case use
 *               the project API base, e.g. https://project-api.zapehr.com/v1,
 *               with no /local).)
 *
 * Recommended invocation:
 *   npx env-cmd -f packages/zambdas/.env/<env>.json \
 *     npx tsx scripts/synthetic-patient-data/synthesize-visit.ts \
 *     scripts/synthetic-patient-data/examples/jane-doe-urgent-care.json --execute
 */
import Oystehr from '@oystehr/sdk';
import type {
  AllergyIntolerance,
  ChargeItemDefinition,
  Condition,
  Coverage,
  CoverageEligibilityRequest,
  CoverageEligibilityResponse,
  EpisodeOfCare,
  Location,
  Medication,
  MedicationStatement,
  Organization,
  Patient,
  Practitioner,
  Procedure,
  RelatedPerson,
  Schedule,
} from 'fhir/r4b';
import * as fs from 'fs';
import { readFileSync } from 'fs';
import { DateTime } from 'luxon';
import * as path from 'path';
import { resolve } from 'path';
import { finalizeInHouseLabs, finalizeRadiology } from './finalize-visit-orders';
import { type History as ScenarioHistory, type VisitScenario, VisitScenarioSchema } from './schema';
import { STATUS_GAP_DISTRIBUTIONS, SYNTHETIC_PATIENT_ID_SYSTEM, VISIT_STATUS_ORDER } from './shared/constants';
import { withRetry } from './shared/retry';

// ── Argument parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(
    'Usage: tsx synthesize-visit.ts <scenario.json> [--execute] [--practitioner <name|auto>] [--location <name>]'
  );
  console.log('');
  console.log('  --practitioner <name>   Override scenario.signOff.practitionerName for the');
  console.log('                          attending lookup. Use when running against a project');
  console.log("                          that lacks the scenario's named practitioner. Pass");
  console.log("                          'auto' to skip the named search and auto-pick from");
  console.log('                          the role-assigned employee list. Also settable via');
  console.log('                          SYNTH_PRACTITIONER_NAME env var (CLI takes precedence).');
  console.log('  --location <name>       Override scenario.visit.locationName for the Location');
  console.log('                          lookup. Use when running against a project where the');
  console.log('                          scenario\'s location ("New York" in shipped scenarios)');
  console.log("                          doesn't exist. Also settable via SYNTH_LOCATION_NAME");
  console.log('                          env var (CLI takes precedence).');
  process.exit(args.length === 0 ? 1 : 0);
}

const isExecute = args.includes('--execute');
function getFlagValue(name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx === -1 || idx === args.length - 1 ? undefined : args[idx + 1];
}
const practitionerOverride = getFlagValue('--practitioner') ?? process.env.SYNTH_PRACTITIONER_NAME;
const locationOverride = getFlagValue('--location') ?? process.env.SYNTH_LOCATION_NAME;
const intakeOverride = getFlagValue('--intake') ?? process.env.SYNTH_INTAKE_NAME;
const positional = args.filter((a, i) => {
  if (a.startsWith('--')) return false;
  // Skip values consumed by --practitioner / --location / --intake (next arg after each flag).
  const prev = i > 0 ? args[i - 1] : '';
  return prev !== '--practitioner' && prev !== '--location' && prev !== '--intake';
});
if (positional.length !== 1) {
  console.error('Expected exactly one scenario file path.');
  process.exit(1);
}
const scenarioPath = resolve(positional[0]);

// ── Load + validate scenario ─────────────────────────────────────────────────

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(scenarioPath, 'utf-8'));
} catch (err) {
  console.error(`Failed to read scenario file at ${scenarioPath}:`);
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const parsed = VisitScenarioSchema.safeParse(raw);
if (!parsed.success) {
  console.error(`Scenario failed schema validation (${parsed.error.issues.length} issue(s)):`);
  for (const issue of parsed.error.issues) {
    const path = issue.path.length === 0 ? '<root>' : issue.path.join('.');
    console.error(`  ${path} — ${issue.message}`);
  }
  process.exit(1);
}
const scenario = parsed.data;

// ── Synthesis context ─────────────────────────────────────────────────────────

type Mode = 'plan' | 'execute';

interface SynthesisContext {
  mode: Mode;
  oystehr: Oystehr | null;
  accessToken: string | null;
  projectId: string | null;
  projectApi: string | null;
  zambdaApi: string | null;
  scenario: VisitScenario;
  scenarioPath: string;
  // CLI/env override for the attending practitioner lookup (--practitioner
  // <name|auto> or SYNTH_PRACTITIONER_NAME env var). 'auto' = skip the named
  // search and pick from role-assigned employees; any other value replaces
  // scenario.signOff.practitionerName for the Phase 0 lookup.
  practitionerOverride?: string;
  // CLI/env override for the Location lookup (--location <name> or
  // SYNTH_LOCATION_NAME env var). Replaces scenario.visit.locationName for
  // the Phase 0 lookup. Useful when running a scenario against a project
  // where the scenario's preferred location doesn't exist.
  locationOverride?: string;
  // CLI/env override for the intake-staff lookup (--intake <name> or
  // SYNTH_INTAKE_NAME env var). When set, the intake performer (the MA who does
  // vitals/screening in the Phase 13 status walk) is resolved by name instead
  // of auto-picked. Falls back to auto-pick if the name isn't found.
  intakeOverride?: string;
  // Resolved in Phase 0:
  locationId?: string;
  scheduleId?: string;
  attendingPractitionerId?: string;
  intakeStaffId?: string;
  payerOrganizationId?: string;
  vaccineMedicationsByName?: Record<string, string>;
  // Resolved in Phase 0.5 (create-slot):
  slotId?: string;
  // Resolved in Phase 1:
  patientId?: string;
  appointmentId?: string;
  encounterId?: string;
  questionnaireResponseId?: string;
  // Captured from apply-template (Phase 4):
  templateConditionIds?: string[];
  templateCptProcedureIds?: string[];
}

// ── SDK setup ─────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function createOystehr(): Promise<{
  oystehr: Oystehr;
  accessToken: string;
  projectId: string;
  projectApi: string;
  zambdaApi: string;
}> {
  // Env var names are AUTH0_* for compatibility with the broader Ottehr
  // .env files, but the surface here is "Oystehr IAM": an OAuth 2.0 client-
  // credentials exchange for an M2M access token. If the underlying IAM
  // vendor changes, the prose stays accurate even if the env vars don't.
  const oystehrAuthEndpoint = requireEnv('AUTH0_ENDPOINT');
  const oystehrAuthClient = requireEnv('AUTH0_CLIENT');
  const oystehrAuthSecret = requireEnv('AUTH0_SECRET');
  const oystehrAuthAudience = requireEnv('AUTH0_AUDIENCE');
  const projectId = requireEnv('PROJECT_ID');
  const projectApi = requireEnv('PROJECT_API');
  // The synth pipeline always routes zambda calls through the local Express
  // zambda server (`packages/zambdas/src/local-server`), which runs the
  // current source — never the cloud-deployed copy that may be stale. The
  // local server uses the same M2M token + FHIR backend, so resources still
  // land in the target Oystehr project. Override with ZAMBDA_API only if you
  // explicitly want to hit a remote zambda runtime (rarely useful).
  const zambdaApi = process.env.ZAMBDA_API ?? 'http://localhost:3000/local';

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
  const oystehr = new Oystehr({
    accessToken: tokenData.access_token,
    projectId,
    services: {
      projectApiUrl: projectApi,
      zambdaApiUrl: zambdaApi,
    },
  });
  return { oystehr, accessToken: tokenData.access_token, projectId, projectApi, zambdaApi };
}

// ── Logging helpers ───────────────────────────────────────────────────────────

let phaseCounter = 0;
function startPhase(title: string): void {
  console.log('');
  console.log(`── Phase ${phaseCounter}: ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
  phaseCounter += 1;
}

function logCall(zambdaId: string, body: Record<string, unknown>): void {
  console.log(`  zambda.execute('${zambdaId}')`);
  for (const [k, v] of Object.entries(body)) {
    const rendered = typeof v === 'object' ? JSON.stringify(v) : String(v);
    const truncated = rendered.length > 80 ? rendered.slice(0, 77) + '...' : rendered;
    console.log(`    ${k}: ${truncated}`);
  }
}

function logFhir(op: string, detail: string): void {
  console.log(`  fhir.${op} — ${detail}`);
}

function logNote(text: string): void {
  console.log(`  • ${text}`);
}

// ── Phase 0 — prerequisite lookups ────────────────────────────────────────────

async function phase0_lookups(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  startPhase('Prerequisite lookups (FHIR searches)');

  // Location
  // CLI / env override (--location <name> or SYNTH_LOCATION_NAME). Lets a
  // single scenario JSON run against multiple Oystehr projects without
  // editing the scenario itself.
  const locationNameToUse = ctx.locationOverride ?? s.visit.locationName;
  if (ctx.locationOverride) {
    logNote(`location override: "${ctx.locationOverride}" (replacing scenario's "${s.visit.locationName}")`);
  }
  logFhir('search', `Location with name="${locationNameToUse}"`);
  if (ctx.mode === 'execute' && ctx.oystehr) {
    const result = await ctx.oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [{ name: 'name', value: locationNameToUse }],
    });
    const location = result.unbundle()[0];
    if (!location?.id)
      throw new Error(`Location not found: "${locationNameToUse}". Pass --location <existing-name> to override.`);
    ctx.locationId = location.id;
    logNote(`resolved Location → ${ctx.locationId}`);
  }

  // Schedule for the location
  logFhir('search', `Schedule for resolved Location`);
  if (ctx.mode === 'execute' && ctx.oystehr) {
    const result = await ctx.oystehr.fhir.search<Schedule>({
      resourceType: 'Schedule',
      params: [{ name: 'actor', value: `Location/${ctx.locationId}` }],
    });
    const schedule = result.unbundle()[0];
    if (!schedule?.id) throw new Error(`Schedule not found for Location ${ctx.locationId}`);
    ctx.scheduleId = schedule.id;
    logNote(`resolved Schedule → ${ctx.scheduleId}`);
  }

  // Attending practitioner
  // Fetch role-assigned employees via get-employees. Only practitioners with
  // active EHR role membership (Provider/Administrator/etc.) are valid options
  // for the EHR's role-assignment dropdowns — picking by FHIR Practitioner
  // alone gives MUI "out-of-range" warnings for any unassigned practitioner.
  const roleAssignedIds: Set<string> = new Set();
  if (ctx.mode === 'execute' && ctx.oystehr) {
    try {
      const employeesRes = await fetch(`${ctx.zambdaApi}/zambda/get-employees/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.accessToken}`,
          'x-zapehr-project-id': ctx.projectId ?? '',
        },
        body: JSON.stringify({}),
      });
      if (employeesRes.ok) {
        const j = (await employeesRes.json()) as {
          output?: { employees?: Array<{ profile?: string; id?: string; status?: string }> };
          employees?: Array<{ profile?: string; id?: string; status?: string }>;
        };
        const list = j.output?.employees ?? j.employees ?? [];
        for (const e of list) {
          if (e.status && e.status !== 'Active') continue;
          // Only collect employees whose profile is a Practitioner. Some
          // projects (e.g., demo) have role-assigned users whose profile is
          // Patient/<id> or Device/<id> — assigning those as intake-staff or
          // attending would later produce "Practitioner/Patient/<id>" (the
          // assign-practitioner zambda blindly prepends "Practitioner/").
          // e.id is a user id, not a Practitioner id, so we can't fall back
          // to it — just skip the employee entirely.
          if (!e.profile?.startsWith('Practitioner/')) continue;
          const id = e.profile.replace('Practitioner/', '');
          if (id) roleAssignedIds.add(id);
        }
        logNote(`role-assigned practitioners: ${roleAssignedIds.size}`);
      } else {
        console.warn(`  ⚠ get-employees failed: ${employeesRes.status}`);
      }
    } catch (err) {
      console.warn(`  ⚠ get-employees errored: ${err instanceof Error ? err.message : err}`);
    }
  }

  // CLI / env override (--practitioner <name|auto> or SYNTH_PRACTITIONER_NAME).
  // Lets a single scenario JSON run against multiple Oystehr projects without
  // editing the scenario itself: pass an existing practitioner's name on the
  // target project, or 'auto' to skip the named search and pick from the
  // role-assigned employee list. Useful when running synth against a local-dev
  // project that doesn't have the scenario's preferred "Demo Admin" user.
  const practitionerNameToUse =
    ctx.practitionerOverride === 'auto' ? undefined : ctx.practitionerOverride ?? s.signOff?.practitionerName;
  if (ctx.practitionerOverride) {
    logNote(
      ctx.practitionerOverride === 'auto'
        ? 'practitioner override: auto-pick (skipping named search)'
        : `practitioner override: "${ctx.practitionerOverride}" (replacing scenario's "${
            s.signOff?.practitionerName ?? 'unset'
          }")`
    );
  }

  if (practitionerNameToUse) {
    logFhir('search', `Practitioner with name="${practitionerNameToUse}" (attending)`);
    if (ctx.mode === 'execute' && ctx.oystehr) {
      // FHIR Practitioner search by `name` doesn't match across given+family; split to given+family.
      const parts = practitionerNameToUse.split(/\s+/).filter(Boolean);
      const family = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      const given = parts.length > 1 ? parts.slice(0, -1).join(' ') : undefined;
      const params: Array<{ name: string; value: string }> = [{ name: 'family', value: family }];
      if (given) params.push({ name: 'given', value: given });
      const result = await ctx.oystehr.fhir.search<Practitioner>({ resourceType: 'Practitioner', params });
      const practitioner = result.unbundle()[0];
      if (!practitioner?.id) {
        throw new Error(
          `Practitioner not found: "${practitionerNameToUse}" (searched given="${given}" family="${family}"). ` +
            `Pass --practitioner <existing-name> or --practitioner auto to override.`
        );
      }
      if (roleAssignedIds.size && !roleAssignedIds.has(practitioner.id)) {
        const fallback = roleAssignedIds.values().next().value;
        console.warn(
          `  ⚠ "${practitionerNameToUse}" (${practitioner.id}) is not a role-assigned employee — falling back to ${fallback} so EHR Select dropdowns recognize the assignment`
        );
        ctx.attendingPractitionerId = fallback;
      } else {
        ctx.attendingPractitionerId = practitioner.id;
      }
      logNote(`resolved Practitioner → ${ctx.attendingPractitionerId}`);
    }
  } else {
    logFhir('search', `Practitioner — auto-pick attending`);
    if (ctx.mode === 'execute' && ctx.oystehr) {
      const fromRoles = roleAssignedIds.values().next().value;
      if (fromRoles) {
        ctx.attendingPractitionerId = fromRoles;
      } else {
        const result = await ctx.oystehr.fhir.search<Practitioner>({
          resourceType: 'Practitioner',
          params: [{ name: '_count', value: '1' }],
        });
        const practitioner = result.unbundle()[0];
        if (!practitioner?.id) throw new Error('No Practitioners exist on this project');
        ctx.attendingPractitionerId = practitioner.id;
      }
      logNote(`auto-picked Practitioner → ${ctx.attendingPractitionerId}`);
    }
  }

  // Intake staff — must also be role-assigned. Prefer a different employee
  // from attending; if only one role-assigned employee exists (typical of
  // synth projects), reuse them as both intake and attending — that matches
  // the small-clinic case and avoids EHR Select out-of-range warnings.
  logFhir('search', `Practitioner — intake staff`);
  if (ctx.mode === 'execute' && ctx.oystehr) {
    // Named intake override (--intake <name>): resolve the MA by name so the
    // intake performer is a real medical assistant, not an arbitrary employee.
    if (ctx.intakeOverride) {
      const parts = ctx.intakeOverride.split(/\s+/).filter(Boolean);
      const family = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      const given = parts.length > 1 ? parts.slice(0, -1).join(' ') : undefined;
      const params: Array<{ name: string; value: string }> = [{ name: 'family', value: family }];
      if (given) params.push({ name: 'given', value: given });
      const found = (
        await ctx.oystehr.fhir.search<Practitioner>({ resourceType: 'Practitioner', params })
      ).unbundle()[0];
      if (found?.id) {
        ctx.intakeStaffId = found.id;
        logNote(`resolved intake staff "${ctx.intakeOverride}" → ${ctx.intakeStaffId}`);
      } else {
        console.warn(`  ⚠ intake "${ctx.intakeOverride}" not found — falling back to auto-pick`);
      }
    }
    const candidates = [...roleAssignedIds].filter((id) => id !== ctx.attendingPractitionerId);
    if (ctx.intakeStaffId) {
      // already resolved by name override
    } else if (candidates.length) {
      ctx.intakeStaffId = candidates[0];
    } else if (ctx.attendingPractitionerId) {
      ctx.intakeStaffId = ctx.attendingPractitionerId;
    } else {
      const result = await ctx.oystehr.fhir.search<Practitioner>({
        resourceType: 'Practitioner',
        params: [{ name: '_count', value: '10' }],
      });
      const practitioners = result.unbundle();
      const intake = practitioners.find((p) => p.id !== ctx.attendingPractitionerId) ?? practitioners[0];
      if (!intake?.id) throw new Error('No Practitioner available for intake staff');
      ctx.intakeStaffId = intake.id;
    }
    logNote(`auto-picked intake staff → ${ctx.intakeStaffId}`);
  }

  // Payer organization
  if (s.patient.insurance?.primary) {
    const carrier = s.patient.insurance.primary.carrier;
    logFhir('search', `Organization name:contains="${carrier}" (payer, type=pay)`);
    if (ctx.mode === 'execute' && ctx.oystehr) {
      // `name:contains` matches the carrier as a substring — needed because
      // copied payers from demo are state-specific ("TN BCBS", "Aetna Better
      // Health of Kansas") and our scenarios use generic names like "Blue
      // Cross Blue Shield" or "Aetna".
      const result = await ctx.oystehr.fhir.search<Organization>({
        resourceType: 'Organization',
        params: [
          { name: 'name:contains', value: carrier },
          { name: 'type', value: 'http://terminology.hl7.org/CodeSystem/organization-type|pay' },
          { name: '_count', value: '1' },
        ],
      });
      const org = result.unbundle()[0];
      if (org?.id) {
        ctx.payerOrganizationId = org.id;
        logNote(`resolved Organization → ${ctx.payerOrganizationId} ("${org.name}")`);
      } else {
        throw new Error(
          `No payer Organization with name containing "${carrier}" found on this project. Bootstrap step missing — run scripts/synthetic-patient-data/copy-payer-organizations.ts to copy real payer Orgs (with their Candid payer-id identifiers) from a working environment.`
        );
      }
    }
  }

  // Template existence verification
  if (s.template) {
    const examType = s.template.examType ?? (s.visit.type === 'in-person' ? 'inPerson' : 'telemed');
    logCall('list-templates', { examType, includeVersionData: false });
    if (ctx.mode === 'execute' && ctx.oystehr) {
      const result = (await ctx.oystehr.zambda.execute({
        id: 'list-templates',
        examType,
        includeVersionData: false,
      })) as {
        status?: number;
        output?: { templates?: Array<{ title?: string; name?: string }> };
        templates?: Array<{ title?: string; name?: string }>;
        list?: Array<{ title?: string; name?: string }>;
      };
      const templates = result.output?.templates ?? result.templates ?? result.list ?? [];
      const found = templates.some((t) => t.title === s.template!.name || t.name === s.template!.name);
      if (!found) {
        // Hard fail — earlier behavior was a warn that let Phase 4 proceed.
        // The apply-template zambda silently no-ops for most missing template
        // names (returning 200 with nothing applied), so a missing template
        // produced a clinically-empty visit (no CC/HPI/ROS/exam/MDM/dx/CPT/
        // instructions) instead of the loud failure the user expects. For
        // a few names like "UTI" the zambda returns 500 instead of no-op,
        // so the failure mode was inconsistent. Throwing here surfaces the
        // missing-template prerequisite cleanly.
        const sample = templates
          .slice(0, 10)
          .map((t) => `"${t.title ?? t.name}"`)
          .join(', ');
        throw new Error(
          `Template "${s.template.name}" not found on this project. ` +
            `list-templates returned ${templates.length} template(s)${
              sample ? `: ${sample}${templates.length > 10 ? ', …' : ''}` : ''
            }. ` +
            `Bootstrap with copy-templates.ts to import templates from a known-good source project.`
        );
      }
      logNote(`verified template "${s.template.name}" exists`);
    } else {
      logNote(`verify template "${s.template.name}" appears in the list`);
    }
  }

  // Vaccine catalog (only if scenario has immunizations)
  if (s.modules?.immunizations?.length) {
    logFhir('search', `Medication catalog for vaccine names`);
    if (ctx.mode === 'execute' && ctx.oystehr) {
      ctx.vaccineMedicationsByName = {};
      for (const imm of s.modules.immunizations) {
        try {
          const result = await ctx.oystehr.fhir.search<Medication>({
            resourceType: 'Medication',
            params: [{ name: 'code', value: imm.vaccineName }],
          });
          const med = result.unbundle()[0];
          if (!med?.id) {
            console.warn(
              `  ⚠ vaccine Medication not found: "${imm.vaccineName}" — Phase 8 (immunization) will fail if enabled`
            );
            continue;
          }
          ctx.vaccineMedicationsByName[imm.vaccineName] = med.id;
          logNote(`resolved Medication "${imm.vaccineName}" → ${med.id}`);
        } catch (err) {
          console.warn(
            `  ⚠ vaccine Medication search failed for "${imm.vaccineName}" (${
              err instanceof Error ? err.message : err
            }) — Phase 8 will fail if enabled`
          );
        }
      }
    }
  }
}

// ── Phase 0.5 — create slot ───────────────────────────────────────────────────

function computeSlotStartISO(scenario: VisitScenario): string {
  // Round up to the next 15-min boundary from now — used both as a fallback
  // and as the override when scenario's date+time is in the past.
  const nextFutureSlot = (): string => {
    const now = new Date();
    const minutes = now.getMinutes();
    const minutesToAdd = (15 - (minutes % 15)) % 15 || 15;
    // Per-visit scaffold offset (minutes): when many backdated visits run
    // concurrently they'd otherwise all pick the SAME next-15-min slot, and a
    // schedule slot can only be booked once (create-appointment → 4019 "slot
    // unavailable"). The orchestrator passes a unique offset per visit via
    // SYNTH_SCAFFOLD_OFFSET_MIN so each gets a distinct future slot. The slot is
    // backdated to the real date in Phase 15, so this future time is throwaway.
    const offsetMin = parseInt(process.env.SYNTH_SCAFFOLD_OFFSET_MIN ?? '0', 10) || 0;
    const s = new Date(now.getTime() + (minutesToAdd + offsetMin) * 60_000);
    s.setSeconds(0, 0);
    return s.toISOString();
  };

  if (!scenario.visit.time) return nextFutureSlot();

  // Scenario provides date+time — use it if it's in the future, else fall back.
  const candidateISO = `${scenario.visit.date}T${scenario.visit.time}:00.000Z`;
  const candidate = new Date(candidateISO);
  if (Number.isNaN(candidate.getTime()) || candidate.getTime() <= Date.now()) {
    console.warn(
      `  ⚠ scenario.visit.date+time (${candidateISO}) is in the past — using next future 15-min slot instead`
    );
    return nextFutureSlot();
  }
  return candidateISO;
}

/**
 * The historical date+time the scenario actually wants this visit dated to.
 * Returns null when the scenario time is in the future (or absent) — in that
 * case the slot the harness created IS the real time and no backdate is needed.
 *
 * create-slot / create-appointment reject past slots, so the pipeline always
 * books at a near-future slot (computeSlotStartISO) and Phase 15 translates the
 * finished visit back to this datetime. See phase15_backdateVisitToHistory.
 */
function intendedHistoricalStart(scenario: VisitScenario): DateTime | null {
  if (!scenario.visit.time) return null;
  const iso = `${scenario.visit.date}T${scenario.visit.time}`;
  const dt = DateTime.fromISO(iso, { zone: 'utc' });
  if (!dt.isValid) return null;
  // Leave a small buffer so a "today, a few minutes ago" scenario isn't shifted.
  return dt.toMillis() < Date.now() - 60_000 ? dt : null;
}

async function phase0_5_createSlot(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  startPhase('Create slot');

  // Historical visits book a WALK-IN slot at the real past date+time. walkin:true
  // (a) lets create-slot accept a past startISO (it otherwise requires future),
  // and (b) marks the slot walk-in so create-appointment skips its schedule
  // capacity/availability guard entirely (capacityGuardApplies → false). This is
  // both robust (no schedule-hours/capacity/orphan-slot fragility) and more
  // correct — urgent-care visits ARE walk-ins. Future/today visits keep the
  // normal scheduled-slot path. The slot lands historically, so Phase 15 is a
  // no-op for these.
  const historical = intendedHistoricalStart(s);
  const startISO = historical ? historical.toUTC().toISO()! : computeSlotStartISO(s);
  const walkin = historical != null;
  const body = {
    scheduleId: ctx.scheduleId ?? '<resolved in Phase 0>',
    startISO,
    lengthInMinutes: 15,
    serviceModality: s.visit.type === 'in-person' ? 'in-person' : 'virtual',
    serviceCategoryCode: 'urgent-care',
    walkin,
  };
  logCall('create-slot (execute-public)', body);

  if (ctx.mode === 'execute' && ctx.oystehr) {
    // create-slot is registered as /execute-public — the SDK's zambda.execute() hits /execute,
    // so we call it via direct fetch.
    const res = await fetch(`${ctx.zambdaApi}/zambda/create-slot/execute-public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.accessToken}`,
        'x-zapehr-project-id': ctx.projectId ?? '',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`create-slot failed: ${res.status} ${await res.text()}`);
    }
    const result = (await res.json()) as { id?: string; output?: { id?: string } };
    const slotId = result.output?.id ?? result.id;
    if (!slotId) {
      throw new Error(`create-slot returned unexpected shape: ${JSON.stringify(result).slice(0, 200)}`);
    }
    ctx.slotId = slotId;
    logNote(`slotId=${ctx.slotId}`);
  } else {
    logNote('returns: { id }');
  }
}

// ── Phase 1 — create-appointment ──────────────────────────────────────────────

/**
 * Build a deterministic identifier value from scenario.patient — used to
 * dedupe patients across re-runs of the same scenario.
 */
function synthIdentifierValue(patient: VisitScenario['patient']): string {
  const slug = (s: string): string =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `${slug(patient.firstName)}-${slug(patient.lastName)}-${patient.dateOfBirth}`;
}

async function phase1_createAppointment(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  startPhase('Create appointment');

  const synthId = synthIdentifierValue(s.patient);

  // Look up an existing Patient with this synth identifier (for dedup).
  let existingPatientId: string | undefined;
  if (ctx.mode === 'execute' && ctx.oystehr) {
    const result = await ctx.oystehr.fhir.search({
      resourceType: 'Patient',
      params: [{ name: 'identifier', value: `${SYNTHETIC_PATIENT_ID_SYSTEM}|${synthId}` }],
    });
    existingPatientId = result.unbundle()[0]?.id;
    if (existingPatientId) {
      logNote(`existing Patient found by synth identifier "${synthId}" → ${existingPatientId} (will reuse)`);
    } else {
      logNote(`no Patient with synth identifier "${synthId}" — will create + tag`);
    }
  }

  const body = {
    patient: {
      // newPatient: false signals create-appointment to dedupe internally;
      // when an `id` is supplied alongside, the zambda reuses that Patient.
      newPatient: !existingPatientId,
      ...(existingPatientId ? { id: existingPatientId } : {}),
      firstName: s.patient.firstName,
      lastName: s.patient.lastName,
      dateOfBirth: s.patient.dateOfBirth,
      sex: s.patient.sex,
      email: s.patient.email,
      phoneNumber: s.patient.phoneNumber,
      reasonForVisit: s.visit.reasonForVisit,
    },
    slotId: ctx.slotId ?? '<resolved in Phase 0.5>',
    language: s.visit.language ?? 'en',
  };
  logCall('create-appointment', body);

  if (ctx.mode === 'execute' && ctx.oystehr) {
    const res = await fetch(`${ctx.zambdaApi}/zambda/create-appointment/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.accessToken}`,
        'x-zapehr-project-id': ctx.projectId ?? '',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`create-appointment failed: ${res.status}\n${await res.text()}`);
    }
    const result = (await res.json()) as {
      output?: {
        patientId?: string;
        fhirPatientId?: string;
        appointmentId?: string;
        encounterId?: string;
        questionnaireResponseId?: string;
        relatedPersonId?: string;
      };
      patientId?: string;
      fhirPatientId?: string;
      appointmentId?: string;
      encounterId?: string;
      questionnaireResponseId?: string;
      relatedPersonId?: string;
    };
    const out = result.output ?? result;
    ctx.patientId = out.patientId ?? out.fhirPatientId;
    ctx.appointmentId = out.appointmentId;
    ctx.encounterId = out.encounterId;
    ctx.questionnaireResponseId = out.questionnaireResponseId;
    if (!ctx.appointmentId || !ctx.encounterId) {
      throw new Error(`create-appointment returned unexpected shape: ${JSON.stringify(result).slice(0, 200)}`);
    }
    logNote(`patientId=${ctx.patientId}`);
    logNote(`appointmentId=${ctx.appointmentId}`);
    logNote(`encounterId=${ctx.encounterId}`);

    // Tag the Patient with the synthetic identifier so future runs deduplicate.
    // Only do this when the Patient is newly created — existing patients
    // already have the identifier (that's how we found them).
    if (!existingPatientId && ctx.patientId) {
      try {
        const patient = await ctx.oystehr.fhir.get<Patient>({
          resourceType: 'Patient',
          id: ctx.patientId,
        });
        const next: Patient = {
          ...patient,
          identifier: [
            ...(patient.identifier ?? []),
            { use: 'secondary', system: SYNTHETIC_PATIENT_ID_SYSTEM, value: synthId },
          ],
        };
        await ctx.oystehr.fhir.update<Patient>(next);
        logNote(`tagged Patient with synth identifier "${synthId}"`);
      } catch (err) {
        console.warn(`  ⚠ failed to tag Patient with synth identifier: ${err instanceof Error ? err.message : err}`);
      }

      // Fix the messaging RelatedPerson's SMS number. create-appointment stamps it from the booking
      // USER, which for the synth M2M client resolves to the non-production mock phone (+11231231234)
      // — so the EHR chat shows that mock number for every synth patient instead of a believable one.
      // Point it at the patient's own (NANPA-reserved 555) phone. The patient's Patient.telecom is
      // already correct; this only repairs the conversation recipient the chat/SMS panel reads.
      const relatedPersonId = out.relatedPersonId;
      if (relatedPersonId && s.patient.phoneNumber) {
        try {
          const rp = await ctx.oystehr.fhir.get<RelatedPerson>({
            resourceType: 'RelatedPerson',
            id: relatedPersonId,
          });
          const telecom = (rp.telecom ?? []).map((t) =>
            t.system === 'phone' ? { ...t, value: s.patient.phoneNumber! } : t
          );
          if (!telecom.some((t) => t.system === 'phone')) {
            telecom.push({ system: 'phone', value: s.patient.phoneNumber, use: 'mobile' });
          }
          await ctx.oystehr.fhir.update<RelatedPerson>({ ...rp, telecom });
          logNote(`set messaging RelatedPerson phone → ${s.patient.phoneNumber}`);
        } catch (err) {
          console.warn(`  ⚠ failed to fix RelatedPerson phone: ${err instanceof Error ? err.message : err}`);
        }
      }
    }
  } else {
    logNote('returns: { patientId, appointmentId, encounterId, questionnaireResponseId }');
  }
}

// ── Phase 1.5 — intake paperwork (drives the harvest subscription) ───────────

/**
 * Fill out the intake QuestionnaireResponse page-by-page using the same
 * `patch-paperwork` zambda the patient app calls. Each page submission with
 * a `pageHarvestStrategy` mapping creates a Task that triggers
 * `sub-harvest-paperwork-page`, which writes the page-specific resources
 * (Patient demographics, Coverage, RelatedPerson, Consent, DocumentReference,
 * etc.). The final patch-paperwork on `consent-forms-page` auto-flips the QR
 * to status=completed, which fires `sub-intake-harvest` for finalization.
 *
 * Calling these zambdas — instead of writing the FHIR resources directly —
 * means the synth pipeline exercises the same code paths as a real patient
 * intake, so any harvest-side change (new field, schema migration, validator
 * tightening) is caught automatically on the next synth run.
 */
async function phase1_5_intakePaperwork(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  const p = s.patient;

  startPhase('Intake paperwork (patch-paperwork per page → submit-paperwork)');

  if (!ctx.questionnaireResponseId || !ctx.appointmentId) {
    if (ctx.mode === 'execute') {
      throw new Error('Phase 1.5 requires questionnaireResponseId + appointmentId from Phase 1');
    }
    logNote('(plan-only — IDs come from Phase 1)');
    return;
  }

  const phone = p.phoneNumber ?? '';
  const consentName = p.consents?.signatureName ?? `${p.firstName} ${p.lastName}`;

  const stringAnswer = (linkId: string, value: string | undefined): unknown =>
    value !== undefined && value !== '' ? { linkId, answer: [{ valueString: value }] } : { linkId };
  const boolAnswer = (linkId: string, value: boolean | undefined): unknown =>
    value !== undefined ? { linkId, answer: [{ valueBoolean: value }] } : { linkId };
  const refAnswer = (linkId: string, ref: string | undefined, display: string | undefined): unknown =>
    ref ? { linkId, answer: [{ valueReference: { reference: ref, display } }] } : { linkId };
  // `creation` is required — the harvest's documents handler propagates it
  // to DocumentReference.date, which Oystehr rejects as an empty string.
  const attachmentAnswer = (
    linkId: string,
    url: string | undefined,
    contentType: string | undefined,
    title: string
  ): unknown =>
    url
      ? { linkId, answer: [{ valueAttachment: { url, contentType, title, creation: new Date().toISOString() } }] }
      : { linkId };

  // Upload a fixture file via get-presigned-file-url + PUT to the returned
  // signed URL. Returns the canonical Z3 URL the harvest's documents handler
  // resolves into a DocumentReference attachment.
  const uploadFixture = async (
    fixturePath: string | undefined,
    fileType: string
  ): Promise<{ z3Url: string; contentType: string } | undefined> => {
    if (!fixturePath || ctx.mode !== 'execute') return undefined;
    const scenarioDir = path.dirname(path.resolve(ctx.scenarioPath));
    const absPath = path.resolve(scenarioDir, fixturePath);
    if (!fs.existsSync(absPath)) {
      console.warn(`  ⚠ fixture not found: ${absPath} — skipping upload for ${fileType}`);
      return undefined;
    }
    const ext = path.extname(absPath).slice(1).toLowerCase();
    const fileFormat = ext === 'jpg' ? 'jpeg' : ext;
    const contentType =
      fileFormat === 'png' ? 'image/png' : fileFormat === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';

    const presignRes = await fetch(`${ctx.zambdaApi}/zambda/get-presigned-file-url/execute-public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.accessToken}`,
        'x-zapehr-project-id': ctx.projectId ?? '',
      },
      body: JSON.stringify({ appointmentID: ctx.appointmentId, fileType, fileFormat }),
    });
    if (!presignRes.ok) {
      console.warn(
        `  ⚠ get-presigned-file-url(${fileType}) failed: ${presignRes.status} ${(await presignRes.text()).slice(
          0,
          200
        )}`
      );
      return undefined;
    }
    const presignJson = (await presignRes.json()) as {
      output?: { presignedURL?: string; z3URL?: string };
      presignedURL?: string;
      z3URL?: string;
    };
    const out = presignJson.output ?? presignJson;
    const presignedURL = out.presignedURL;
    const z3Url = out.z3URL;
    if (!presignedURL || !z3Url) {
      console.warn(`  ⚠ get-presigned-file-url(${fileType}) returned no URLs`);
      return undefined;
    }

    const body = fs.readFileSync(absPath);
    const putRes = await fetch(presignedURL, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body,
    });
    if (!putRes.ok) {
      console.warn(`  ⚠ Z3 upload(${fileType}) failed: ${putRes.status}`);
      return undefined;
    }
    logNote(`uploaded ${fileType} (${body.length} bytes) → ${z3Url}`);
    return { z3Url, contentType };
  };

  // Upload all fixtures up front; we slot them into the right QR pages below.
  const fx = p.fixtures;
  const idFront = await uploadFixture(fx?.idCardFront, 'photo-id-front');
  const idBack = await uploadFixture(fx?.idCardBack, 'photo-id-back');
  const insFront = await uploadFixture(fx?.insuranceCardFront, 'insurance-card-front');
  const insBack = await uploadFixture(fx?.insuranceCardBack, 'insurance-card-back');

  type Page = { linkId: string; item: unknown[] };
  const pages: Page[] = [];

  // Contact information page — patient address + phone + email.
  pages.push({
    linkId: 'contact-information-page',
    item: [
      stringAnswer('patient-street-address', p.address?.line1),
      stringAnswer('patient-street-address-2', p.address?.line2),
      stringAnswer('patient-city', p.address?.city),
      stringAnswer('patient-state', p.address?.state),
      stringAnswer('patient-zip', p.address?.postalCode),
      stringAnswer('patient-email', p.email),
      stringAnswer('patient-number', phone),
      stringAnswer('patient-preferred-communication-method', p.preferredCommunication ?? 'Cell Phone'),
      boolAnswer('mobile-opt-in', p.mobileOptIn ?? true),
    ],
  });

  // Patient details page — demographics for the harvest's master-record handler.
  pages.push({
    linkId: 'patient-details-page',
    item: [
      stringAnswer('patient-ethnicity', p.ethnicity),
      stringAnswer('patient-race', p.race),
      stringAnswer('patient-pronouns', p.pronouns),
      stringAnswer('preferred-language', p.preferredLanguage ?? 'English'),
      stringAnswer('patient-point-of-discovery', p.pointOfDiscovery),
    ],
  });

  // PCP page — only fill if scenario provided one (the page is optional).
  if (p.primaryCarePhysician) {
    const pcp = p.primaryCarePhysician;
    pages.push({
      linkId: 'primary-care-physician-page',
      item: [
        stringAnswer('pcp-first', pcp.firstName),
        stringAnswer('pcp-last', pcp.lastName),
        stringAnswer('pcp-practice', pcp.practice),
        stringAnswer('pcp-address', pcp.address),
        stringAnswer('pcp-number', pcp.phone),
      ],
    });
  }

  // Pharmacy page (optional).
  if (p.preferredPharmacy) {
    pages.push({
      linkId: 'pharmacy-page',
      item: [
        stringAnswer('pharmacy-name', p.preferredPharmacy.name),
        stringAnswer('pharmacy-address', p.preferredPharmacy.address),
      ],
    });
  }

  // Payment / insurance page — drives the account-coverage harvest handler
  // (creates Coverage + RelatedPerson, links Encounter.account).
  if (p.insurance?.primary && ctx.payerOrganizationId) {
    const ins = p.insurance.primary;
    const subscriberIsSelf = (ins.subscriberRelationship ?? 'self') === 'self';
    pages.push({
      linkId: 'payment-option-page',
      item: [
        stringAnswer('payment-option', 'I have insurance'),
        refAnswer('insurance-carrier', `Organization/${ctx.payerOrganizationId}`, ins.carrier),
        stringAnswer('insurance-member-id', ins.memberId),
        stringAnswer('policy-holder-first-name', subscriberIsSelf ? p.firstName : ins.subscriberName?.split(' ')[0]),
        stringAnswer(
          'policy-holder-last-name',
          subscriberIsSelf ? p.lastName : ins.subscriberName?.split(' ').slice(1).join(' ')
        ),
        stringAnswer('policy-holder-date-of-birth', subscriberIsSelf ? p.dateOfBirth : ins.subscriberDob),
        // policy-holder-birth-sex and policy-holder-date-of-birth are REQUIRED
        // by the harvest's policyHolder extractor (extractPolicyHolderContact in
        // packages/zambdas/src/ehr/shared/harvest/index.ts) — if missing, the
        // policy holder is rejected and NO Coverage resource gets created
        // (silent failure). Always pass them, sourced from the patient when
        // self or from scenario.patient.insurance.primary.subscriberSex /
        // .subscriberDob otherwise.
        stringAnswer('policy-holder-birth-sex', subscriberIsSelf ? capitalize(p.sex) : ins.subscriberSex),
        // For non-self subscribers (typically a parent for a minor patient),
        // assume the policy holder shares the patient's address — true in
        // almost every case and matches what the intake form would default to.
        boolAnswer('policy-holder-address-as-patient', true),
        stringAnswer(
          'patient-relationship-to-insured',
          subscriberIsSelf ? 'Self' : capitalize(ins.subscriberRelationship ?? 'self')
        ),
        // Title MUST match a DocumentType enum value (machine key, not a
        // display string). EHR's get-visit-files zambda filters DRs whose
        // title isn't in DocumentType, so display titles like "Insurance
        // card front" cause images to silently disappear from the visit
        // detail page even though the DRs exist.
        attachmentAnswer('insurance-card-front', insFront?.z3Url, insFront?.contentType, 'insurance-card-front'),
        attachmentAnswer('insurance-card-back', insBack?.z3Url, insBack?.contentType, 'insurance-card-back'),
      ],
    });
  } else if (p.insurance?.primary && !ctx.payerOrganizationId) {
    logNote(`payer Organization not resolved — payment-option-page will go self-pay`);
    pages.push({
      linkId: 'payment-option-page',
      item: [stringAnswer('payment-option', 'I will pay without insurance')],
    });
  } else {
    pages.push({
      linkId: 'payment-option-page',
      item: [stringAnswer('payment-option', 'I will pay without insurance')],
    });
  }

  // Responsible party page — Self by default, harvested into Account.
  const rp = p.responsibleParty;
  const rpRelationship = rp?.relationship ?? 'Self';
  if (rpRelationship === 'Self') {
    pages.push({
      linkId: 'responsible-party-page',
      item: [
        stringAnswer('responsible-party-relationship', 'Self'),
        stringAnswer('responsible-party-first-name', p.firstName),
        stringAnswer('responsible-party-last-name', p.lastName),
        stringAnswer('responsible-party-date-of-birth', p.dateOfBirth),
        stringAnswer('responsible-party-birth-sex', capitalize(p.sex)),
        boolAnswer('responsible-party-address-as-patient', true),
        stringAnswer('responsible-party-number', phone),
        stringAnswer('responsible-party-email', p.email),
      ],
    });
  } else {
    pages.push({
      linkId: 'responsible-party-page',
      item: [
        stringAnswer('responsible-party-relationship', rpRelationship),
        stringAnswer('responsible-party-first-name', rp?.firstName),
        stringAnswer('responsible-party-last-name', rp?.lastName),
        stringAnswer('responsible-party-date-of-birth', rp?.dateOfBirth),
        stringAnswer('responsible-party-birth-sex', rp?.sex),
        boolAnswer('responsible-party-address-as-patient', rp?.addressAsPatient ?? false),
        ...(rp?.address
          ? [
              stringAnswer('responsible-party-address', rp.address.line1),
              stringAnswer('responsible-party-address-2', rp.address.line2),
              stringAnswer('responsible-party-city', rp.address.city),
              stringAnswer('responsible-party-state', rp.address.state),
              stringAnswer('responsible-party-zip', rp.address.postalCode),
            ]
          : []),
        stringAnswer('responsible-party-number', rp?.phone),
        stringAnswer('responsible-party-email', rp?.email),
      ],
    });
  }

  // Emergency contact page — harvested into Patient.contact / RelatedPerson.
  if (p.emergencyContact) {
    const ec = p.emergencyContact;
    pages.push({
      linkId: 'emergency-contact-page',
      item: [
        stringAnswer('emergency-contact-relationship', ec.relationship),
        stringAnswer('emergency-contact-first-name', ec.firstName),
        stringAnswer('emergency-contact-middle-name', ec.middleName),
        stringAnswer('emergency-contact-last-name', ec.lastName),
        stringAnswer('emergency-contact-number', ec.phone),
        boolAnswer('emergency-contact-address-as-patient', ec.addressAsPatient ?? false),
        ...(ec.address && !ec.addressAsPatient
          ? [
              stringAnswer('emergency-contact-address', ec.address.line1),
              stringAnswer('emergency-contact-address-2', ec.address.line2),
              stringAnswer('emergency-contact-city', ec.address.city),
              stringAnswer('emergency-contact-state', ec.address.state),
              stringAnswer('emergency-contact-zip', ec.address.postalCode),
            ]
          : []),
      ],
    });
  }

  // Photo ID page — uploaded photos go through Z3 + the documents harvest
  // handler, which creates a DocumentReference and adds it to the patient's
  // List for "Photo ID cards".
  if (idFront || idBack) {
    pages.push({
      linkId: 'photo-id-page',
      item: [
        // Title MUST match a DocumentType enum value (see insurance-card
        // section above for rationale).
        attachmentAnswer('photo-id-front', idFront?.z3Url, idFront?.contentType, 'photo-id-front'),
        attachmentAnswer('photo-id-back', idBack?.z3Url, idBack?.contentType, 'photo-id-back'),
      ],
    });
  }

  // Consent forms page — MUST be last; patch-paperwork on this page also
  // flips the QR to status=completed and fires sub-intake-harvest.
  const c = p.consents;
  pages.push({
    linkId: 'consent-forms-page',
    item: [
      {
        linkId: 'consent-forms-checkbox-group',
        item: [
          { linkId: 'hipaa-acknowledgement', answer: [{ valueBoolean: c?.hipaa ?? true }] },
          { linkId: 'consent-to-treat', answer: [{ valueBoolean: c?.treat ?? true }] },
        ],
      },
      stringAnswer('signature', consentName),
      stringAnswer('full-name', consentName),
      stringAnswer('consent-form-signer-relationship', c?.signerRelationship ?? 'Self'),
    ],
  });

  for (const page of pages) {
    const body = {
      answers: { linkId: page.linkId, item: page.item },
      questionnaireResponseId: ctx.questionnaireResponseId,
      appointmentId: ctx.appointmentId,
    };
    logCall('patch-paperwork', { page: page.linkId, items: (page.item as unknown[]).length });

    if (ctx.mode === 'execute' && ctx.oystehr) {
      const res = await withRetry(`patch-paperwork ${page.linkId}`, 3, () =>
        fetch(`${ctx.zambdaApi}/zambda/patch-paperwork/execute-public`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ctx.accessToken}`,
            'x-zapehr-project-id': ctx.projectId ?? '',
          },
          body: JSON.stringify(body),
        })
      );
      if (!res.ok) {
        console.warn(`  ⚠ patch-paperwork (${page.linkId}) failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
        continue;
      }
      logNote(`patched ${page.linkId}`);

      // patch-paperwork creates a `requested` Task with focus=QR + page-index;
      // the cloud-side Task subscription will *also* fire and call the
      // deployed sub-harvest-paperwork-page (potentially stale). To make sure
      // the harvest runs against current source, invoke the local handler
      // directly with the just-created Task. Dedup logic inside the harvest
      // strategies prevents double-writes if cloud runs in parallel.
      await runLocalHarvest(ctx, page.linkId);
    }
  }

  if (ctx.mode === 'execute') {
    logNote('QR auto-completed via consent-forms-page; sub-intake-harvest will run async');
  }
}

async function runLocalHarvest(ctx: SynthesisContext, pageLinkId: string): Promise<void> {
  if (!ctx.oystehr || !ctx.questionnaireResponseId) return;

  // Find the just-created Task for this page (status=requested, matching
  // page-index). patch-paperwork only creates Tasks for pages with a
  // registered harvest strategy — silently no-op if none.
  const tasks = (
    await withRetry('Task search', 3, () =>
      ctx.oystehr!.fhir.search({
        resourceType: 'Task',
        params: [
          { name: 'focus', value: `QuestionnaireResponse/${ctx.questionnaireResponseId}` },
          { name: 'code', value: 'harvest-paperwork' },
          { name: 'status', value: 'requested,in-progress' },
        ],
      })
    )
  ).unbundle() as Array<{
    id?: string;
    status?: string;
    input?: Array<{ type?: { coding?: Array<{ code?: string }> }; valueUnsignedInt?: number }>;
  }>;

  // We need the Task whose page-index matches `pageLinkId`. Resolve via the QR.
  const qr = (await withRetry('QR get', 3, () =>
    ctx.oystehr!.fhir.get({
      resourceType: 'QuestionnaireResponse',
      id: ctx.questionnaireResponseId!,
    })
  )) as { item?: Array<{ linkId: string }> };
  const pageIndex = (qr.item ?? []).findIndex((p) => p.linkId === pageLinkId);
  if (pageIndex < 0) return;
  const task = tasks.find(
    (t) => t.input?.some((i) => i.type?.coding?.[0]?.code === 'page-index' && i.valueUnsignedInt === pageIndex)
  );
  if (!task) return;

  // Reset to 'requested' so the local subscription handler accepts it (it
  // rejects 'failed' tasks, and cloud may have already raced and failed).
  if (task.status !== 'requested') {
    try {
      await withRetry('Task patch', 3, () =>
        ctx.oystehr!.fhir.patch({
          resourceType: 'Task',
          id: task.id!,
          operations: [{ op: 'replace', path: '/status', value: 'requested' }],
        })
      );
    } catch {
      /* tolerate optimistic-lock conflict if cloud is racing */
    }
  }

  const refreshedTask = (await withRetry('Task refresh', 3, () =>
    ctx.oystehr!.fhir.get({
      resourceType: 'Task',
      id: task.id!,
    })
  )) as Record<string, unknown>;
  const harvestRes = await withRetry('harvest POST', 3, () =>
    fetch(`${ctx.zambdaApi}/zambda/sub-harvest-paperwork-page/execute-public`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.accessToken}`,
        'x-zapehr-project-id': ctx.projectId ?? '',
      },
      body: JSON.stringify(refreshedTask),
    })
  );
  if (!harvestRes.ok) {
    console.warn(
      `  ⚠ local harvest (${pageLinkId}) failed: ${harvestRes.status} ${(await harvestRes.text()).slice(0, 300)}`
    );
    return;
  }
  logNote(`harvested ${pageLinkId} (local)`);
}

function capitalize(s: string | undefined): string | undefined {
  if (!s) return undefined;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Phase 1.7 — assign attending practitioner ───────────────────────────────

/**
 * Assign the attending practitioner to the encounter early so subsequent
 * phases that require an attending participant (in-house labs, radiology,
 * immunizations, etc.) work. The formal visit lifecycle assigns this in
 * Phase 13 between "ready for provider" and "provider", but we do it
 * earlier here as a sequencing fix.
 */
async function phase1_7_assignAttending(ctx: SynthesisContext): Promise<void> {
  if (!ctx.attendingPractitionerId || !ctx.encounterId) return;
  startPhase('Assign attending practitioner');

  const body = {
    encounterId: ctx.encounterId,
    practitionerId: ctx.attendingPractitionerId,
    userRole: [
      {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
        code: 'ATND',
      },
    ],
  };
  logCall('assign-practitioner', body);

  if (ctx.mode === 'execute' && ctx.oystehr) {
    // assign-practitioner is one of the OTR-2428 zambdas. Cloud-deployed
    // version lacks the M2M fix; route through local until deploy catches up.
    const res = await fetch(`${ctx.zambdaApi}/zambda/assign-practitioner/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.accessToken}`,
        'x-zapehr-project-id': ctx.projectId ?? '',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`assign-practitioner (ATND) failed: ${res.status}\n${await res.text()}`);
    }
    logNote(`attending practitioner assigned`);
  }
}

// ── Phase 2 — Z3 fixture uploads (narrative log only) ────────────────────────
// The actual uploads happen in Phase 1.5 (so the QR can reference the Z3 URLs
// before the harvest fires). This phase remains as a narrative log to keep
// numbering aligned with the README; it never writes to FHIR or Z3.

async function phase2_z3Uploads(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  if (!s.patient.fixtures || !Object.values(s.patient.fixtures).some(Boolean)) return;

  startPhase('Z3 fixture uploads');
  for (const [key, path] of Object.entries(s.patient.fixtures)) {
    if (!path) continue;
    logNote(
      `z3.uploadFile { bucket: "<projectId>-patient-files", key: "<patientId>/${key}", file: <Blob from ${path}> }`
    );
    logFhir('create', `DocumentReference referencing the Z3 object (${key})`);
  }
}

// ── Phase 3 — save-chart-data Pass 1 ──────────────────────────────────────────

/**
 * Convert scenario.vitals (a domain-shaped object) into save-chart-data's
 * `vitalsObservations` array (FHIR-flavored entries keyed by `field` codes).
 */
function buildVitalsObservations(vitals: VisitScenario['vitals']): unknown[] {
  if (!vitals) return [];
  const out: unknown[] = [];
  if (vitals.temperature) {
    out.push({ field: 'vital-temperature', value: vitals.temperature.value, unit: vitals.temperature.unit ?? 'F' });
  }
  if (vitals.heartRate) {
    out.push({ field: 'vital-heartbeat', value: vitals.heartRate.value, unit: '/min' });
  }
  if (vitals.bloodPressure) {
    out.push({
      field: 'vital-blood-pressure',
      value: { systolic: vitals.bloodPressure.systolic, diastolic: vitals.bloodPressure.diastolic },
      unit: 'mm[Hg]',
    });
  }
  if (vitals.respirationRate) {
    out.push({ field: 'vital-respiration-rate', value: vitals.respirationRate.value, unit: '/min' });
  }
  if (vitals.oxygenSaturation) {
    out.push({ field: 'vital-oxygen-sat', value: vitals.oxygenSaturation.value, unit: '%' });
  }
  if (vitals.weight) {
    out.push({ field: 'vital-weight', value: vitals.weight.value, unit: vitals.weight.unit ?? 'kg' });
  }
  if (vitals.height) {
    out.push({ field: 'vital-height', value: vitals.height.value, unit: vitals.height.unit ?? 'cm' });
  }
  return out;
}

/**
 * Filter scenario.history.* arrays down to entries the patient does NOT
 * already have on file. The chart-data resources here (AllergyIntolerance,
 * MedicationStatement, Condition, Procedure[surgical-history], EpisodeOfCare)
 * are bound to the Patient — not the Encounter — so a rerun for the same
 * Jane Doe would otherwise create N copies of every allergy/condition/etc.
 *
 * Each resource carries a meta tag identifying which chart-data field it
 * came from (`getMetaWFieldName` in packages/zambdas/src/shared/chart-data),
 * so we filter the FHIR search by that tag to avoid sweeping in unrelated
 * Procedures (CPT codes from apply-template) or unrelated Conditions
 * (chief-complaint, HPI, ROS — all stored as Conditions with different tags).
 *
 * Dedup keys are pragmatic: ICD-10 / RxNorm code if the scenario provides
 * one, otherwise the lowercased display name. False-positive skips (a real
 * variant misclassified as duplicate) are acceptable for synth; false
 * negatives (still creating duplicates) are not.
 */
type FilteredHistory = Pick<
  NonNullable<ScenarioHistory>,
  'allergies' | 'medications' | 'conditions' | 'surgicalHistory' | 'hospitalizations'
>;

async function filterPreExistingHistory(ctx: SynthesisContext): Promise<FilteredHistory> {
  const history = ctx.scenario.history;
  if (!history || ctx.mode !== 'execute' || !ctx.oystehr || !ctx.patientId) {
    return {
      allergies: history?.allergies,
      medications: history?.medications,
      conditions: history?.conditions,
      surgicalHistory: history?.surgicalHistory,
      hospitalizations: history?.hospitalizations,
    };
  }

  const patientRef = `Patient/${ctx.patientId}`;
  const [allergies, medications, conditions, procedures, episodesOfCare] = await Promise.all([
    ctx.oystehr.fhir
      .search<AllergyIntolerance>({
        resourceType: 'AllergyIntolerance',
        params: [
          { name: 'patient', value: patientRef },
          { name: '_tag', value: 'known-allergy' },
        ],
      })
      .then((r) => r.unbundle()),
    ctx.oystehr.fhir
      .search<MedicationStatement>({
        resourceType: 'MedicationStatement',
        params: [
          { name: 'subject', value: patientRef },
          { name: '_tag', value: 'current-medication' },
        ],
      })
      .then((r) => r.unbundle()),
    ctx.oystehr.fhir
      .search<Condition>({
        resourceType: 'Condition',
        params: [
          { name: 'subject', value: patientRef },
          { name: '_tag', value: 'medical-condition' },
        ],
      })
      .then((r) => r.unbundle()),
    ctx.oystehr.fhir
      .search<Procedure>({
        resourceType: 'Procedure',
        params: [
          { name: 'subject', value: patientRef },
          { name: '_tag', value: 'surgical-history' },
        ],
      })
      .then((r) => r.unbundle()),
    ctx.oystehr.fhir
      .search<EpisodeOfCare>({
        resourceType: 'EpisodeOfCare',
        params: [
          { name: 'patient', value: patientRef },
          { name: '_tag', value: 'hospitalization' },
        ],
      })
      .then((r) => r.unbundle()),
  ]);

  const norm = (s: string | undefined): string => (s ?? '').trim().toLowerCase();

  // Existing dedup-key sets per category.
  const allergyKeys = new Set(
    allergies.flatMap((a) => [norm(a.code?.coding?.[0]?.display), norm(a.code?.text)]).filter(Boolean)
  );
  const medicationKeys = new Set(
    medications.map((m) => norm(m.medicationCodeableConcept?.coding?.[0]?.display)).filter(Boolean)
  );
  const conditionKeys = new Set(
    conditions
      .flatMap((c) => [
        norm(c.code?.coding?.find((cd) => cd.system?.includes('icd-10') || cd.system?.includes('icd10'))?.code),
        norm(c.code?.coding?.[0]?.code),
        norm(c.code?.coding?.[0]?.display),
        norm(c.code?.text),
      ])
      .filter(Boolean)
  );
  const procedureKeys = new Set(
    procedures
      .flatMap((p) => [norm(p.code?.coding?.[0]?.code), norm(p.code?.coding?.[0]?.display), norm(p.note?.[0]?.text)])
      .filter(Boolean)
  );
  const episodeKeys = new Set(episodesOfCare.map((e) => norm(e.type?.[0]?.text)).filter(Boolean));

  const dropped = { allergies: 0, medications: 0, conditions: 0, surgicalHistory: 0, hospitalizations: 0 };

  const filteredAllergies = history.allergies?.filter((a) => {
    const key = norm(a.name);
    if (key && allergyKeys.has(key)) {
      dropped.allergies += 1;
      return false;
    }
    return true;
  });
  const filteredMedications = history.medications?.filter((m) => {
    const key = norm(m.name);
    if (key && medicationKeys.has(key)) {
      dropped.medications += 1;
      return false;
    }
    return true;
  });
  const filteredConditions = history.conditions?.filter((c) => {
    const codeKey = norm(c.code);
    const displayKey = norm(c.display);
    if ((codeKey && conditionKeys.has(codeKey)) || (displayKey && conditionKeys.has(displayKey))) {
      dropped.conditions += 1;
      return false;
    }
    return true;
  });
  const filteredSurgical = history.surgicalHistory?.filter((sh) => {
    const codeKey = norm(sh.code);
    const displayKey = norm(sh.display);
    if ((codeKey && procedureKeys.has(codeKey)) || (displayKey && procedureKeys.has(displayKey))) {
      dropped.surgicalHistory += 1;
      return false;
    }
    return true;
  });
  const filteredHospitalizations = history.hospitalizations?.filter((h) => {
    const key = norm(h.display);
    if (key && episodeKeys.has(key)) {
      dropped.hospitalizations += 1;
      return false;
    }
    return true;
  });

  const totalDropped =
    dropped.allergies + dropped.medications + dropped.conditions + dropped.surgicalHistory + dropped.hospitalizations;
  if (totalDropped > 0) {
    logNote(
      `dedup: skipping ${totalDropped} pre-existing history items ` +
        `(allergies=${dropped.allergies}, meds=${dropped.medications}, conditions=${dropped.conditions}, ` +
        `surgical=${dropped.surgicalHistory}, hospitalizations=${dropped.hospitalizations})`
    );
  }

  return {
    allergies: filteredAllergies,
    medications: filteredMedications,
    conditions: filteredConditions,
    surgicalHistory: filteredSurgical,
    hospitalizations: filteredHospitalizations,
  };
}

async function phase3_chartDataPass1(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  startPhase('save-chart-data Pass 1 (non-templated patient data)');

  // Filter out chart-data history items the patient already has on file
  // (allergies/meds/conditions/surgical-hx/hospitalizations are all
  // patient-record-level — re-sending them would create duplicates).
  // Vitals, screening notes, RFV, CC, patientInfoConfirmed are intentionally
  // per-encounter and continue to flow through unchanged.
  const filtered = await filterPreExistingHistory(ctx);

  const body: Record<string, unknown> = { encounterId: ctx.encounterId ?? '<from Phase 1>' };

  if (filtered.allergies?.length) {
    body.allergies = filtered.allergies.map((a) => ({
      name: a.name,
      current: a.current ?? true,
      ...(a.note ? { note: a.note } : {}),
    }));
  }
  if (filtered.medications?.length) {
    body.medications = filtered.medications.map((m) => {
      const doseParts = [m.dose, m.frequency, m.route].filter(Boolean);
      // makeMedicationResource builds `identifier: [{ value: data.id }]` and
      // FHIR's ele-1 constraint rejects an identifier with no value/children,
      // so we must pass a non-empty id. Derive one from the name as a slug.
      const slug = m.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      return {
        id: slug,
        name: m.name,
        status: m.status ?? 'active',
        type: 'scheduled',
        intakeInfo: { dose: doseParts.length ? doseParts.join(' ') : 'unknown' },
      };
    });
  }
  if (filtered.conditions?.length) {
    body.conditions = filtered.conditions.map((c) => ({
      ...(c.code ? { code: c.code } : {}),
      display: c.display,
      ...(c.current !== undefined ? { current: c.current } : {}),
      ...(c.note ? { note: c.note } : {}),
    }));
  }
  if (filtered.surgicalHistory?.length) {
    body.surgicalHistory = filtered.surgicalHistory.map((sh) => ({
      ...(sh.code ? { code: sh.code } : {}),
      display: sh.display,
    }));
  }
  if (s.history?.surgicalHistoryNote) {
    body.surgicalHistoryNote = { text: s.history.surgicalHistoryNote };
  }
  if (filtered.hospitalizations?.length) {
    body.episodeOfCare = filtered.hospitalizations.map((h) => ({
      ...(h.code ? { code: h.code } : {}),
      display: h.display,
    }));
  }
  if (s.history?.screening?.length) {
    body.observations = s.history.screening.map((o) => ({ field: o.field, value: o.value }));
  }
  if (s.history?.screenNotes?.length) {
    // NoteDTO requires type/text/authorId/authorName/patientId/encounterId.
    // makeNoteResource builds `Practitioner/${authorId}` which fails validation
    // if authorId is undefined.
    body.notes = s.history.screenNotes.map((n) => ({
      type: n.code,
      text: n.text,
      authorId: ctx.attendingPractitionerId,
      authorName: ctx.scenario.signOff?.practitionerName ?? 'Synthesizer',
      patientId: ctx.patientId,
      encounterId: ctx.encounterId,
    }));
  }

  const vitalsObs = buildVitalsObservations(s.vitals);
  if (vitalsObs.length) body.vitalsObservations = vitalsObs;

  // reasonForVisit takes a FreeTextNoteDTO (`{ text }`), not a plain string.
  // (The doc shows it as a string; the zambda actually reads data.text.)
  body.reasonForVisit = { text: s.visit.reasonForVisit };
  // NB: patientInfoConfirmed is intentionally NOT sent in Pass 1. The
  // save-chart-data zambda's per-Encounter-extension handlers each emit
  // their own `add /extension []` op when the Encounter has no extension
  // array yet, and later ops in the same transaction overwrite earlier
  // ones — so combining patientInfoConfirmed + reasonForVisit on a fresh
  // Encounter loses one of the two. We send patientInfoConfirmed in Pass 2
  // (Phase 4) where the array already exists from Pass 1's reasonForVisit.

  logCall('save-chart-data', body);

  if (ctx.mode === 'execute' && ctx.oystehr) {
    if (!ctx.encounterId) {
      throw new Error('Phase 3 requires encounterId from Phase 1 — did Phase 1 run?');
    }
    // Direct fetch (not SDK) — gives access to full error responses on failure.
    // M2M token works because save-chart-data's `userMe()` detects M2M via JWT
    // `sub` and falls through to `m2m.me()` (when ENVIRONMENT != production),
    // returning a synthetic User whose profile is the M2M client's profile.
    // The M2M client must point at a real Practitioner for this to resolve.
    const res = await fetch(`${ctx.zambdaApi}/zambda/save-chart-data/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.accessToken}`,
        'x-zapehr-project-id': ctx.projectId ?? '',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`save-chart-data failed: ${res.status}\n${errText}`);
    }
    logNote('chart data saved');
  }
}

// ── Phase 4 — apply-template ─────────────────────────────────────────────────

async function phase4_applyTemplate(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  if (!s.template) return;

  startPhase('Apply template');
  const examType = s.template.examType ?? (s.visit.type === 'in-person' ? 'inPerson' : 'telemed');
  const body = {
    encounterId: ctx.encounterId ?? '<from Phase 1>',
    templateName: s.template.name,
    examType,
  };
  logCall('apply-template', body);

  if (ctx.mode === 'execute' && ctx.oystehr) {
    if (!ctx.encounterId) {
      throw new Error('Phase 4 requires encounterId from Phase 1');
    }
    // Direct fetch for visibility into the response shape and any failures.
    // Auth: M2M token works through the userMe trick (same as save-chart-data).
    const res = await fetch(`${ctx.zambdaApi}/zambda/apply-template/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.accessToken}`,
        'x-zapehr-project-id': ctx.projectId ?? '',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`apply-template failed: ${res.status}\n${await res.text()}`);
    }
    // apply-template returns an empty body ({}). Resources are materialized as
    // side-effects on the encounter. Phase 5 (when we wire it for execute) will
    // need to FHIR-search the encounter for the newly-created template
    // Conditions/Procedures if it wants to cross-reference them.
    void (await res.json());
    logNote('template applied (response is empty by design)');
  } else {
    logNote('returns: empty body — template content materialized as side-effect');
  }
}

// ── Phase 5 — save-chart-data Pass 2 ──────────────────────────────────────────

/**
 * After apply-template runs, FHIR-search the encounter for the Conditions
 * (diagnoses) and Procedures (CPT) the template created, indexed by their
 * code values. Phase 5 procedures cross-reference these via `resourceId`.
 */
async function indexTemplateResources(
  ctx: SynthesisContext
): Promise<{ conditionsByCode: Map<string, string>; cptProceduresByCode: Map<string, string> }> {
  const conditionsByCode = new Map<string, string>();
  const cptProceduresByCode = new Map<string, string>();
  if (!ctx.oystehr || !ctx.encounterId) return { conditionsByCode, cptProceduresByCode };

  const conditions = (
    await ctx.oystehr.fhir.search({
      resourceType: 'Condition',
      params: [
        { name: 'encounter', value: `Encounter/${ctx.encounterId}` },
        { name: '_count', value: '100' },
      ],
    })
  ).unbundle() as Array<{ id?: string; code?: { coding?: Array<{ code?: string }> } }>;
  for (const c of conditions) {
    for (const coding of c.code?.coding ?? []) {
      if (coding.code && c.id) conditionsByCode.set(coding.code, c.id);
    }
  }

  const procedures = (
    await ctx.oystehr.fhir.search({
      resourceType: 'Procedure',
      params: [
        { name: 'encounter', value: `Encounter/${ctx.encounterId}` },
        { name: '_count', value: '100' },
      ],
    })
  ).unbundle() as Array<{ id?: string; code?: { coding?: Array<{ code?: string }> } }>;
  for (const p of procedures) {
    for (const coding of p.code?.coding ?? []) {
      if (coding.code && p.id) cptProceduresByCode.set(coding.code, p.id);
    }
  }

  return { conditionsByCode, cptProceduresByCode };
}

async function phase5_chartDataPass2(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  if (!s.modules?.procedures?.length && !s.disposition) return;

  startPhase('save-chart-data Pass 2 (cross-references template-created resources)');

  // Index template-created resources for cross-referencing.
  let conditionsByCode = new Map<string, string>();
  let cptProceduresByCode = new Map<string, string>();
  if (ctx.mode === 'execute' && ctx.oystehr && ctx.encounterId) {
    const indexed = await indexTemplateResources(ctx);
    conditionsByCode = indexed.conditionsByCode;
    cptProceduresByCode = indexed.cptProceduresByCode;
    logNote(
      `indexed ${conditionsByCode.size} Condition code(s) and ${cptProceduresByCode.size} Procedure code(s) on the encounter`
    );
  }

  const body: Record<string, unknown> = { encounterId: ctx.encounterId ?? '<from Phase 1>' };

  if (s.modules?.procedures?.length) {
    body.procedures = s.modules.procedures.map((p) => {
      const diagnosisRef = p.diagnosisCode ? conditionsByCode.get(p.diagnosisCode) : undefined;
      const cptRef = p.cptCode ? cptProceduresByCode.get(p.cptCode) : undefined;
      return {
        procedureType: p.procedureType,
        occurrenceDateTime: p.occurrenceDateTime,
        documentedDateTime: p.documentedDateTime,
        performerType: p.performerType ?? 'Provider',
        bodySite: p.bodySite,
        technique: p.technique,
        suppliesUsed: p.suppliesUsed,
        procedureDetails: p.procedureDetails,
        specimenSent: p.specimenSent,
        complications: p.complications ?? 'None',
        patientResponse: p.patientResponse ?? 'Tolerated procedure well',
        timeSpent: p.timeSpent,
        documentedBy: p.documentedBy ?? 'Provider',
        consentObtained: p.consentObtained ?? true,
        diagnoses: diagnosisRef ? [{ resourceId: diagnosisRef }] : [],
        cptCodes: cptRef ? [{ resourceId: cptRef }] : [],
      };
    });
  }

  if (s.disposition) {
    body.disposition = {
      type: s.disposition.type,
      ...(s.disposition.text ? { text: s.disposition.text } : {}),
      ...(s.disposition.note ? { note: s.disposition.note } : {}),
      ...(s.disposition.followUpIn !== undefined ? { followUpIn: s.disposition.followUpIn } : {}),
      ...(s.disposition.followUp?.length
        ? {
            followUp: s.disposition.followUp.map((f) => ({
              type: f.type,
              ...(f.note ? { note: f.note } : {}),
            })),
          }
        : {}),
    };
  }

  if (s.emCode) {
    body.emCode = { code: s.emCode.code, display: s.emCode.display };
  }

  if (s.signOff?.patientInfoConfirmed !== false) {
    body.patientInfoConfirmed = { value: true };
  }

  logCall('save-chart-data', body);

  if (ctx.mode === 'execute' && ctx.oystehr) {
    const res = await fetch(`${ctx.zambdaApi}/zambda/save-chart-data/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.accessToken}`,
        'x-zapehr-project-id': ctx.projectId ?? '',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`save-chart-data Pass 2 failed: ${res.status}\n${await res.text()}`);
    }
    logNote('procedures + disposition saved');
  }
}

// ── Phase 5.5 — provider chart findings (template-less archetypes) ────────────
//
// Templates supply diagnoses / exam / ROS / MDM. Archetypes WITHOUT a template
// carry them explicitly (scenario.diagnoses/exam/reviewOfSystems/medicalDecision)
// so the note is still complete. Prescriptions are written as eRx-tagged
// MedicationRequests directly (save-chart-data's prescribedMedications is
// read-only — it reflects vendor orders, it does not create them).
//
// IMPORTANT: ROS is STRUCTURED checkbox findings (rosObservations), never free
// text — a free-text `ros` renders nowhere in the EHR.
async function phase5_5_providerChartFindings(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  const hasChart = !!(s.diagnoses?.length || s.exam?.length || s.reviewOfSystems?.length || s.medicalDecision);
  if (!hasChart && !s.prescriptions?.length) return;

  startPhase('Provider chart findings (diagnoses / exam / ROS / MDM / prescriptions)');

  const body: Record<string, unknown> = { encounterId: ctx.encounterId ?? '<from Phase 1>' };
  if (s.diagnoses?.length) {
    body.diagnosis = s.diagnoses.map((d) => ({ code: d.code, display: d.display, isPrimary: d.isPrimary ?? false }));
  }
  if (s.exam?.length) {
    body.examObservations = s.exam.map((e) => ({
      field: e.field,
      value: e.value ?? true,
      ...(e.note ? { note: e.note } : {}),
    }));
  }
  if (s.reviewOfSystems?.length) {
    body.rosObservations = s.reviewOfSystems.map((r) => ({ field: r.field, value: true }));
  }
  if (s.medicalDecision) {
    body.medicalDecision = { text: s.medicalDecision };
  }
  if (Object.keys(body).length > 1) {
    logCall('save-chart-data (provider findings)', body);
    if (ctx.mode === 'execute' && ctx.oystehr) {
      const res = await fetch(`${ctx.zambdaApi}/zambda/save-chart-data/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.accessToken}`,
          'x-zapehr-project-id': ctx.projectId ?? '',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`save-chart-data (provider findings) failed: ${res.status}\n${await res.text()}`);
      logNote('diagnoses/exam/ROS/MDM saved');
    }
  }

  // Prescriptions → eRx-tagged MedicationRequest (so they render in the note's
  // Prescriptions section + the eRX tab; get-erx-orders searches _tag=erx-medication).
  if (s.prescriptions?.length) {
    const DRUG_SYS = 'https://terminology.fhir.oystehr.com/CodeSystem/medispan-dispensable-drug-id';
    logCall('create eRx MedicationRequest(s)', { count: s.prescriptions.length });
    if (ctx.mode === 'execute' && ctx.oystehr && ctx.encounterId) {
      for (const rx of s.prescriptions) {
        await ctx.oystehr.fhir.create({
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          meta: { tag: [{ code: 'erx-medication' }] },
          ...(ctx.patientId ? { subject: { reference: `Patient/${ctx.patientId}` } } : {}),
          encounter: { reference: `Encounter/${ctx.encounterId}` },
          ...(ctx.attendingPractitionerId
            ? { requester: { reference: `Practitioner/${ctx.attendingPractitionerId}` } }
            : {}),
          medicationCodeableConcept: { coding: [{ system: DRUG_SYS, display: rx.name }], text: rx.name },
          dosageInstruction: [{ text: rx.sig, patientInstruction: rx.sig }],
        } as import('fhir/r4b').MedicationRequest);
      }
      logNote(`${s.prescriptions.length} prescription(s) created`);
    }
  }
}

// ── Phase 6 — in-house lab orders (plan-only) ────────────────────────────────

// Catalog test names vary across envs ("Urinalysis (UA)" vs "Urinalysis",
// "COVID-19 Antigen" vs "SARS-CoV-2 Antigen", "Monospot test" vs "Mono Spot"),
// and the harness used to require an EXACT match — so most lab orders silently
// skipped. Normalize (drop parentheticals + non-alphanumerics) and apply a small
// alias map, then prefer an exact normalized hit before a catalog-contains
// fallback (so "Rapid Strep A" never collides with a bare "Strep" entry).
const normLab = (s: string): string =>
  (s ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]/g, '');
const LAB_NAME_ALIASES: Record<string, string> = {
  sarscov2antigen: 'covid19antigen',
  sarscov2: 'covid19antigen',
  covid19: 'covid19antigen',
  monospot: 'monospottest',
  rapidcovid19antigen: 'covid19antigen',
  rapidinfluenzaab: 'rapidinfluenzaa', // combined "A/B" archetype → the Flu A catalog test
};
function matchCatalogTest<T extends { name: string }>(labs: T[], testName: string): T | undefined {
  const want = normLab(testName);
  const aliased = LAB_NAME_ALIASES[want] ?? want;
  return (
    labs.find((t) => normLab(t.name) === want) ??
    labs.find((t) => normLab(t.name) === aliased) ??
    labs.find((t) => normLab(t.name).includes(aliased))
  );
}

async function phase6_inHouseLabs(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  if (!s.modules?.inHouseLabs?.length) return;

  startPhase('In-house lab orders');

  for (const lab of s.modules.inHouseLabs) {
    logCall('get-create-in-house-lab-order-resources', { encounterId: ctx.encounterId ?? '<from Phase 1>' });

    if (ctx.mode !== 'execute' || !ctx.oystehr) {
      logNote(
        `(plan) test "${lab.testName}", ${lab.diagnoses.length} diagnoses, results=${lab.results ? 'yes' : 'no'}`
      );
      continue;
    }

    // 1. Fetch the catalog of test items available for this encounter.
    const catalogRes = await fetch(`${ctx.zambdaApi}/zambda/get-create-in-house-lab-order-resources/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.accessToken}`,
        'x-zapehr-project-id': ctx.projectId ?? '',
      },
      body: JSON.stringify({ encounterId: ctx.encounterId }),
    });
    if (!catalogRes.ok) {
      throw new Error(
        `get-create-in-house-lab-order-resources failed: ${catalogRes.status}\n${await catalogRes.text()}`
      );
    }
    const catalog = (await catalogRes.json()) as {
      output?: { labs?: Array<{ name: string }> };
      labs?: Array<{ name: string }>;
    };
    const labs = catalog.output?.labs ?? catalog.labs ?? [];
    const testItem = matchCatalogTest(labs, lab.testName);
    if (!testItem) {
      console.warn(
        `  ⚠ test "${lab.testName}" not found in encounter catalog (${labs.length} options) — skipping this lab order`
      );
      continue;
    }
    logNote(`resolved test "${lab.testName}" from catalog`);

    // 2. Create the order. testItems is the full DataEntryTestItem objects.
    logCall('create-in-house-lab-order', {
      encounterId: ctx.encounterId,
      testItems: `[1 item: "${lab.testName}"]`,
      diagnosesAll: lab.diagnoses,
      diagnosesNew: lab.diagnoses,
      notes: lab.notes ?? '',
    });
    const orderRes = await fetch(`${ctx.zambdaApi}/zambda/create-in-house-lab-order/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.accessToken}`,
        'x-zapehr-project-id': ctx.projectId ?? '',
      },
      body: JSON.stringify({
        encounterId: ctx.encounterId,
        testItems: [testItem],
        diagnosesAll: lab.diagnoses,
        diagnosesNew: lab.diagnoses,
        notes: lab.notes ?? '',
      }),
    });
    if (!orderRes.ok) {
      throw new Error(`create-in-house-lab-order failed: ${orderRes.status}\n${await orderRes.text()}`);
    }
    const orderJson = (await orderRes.json()) as {
      output?: { serviceRequestIds?: string[] };
      serviceRequestIds?: string[];
    };
    const serviceRequestId = (orderJson.output?.serviceRequestIds ?? orderJson.serviceRequestIds ?? [])[0];
    if (!serviceRequestId) {
      throw new Error(
        `create-in-house-lab-order returned no serviceRequestId: ${JSON.stringify(orderJson).slice(0, 200)}`
      );
    }
    logNote(`order created — serviceRequestId=${serviceRequestId}`);

    // 3. If the scenario carries results, mark specimen as collected. (Final
    //    result entry uses ResultEntryInput keyed by observationDefinitionId,
    //    which requires walking testItem.components — left as a follow-up.)
    if (lab.results) {
      logCall('collect-in-house-lab-specimen', { serviceRequestId });
      const collectRes = await fetch(`${ctx.zambdaApi}/zambda/collect-in-house-lab-specimen/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.accessToken}`,
          'x-zapehr-project-id': ctx.projectId ?? '',
        },
        body: JSON.stringify({
          encounterId: ctx.encounterId,
          serviceRequestId,
          data: {
            specimen: {
              source: 'throat-swab',
              // Must match either encounter's attending or the calling user
              // (synthesizer Practitioner). Use attending — easiest match.
              collectedBy: { id: ctx.attendingPractitionerId ?? '', name: 'Synthesizer' },
              collectionDate: new Date().toISOString(),
            },
          },
        }),
      });
      if (!collectRes.ok) {
        console.warn(
          `  ⚠ collect-in-house-lab-specimen failed: ${collectRes.status} ${(await collectRes.text()).slice(0, 200)}`
        );
      } else {
        logNote('specimen collected');
      }
    }
  }

  // Result-finalization: only visits that will end discharged/completed get
  // their labs resulted (in-progress visits keep pending orders — realistic).
  // For visits left in-progress today, the daily-census catch-up finalizes them
  // when it signs them tomorrow. Submits the scenario-authored result values via
  // handle-in-house-lab-results (the finalizer derives normal/abnormal flags).
  const target = s.visit.targetStatus ?? 'completed';
  if (ctx.mode === 'execute' && ctx.oystehr && ctx.encounterId && ['discharged', 'completed'].includes(target)) {
    const nrm = (x: string): string => (x ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const resultsByTest: Record<string, any> = {};
    for (const lab of s.modules.inHouseLabs) if (lab.results) resultsByTest[nrm(lab.testName)] = lab.results;
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.accessToken}`,
        'x-zapehr-project-id': ctx.projectId ?? '',
      };
      const fz = await finalizeInHouseLabs({ zambdaApi: ctx.zambdaApi, headers }, ctx.encounterId, resultsByTest, true);
      if (fz.finalized) logNote(`finalized ${fz.finalized} in-house lab result(s)`);
    } catch (err) {
      console.warn(`  ⚠ in-house lab result finalization failed: ${err instanceof Error ? err.message : err}`);
    }
  }
}

// ── Phase 7 — in-house medications ───────────────────────────────────────────

/** Map common route abbreviations to SNOMED codes that the zambda accepts. */
const ROUTE_SNOMED_MAP: Record<string, string> = {
  PO: '26643006',
  ORAL: '26643006',
  IV: '47625008',
  IM: '78421000',
  SC: '34206005',
  TOPICAL: '6064005',
};

async function resolveMedicationId(ctx: SynthesisContext, name: string): Promise<string | undefined> {
  if (!ctx.oystehr) return undefined;
  // Identifier values on Ottehr's medication catalog are typically the full
  // human-readable name (e.g., "Tdap (Tetanus, Diphtheria, Pertussis)").
  // Try exact match first, then substring match against the full catalog.
  try {
    const result = await ctx.oystehr.fhir.search<{ id?: string }>({
      resourceType: 'Medication',
      params: [{ name: 'identifier', value: name }],
    });
    const m = (result.unbundle() as Array<{ id?: string }>)[0];
    if (m?.id) return m.id;
  } catch {
    /* fall through */
  }
  // Substring fallback — list all, find any whose identifier value or code.text contains the name.
  try {
    const all = (
      await ctx.oystehr.fhir.search<{
        id?: string;
        identifier?: Array<{ value?: string }>;
        code?: { text?: string; coding?: Array<{ display?: string }> };
      }>({
        resourceType: 'Medication',
        params: [{ name: '_count', value: '500' }],
      })
    ).unbundle();
    const needle = name.toLowerCase();
    const match = all.find((m) => {
      const fields = [
        ...(m.identifier?.map((i) => i.value) ?? []),
        m.code?.text,
        ...(m.code?.coding?.map((c) => c.display) ?? []),
      ].filter(Boolean) as string[];
      return fields.some((f) => f.toLowerCase().includes(needle));
    });
    return match?.id;
  } catch {
    return undefined;
  }
}

async function phase7_inHouseMedications(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  if (!s.modules?.inHouseMedications?.length) return;

  startPhase('In-house medication orders');

  for (const med of s.modules.inHouseMedications) {
    const medicationId = ctx.mode === 'execute' ? await resolveMedicationId(ctx, med.medicationName) : undefined;
    const routeCode = ROUTE_SNOMED_MAP[(med.route ?? '').toUpperCase()] ?? med.route;

    // The zambda always creates orders in `pending` status regardless of
    // newStatus. To end up `administered`, we make two calls: first creates
    // the order, second transitions to administered.
    const orderData = {
      patient: ctx.patientId,
      // The zambda's validator reads `encounter` while the FHIR resource builder
      // reads `encounterId` — both fields are needed to get a linked MA + MR.
      encounter: ctx.encounterId,
      encounterId: ctx.encounterId,
      // Same provider mismatch — the MA's "ordered by" performer comes from
      // orderData.providerId; pass the attending so the order is attributed.
      providerId: ctx.attendingPractitionerId,
      medicationId: medicationId ?? `<unresolved: ${med.medicationName}>`,
      // dose must be a Number (FHIR Quantity.value). Scenario stores as string.
      dose: Number(med.dose),
      units: med.units,
      route: routeCode,
      ...(med.effectiveDateTime ? { effectiveDateTime: med.effectiveDateTime } : {}),
    };
    const createBody = { orderId: null, orderData };
    logCall('create-update-medication-order', createBody);

    if (ctx.mode === 'execute' && ctx.oystehr) {
      if (!medicationId) {
        console.warn(`  ⚠ medication "${med.medicationName}" not found in formulary — skipping order`);
        continue;
      }
      // Routed to local: cloud-deployed zambda lacks the OTR-2428 fix.
      const callZambda = (b: unknown): Promise<Response> =>
        fetch(`${ctx.zambdaApi}/zambda/create-update-medication-order/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ctx.accessToken}`,
            'x-zapehr-project-id': ctx.projectId ?? '',
          },
          body: JSON.stringify(b),
        });
      const res = await callZambda(createBody);
      if (!res.ok) {
        console.warn(
          `  ⚠ create-update-medication-order (create) failed: ${res.status} ${(await res.text()).slice(0, 200)}`
        );
        continue;
      }
      const created = (await res.json()) as { id?: string; output?: { id?: string } };
      const orderId = created.id ?? created.output?.id;
      logNote(`order created for ${med.medicationName} → ${orderId}`);

      // Administration is status-aware: only finalized visits (discharged/
      // completed) administer at creation. In-progress visits leave the order
      // PENDING (realistic) — the daily-census catch-up administers it when it
      // later signs the visit (finalizeMedicationsAndImmunizations).
      const target = s.visit.targetStatus ?? 'completed';
      const administerNow = med.administered && ['discharged', 'completed'].includes(target);
      if (administerNow && orderId) {
        const adminBody = { orderId, newStatus: 'administered', orderData };
        logCall('create-update-medication-order (administer)', adminBody);
        const adminRes = await callZambda(adminBody);
        if (!adminRes.ok) {
          console.warn(
            `  ⚠ create-update-medication-order (administer) failed: ${adminRes.status} ${(
              await adminRes.text()
            ).slice(0, 200)}`
          );
        } else {
          logNote(`order administered: ${med.medicationName}`);
        }
      }
    }
  }
}

// ── Phase 8 — immunizations ──────────────────────────────────────────────────

async function phase8_immunizations(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  if (!s.modules?.immunizations?.length) return;

  startPhase('Immunization orders');

  for (const imm of s.modules.immunizations) {
    const medicationId = ctx.mode === 'execute' ? await resolveMedicationId(ctx, imm.vaccineName) : undefined;

    const orderBody = {
      encounterId: ctx.encounterId,
      details: {
        medication: { id: medicationId ?? '<unresolved>', name: imm.vaccineName },
        dose: imm.dose,
        units: imm.units,
        orderedProvider: { id: ctx.attendingPractitionerId ?? '', name: 'Synthesizer' },
        ...(imm.route ? { route: imm.route } : {}),
        ...(imm.location ? { location: imm.location } : {}),
      },
    };
    logCall('create-update-immunization-order', orderBody);

    if (ctx.mode === 'execute' && ctx.oystehr) {
      if (!medicationId) {
        console.warn(`  ⚠ vaccine "${imm.vaccineName}" not found in catalog — skipping immunization order`);
        continue;
      }
      const res = await fetch(`${ctx.zambdaApi}/zambda/create-update-immunization-order/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.accessToken}`,
          'x-zapehr-project-id': ctx.projectId ?? '',
        },
        body: JSON.stringify(orderBody),
      });
      if (!res.ok) {
        console.warn(`  ⚠ create-update-immunization-order failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
        continue;
      }
      const orderJson = (await res.json()) as { output?: { id?: string }; id?: string };
      const orderId = orderJson.output?.id ?? orderJson.id;
      logNote(`order created for ${imm.vaccineName} → ${orderId}`);

      // Status-aware administration (see Phase 7 note): only finalized visits
      // administer at creation; in-progress visits leave the immunization order
      // pending for the daily-census catch-up to administer when it signs.
      const target = s.visit.targetStatus ?? 'completed';
      const administerNow = imm.administered && ['discharged', 'completed'].includes(target);
      if (administerNow && orderId) {
        const adminBody = {
          orderId,
          administrationDetails: { dose: { value: parseFloat(imm.dose), unit: imm.units } },
        };
        logCall('administer-immunization-order', adminBody);
        const adminRes = await fetch(`${ctx.zambdaApi}/zambda/administer-immunization-order/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ctx.accessToken}`,
            'x-zapehr-project-id': ctx.projectId ?? '',
          },
          body: JSON.stringify(adminBody),
        });
        if (!adminRes.ok) {
          console.warn(
            `  ⚠ administer-immunization-order failed: ${adminRes.status} ${(await adminRes.text()).slice(0, 200)}`
          );
        } else {
          logNote(`administered`);
        }
      }
    } else if (imm.administered) {
      logCall('administer-immunization-order', {
        orderId: '<from prior>',
        administrationDetails: { dose: { value: parseFloat(imm.dose), unit: imm.units } },
      });
    }
  }
}

// ── Phase 9 — radiology (plan-only) ──────────────────────────────────────────

async function phase9_radiology(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  if (!s.modules?.radiology?.length) return;

  startPhase('Radiology orders');

  for (const rad of s.modules.radiology) {
    const orderBody = {
      encounterId: ctx.encounterId,
      cptCode: rad.cptCode,
      diagnosisCode: rad.diagnosisCode,
      stat: rad.stat,
      clinicalHistory: rad.clinicalHistory,
      consentObtained: rad.consentObtained,
      ...(rad.studyName ? { studyName: rad.studyName } : {}),
      ...(rad.lateralityModifier ? { lateralityModifier: rad.lateralityModifier } : {}),
    };
    logCall('radiology-create-order', orderBody);

    if (ctx.mode === 'execute' && ctx.oystehr) {
      // Cloud-deployed radiology zambdas appear to be running older code that
      // 500s — route through local until cloud catches up.
      const res = await fetch(`${ctx.zambdaApi}/zambda/radiology-create-order/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.accessToken}`,
          'x-zapehr-project-id': ctx.projectId ?? '',
        },
        body: JSON.stringify(orderBody),
      });
      if (!res.ok) {
        console.warn(`  ⚠ radiology-create-order failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
        continue;
      }
      const orderJson = (await res.json()) as {
        output?: { serviceRequestId?: string };
        serviceRequestId?: string;
      };
      const serviceRequestId = orderJson.output?.serviceRequestId ?? orderJson.serviceRequestId;
      logNote(`radiology order → ${serviceRequestId}`);

      if (rad.preliminaryReport && serviceRequestId) {
        const reportBody = { serviceRequestId, preliminaryReport: rad.preliminaryReport };
        logCall('radiology-save-preliminary-report', reportBody);
        const rRes = await fetch(`${ctx.zambdaApi}/zambda/radiology-save-preliminary-report/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ctx.accessToken}`,
            'x-zapehr-project-id': ctx.projectId ?? '',
          },
          body: JSON.stringify(reportBody),
        });
        if (!rRes.ok) {
          console.warn(`  ⚠ save-preliminary-report failed: ${rRes.status} ${(await rRes.text()).slice(0, 200)}`);
        } else {
          logNote(`preliminary report saved`);
        }
      }
    } else if (rad.preliminaryReport) {
      logCall('radiology-save-preliminary-report', {
        serviceRequestId: '<from prior>',
        conclusion: rad.preliminaryReport,
      });
    }
  }

  // Final-report finalization: only visits that will end discharged/completed
  // get their radiology orders finalized (preliminary → final). In-progress
  // visits keep just the preliminary report — realistic — and the daily-census
  // catch-up finalizes them when it signs the visit tomorrow. Mirrors the
  // in-house lab finalization in Phase 6.
  const target = s.visit.targetStatus ?? 'completed';
  if (ctx.mode === 'execute' && ctx.oystehr && ctx.encounterId && ['discharged', 'completed'].includes(target)) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.accessToken}`,
        'x-zapehr-project-id': ctx.projectId ?? '',
      };
      const fz = await finalizeRadiology({ zambdaApi: ctx.zambdaApi, headers }, ctx.encounterId, true);
      if (fz.finalized) logNote(`finalized ${fz.finalized} radiology report(s)`);
    } catch (err) {
      console.warn(`  ⚠ radiology final-report finalization failed: ${err instanceof Error ? err.message : err}`);
    }
  }
}

// ── Phase 10 — eligibility & pricing ──────────────────────────────────────────
//
// Two sub-phases run end-to-end:
//
//   10A. Charge master + fee schedule setup. Idempotent — finds existing
//        ChargeItemDefinitions by name+designation/tag (via list-charge-masters
//        / list-fee-schedules) and adds CPT entries via cm-add-procedure-code
//        / add-procedure-code. Associates the fee schedule with the payer
//        Organization via associate-payer. The EHR's PatientPaymentsList uses
//        find-applicable-fee-schedule (payer + dateOfService → fee schedule)
//        and get-charge-master-entry to compute the patient-responsibility
//        column.
//
//   10B. Coverage enrichment + synthetic eligibility check. We patch the
//        Coverage created by the harvest with extra `class` entries (plan
//        name, group number) — there's no zambda for this since the harvest
//        itself doesn't accept those fields, so a direct FHIR PATCH is
//        unavoidable. Then we create CoverageEligibilityRequest +
//        CoverageEligibilityResponse FHIR resources directly. The only
//        zambda that produces a CER is `get-eligibility`, which POSTs to
//        an external RCM `/rcm/eligibility-check` endpoint that synth
//        doesn't have wired up — so we synthesize the FHIR shape the EHR
//        reads (parseCoverageEligibilityResponse) instead, including the
//        oystehr `raw-request` / `raw-response` extensions that carry the
//        copay/deductible/OOP-max benefit detail.
//
// Critical filter to be aware of:
//   - The eligibility chip flips to ELIGIBLE only when at least one
//     `insurance[0].item[]` has `category.coding[0].code` ∈ 'UC,86,30' AND
//     a `benefit[]` entry with `type.text === 'Active Coverage'`.
//   - CopayWidget.tsx filters benefits to `code === 'UC'` only — anything
//     with a different benefit_code is silently dropped from the panel.

async function phase10_eligibilityAndPricing(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  if (!s.eligibility && !s.pricing) return;

  startPhase('Eligibility & pricing');

  if (ctx.mode !== 'execute' || !ctx.oystehr) {
    if (s.pricing?.cptPrices?.length) {
      for (const price of s.pricing.cptPrices) {
        logCall('cm-add-procedure-code', { code: price.cpt, chargedAmount: price.chargedAmount });
        logCall('add-procedure-code', { code: price.cpt, allowedAmount: price.allowedAmount });
      }
    }
    if (s.eligibility) {
      logFhir('patch', 'Coverage.class entries for plan name + group number');
      logFhir(
        'create',
        'CoverageEligibilityRequest + CoverageEligibilityResponse with raw-request/raw-response extensions'
      );
    }
    return;
  }

  // ── 10A — charge master + fee schedule (idempotent) ──────────────────────
  if (s.pricing?.cptPrices?.length && ctx.payerOrganizationId) {
    await ensureChargeMasterAndFeeSchedule(ctx, s);
  }

  // ── 10B — Coverage enrichment + eligibility synthesis ────────────────────
  if (s.eligibility) {
    await enrichCoverageAndSynthesizeEligibility(ctx, s);
  }
}

/**
 * Idempotent setup: a default-insurance Charge Master with chargedAmounts
 * and a per-payer Fee Schedule with allowedAmounts. Re-runs no-op when
 * names match and CPT entries already exist.
 */
async function ensureChargeMasterAndFeeSchedule(ctx: SynthesisContext, s: VisitScenario): Promise<void> {
  if (!ctx.oystehr || !s.pricing) return;

  // Optional per-team namespace prefix (SYNTH_NAMESPACE env var). When set,
  // CM + FS titles get prefixed with "<namespace>: " so multiple users
  // running synth in the same Oystehr project don't collide on each other's
  // pricing — write/overwrite of a CPT entry only affects the namespaced
  // CM/FS, not the default shared one. Default behavior (env var unset) is
  // unchanged: a single shared CM and FS per project.
  const namespace = process.env.SYNTH_NAMESPACE?.trim();
  const titlePrefix = namespace ? `${namespace}: ` : '';
  const cmName = `${titlePrefix}Ottehr Synth Default Insurance Charge Master`;
  const fsName = `${titlePrefix}${s.pricing.feeScheduleName ?? 'Ottehr Synth Fee Schedule'}`;
  if (namespace) {
    logNote(`SYNTH_NAMESPACE="${namespace}" — using namespaced CM/FS titles`);
  }
  const effectiveDate = '2024-01-01';

  // 1. Find or create the default-insurance Charge Master.
  const cmList = (await zambdaExecute(ctx, 'list-charge-masters', {})) as ChargeItemDefinition[];
  let cm = cmList.find((entry) => entry.title === cmName);
  if (!cm) {
    cm = (await zambdaExecute(ctx, 'create-charge-master', {
      name: cmName,
      effectiveDate,
      description: 'Default insurance charge master seeded by synth pipeline',
    })) as ChargeItemDefinition;
    logNote(`created Charge Master "${cmName}" → ${cm.id}`);
    await zambdaExecute(ctx, 'designate-charge-master-entry', {
      chargeMasterId: cm.id,
      designation: 'default-insurance',
    });
    logNote(`designated Charge Master as default-insurance`);
  } else {
    logNote(`Charge Master "${cmName}" already exists → ${cm.id}`);
  }

  // 2. Find or create the payer-specific Fee Schedule.
  const fsList = (await zambdaExecute(ctx, 'list-fee-schedules', {})) as ChargeItemDefinition[];
  let fs = fsList.find((entry) => entry.title === fsName);
  if (!fs) {
    fs = (await zambdaExecute(ctx, 'create-fee-schedule', {
      name: fsName,
      effectiveDate,
      description: `Fee schedule for ${fsName} seeded by synth pipeline`,
    })) as ChargeItemDefinition;
    logNote(`created Fee Schedule "${fsName}" → ${fs.id}`);
  } else {
    logNote(`Fee Schedule "${fsName}" already exists → ${fs.id}`);
  }

  // 3. Associate fee schedule with the payer Organization (idempotent —
  //    the zambda no-ops if association already exists).
  try {
    await zambdaExecute(ctx, 'associate-payer', {
      feeScheduleId: fs.id,
      organizationId: ctx.payerOrganizationId,
    });
    logNote(`associated Fee Schedule with payer Organization/${ctx.payerOrganizationId}`);
  } catch (err) {
    // Ignore "already associated" errors; surface real failures.
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.toLowerCase().includes('already')) {
      console.warn(`  ⚠ associate-payer failed: ${msg}`);
    }
  }

  // 4. Add per-CPT prices. cm-add-procedure-code and add-procedure-code throw
  //    if the entry already exists, so swallow duplicate errors.
  for (const price of s.pricing.cptPrices ?? []) {
    try {
      await zambdaExecute(ctx, 'cm-add-procedure-code', {
        chargeMasterId: cm.id,
        code: price.cpt,
        amount: price.chargedAmount,
      });
      logNote(`CM ${price.cpt}: charged $${price.chargedAmount}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes('already')) console.warn(`  ⚠ cm-add ${price.cpt}: ${msg}`);
    }
    try {
      await zambdaExecute(ctx, 'add-procedure-code', {
        feeScheduleId: fs.id,
        code: price.cpt,
        amount: price.allowedAmount,
      });
      logNote(`FS ${price.cpt}: allowed $${price.allowedAmount}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes('already')) console.warn(`  ⚠ fs-add ${price.cpt}: ${msg}`);
    }
  }
}

/**
 * Patch Coverage with plan-name + group-number class entries (the harvest
 * doesn't propagate these fields), then create CER + CoverageEligibilityResponse
 * resources with synthetic benefit data. The EHR's get-patient-account zambda
 * picks up the most recent CERs by patient and renders the eligibility chip
 * + CopayWidget from them.
 */
async function enrichCoverageAndSynthesizeEligibility(ctx: SynthesisContext, s: VisitScenario): Promise<void> {
  if (!ctx.oystehr || !s.eligibility || !ctx.patientId) return;

  const e = s.eligibility;
  const ins = s.patient.insurance?.primary;
  if (!ins) {
    console.warn('  ⚠ no primary insurance in scenario — skipping eligibility synthesis');
    return;
  }

  // Find the Coverage created by the harvest.
  const coverages = (
    await ctx.oystehr.fhir.search<Coverage>({
      resourceType: 'Coverage',
      params: [{ name: 'patient', value: `Patient/${ctx.patientId}` }],
    })
  ).unbundle();
  const coverage = coverages.find((c) => c.status === 'active');
  if (!coverage?.id) {
    console.warn('  ⚠ no active Coverage found — skipping eligibility synthesis');
    return;
  }

  // Add telecom to the payer Organization if it's missing — the EHR's
  // carrier panel renders phone/website/fax from Organization.telecom.
  if (ctx.payerOrganizationId) {
    const payer = await ctx.oystehr.fhir.get<Organization>({
      resourceType: 'Organization',
      id: ctx.payerOrganizationId,
    });
    if (!payer.telecom?.length) {
      // Backfill phone + fax only — these are NANPA-reserved 555-01XX
      // numbers that never reach a real person, so it's safe to apply the
      // same value to every payer Organization. URL/website is intentionally
      // NOT backfilled: hardcoding any one payer's website (e.g.,
      // https://www.bcbst.com) onto every payer Org we touch produces
      // wrong-on-its-face data in the eligibility detail dialog (Aetna
      // patient seeing BCBS-TN's URL, etc.). If a payer Org genuinely has
      // no website, leave it blank — the EHR's carrier panel renders an
      // empty field rather than a fabricated one.
      const updated: Organization = {
        ...payer,
        telecom: [
          { system: 'phone', value: '1-800-555-0140', use: 'work' },
          { system: 'fax', value: '1-423-555-0109' },
        ],
      };
      await ctx.oystehr.fhir.update<Organization>(updated);
      logNote(`patched payer Organization/${ctx.payerOrganizationId} with synth phone/fax (URL left blank)`);
    }
  }

  // Patch Coverage.class with plan-name + group-number, dedup-aware.
  const existingClasses = coverage.class ?? [];
  const newClasses: typeof existingClasses = [];
  const planName = ins.planName;
  const groupNumber = ins.groupNumber;
  const hasPlanClass = existingClasses.some(
    (c) => c.value === planName && c.type?.coding?.some((cd) => cd.code === 'plan')
  );
  const hasGroupClass = existingClasses.some(
    (c) => c.value === groupNumber && c.type?.coding?.some((cd) => cd.code === 'group')
  );
  if (planName && !hasPlanClass) {
    newClasses.push({
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/coverage-class', code: 'plan' }] },
      value: planName,
      name: planName,
    });
  }
  if (groupNumber && !hasGroupClass) {
    newClasses.push({
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/coverage-class', code: 'group' }] },
      value: groupNumber,
      name: groupNumber,
    });
  }
  if (newClasses.length) {
    const updated: Coverage = { ...coverage, class: [...existingClasses, ...newClasses] };
    await ctx.oystehr.fhir.update<Coverage>(updated);
    logNote(`patched Coverage with ${newClasses.length} class entries (plan/group)`);
  }

  // Build the synthetic eligibility request → response pair.
  const nowISO = new Date().toISOString();
  const todayDate = nowISO.slice(0, 10);

  // Supersede any prior active CERs for this patient + Coverage so the EHR's
  // coverageChecks.find() unambiguously picks the new one. Without this, the
  // old CER stays sorted into the array (only filtered by Coverage match) and
  // a stale browser cache could surface its data even though the new one
  // would normally win on `_sort=-created`.
  const priorCERs = (
    await ctx.oystehr.fhir.search<CoverageEligibilityResponse>({
      resourceType: 'CoverageEligibilityResponse',
      params: [
        { name: 'patient', value: `Patient/${ctx.patientId}` },
        { name: 'status', value: 'active' },
      ],
    })
  ).unbundle();
  for (const prior of priorCERs) {
    if (prior.insurance?.[0]?.coverage?.reference !== `Coverage/${coverage.id}`) continue;
    if (!prior.id) continue;
    await ctx.oystehr.fhir.patch<CoverageEligibilityResponse>({
      resourceType: 'CoverageEligibilityResponse',
      id: prior.id,
      operations: [{ op: 'replace', path: '/status', value: 'cancelled' }],
    });
  }
  if (priorCERs.length) {
    logNote(`superseded ${priorCERs.length} prior CER(s) (status → cancelled)`);
  }

  const cer: CoverageEligibilityRequest = {
    resourceType: 'CoverageEligibilityRequest',
    status: 'active',
    purpose: ['benefits'],
    patient: { reference: `Patient/${ctx.patientId}` },
    created: nowISO,
    insurer: { reference: `Organization/${ctx.payerOrganizationId}` },
    insurance: [{ coverage: { reference: `Coverage/${coverage.id}` } }],
  };
  const requestCreated = await ctx.oystehr.fhir.create<CoverageEligibilityRequest>(cer);
  logNote(`created CoverageEligibilityRequest → ${requestCreated.id}`);

  // Synthetic raw-request payload (mirrors what pVerify/Candid sends).
  const dobYYYYMMDD = (s.patient.dateOfBirth ?? '').replace(/-/g, '');
  const rawRequest = {
    pat_name_f: s.patient.firstName,
    pat_name_m: s.patient.middleName ?? '',
    pat_name_l: s.patient.lastName,
    pat_dob: dobYYYYMMDD,
  };

  // Synthetic raw-response payload — the parser pulls copay/deductible/OOP-max
  // from elig.benefit[] entries shaped like pVerify's response.
  //
  // Build payerEntity from the resolved payer Organization on FHIR (we already
  // have ctx.payerOrganizationId from Phase 0). Per-payer values are the
  // truth: an Aetna patient should see Aetna's address/website in the
  // eligibility detail dialog, not whatever fallback we'd hardcode. Where
  // the Organization lacks a field (some imported payer Orgs only have a
  // name + payer-id), we leave it blank — better than embedding wrong data.
  const carrierName = ins.carrier;
  const refreshedPayer = ctx.payerOrganizationId
    ? await ctx.oystehr.fhir.get<Organization>({ resourceType: 'Organization', id: ctx.payerOrganizationId })
    : undefined;
  const phoneTelecom = refreshedPayer?.telecom?.find((t) => t.system === 'phone')?.value;
  const faxTelecom = refreshedPayer?.telecom?.find((t) => t.system === 'fax')?.value;
  const websiteTelecom = refreshedPayer?.telecom?.find((t) => t.system === 'url')?.value;
  const payerAddr = refreshedPayer?.address?.[0];
  const payerXxId = refreshedPayer?.identifier?.find((i) => i.type?.coding?.some((c) => c.code === 'XX'))?.value;
  const payerEntity = {
    entity_name: [refreshedPayer?.name ?? carrierName],
    entity_id: payerXxId ? [payerXxId] : [],
    entity_addr_1: payerAddr?.line?.[0] ? [payerAddr.line[0]] : [],
    entity_city: payerAddr?.city ?? '',
    entity_state: payerAddr?.state ?? '',
    entity_zip: payerAddr?.postalCode ?? '',
    entity_website: websiteTelecom ? [websiteTelecom] : [],
    // Phone/fax come from Organization.telecom which we backfill earlier in
    // this phase with NANPA-reserved 555-01XX numbers when missing — so a
    // real payer phone/fax can never end up here even if the source FHIR
    // resource has none.
    entity_phone: phoneTelecom ? [phoneTelecom] : [],
    entity_fax: faxTelecom ? [faxTelecom] : [],
  };

  const benefits: unknown[] = [];

  // Active Coverage marker — required for the eligibility chip to flip green.
  benefits.push({
    benefit_coverage_code: '1',
    benefit_code: 'UC',
    benefit_amount: 0,
    benefit_percent: 0,
    benefit_description: 'Active Coverage',
    benefit_coverage_description: 'Active Coverage',
    benefit_period_code: '23',
    benefit_period_description: 'Calendar Year',
    benefit_level_code: 'IND',
    benefit_level_description: 'Individual',
    inplan_network: 'Y',
    policy_number: ins.memberId ?? '',
    insurance_type_code: '12',
    insurance_type_description: 'Preferred Provider Organization (PPO)',
    plan_number: ins.planName ?? '',
    ...payerEntity,
  });

  // Health Benefit Plan Coverage (code 30) — populates the insurance details panel.
  benefits.push({
    benefit_coverage_code: '1',
    benefit_code: '30',
    benefit_amount: 0,
    benefit_percent: 0,
    benefit_description: 'Health Benefit Plan Coverage',
    benefit_coverage_description: 'Active Coverage',
    benefit_period_code: '23',
    benefit_period_description: 'Calendar Year',
    benefit_level_code: 'IND',
    benefit_level_description: 'Individual',
    inplan_network: 'Y',
    policy_number: ins.memberId ?? '',
    insurance_type_code: '12',
    insurance_type_description: 'Preferred Provider Organization (PPO)',
    plan_number: ins.planName ?? '',
    ...payerEntity,
  });

  // Copay (code B): urgent care, in-network and out-of-network.
  if (e.copays?.urgentCare !== undefined) {
    benefits.push({
      benefit_coverage_code: 'B',
      benefit_code: 'UC',
      benefit_amount: e.copays.urgentCare,
      benefit_percent: 0,
      benefit_description: 'Copay',
      benefit_coverage_description: 'Co-Payment',
      benefit_period_code: '27',
      benefit_period_description: 'Visit',
      benefit_level_code: 'IND',
      benefit_level_description: 'Individual',
      inplan_network: 'Y',
      ...payerEntity,
    });
    benefits.push({
      benefit_coverage_code: 'B',
      benefit_code: 'UC',
      benefit_amount: Math.round((e.copays.urgentCare ?? 0) * 2),
      benefit_percent: 0,
      benefit_description: 'Copay',
      benefit_coverage_description: 'Co-Payment',
      benefit_period_code: '27',
      benefit_period_description: 'Visit',
      benefit_level_code: 'IND',
      benefit_level_description: 'Individual',
      inplan_network: 'N',
      ...payerEntity,
    });
  }

  // Coinsurance (code A): in/out-of-network percentages.
  if (e.coinsurancePercent !== undefined) {
    benefits.push({
      benefit_coverage_code: 'A',
      benefit_code: 'UC',
      benefit_amount: 0,
      benefit_percent: e.coinsurancePercent,
      benefit_description: 'Coinsurance',
      benefit_coverage_description: 'Co-Insurance',
      benefit_period_code: '23',
      benefit_period_description: 'Calendar Year',
      benefit_level_code: 'IND',
      benefit_level_description: 'Individual',
      inplan_network: 'Y',
      ...payerEntity,
    });
    benefits.push({
      benefit_coverage_code: 'A',
      benefit_code: 'UC',
      benefit_amount: 0,
      benefit_percent: Math.min(100, e.coinsurancePercent + 20),
      benefit_description: 'Coinsurance',
      benefit_coverage_description: 'Co-Insurance',
      benefit_period_code: '23',
      benefit_period_description: 'Calendar Year',
      benefit_level_code: 'IND',
      benefit_level_description: 'Individual',
      inplan_network: 'N',
      ...payerEntity,
    });
  }

  // Deductible (code C): individual + family, total/used/remaining.
  if (e.deductible) {
    const indTotal = e.deductible.individual ?? 0;
    const indMet = e.deductible.met ?? 0;
    const indRemaining = Math.max(0, indTotal - indMet);
    const famTotal = e.deductible.family ?? 0;
    benefits.push(
      makeFinancialBenefit('C', 'Deductible', '23', 'Calendar Year', 'IND', indTotal, payerEntity),
      makeFinancialBenefit('C', 'Deductible', '24', 'Year-to-Date', 'IND', indMet, payerEntity),
      makeFinancialBenefit('C', 'Deductible', '29', 'Remaining', 'IND', indRemaining, payerEntity),
      makeFinancialBenefit('C', 'Deductible', '23', 'Calendar Year', 'FAM', famTotal, payerEntity)
    );
  }

  // Out-of-Pocket Max (code G): individual total/used/remaining + family total.
  if (e.outOfPocketMax) {
    const indTotal = e.outOfPocketMax.individual ?? 0;
    const indMet = e.deductible?.met ?? 0; // Use deductible-met as proxy for OOP used.
    const indRemaining = Math.max(0, indTotal - indMet);
    const famTotal = e.outOfPocketMax.family ?? 0;
    benefits.push(
      makeFinancialBenefit('G', 'Out-of-Pocket Maximum', '23', 'Calendar Year', 'IND', indTotal, payerEntity),
      makeFinancialBenefit('G', 'Out-of-Pocket Maximum', '24', 'Year-to-Date', 'IND', indMet, payerEntity),
      makeFinancialBenefit('G', 'Out-of-Pocket Maximum', '29', 'Remaining', 'IND', indRemaining, payerEntity),
      makeFinancialBenefit('G', 'Out-of-Pocket Maximum', '23', 'Calendar Year', 'FAM', famTotal, payerEntity)
    );
  }

  const rawResponse = {
    elig: {
      ins_name_f: s.patient.firstName,
      ins_name_m: s.patient.middleName ?? '',
      ins_name_l: s.patient.lastName,
      ins_dob: dobYYYYMMDD,
      ins_number: ins.memberId ?? '',
      ins_addr_1: s.patient.address?.line1 ?? '',
      ins_city: s.patient.address?.city ?? '',
      ins_state: s.patient.address?.state ?? '',
      ins_zip: s.patient.address?.postalCode ?? '',
      plan_number: ins.planName ?? '',
      benefit: benefits,
    },
  };

  const response: CoverageEligibilityResponse = {
    resourceType: 'CoverageEligibilityResponse',
    status: 'active',
    purpose: ['benefits'],
    patient: { reference: `Patient/${ctx.patientId}` },
    created: nowISO,
    request: { reference: `CoverageEligibilityRequest/${requestCreated.id}` },
    outcome: 'complete',
    insurer: { reference: `Organization/${ctx.payerOrganizationId}` },
    servicedDate: todayDate,
    insurance: [
      {
        coverage: { reference: `Coverage/${coverage.id}` },
        item: [
          {
            category: { coding: [{ code: 'UC', display: 'Urgent Care' }] },
            benefit: [{ type: { text: 'Active Coverage' } }],
          },
        ],
      },
    ],
    extension: [
      { url: 'https://extensions.fhir.oystehr.com/raw-request', valueString: JSON.stringify(rawRequest) },
      { url: 'https://extensions.fhir.oystehr.com/raw-response', valueString: JSON.stringify(rawResponse) },
    ],
  };
  const responseCreated = await ctx.oystehr.fhir.create<CoverageEligibilityResponse>(response);
  logNote(`created CoverageEligibilityResponse (${benefits.length} benefits) → ${responseCreated.id}`);
}

function makeFinancialBenefit(
  coverageCode: 'C' | 'G',
  description: string,
  periodCode: string,
  periodDescription: string,
  levelCode: 'IND' | 'FAM',
  amount: number,
  payerEntity: Record<string, unknown>
): Record<string, unknown> {
  return {
    benefit_coverage_code: coverageCode,
    // Plan-level financial benefits use service-type '30' (Health Benefit Plan
    // Coverage), not 'UC'. PatientPaymentsList.tsx:654 looks up the remaining
    // deductible with `code: '30'` when computing patient responsibility, so
    // tagging deductible/OOP-max with 'UC' (the urgent-care service code)
    // makes the EHR's responsibility projection ignore the deductible and
    // collapse to copay-only. Real pVerify/Candid responses follow the same
    // convention: per-service copays are 'UC', plan-wide financials are '30'.
    benefit_code: '30',
    benefit_amount: amount,
    benefit_percent: 0,
    benefit_description: description,
    benefit_coverage_description: description,
    benefit_period_code: periodCode,
    benefit_period_description: periodDescription,
    benefit_level_code: levelCode,
    benefit_level_description: levelCode === 'IND' ? 'Individual' : 'Family',
    inplan_network: 'Y',
    ...payerEntity,
  };
}

async function zambdaExecute(ctx: SynthesisContext, id: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${ctx.zambdaApi}/zambda/${id}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.accessToken}`,
      'x-zapehr-project-id': ctx.projectId ?? '',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${id} failed: ${res.status} ${text.slice(0, 300)}`);
  }
  if (!text) return undefined;
  const parsed = JSON.parse(text) as { output?: unknown };
  return parsed.output ?? parsed;
}

// ── Phase 11 — appointment notes (plan-only) ─────────────────────────────────

async function phase11_appointmentNotes(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  if (!s.notes?.appointmentNotes?.length) return;

  startPhase('Appointment notes (Communications)');
  for (const apptNote of s.notes.appointmentNotes) {
    logFhir('create', `Communication on appointment with text="${apptNote.text.slice(0, 50)}..."`);
  }
}

// ── Phase 12 — patient education (plan-only) ─────────────────────────────────

async function phase12_patientEducation(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  if (!s.notes?.patientEducationDocs?.length) return;

  startPhase('Patient education materials');
  for (const ed of s.notes.patientEducationDocs) {
    logCall('patient-education-create', { topic: ed.topic, title: ed.title, url: ed.url });
  }
}

// ── Phase 13 — visit-status walk + practitioner assignment ───────────────────

async function changeStatus(ctx: SynthesisContext, status: string): Promise<void> {
  if (!ctx.oystehr) return;
  const body = { encounterId: ctx.encounterId, updatedStatus: status };
  // change-in-person-visit-status doesn't use user.me() — cloud routing OK.
  const res = await fetch(`${ctx.zambdaApi}/zambda/change-in-person-visit-status/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.accessToken}`,
      'x-zapehr-project-id': ctx.projectId ?? '',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`change-in-person-visit-status (${status}) failed: ${res.status}\n${await res.text()}`);
  }
}

async function assignIntakePractitioner(ctx: SynthesisContext): Promise<void> {
  if (!ctx.oystehr || !ctx.intakeStaffId) return;
  const body = {
    encounterId: ctx.encounterId,
    practitionerId: ctx.intakeStaffId,
    userRole: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'ADM' }],
  };
  // assign-practitioner has the OTR-2428 fix locally; cloud not yet — route local.
  const res = await fetch(`${ctx.zambdaApi}/zambda/assign-practitioner/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.accessToken}`,
      'x-zapehr-project-id': ctx.projectId ?? '',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`assign-practitioner (ADM) failed: ${res.status}\n${await res.text()}`);
  }
}

/**
 * Phase 13 — Visit-status walk + intake-practitioner assignment.
 *
 * Walks the EHR's in-person visit-status lifecycle as far as
 * `scenario.visit.targetStatus` (default: 'completed'). Earlier targets stop
 * the walk at the named state, leaving the visit visible in the corresponding
 * dashboard tab (e.g. 'intake' → "Active" tab, 'discharged' → "Discharged"
 * tab without sign-off lock).
 *
 * Phases 1–12 (clinical work — chart data, template, orders, eligibility,
 * etc.) ran unconditionally regardless of `targetStatus`. This mirrors how a
 * real EHR works: intake nurses enter vitals while the provider is still
 * away, so a chart can be fully populated long before the lifecycle reaches
 * 'provider' or 'completed'. The target field controls dashboard placement,
 * not chart contents.
 */

async function phase13_statusWalk(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  if (s.signOff?.complete === false) return;

  const target = s.visit.targetStatus ?? 'completed';
  const targetIdx = VISIT_STATUS_ORDER.indexOf(target);
  const reach = (status: (typeof VISIT_STATUS_ORDER)[number]): boolean =>
    VISIT_STATUS_ORDER.indexOf(status) <= targetIdx;

  startPhase(`Visit-status walk + practitioner assignment (target: ${target})`);

  // 'pending' is the lifecycle state Phase 1's create-appointment leaves
  // the visit in already (Appointment.status='booked'). Nothing to do.
  if (target === 'pending') {
    logNote(`target=${target} — leaving visit at pending (no walk)`);
    return;
  }

  if (ctx.mode !== 'execute' || !ctx.oystehr) {
    if (reach('arrived')) logNote('change-in-person-visit-status → arrived');
    if (reach('ready')) logNote('change-in-person-visit-status → ready');
    if (reach('intake')) {
      logNote('assign-practitioner (intake staff, ADM)');
      logNote('change-in-person-visit-status → intake');
    }
    if (reach('ready for provider')) logNote('change-in-person-visit-status → ready for provider');
    if (reach('provider')) logNote('change-in-person-visit-status → provider');
    if (reach('discharged')) logNote('change-in-person-visit-status → discharged');
    if (reach('completed')) logNote('change-in-person-visit-status → completed');
    return;
  }

  if (reach('arrived')) {
    await changeStatus(ctx, 'arrived');
    logNote('status → arrived');
  }
  if (reach('ready')) {
    await changeStatus(ctx, 'ready');
    logNote('status → ready');
  }
  if (reach('intake')) {
    // assign intake staff before transitioning to intake
    await assignIntakePractitioner(ctx);
    logNote('intake staff assigned (ADM)');
    await changeStatus(ctx, 'intake');
    logNote('status → intake');
  }
  if (reach('ready for provider')) {
    await changeStatus(ctx, 'ready for provider');
    logNote('status → ready for provider');
  }
  // attending was already assigned in Phase 1.7 — no need to reassign
  if (reach('provider')) {
    await changeStatus(ctx, 'provider');
    logNote('status → provider');
  }
  if (reach('discharged')) {
    await changeStatus(ctx, 'discharged');
    logNote('status → discharged');
  }
  if (reach('completed')) {
    await changeStatus(ctx, 'completed');
    logNote('status → completed');
  }
}

// ── Phase 13.5 — backdate Encounter.statusHistory with realistic gaps ────────
//
// Phase 13 calls change-in-person-visit-status six or seven times back-to-back.
// The zambda stamps each transition with `DateTime.now()`
// (packages/utils/lib/fhir/encounter.ts:getEncounterStatusHistoryUpdateOp), so
// every in-room phase ends up at 0 mins in the EHR's visit-history viewer.
// The pre-arrival "pending" period also balloons (it spans from the
// appointment's scheduled time to whenever the synth happened to run the
// "arrived" call).
//
// THIS IS AN EXCEPTION to the README's "drive everything through zambdas"
// rule. The change-in-person-visit-status zambda intentionally uses real-time
// stamps — that's the right behavior for production. Synth needs backdated,
// realistic spacing, so we PATCH Encounter.statusHistory directly here. The
// alternative — modifying the zambda to accept an override timestamp — would
// add a code path that exists solely for synth and that admins could misuse
// in prod. Patching the FHIR resource directly is cheaper and isolated to
// the synth pipeline.
//
// Anchor: appointment.start. Each gap is sampled from a deterministic
// per-appointment seed so reruns produce identical timelines (good for
// regression testing and demos).

// Cheap deterministic PRNG: mulberry32 seeded from a string hash. Reruns of
// the same scenario produce identical timelines.
function seededRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function phase13_5_backdateStatusHistory(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  if (s.signOff?.complete === false) return;

  const target = s.visit.targetStatus ?? 'completed';
  const targetIdx = VISIT_STATUS_ORDER.indexOf(target);
  // Nothing to backdate if the walk never advanced past 'pending'.
  if (targetIdx <= VISIT_STATUS_ORDER.indexOf('pending')) return;

  startPhase('Backdate Encounter.statusHistory with realistic LOS gaps');

  if (ctx.mode !== 'execute' || !ctx.oystehr) {
    logNote(
      `would patch Encounter.statusHistory to spread ` +
        `${VISIT_STATUS_ORDER.slice(1, targetIdx + 1).join(' → ')} over realistic gaps anchored to appointment.start`
    );
    return;
  }
  if (!ctx.encounterId || !ctx.appointmentId) return;

  // Need both the Appointment (for start anchor) and the Encounter (for
  // current statusHistory shape — we want to preserve the FHIR encounter
  // status code and the ottehr-visit-status extension on each entry).
  const [appointment, encounter] = await Promise.all([
    ctx.oystehr.fhir.get<import('fhir/r4b').Appointment>({
      resourceType: 'Appointment',
      id: ctx.appointmentId,
    }),
    ctx.oystehr.fhir.get<import('fhir/r4b').Encounter>({
      resourceType: 'Encounter',
      id: ctx.encounterId,
    }),
  ]);

  const apptStartISO = appointment.start;
  if (!apptStartISO) {
    logNote('appointment.start missing — skipping statusHistory backdate');
    return;
  }
  const apptStart = DateTime.fromISO(apptStartISO);

  const existing = encounter.statusHistory ?? [];
  if (existing.length === 0) {
    logNote('Encounter.statusHistory empty — nothing to backdate');
    return;
  }

  // Index existing entries by their ottehr-visit-status extension code so we
  // can preserve each entry's FHIR status + extension shape while replacing
  // its period. Must match `FHIR_EXTENSION.EncounterStatusHistory.ottehrVisitStatus.url`
  // in packages/utils/lib/fhir/constants.ts — that's what `getVisitStatusHistory`
  // looks up. Writing a different URL here makes the EHR fall through to a
  // legacy fallback that emits multiple derived entries per real entry,
  // producing 28-entry dashboard rows that render garbage durations.
  const OTT_EXT_URL = 'https://extensions.fhir.zapehr.com/visit-status';
  const byOttStatus = new Map<string, (typeof existing)[number]>();
  for (const entry of existing) {
    const code = entry.extension?.find((e) => e.url === OTT_EXT_URL)?.valueCode;
    if (code) byOttStatus.set(code, entry);
  }

  const rng = seededRng(`${ctx.appointmentId}-status-history`);
  const sampleGap = (status: string): number => {
    const range = STATUS_GAP_DISTRIBUTIONS[status];
    if (!range) return 5;
    return Math.round(range.min + rng() * (range.max - range.min));
  };

  // Walk the lifecycle from 'pending' through targetStatus, computing each
  // entry's start time. 'pending' starts when the appointment was booked
  // (= appointment.start minus a small lead, since real visits are scheduled
  // ahead of time) and runs until 'arrived'. Each subsequent entry's start is
  // the previous start plus that entry's sampled gap.
  type Stamped = { ottStatus: string; start: DateTime };
  const stamped: Stamped[] = [];

  // 'pending' baseline: appointment.start - 30 min (a notional "booking time"
  // — this is just so 'pending' has a non-zero duration before 'arrived').
  let cursor = apptStart.minus({ minutes: 30 });
  stamped.push({ ottStatus: 'pending', start: cursor });

  // 'arrived' baseline: anchored to appointment.start, with patient possibly
  // a few minutes early or late.
  for (let i = VISIT_STATUS_ORDER.indexOf('arrived'); i <= targetIdx; i++) {
    const ottStatus = VISIT_STATUS_ORDER[i];
    if (ottStatus === 'arrived') {
      cursor = apptStart.plus({ minutes: sampleGap('arrived') });
    } else {
      cursor = cursor.plus({ minutes: sampleGap(ottStatus) });
    }
    stamped.push({ ottStatus, start: cursor });
  }

  // Build the new statusHistory entries. Each entry's period.end is the next
  // entry's period.start; the final entry has no period.end (it's the
  // currently-open status from the EHR's POV).
  const newStatusHistory: typeof existing = stamped.map((s2, idx) => {
    const next = stamped[idx + 1];
    const original = byOttStatus.get(s2.ottStatus);
    if (!original) {
      // Defensive: the walk should have produced an entry for every reached
      // status, but if not, fall back to a synthesized entry. The FHIR
      // encounter status code in this case is a best-effort approximation.
      return {
        status: 'in-progress',
        period: {
          start: s2.start.toUTC().toISO()!,
          ...(next ? { end: next.start.toUTC().toISO()! } : {}),
        },
        extension: [{ url: OTT_EXT_URL, valueCode: s2.ottStatus }],
      };
    }
    return {
      ...original,
      period: {
        start: s2.start.toUTC().toISO()!,
        ...(next ? { end: next.start.toUTC().toISO()! } : {}),
      },
    };
  });

  await ctx.oystehr.fhir.patch<import('fhir/r4b').Encounter>({
    resourceType: 'Encounter',
    id: ctx.encounterId,
    operations: [{ op: 'replace', path: '/statusHistory', value: newStatusHistory }],
  });

  const totalLOSMin =
    stamped.length > 1 ? Math.round(stamped[stamped.length - 1].start.diff(stamped[1].start, 'minutes').minutes) : 0;
  logNote(
    `statusHistory rewritten: ${stamped.length} entries spanning ${stamped[0].start.toISO()} → ${stamped[
      stamped.length - 1
    ].start.toISO()} (in-room LOS ≈ ${totalLOSMin} min)`
  );
}

// ── Phase 14 — sign-off ──────────────────────────────────────────────────────

async function phase14_signOff(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  if (s.signOff?.complete === false) return;

  // Sign-off is the final step of the lifecycle — only run when the scenario
  // wants the visit fully signed (the default). Skipping leaves the visit
  // unlocked (no APPOINTMENT_LOCKED tag) so it can still be edited from the
  // EHR, which is what targetStatus < 'completed' implies.
  const target = s.visit.targetStatus ?? 'completed';
  if (target !== 'completed') {
    startPhase(`Sign-off (skipped — targetStatus=${target}, visit remains unlocked)`);
    return;
  }

  startPhase('Sign-off');
  const body = {
    appointmentId: ctx.appointmentId,
    encounterId: ctx.encounterId,
    ...(s.signOff?.timezone ? { timezone: s.signOff.timezone } : {}),
    ...(s.signOff?.supervisorApproval !== undefined ? { supervisorApprovalEnabled: s.signOff.supervisorApproval } : {}),
  };
  logCall('sign-appointment', body);

  if (ctx.mode === 'execute' && ctx.oystehr) {
    // sign-appointment has the OTR-2428 fix locally; cloud not yet — route local.
    const res = await fetch(`${ctx.zambdaApi}/zambda/sign-appointment/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.accessToken}`,
        'x-zapehr-project-id': ctx.projectId ?? '',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`sign-appointment failed: ${res.status}\n${await res.text()}`);
    }
    logNote('appointment signed — visit-note PDF subscription triggered');
  } else {
    logNote('triggers visit-note PDF subscription → DocumentReference in visit-notes Z3 bucket');
  }
}

// ── Phase 15 — backdate the whole visit to its historical date ───────────────
//
// The pipeline always books at a near-future slot because create-slot /
// create-appointment reject past times, and Phase 13.5 builds realistic LOS
// spacing anchored to that (future) appointment.start. This phase translates
// the ENTIRE finished visit back to scenario.visit.date+time by a single
// constant delta, so every internal gap (statusHistory LOS, period span) is
// preserved exactly — only the absolute position moves.
//
// Critical because the ad-hoc Encounters report (and the EHR generally) buckets
// visits by Appointment.start (the FHIR `date` search param). Without this, a
// visit authored "for 2025-09" would land on today's date and never show up in
// a historical date-range report.
//
// Shifted: Appointment.start/.end, Slot.start/.end, Encounter.period.start/.end,
// and every Encounter.statusHistory[].period.start/.end. Per-resource clinical
// timestamps (Observation.effectiveDateTime, Condition.recordedDate, etc.) are
// NOT shifted — the report keys off Appointment/Encounter dates, and those
// in-visit details render against the encounter regardless of their own stamp.
async function phase15_backdateVisitToHistory(ctx: SynthesisContext): Promise<void> {
  const target = intendedHistoricalStart(ctx.scenario);
  if (!target) return; // future/today visit — slot time is already correct
  if (ctx.mode !== 'execute' || !ctx.oystehr) {
    startPhase('Backdate visit to historical date');
    logNote(`would shift Appointment/Slot/Encounter back to ${target.toISO()}`);
    return;
  }
  if (!ctx.appointmentId || !ctx.encounterId) return;

  startPhase('Backdate visit to historical date');

  const [appointment, encounter] = await Promise.all([
    ctx.oystehr.fhir.get<import('fhir/r4b').Appointment>({ resourceType: 'Appointment', id: ctx.appointmentId }),
    ctx.oystehr.fhir.get<import('fhir/r4b').Encounter>({ resourceType: 'Encounter', id: ctx.encounterId }),
  ]);

  if (!appointment.start) {
    logNote('appointment.start missing — cannot compute backdate delta; skipping');
    return;
  }
  const currentStart = DateTime.fromISO(appointment.start);
  const deltaMs = target.toMillis() - currentStart.toMillis();
  if (deltaMs >= 0) {
    logNote('current appointment.start is already at/after target — nothing to backdate');
    return;
  }
  const shift = (iso?: string): string | undefined =>
    iso ? DateTime.fromISO(iso).plus({ milliseconds: deltaMs }).toUTC().toISO()! : undefined;

  // Appointment.start/.end
  const apptOps: Array<{ op: 'replace'; path: string; value: string }> = [];
  const newApptStart = shift(appointment.start);
  if (newApptStart) apptOps.push({ op: 'replace', path: '/start', value: newApptStart });
  const newApptEnd = shift(appointment.end);
  if (newApptEnd) apptOps.push({ op: 'replace', path: '/end', value: newApptEnd });
  if (apptOps.length) {
    await ctx.oystehr.fhir.patch({ resourceType: 'Appointment', id: ctx.appointmentId, operations: apptOps });
  }

  // Slot.start/.end (appointment references it; keep them consistent)
  if (ctx.slotId) {
    try {
      const slot = await ctx.oystehr.fhir.get<import('fhir/r4b').Slot>({ resourceType: 'Slot', id: ctx.slotId });
      const slotOps: Array<{ op: 'replace'; path: string; value: string }> = [];
      const ns = shift(slot.start);
      const ne = shift(slot.end);
      if (ns) slotOps.push({ op: 'replace', path: '/start', value: ns });
      if (ne) slotOps.push({ op: 'replace', path: '/end', value: ne });
      if (slotOps.length) {
        await ctx.oystehr.fhir.patch({ resourceType: 'Slot', id: ctx.slotId, operations: slotOps });
      }
    } catch (err) {
      logNote(`slot backdate skipped: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Encounter.period + every statusHistory entry's period, shifted by the same delta.
  const encOps: Array<{ op: 'replace'; path: string; value: unknown }> = [];
  if (encounter.period) {
    encOps.push({
      op: 'replace',
      path: '/period',
      value: {
        ...encounter.period,
        ...(encounter.period.start ? { start: shift(encounter.period.start) } : {}),
        ...(encounter.period.end ? { end: shift(encounter.period.end) } : {}),
      },
    });
  }
  if (encounter.statusHistory?.length) {
    const newHistory = encounter.statusHistory.map((entry) => ({
      ...entry,
      period: {
        ...entry.period,
        ...(entry.period?.start ? { start: shift(entry.period.start) } : {}),
        ...(entry.period?.end ? { end: shift(entry.period.end) } : {}),
      },
    }));
    encOps.push({ op: 'replace', path: '/statusHistory', value: newHistory });
  }
  if (encOps.length) {
    await ctx.oystehr.fhir.patch({ resourceType: 'Encounter', id: ctx.encounterId, operations: encOps });
  }

  logNote(
    `visit shifted by ${Math.round(deltaMs / 86_400_000)} days → ` +
      `Appointment.start now ${newApptStart} (target ${target.toISODate()})`
  );
}

// ── Failed-run cleanup ───────────────────────────────────────────────────────

/**
 * On uncaught script error, delete the visit-level resources Phase 1 just
 * created — Appointment, Encounter, QuestionnaireResponse, and any Tasks
 * tied to the QR (the harvest opens these per-page). Patient/Account/
 * Coverage/RelatedPerson are left in place: they persist across visits
 * and the synth Patient dedup will reuse them on the next run.
 *
 * Best-effort — failures here are logged but never re-thrown, so the
 * original pipeline error remains the visible one.
 */
async function cleanupFailedRun(ctx: SynthesisContext): Promise<void> {
  // NOTE: do NOT bail when appointmentId is unset — the most common early
  // failure is create-appointment itself (Phase 1), which leaves the Phase 0.5
  // scaffold Slot orphaned. Orphan future slots pile up at the same scaffold
  // time across retries and eventually make create-appointment reject new
  // bookings, so we must clean the Slot even when no Appointment was created.
  if (!ctx.oystehr) return;

  const tryDelete = async (resourceType: string, id: string): Promise<void> => {
    try {
      await ctx.oystehr!.fhir.delete({ resourceType: resourceType as 'Appointment', id });
      console.log(`  • deleted ${resourceType}/${id}`);
    } catch (err) {
      console.warn(`  ⚠ could not delete ${resourceType}/${id}: ${err instanceof Error ? err.message : err}`);
    }
  };

  // Tasks tied to the QR (harvest-paperwork tasks created per page).
  if (ctx.questionnaireResponseId) {
    try {
      const tasks = (
        await ctx.oystehr.fhir.search({
          resourceType: 'Task',
          params: [{ name: 'focus', value: `QuestionnaireResponse/${ctx.questionnaireResponseId}` }],
        })
      ).unbundle() as Array<{ id?: string }>;
      for (const t of tasks) {
        if (t.id) await tryDelete('Task', t.id);
      }
    } catch (err) {
      console.warn(`  ⚠ Task search failed: ${err instanceof Error ? err.message : err}`);
    }
    await tryDelete('QuestionnaireResponse', ctx.questionnaireResponseId);
  }
  if (ctx.encounterId) {
    await tryDelete('Encounter', ctx.encounterId);
  }
  if (ctx.appointmentId) {
    await tryDelete('Appointment', ctx.appointmentId);
  }
  // Always remove the scaffold Slot — it's orphaned whenever the run fails
  // before Phase 15 backdates it (incl. the create-appointment failure case).
  if (ctx.slotId) {
    await tryDelete('Slot', ctx.slotId);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`Mode: ${isExecute ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`Scenario file: ${scenarioPath}`);
  console.log(`Schema validation: passed`);

  const ctx: SynthesisContext = {
    mode: isExecute ? 'execute' : 'plan',
    oystehr: null,
    accessToken: null,
    projectId: null,
    projectApi: null,
    zambdaApi: null,
    scenario,
    scenarioPath,
    practitionerOverride,
    locationOverride,
    intakeOverride,
  };

  if (isExecute) {
    console.log('Authenticating with Oystehr IAM...');
    const created = await createOystehr();
    ctx.oystehr = created.oystehr;
    ctx.accessToken = created.accessToken;
    ctx.projectId = created.projectId;
    ctx.projectApi = created.projectApi;
    ctx.zambdaApi = created.zambdaApi;
    console.log(`Authenticated. zambda calls -> ${ctx.zambdaApi}`);
  }

  const patientLabel = scenario.label ?? `${scenario.patient.firstName} ${scenario.patient.lastName}`;
  console.log('');
  console.log(`Synthesis plan: ${patientLabel}`);
  console.log(`Visit type: ${scenario.visit.type} on ${scenario.visit.date}`);
  if (scenario.template) {
    console.log(`Template: ${scenario.template.name} (${scenario.template.examType ?? 'derived from visit.type'})`);
  }

  const phases: Array<(ctx: SynthesisContext) => Promise<void>> = [
    phase0_lookups,
    phase0_5_createSlot,
    phase1_createAppointment,
    phase1_5_intakePaperwork,
    phase1_7_assignAttending,
    phase2_z3Uploads,
    phase3_chartDataPass1,
    phase4_applyTemplate,
    phase5_chartDataPass2,
    phase5_5_providerChartFindings,
    phase6_inHouseLabs,
    phase7_inHouseMedications,
    phase8_immunizations,
    phase9_radiology,
    phase10_eligibilityAndPricing,
    phase11_appointmentNotes,
    phase12_patientEducation,
    phase13_statusWalk,
    phase13_5_backdateStatusHistory,
    phase14_signOff,
    phase15_backdateVisitToHistory,
  ];

  // Track whether the visit signed off cleanly. If not (uncaught error in
  // any phase), the per-visit resources created in Phase 1 (Appointment,
  // Encounter, QuestionnaireResponse, plus the Tasks the harvest opens)
  // are orphaned: status='booked' on the Appointment maps to 'pending' →
  // appears in the EHR's pre-booked tab as if it were an upcoming visit.
  // Clean them up so the dashboard stays uncluttered. Patient/Account/
  // Coverage are intentionally NOT touched — they persist across visits
  // and the synth dedup will reuse them on the next run.
  let signedSuccessfully = false;
  try {
    for (const fn of phases) {
      await fn(ctx);
    }
    signedSuccessfully = true;
  } catch (err) {
    console.log('');
    console.error(`Pipeline aborted: ${err instanceof Error ? err.message : err}`);
    if (isExecute && ctx.appointmentId && ctx.oystehr) {
      console.log('');
      console.log('── Cleanup: deleting orphan visit resources from this run ───────────────');
      await cleanupFailedRun(ctx);
    }
    throw err;
  } finally {
    void signedSuccessfully;
  }

  console.log('');
  console.log(`-- end of plan (${phaseCounter} phases) --`);
  if (isExecute) {
    console.log('');
    console.log('Mode summary: --execute ran the synthesis pipeline through sign-off.');
    console.log('Z3 fixture uploads (ID/insurance cards) happen inside Phase 1.5; the');
    console.log('Phase 2 stub is a narrative log only. Plan-only phases (no FHIR writes):');
    console.log('Phase 11 (appointment notes), Phase 12 (patient education).');
    console.log('');
    console.log('Resolved IDs:');
    if (ctx.locationId) console.log(`  Location:                ${ctx.locationId}`);
    if (ctx.scheduleId) console.log(`  Schedule:                ${ctx.scheduleId}`);
    if (ctx.attendingPractitionerId) console.log(`  Attending Practitioner:  ${ctx.attendingPractitionerId}`);
    if (ctx.intakeStaffId) console.log(`  Intake-staff Practitioner: ${ctx.intakeStaffId}`);
    if (ctx.payerOrganizationId) console.log(`  Payer Organization:      ${ctx.payerOrganizationId}`);
    if (ctx.vaccineMedicationsByName) {
      for (const [name, id] of Object.entries(ctx.vaccineMedicationsByName)) {
        console.log(`  Vaccine "${name}": ${id}`);
      }
    }
    console.log('');
    console.log('Created (Phase 0.5 + Phase 1):');
    if (ctx.slotId) console.log(`  Slot:                    ${ctx.slotId}`);
    if (ctx.patientId) console.log(`  Patient:                 ${ctx.patientId}`);
    if (ctx.appointmentId) console.log(`  Appointment:             ${ctx.appointmentId}`);
    if (ctx.encounterId) console.log(`  Encounter:               ${ctx.encounterId}`);
    if (ctx.questionnaireResponseId) console.log(`  QuestionnaireResponse:   ${ctx.questionnaireResponseId}`);
  }
}

main().catch((err) => {
  console.error('');
  console.error('Fatal error:', err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) {
    console.error(err.stack.split('\n').slice(1, 4).join('\n'));
  }
  process.exit(1);
});
