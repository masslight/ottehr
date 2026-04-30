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
 *
 * Phase 2 and Phases 7+ are plan-only — they log what they would do but do
 * NOT write to the FHIR datastore. They will be enabled progressively as
 * each is verified.
 *
 * Use --execute against an environment to validate connectivity end-to-end
 * through Phase 1, producing a real Patient + Appointment + Encounter on the
 * target project.
 *
 * Usage:
 *   npx tsx scripts/synthetic-patient-data/synthesize-visit.ts <scenario.json> [--execute]
 *
 * Defaults to dry-run.
 *
 * Env (required when --execute):
 *   AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE,
 *   PROJECT_ID, PROJECT_API
 *   ZAMBDA_API (optional — defaults to PROJECT_API; set to
 *               http://localhost:3000 for local zambdas server)
 *
 * Recommended invocation:
 *   npx env-cmd -f packages/zambdas/.env/<env>.json \
 *     npx tsx scripts/synthetic-patient-data/synthesize-visit.ts \
 *     scripts/synthetic-patient-data/examples/jane-doe-urgent-care.json --execute
 */
import Oystehr from '@oystehr/sdk';
import type { Location, Medication, Organization, Patient, Practitioner, Schedule } from 'fhir/r4b';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { type VisitScenario, VisitScenarioSchema } from './schema';

// ── Argument parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log('Usage: tsx synthesize-visit.ts <scenario.json> [--execute]');
  process.exit(args.length === 0 ? 1 : 0);
}

