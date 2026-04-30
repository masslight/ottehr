/**
 * synthesize-visit.ts — Stage 2 of the synthetic-patient-data pipeline.
 *
 * Reads a VisitScenario JSON, validates it against the Zod schema, and walks
 * through the synthesis plan documented in VISIT_ANATOMY_ZAMBDAS.md (§9).
 *
 * Currently a SKELETON: --dry-run mode is implemented; --execute is stubbed
 * out. The dry-run prints the sequence of zambda calls that would fire, in
 * the order they should fire, with the inputs each call would receive.
 *
 * Usage:
 *   npx tsx scripts/synthetic-patient-data/synthesize-visit.ts <scenario.json> [--execute]
 *
 * Defaults to dry-run. Use --execute (when implemented) to actually synthesize.
 *
 * Env (required when --execute is implemented):
 *   AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE,
 *   PROJECT_ID, PROJECT_API
 *
 * Recommended:
 *   npx env-cmd -f packages/zambdas/.env/<env>.json \
 *     npx tsx scripts/synthetic-patient-data/synthesize-visit.ts \
 *     scripts/synthetic-patient-data/examples/jane-doe-urgent-care.json
 */
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

// ── Load + validate ───────────────────────────────────────────────────────────

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

// ── Plan emitter ──────────────────────────────────────────────────────────────

