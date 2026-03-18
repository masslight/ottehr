import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, FhirResource, MedicationAdministration, Patient, Resource } from 'fhir/r4b';
import * as fs from 'fs';
import * as path from 'path';
import { ChartDataRequestedFields } from 'utils';
import { getChartData } from '../ehr/get-chart-data';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TransferSummary {
  resourceType: string;
  id: string;
  fieldsUpdated: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPatientIdFromAppointment(appointment: Appointment): string | undefined {
  return appointment.participant
    .find((p) => p.actor?.reference?.startsWith('Patient/'))
    ?.actor?.reference?.split('/')[1];
}

async function getEncounterForAppointment(appointmentId: string, oystehr: Oystehr): Promise<Encounter> {
  const encounters = (
    await oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [{ name: 'appointment', value: `Appointment/${appointmentId}` }],
    })
  ).unbundle();

  if (encounters.length === 0 || !encounters[0].id) {
    throw new Error(`No encounter found for Appointment/${appointmentId}`);
  }
  return encounters[0];
}

/**
 * Conditional fields that are only fetched when explicitly requested.
 * These cover resource types NOT included in the default getChartData call:
 *   - ServiceRequest (disposition, procedures)
 *   - MedicationRequest (prescribedMedications)
 *   - ClinicalImpression (medicalDecision)
 *   - EpisodeOfCare (episodeOfCare)
 *   - Additional Observations (vitalsObservations, birthHistory)
 *   - Additional Conditions (chiefComplaint, HPI, MOI, ROS, accident)
 *   - Additional Communications (notes)
 *
 * The default getChartData call (no requestedFields) already fetches:
 *   - AllergyIntolerance, Condition (by patient), MedicationStatement,
 *     Procedure (by patient), Observation (by encounter), Communication
 *     (instructions), DocumentReference (schoolWorkNotes, AI chat)
 */
const CONDITIONAL_CHART_DATA_FIELDS: ChartDataRequestedFields = {
  // Condition by encounter
  // Condition by encounter (tags match what mapResourceToChartDataResponse checks)
  chiefComplaint: { _tag: 'chief-complaint' },
  historyOfPresentIllness: { _tag: 'history-of-present-illness' },
  mechanismOfInjury: { _tag: 'mechanism-of-injury' },
  ros: { _tag: 'ros' },
  accident: {},
  // Procedure by encounter
  surgicalHistoryNote: { _tag: 'surgical-history-note' },
  // MedicationStatement by patient
  // (defaults add _tag: 'current-medication' / 'in-house-medication' via defaultChartDataFieldsSearchParams)
  medications: {},
  inhouseMedications: {},
  // MedicationRequest by encounter
  prescribedMedications: {},
  // ServiceRequest by encounter
  disposition: {},
  procedures: {},
  // ClinicalImpression by encounter
  medicalDecision: { _tag: 'medical-decision' },
  // EpisodeOfCare by patient
  episodeOfCare: {},
  // Communication by patient
  notes: { _count: 10000 },
  // Observation by encounter / patient
  observations: {},
  vitalsObservations: { _search_by: 'encounter' },
  birthHistory: {},
  // Labs
  externalLabResults: {},
  inHouseLabResults: {},
  // Encounter extensions (no extra FHIR search, but included for completeness)
  reasonForVisit: {},
  patientInfoConfirmed: {},
  addendumNote: {},
};

// ─── Resource patching functions ──────────────────────────────────────────────

/**
 * Check if a resource references the given encounter.
 * Different resource types store the encounter reference in different fields:
 *   - encounter.reference  → Condition, AllergyIntolerance, Procedure, Observation,
 *                            Communication, ClinicalImpression, ServiceRequest
 *   - context.reference    → MedicationStatement
 *   - context.encounter[]  → DocumentReference
 *   - encounter.reference  → MedicationRequest, Task
 *
 * Resources without any encounter reference (e.g. EpisodeOfCare) will NOT pass
 * this filter — they are patient-level and cannot be reliably attributed to a
 * specific visit.
 */
function resourceReferencesEncounter(resource: Resource, encounterId: string): boolean {
  const encounterRef = `Encounter/${encounterId}`;
  const r = resource as any;

  // encounter: { reference: "Encounter/..." }
  if (r.encounter?.reference === encounterRef) return true;

  // context: { reference: "Encounter/..." } — MedicationStatement
  if (r.context?.reference === encounterRef) return true;

  // context.encounter[]: [{ reference: "Encounter/..." }] — DocumentReference
  if (Array.isArray(r.context?.encounter)) {
    if (r.context.encounter.some((e: any) => e.reference === encounterRef)) return true;
  }

  // focus: { reference: "Encounter/..." } — Task
  if (r.focus?.reference === encounterRef) return true;

  return false;
}