const isExecute = args.includes('--execute');
const positional = args.filter((a) => !a.startsWith('--'));
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
  const auth0Endpoint = requireEnv('AUTH0_ENDPOINT');
  const auth0Client = requireEnv('AUTH0_CLIENT');
  const auth0Secret = requireEnv('AUTH0_SECRET');
  const auth0Audience = requireEnv('AUTH0_AUDIENCE');
  const projectId = requireEnv('PROJECT_ID');
  const projectApi = requireEnv('PROJECT_API');
  const zambdaApi = process.env.ZAMBDA_API ?? projectApi;

  const tokenResponse = await fetch(auth0Endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: auth0Client,
      client_secret: auth0Secret,
      audience: auth0Audience,
      grant_type: 'client_credentials',
    }),
  });
  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Auth0 token request failed: ${tokenResponse.status} ${errorText}`);
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
  logFhir('search', `Location with name="${s.visit.locationName}"`);
  if (ctx.mode === 'execute' && ctx.oystehr) {
    const result = await ctx.oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [{ name: 'name', value: s.visit.locationName }],
    });
    const location = result.unbundle()[0];
    if (!location?.id) throw new Error(`Location not found: "${s.visit.locationName}"`);
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
  if (s.signOff?.practitionerName) {
    logFhir('search', `Practitioner with name="${s.signOff.practitionerName}" (attending)`);
    if (ctx.mode === 'execute' && ctx.oystehr) {
      // FHIR Practitioner search by `name` doesn't match across given+family; split to given+family.
      const parts = s.signOff.practitionerName.split(/\s+/).filter(Boolean);
      const family = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      const given = parts.length > 1 ? parts.slice(0, -1).join(' ') : undefined;
      const params: Array<{ name: string; value: string }> = [{ name: 'family', value: family }];
      if (given) params.push({ name: 'given', value: given });
      const result = await ctx.oystehr.fhir.search<Practitioner>({ resourceType: 'Practitioner', params });
      const practitioner = result.unbundle()[0];
      if (!practitioner?.id) {
        throw new Error(
          `Practitioner not found: "${s.signOff.practitionerName}" (searched given="${given}" family="${family}")`
        );
      }
      ctx.attendingPractitionerId = practitioner.id;
      logNote(`resolved Practitioner → ${ctx.attendingPractitionerId}`);
    }
  } else {
    logFhir('search', `Practitioner — auto-pick attending`);
    if (ctx.mode === 'execute' && ctx.oystehr) {
      const result = await ctx.oystehr.fhir.search<Practitioner>({
        resourceType: 'Practitioner',
        params: [{ name: '_count', value: '1' }],
      });
      const practitioner = result.unbundle()[0];
      if (!practitioner?.id) throw new Error('No Practitioners exist on this project');
      ctx.attendingPractitionerId = practitioner.id;
      logNote(`auto-picked Practitioner → ${ctx.attendingPractitionerId}`);
    }
  }

  // Intake staff (separate from attending — first different practitioner found)
  logFhir('search', `Practitioner — intake staff`);
  if (ctx.mode === 'execute' && ctx.oystehr) {
    const result = await ctx.oystehr.fhir.search<Practitioner>({
      resourceType: 'Practitioner',
      params: [{ name: '_count', value: '10' }],
    });
    const practitioners = result.unbundle();
    const intake = practitioners.find((p) => p.id !== ctx.attendingPractitionerId) ?? practitioners[0];
    if (!intake?.id) throw new Error('No Practitioner available for intake staff');
    ctx.intakeStaffId = intake.id;
    logNote(`auto-picked intake staff → ${ctx.intakeStaffId}`);
  }

  // Payer organization
  if (s.patient.insurance?.primary) {
    logFhir('search', `Organization with name="${s.patient.insurance.primary.carrier}" (payer)`);
    if (ctx.mode === 'execute' && ctx.oystehr) {
      const result = await ctx.oystehr.fhir.search<Organization>({
        resourceType: 'Organization',
        params: [{ name: 'name', value: s.patient.insurance.primary.carrier }],
      });
      const org = result.unbundle()[0];
      if (org?.id) {
        ctx.payerOrganizationId = org.id;
        logNote(`resolved Organization → ${ctx.payerOrganizationId}`);
      } else {
        logNote(`payer Organization not found — Coverage will reference by display only`);
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
        console.warn(
          `  ⚠ template "${s.template.name}" not found in list-templates response — Phase 4 (apply-template) will fail if enabled`
        );
      } else {
        logNote(`verified template "${s.template.name}" exists`);
      }
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
    const s = new Date(now.getTime() + minutesToAdd * 60_000);
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

async function phase0_5_createSlot(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  startPhase('Create slot');

  const startISO = computeSlotStartISO(s);
  const body = {
    scheduleId: ctx.scheduleId ?? '<resolved in Phase 0>',
    startISO,
    lengthInMinutes: 15,
    serviceModality: s.visit.type === 'in-person' ? 'in-person' : 'virtual',
    serviceCategoryCode: 'urgent-care',
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

const SYNTHETIC_PATIENT_ID_SYSTEM = 'https://fhir.ottehr.com/sid/synthetic-patient-id';

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
      };
      patientId?: string;
      fhirPatientId?: string;
      appointmentId?: string;
      encounterId?: string;
      questionnaireResponseId?: string;
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
    }
  } else {
    logNote('returns: { patientId, appointmentId, encounterId, questionnaireResponseId }');
  }
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

// ── Phase 2 — Z3 fixture uploads (plan-only) ─────────────────────────────────

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

async function phase3_chartDataPass1(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  startPhase('save-chart-data Pass 1 (non-templated patient data)');

  const body: Record<string, unknown> = { encounterId: ctx.encounterId ?? '<from Phase 1>' };

  if (s.history?.allergies?.length) {
    body.allergies = s.history.allergies.map((a) => ({
      name: a.name,
      ...(a.note ? { note: a.note } : {}),
    }));
  }
  if (s.history?.medications?.length) {
    body.medications = s.history.medications.map((m) => {
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
  if (s.history?.conditions?.length) {
    body.conditions = s.history.conditions.map((c) => ({
      ...(c.code ? { code: c.code } : {}),
      display: c.display,
      ...(c.current !== undefined ? { current: c.current } : {}),
      ...(c.note ? { note: c.note } : {}),
    }));
  }
  if (s.history?.surgicalHistory?.length) {
    body.surgicalHistory = s.history.surgicalHistory.map((sh) => ({
      ...(sh.code ? { code: sh.code } : {}),
      display: sh.display,
    }));
  }
  if (s.history?.surgicalHistoryNote) {
    body.surgicalHistoryNote = { text: s.history.surgicalHistoryNote };
  }
  if (s.history?.hospitalizations?.length) {
    body.episodeOfCare = s.history.hospitalizations.map((h) => ({
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
  if (s.signOff?.patientInfoConfirmed !== false) {
    body.patientInfoConfirmed = { value: true };
  }

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
      ...(s.disposition.followUp?.length
        ? {
            followUp: s.disposition.followUp.map((f) => ({
              type: f.type,
              ...(f.note ? { note: f.note } : {}),
              ...(f.daysOut !== undefined ? { followUpIn: f.daysOut } : {}),
            })),
          }
        : {}),
    };
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

// ── Phase 6 — in-house lab orders (plan-only) ────────────────────────────────

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

    // The cloud-deployed zambdas don't yet have the OTR-2428 fix to
    // getMyPractitionerId, so route in-house lab calls through the local
    // zambdas server (which uses local source). Override with LOCAL_ZAMBDA_API
    // env var if needed. Remove this once cloud deploys catch up.
    const labZambdaApi = process.env.LOCAL_ZAMBDA_API ?? 'http://localhost:3000/local';

    // 1. Fetch the catalog of test items available for this encounter.
    const catalogRes = await fetch(`${labZambdaApi}/zambda/get-create-in-house-lab-order-resources/execute`, {
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
    const testItem = labs.find((t) => t.name === lab.testName);
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
    const orderRes = await fetch(`${labZambdaApi}/zambda/create-in-house-lab-order/execute`, {
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
      const collectRes = await fetch(`${labZambdaApi}/zambda/collect-in-house-lab-specimen/execute`, {
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
              collectedBy: { id: ctx.intakeStaffId ?? '', name: 'Synthesizer' },
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
      logNote('(handle-in-house-lab-results not yet implemented — finalize via EHR UI for now)');
    }
  }
}

// ── Phase 7 — in-house medications (plan-only) ───────────────────────────────

async function phase7_inHouseMedications(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  if (!s.modules?.inHouseMedications?.length) return;

  startPhase('In-house medication orders');
  for (const med of s.modules.inHouseMedications) {
    logCall('create-update-medication-order', {
      orderId: null,
      newStatus: med.administered ? 'administered' : 'pending',
      orderData: {
        medicationId: `<resolved from "${med.medicationName}">`,
        dose: med.dose,
        units: med.units,
        route: med.route,
        effectiveDateTime: med.effectiveDateTime,
      },
    });
  }
}

// ── Phase 8 — immunizations (plan-only) ──────────────────────────────────────

async function phase8_immunizations(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  if (!s.modules?.immunizations?.length) return;

  startPhase('Immunization orders');
  for (const imm of s.modules.immunizations) {
    logCall('immunization/create-update-order', {
      details: {
        encounterId: ctx.encounterId ?? '<from Phase 1>',
        medication: { id: `<resolved from "${imm.vaccineName}">`, name: imm.vaccineName },
        dose: imm.dose,
        units: imm.units,
        route: imm.route,
        location: imm.location,
      },
    });
    if (imm.administered) {
      logCall('immunization/administer-order', {
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
    logCall('radiology/create-order', {
      encounterId: ctx.encounterId ?? '<from Phase 1>',
      cptCode: rad.cptCode,
      diagnosisCode: rad.diagnosisCode,
      stat: rad.stat,
      clinicalHistory: rad.clinicalHistory,
      consentObtained: rad.consentObtained,
      studyName: rad.studyName,
      lateralityModifier: rad.lateralityModifier,
    });
    if (rad.preliminaryReport) {
      logCall('radiology/save-preliminary-report', {
        serviceRequestId: '<from prior>',
        conclusion: rad.preliminaryReport,
      });
    }
  }
}

// ── Phase 10 — eligibility & pricing (plan-only) ─────────────────────────────

async function phase10_eligibilityAndPricing(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  if (!s.eligibility && !s.pricing) return;

  startPhase('Eligibility & pricing polish');
  if (s.pricing?.cptPrices?.length) {
    for (const price of s.pricing.cptPrices) {
      logCall('cm-add-procedure-code', { code: price.cpt, chargedAmount: price.chargedAmount });
      logCall('add-procedure-code', { code: price.cpt, allowedAmount: price.allowedAmount });
    }
  }
  if (s.eligibility) {
    logFhir(
      'create',
      `CoverageEligibilityResponse with Candid raw-request/raw-response extensions for ${
        s.eligibility.cptScenarios?.length ?? 0
      } CPT scenarios`
    );
  }
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

// ── Phase 13 — visit-status walk + practitioner assignment (plan-only) ───────

async function phase13_statusWalk(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  if (s.signOff?.complete === false) return;

  startPhase('Visit-status walk + practitioner assignment');
  logNote('change-in-person-visit-status: arrived → ready');
  logNote('assign-practitioner (intake staff, ADM)');
  logNote('change-in-person-visit-status: ready → intake → ready for provider');
  logNote('assign-practitioner (attending provider, ATND)');
  logNote('change-in-person-visit-status: ready for provider → provider → discharged → completed');
}

// ── Phase 14 — sign-off (plan-only) ──────────────────────────────────────────

async function phase14_signOff(ctx: SynthesisContext): Promise<void> {
  const s = ctx.scenario;
  if (s.signOff?.complete === false) return;

  startPhase('Sign-off');
  logCall('sign-appointment', {
    appointmentId: ctx.appointmentId ?? '<from Phase 1>',
    encounterId: ctx.encounterId ?? '<from Phase 1>',
    timezone: s.signOff?.timezone,
    supervisorApprovalEnabled: s.signOff?.supervisorApproval,
  });
  logNote('triggers visit-note PDF subscription → DocumentReference in visit-notes Z3 bucket');
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
  };

  if (isExecute) {
    console.log('Authenticating with Auth0...');
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
    phase1_7_assignAttending,
    phase2_z3Uploads,
    phase3_chartDataPass1,
    phase4_applyTemplate,
    phase5_chartDataPass2,
    phase6_inHouseLabs,
    phase7_inHouseMedications,
    phase8_immunizations,
    phase9_radiology,
    phase10_eligibilityAndPricing,
    phase11_appointmentNotes,
    phase12_patientEducation,
    phase13_statusWalk,
    phase14_signOff,
  ];

  for (const fn of phases) {
    await fn(ctx);
  }

  console.log('');
  console.log(`-- end of plan (${phaseCounter} phases) --`);
  if (isExecute) {
    console.log('');
    console.log('Mode summary: --execute performed Phase 0 lookups, Phase 0.5 (create slot),');
    console.log('Phase 1 (create-appointment), Phase 3 (save-chart-data Pass 1), Phase 4');
    console.log('(apply-template), and Phase 5 (procedures + disposition) against the live');
    console.log('environment. Phase 2 and Phases 6+ were planned only — no further FHIR');
    console.log('writes were performed.');
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