let phaseCounter = 0;
function phase(title: string): void {
  console.log('');
  console.log(`── Phase ${phaseCounter}: ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
  phaseCounter += 1;
}

function call(zambdaId: string, body: Record<string, unknown>): void {
  console.log(`  zambda.execute('${zambdaId}')`);
  for (const [k, v] of Object.entries(body)) {
    const rendered = typeof v === 'object' ? JSON.stringify(v) : String(v);
    const truncated = rendered.length > 80 ? rendered.slice(0, 77) + '...' : rendered;
    console.log(`    ${k}: ${truncated}`);
  }
}

function note(text: string): void {
  console.log(`  • ${text}`);
}

function fhirOp(op: string, detail: string): void {
  console.log(`  fhir.${op} — ${detail}`);
}

// ── Plan ──────────────────────────────────────────────────────────────────────

function planSynthesis(s: VisitScenario): void {
  const patientLabel = s.label ?? `${s.patient.firstName} ${s.patient.lastName}`;
  console.log(`Synthesis plan: ${patientLabel}`);
  console.log(`Visit type: ${s.visit.type} on ${s.visit.date}`);
  if (s.template) console.log(`Template: ${s.template.name} (${s.template.examType ?? 'derived from visit.type'})`);

  // Phase 0 — prerequisite lookups
  phase('Prerequisite lookups (FHIR searches)');
  fhirOp('search', `Location with name="${s.visit.locationName}"`);
  fhirOp('search', `Schedule for resolved Location`);
  if (s.signOff?.practitionerName) {
    fhirOp('search', `Practitioner with name="${s.signOff.practitionerName}" (attending)`);
  } else {
    fhirOp('search', `Practitioner — auto-pick attending`);
  }
  fhirOp('search', `Practitioner — intake staff`);
  if (s.patient.insurance?.primary) {
    fhirOp('search', `Organization with name="${s.patient.insurance.primary.carrier}" (payer)`);
  }
  if (s.template) {
    call('list-templates', {
      examType: s.template.examType ?? (s.visit.type === 'in-person' ? 'inPerson' : 'telemed'),
    });
    note(`verify template "${s.template.name}" appears in the list`);
  }
  if (s.modules?.immunizations?.length) {
    fhirOp('search', `Medication catalog for vaccine names`);
  }

  // Phase 1 — create-appointment
  phase('Create appointment');
  call('create-appointment', {
    patient: {
      firstName: s.patient.firstName,
      lastName: s.patient.lastName,
      dateOfBirth: s.patient.dateOfBirth,
      sex: s.patient.sex,
      email: s.patient.email,
      phoneNumber: s.patient.phoneNumber,
      reasonForVisit: s.visit.reasonForVisit,
      address: s.patient.address,
    },
    visitType: 'walkin',
    serviceMode: s.visit.type,
    serviceCategory: 'urgent-care',
    locationID: '<resolved in Phase 0>',
  });
  note('returns: { patientId, appointmentId, encounterId, questionnaireResponseId }');

  // Phase 2 — Z3 uploads
  if (s.patient.fixtures && Object.values(s.patient.fixtures).some(Boolean)) {
    phase('Z3 fixture uploads');
    for (const [key, path] of Object.entries(s.patient.fixtures)) {
      if (!path) continue;
      note(
        `z3.uploadFile { bucket: "<projectId>-patient-files", key: "<patientId>/${key}", file: <Blob from ${path}> }`
      );
      fhirOp('create', `DocumentReference referencing the Z3 object (${key})`);
    }
  }

  // Phase 3a — save-chart-data: non-templated patient-specific data
  phase('save-chart-data Pass 1 (non-templated patient data)');
  const pass1: Record<string, unknown> = { encounterId: '<from Phase 1>' };
  if (s.history?.allergies?.length) pass1.allergies = `[${s.history.allergies.length} entries]`;
  if (s.history?.medications?.length) pass1.medications = `[${s.history.medications.length} entries]`;
  if (s.history?.conditions?.length) pass1.conditions = `[${s.history.conditions.length} entries]`;
  if (s.history?.surgicalHistory?.length) pass1.surgicalHistory = `[${s.history.surgicalHistory.length} entries]`;
  if (s.history?.surgicalHistoryNote) pass1.surgicalHistoryNote = s.history.surgicalHistoryNote;
  if (s.history?.hospitalizations?.length) pass1.episodeOfCare = `[${s.history.hospitalizations.length} entries]`;
  if (s.history?.birthHistory?.length) pass1.birthHistory = `[${s.history.birthHistory.length} entries]`;
  if (s.history?.accident) pass1.accident = '<accident>';
  if (s.history?.screening?.length) pass1.observations = `[${s.history.screening.length} entries]`;
  if (s.history?.screenNotes?.length) pass1.notes = `[${s.history.screenNotes.length} entries]`;
  if (s.vitals && Object.keys(s.vitals).length) pass1.vitalsObservations = `[${Object.keys(s.vitals).length} vitals]`;
  pass1.reasonForVisit = s.visit.reasonForVisit;
  if (s.signOff?.patientInfoConfirmed) pass1.patientInfoConfirmed = { value: true };
  call('save-chart-data', pass1);

  // Phase 3b — apply-template
  if (s.template) {
    phase('Apply template');
    call('apply-template', {
      encounterId: '<from Phase 1>',
      templateName: s.template.name,
      examType: s.template.examType ?? (s.visit.type === 'in-person' ? 'inPerson' : 'telemed'),
    });
    note('returns: { conditionIds[], cptProcedureIds[], ... } — capture for cross-references in Pass 2');
  }

  // Phase 3c — save-chart-data Pass 2: procedures + disposition (cross-reference template ids)
  if (s.modules?.procedures?.length || s.disposition) {
    phase('save-chart-data Pass 2 (cross-references template-created resources)');
    const pass2: Record<string, unknown> = { encounterId: '<from Phase 1>' };
    if (s.modules?.procedures?.length) pass2.procedures = `[${s.modules.procedures.length} entries with cross-refs]`;
    if (s.disposition) pass2.disposition = '<disposition + followUp>';
    call('save-chart-data', pass2);
  }

  // Phase 4 — module orders
  if (s.modules?.inHouseLabs?.length) {
    phase('In-house lab orders');
    for (const lab of s.modules.inHouseLabs) {
      call('get-create-in-house-lab-order-resources', { encounterId: '<from Phase 1>' });
      note(`resolve test "${lab.testName}" → ActivityDefinition id`);
      call('create-in-house-lab-order', {
        encounterId: '<from Phase 1>',
        selectedTests: ['<resolved>'],
        notes: lab.notes ?? '',
      });
      if (lab.results) {
        call('collect-in-house-lab-specimen', { serviceRequestId: '<from prior>' });
        call('handle-in-house-lab-results', {
          serviceRequestId: '<from prior>',
          results: lab.results,
          status: 'final',
        });
      }
    }
  }

  if (s.modules?.inHouseMedications?.length) {
    phase('In-house medication orders');
    for (const med of s.modules.inHouseMedications) {
      call('create-update-medication-order', {
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

  if (s.modules?.immunizations?.length) {
    phase('Immunization orders');
    for (const imm of s.modules.immunizations) {
      call('immunization/create-update-order', {
        details: {
          encounterId: '<from Phase 1>',
          medication: { id: `<resolved from "${imm.vaccineName}">`, name: imm.vaccineName },
          dose: imm.dose,
          units: imm.units,
          route: imm.route,
          location: imm.location,
        },
      });
      if (imm.administered) {
        call('immunization/administer-order', {
          orderId: '<from prior>',
          administrationDetails: { dose: { value: parseFloat(imm.dose), unit: imm.units } },
        });
      }
    }
  }

  if (s.modules?.radiology?.length) {
    phase('Radiology orders');
    for (const rad of s.modules.radiology) {
      call('radiology/create-order', {
        encounterId: '<from Phase 1>',
        cptCode: rad.cptCode,
        diagnosisCode: rad.diagnosisCode,
        stat: rad.stat,
        clinicalHistory: rad.clinicalHistory,
        consentObtained: rad.consentObtained,
        studyName: rad.studyName,
        lateralityModifier: rad.lateralityModifier,
      });
      if (rad.preliminaryReport) {
        call('radiology/save-preliminary-report', {
          serviceRequestId: '<from prior>',
          conclusion: rad.preliminaryReport,
        });
      }
    }
  }

  // Phase 5 — eligibility / pricing polish (writes that should land before sign-off)
  if (s.eligibility || s.pricing) {
    phase('Eligibility & pricing polish');
    if (s.pricing?.cptPrices?.length) {
      for (const price of s.pricing.cptPrices) {
        call('cm-add-procedure-code', { code: price.cpt, chargedAmount: price.chargedAmount });
        call('add-procedure-code', { code: price.cpt, allowedAmount: price.allowedAmount });
      }
    }
    if (s.eligibility) {
      fhirOp(
        'create',
        `CoverageEligibilityResponse with Candid raw-request/raw-response extensions for ${
          s.eligibility.cptScenarios?.length ?? 0
        } CPT scenarios`
      );
    }
  }

  // Phase 6 — appointment notes / patient education
  if (s.notes?.appointmentNotes?.length) {
    phase('Appointment notes (Communications)');
    for (const note_ of s.notes.appointmentNotes) {
      fhirOp('create', `Communication on appointment with text="${note_.text.slice(0, 50)}..."`);
    }
  }
  if (s.notes?.patientEducationDocs?.length) {
    phase('Patient education materials');
    for (const ed of s.notes.patientEducationDocs) {
      call('patient-education-create', { topic: ed.topic, title: ed.title, url: ed.url });
    }
  }

  // Phase 7 — visit-status walk + practitioner assignment
  if (s.signOff?.complete !== false) {
    phase('Visit-status walk + practitioner assignment');
    note('change-in-person-visit-status: arrived → ready');
    note('assign-practitioner (intake staff, ADM)');
    note('change-in-person-visit-status: ready → intake → ready for provider');
    note('assign-practitioner (attending provider, ATND)');
    note('change-in-person-visit-status: ready for provider → provider → discharged → completed');
  }

  // Phase 8 — sign-off
  if (s.signOff?.complete !== false) {
    phase('Sign-off');
    call('sign-appointment', {
      appointmentId: '<from Phase 1>',
      encounterId: '<from Phase 1>',
      timezone: s.signOff?.timezone,
      supervisorApprovalEnabled: s.signOff?.supervisorApproval,
    });
    note('triggers visit-note PDF subscription → DocumentReference in visit-notes Z3 bucket');
  }

  console.log('');
  console.log(`-- end of plan (${phaseCounter} phases) --`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`Mode: ${isExecute ? 'EXECUTE (NOT IMPLEMENTED)' : 'DRY RUN'}`);
console.log(`Scenario file: ${scenarioPath}`);
console.log(`Schema validation: passed`);
console.log('');

planSynthesis(scenario);

if (isExecute) {
  console.log('');
  console.error('--execute mode is not yet implemented. Implementation plan is in VISIT_ANATOMY_ZAMBDAS.md §9.');
  process.exit(2);
}