/**
 * Detect which patient-reference fields exist on a resource WITHOUT mutating it.
 */
function detectPatientRefFields(resource: Resource): string[] {
  const fields: string[] = [];
  const r = resource as any;

  if (r.subject?.reference?.startsWith('Patient/')) fields.push('subject');
  if (r.patient?.reference?.startsWith('Patient/')) fields.push('patient');

  return fields;
}

/**
 * Mutate patient-reference fields on a resource. Returns the list of fields changed.
 */
function patchPatientRef(resource: Resource, newPatientRef: string): string[] {
  const updated: string[] = [];
  const r = resource as any;

  if (r.subject?.reference?.startsWith('Patient/')) {
    r.subject.reference = newPatientRef;
    updated.push('subject');
  }

  if (r.patient?.reference?.startsWith('Patient/')) {
    r.patient.reference = newPatientRef;
    updated.push('patient');
  }

  return updated;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Parse --dry-run or dry-run flag (can appear anywhere in args)
  // Note: `npm run` intercepts `--dry-run` as its own flag, so either use
  //   npm run <script> -- <args> --dry-run
  // or simply pass `dry-run` without dashes.
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('dry-run');
  const positionalArgs = args.filter((a) => a !== '--dry-run' && a !== 'dry-run');

  const env = positionalArgs[0];
  const appointmentId = positionalArgs[1];
  const newPatientId = positionalArgs[2];

  if (!env || !appointmentId || !newPatientId) {
    console.error(
      '❌ Usage: npx ts-node <script> <env> <appointmentId> <newPatientId> [--dry-run]\n' +
        '   Example: npx ts-node transfer-appointment-to-another-patient.ts staging abc123 def456 --dry-run'
    );
    process.exit(1);
  }

  if (dryRun) {
    console.log('\n🔍 DRY RUN MODE — no resources will be modified\n');
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));
  const token = await getAuth0Token(secrets);
  if (!token) {
    throw new Error('❌ Failed to fetch auth token.');
  }

  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
  });

  const newPatientRef = `Patient/${newPatientId}`;

  // ── Validate new patient exists ───────────────────────────────────────────
  console.log(`\n🔍 Validating new patient ${newPatientId} exists...`);
  const newPatient = await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: newPatientId });
  if (!newPatient) {
    throw new Error(`❌ Patient/${newPatientId} not found`);
  }
  const newPatientName = `${newPatient.name?.[0]?.given?.join(' ') || ''} ${newPatient.name?.[0]?.family || ''}`.trim();
  console.log(`✅ New patient found: ${newPatientName} (DOB: ${newPatient.birthDate || 'N/A'})`);

  // ── Get appointment ───────────────────────────────────────────────────────
  console.log(`\n🔍 Fetching Appointment/${appointmentId}...`);
  const appointment = await oystehr.fhir.get<Appointment>({ resourceType: 'Appointment', id: appointmentId });
  if (!appointment) {
    throw new Error(`❌ Appointment/${appointmentId} not found`);
  }

  const oldPatientId = getPatientIdFromAppointment(appointment);
  if (!oldPatientId) {
    throw new Error('❌ Could not determine current patient from appointment participants');
  }
  console.log(`✅ Current patient on appointment: Patient/${oldPatientId}`);

  if (oldPatientId === newPatientId) {
    console.log('⚠️  The appointment already belongs to this patient. Nothing to do.');
    return;
  }

  // ── Get encounter ─────────────────────────────────────────────────────────
  console.log(`\n🔍 Fetching encounter for appointment...`);
  const encounter = await getEncounterForAppointment(appointmentId, oystehr);
  const encounterId = encounter.id!;
  console.log(`✅ Found Encounter/${encounterId}`);

  // ── Fetch all visit-connected resources via getChartData ────────────────
  // Two calls are needed because getChartData has two categories of resources:
  //   1. Default resources (fetched when requestedFields is undefined):
  //      AllergyIntolerance, Condition, MedicationStatement, Procedure,
  //      Observation, Communication (instructions), DocumentReference
  //   2. Conditional resources (only fetched when explicitly requested):
  //      ServiceRequest, MedicationRequest, ClinicalImpression, EpisodeOfCare, etc.
  // These two sets cannot be retrieved in a single call.

  console.log(`\n🔍 Fetching default chart data resources for encounter ${encounterId}...`);
  const { chartResources: defaultResources } = await getChartData(oystehr, token, encounterId);
  console.log(`   Found ${defaultResources.length} resources from default fields`);

  console.log(`🔍 Fetching conditional chart data resources...`);
  const { chartResources: conditionalResources } = await getChartData(
    oystehr,
    token,
    encounterId,
    CONDITIONAL_CHART_DATA_FIELDS
  );
  console.log(`   Found ${conditionalResources.length} resources from conditional fields`);

  // Fetch immunization orders (MedicationAdministration with _tag=immunization)
  // These are not part of chart data, so we fetch them separately.
  console.log(`🔍 Fetching immunization orders for encounter ${encounterId}...`);
  const immunizationResources = (
    await oystehr.fhir.search<MedicationAdministration>({
      resourceType: 'MedicationAdministration',
      params: [
        { name: '_tag', value: 'immunization' },
        { name: 'context', value: `Encounter/${encounterId}` },
      ],
    })
  ).unbundle();
  console.log(`   Found ${immunizationResources.length} immunization order(s)`);

  // Fetch medication orders (MedicationAdministration with _tag=in-house-medication-administration-order)
  // These are also not part of chart data.
  console.log(`🔍 Fetching medication orders for encounter ${encounterId}...`);
  const medicationOrderResources = (
    await oystehr.fhir.search<MedicationAdministration>({
      resourceType: 'MedicationAdministration',
      params: [
        { name: '_tag', value: 'in-house-medication-administration-order' },
        { name: 'context', value: `Encounter/${encounterId}` },
      ],
    })
  ).unbundle();
  console.log(`   Found ${medicationOrderResources.length} medication order(s)`);

  // Merge and deduplicate resources by type/id
  const resourceMap = new Map<string, Resource>();
  for (const resource of [
    ...defaultResources,
    ...conditionalResources,
    ...immunizationResources,
    ...medicationOrderResources,
  ]) {
    if (resource.id) {
      resourceMap.set(`${resource.resourceType}/${resource.id}`, resource);
    }
  }
  const mergedResources = Array.from(resourceMap.values());

  // Filter: only keep resources that explicitly reference this encounter.
  // The default getChartData call fetches some resource types by patient
  // (AllergyIntolerance, Condition, MedicationStatement, Procedure), which
  // may include resources from other visits. We must not modify those.
  const allResources = mergedResources.filter((r) => resourceReferencesEncounter(r, encounterId));
  const skippedByFilter = mergedResources.length - allResources.length;

  if (skippedByFilter > 0) {
    console.log(
      `\n⚠️  Filtered out ${skippedByFilter} resource(s) not linked to Encounter/${encounterId} (patient-level or from other visits)`
    );
  }

  // Group by resource type for summary
  const resourcesByType = allResources.reduce(
    (acc, r) => {
      acc[r.resourceType] = (acc[r.resourceType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log(`\n📊 Resources found connected to this visit:`);
  Object.entries(resourcesByType)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([type, count]) => {
      console.log(`   ${type.padEnd(25)} ${count}`);
    });
  console.log(`   ${'─'.repeat(35)}`);
  console.log(`   ${'Total'.padEnd(25)} ${allResources.length}`);

  // ── Dry-run report / real updates ─────────────────────────────────────────

  if (dryRun) {
    // Build a report of what WOULD change without touching any resources
    interface PlannedChange {
      resource: string;
      fieldsToUpdate: string[];
      currentValues: Record<string, string>;
      newValue: string;
    }

    const plannedChanges: PlannedChange[] = [];

    // Appointment
    const appointmentPatientParticipant = appointment.participant.find(
      (p) => p.actor?.reference === `Patient/${oldPatientId}`
    );
    if (appointmentPatientParticipant) {
      plannedChanges.push({
        resource: `Appointment/${appointmentId}`,
        fieldsToUpdate: ['participant.actor'],
        currentValues: { 'participant.actor': `Patient/${oldPatientId}` },
        newValue: newPatientRef,
      });
    }

    // Encounter
    plannedChanges.push({
      resource: `Encounter/${encounterId}`,
      fieldsToUpdate: ['subject'],
      currentValues: { subject: encounter.subject?.reference || 'N/A' },
      newValue: newPatientRef,
    });

    // Chart data resources
    let wouldUpdate = 0;
    let wouldSkip = 0;

    for (const resource of allResources) {
      const resourceId = resource.id;
      const resourceType = resource.resourceType;
      if (!resourceId) {
        wouldSkip++;
        continue;
      }

      const fields = detectPatientRefFields(resource);
      if (fields.length === 0) {
        wouldSkip++;
        continue;
      }

      const currentValues: Record<string, string> = {};
      const r = resource as any;
      for (const field of fields) {
        currentValues[field] = r[field]?.reference || 'N/A';
      }

      plannedChanges.push({
        resource: `${resourceType}/${resourceId}`,
        fieldsToUpdate: fields,
        currentValues,
        newValue: newPatientRef,
      });
      wouldUpdate++;
    }

    // Write report file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFilename = `transfer-dry-run-${appointmentId}-${timestamp}.json`;
    const reportPath = path.join(__dirname, reportFilename);

    const report = {
      dryRun: true,
      timestamp: new Date().toISOString(),
      appointmentId,
      encounterId,
      oldPatientId,
      newPatientId,
      newPatientName,
      totalResourcesFound: allResources.length,
      filteredOutFromOtherVisits: skippedByFilter,
      wouldUpdate: wouldUpdate + 2, // +2 for Appointment + Encounter
      wouldSkip,
      plannedChanges,
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    console.log(`\n════════════════════════════════════════════`);
    console.log(`📋 Dry Run Summary`);
    console.log(`════════════════════════════════════════════`);
    console.log(`   Appointment:  ${appointmentId}`);
    console.log(`   Encounter:    ${encounterId}`);
    console.log(`   Old Patient:  ${oldPatientId}`);
    console.log(`   New Patient:  ${newPatientId} (${newPatientName})`);
    console.log(`   ─────────────────────────────`);
    console.log(`   Would update: ${wouldUpdate + 2} resource(s) (incl. Appointment + Encounter)`);
    console.log(`   Would skip:   ${wouldSkip} (no patient ref)`);
    console.log(`════════════════════════════════════════════`);
    console.log(`\n📄 Report written to: ${reportPath}`);
    console.log('\n✅ Dry run complete — no changes were made.');
    return;
  }

  // ── Update Appointment ────────────────────────────────────────────────────
  console.log(`\n🔄 Updating Appointment/${appointmentId}...`);
  const updatedParticipants = appointment.participant.map((p) => {
    if (p.actor?.reference === `Patient/${oldPatientId}`) {
      return { ...p, actor: { ...p.actor, reference: newPatientRef } };
    }
    return p;
  });
  await oystehr.fhir.update<Appointment>({
    ...appointment,
    participant: updatedParticipants,
  });
  console.log(`✅ Appointment participant updated`);

  // ── Update Encounter ──────────────────────────────────────────────────────
  console.log(`🔄 Updating Encounter/${encounterId}...`);
  await oystehr.fhir.update<Encounter>({
    ...encounter,
    subject: { reference: newPatientRef },
  });
  console.log(`✅ Encounter subject updated`);

  // ── Update all connected resources ────────────────────────────────────────
  console.log(`\n🔄 Updating patient references in ${allResources.length} connected resources...`);

  const summary: TransferSummary[] = [];
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const resource of allResources) {
    const resourceId = resource.id;
    const resourceType = resource.resourceType;

    if (!resourceId) {
      console.log(`   ⚠️  Skipping ${resourceType} with no id`);
      skipCount++;
      continue;
    }

    const fieldsUpdated = patchPatientRef(resource, newPatientRef);

    if (fieldsUpdated.length === 0) {
      skipCount++;
      continue;
    }

    try {
      await oystehr.fhir.update(resource as FhirResource);
      successCount++;
      summary.push({ resourceType, id: resourceId, fieldsUpdated });
      console.log(`   ✅ ${resourceType}/${resourceId} – updated: ${fieldsUpdated.join(', ')}`);
    } catch (error) {
      errorCount++;
      console.error(`   ❌ ${resourceType}/${resourceId} – failed:`, error instanceof Error ? error.message : error);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n════════════════════════════════════════════`);
  console.log(`📋 Transfer Summary`);
  console.log(`════════════════════════════════════════════`);
  console.log(`   Appointment:  ${appointmentId}`);
  console.log(`   Encounter:    ${encounterId}`);
  console.log(`   Old Patient:  ${oldPatientId}`);
  console.log(`   New Patient:  ${newPatientId} (${newPatientName})`);
  console.log(`   ─────────────────────────────`);
  console.log(`   Resources updated:  ${successCount}`);
  console.log(`   Resources skipped:  ${skipCount} (no patient ref to update)`);
  console.log(`   Errors:             ${errorCount}`);
  console.log(`════════════════════════════════════════════\n`);

  if (errorCount > 0) {
    console.error('⚠️  Some resources failed to update. Please review the errors above.');
    process.exit(1);
  }

  console.log('✅ Transfer completed successfully.');
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
