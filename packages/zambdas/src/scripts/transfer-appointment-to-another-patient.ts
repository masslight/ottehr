import Oystehr from '@oystehr/sdk';
import {
  Account,
  Appointment,
  ChargeItem,
  Consent,
  Coverage,
  DocumentReference,
  Encounter,
  FhirResource,
  MedicationAdministration,
  Patient,
  QuestionnaireResponse,
  RelatedPerson,
  Resource,
} from 'fhir/r4b';
import * as fs from 'fs';
import * as path from 'path';
import { ChartDataRequestedFields, createUserResourcesForPatient, getCoding, PRIVATE_EXTENSION_BASE_URL } from 'utils';
import { getChartData } from '../ehr/get-chart-data';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TransferSummary {
  resourceType: string;
  id: string;
  fieldsUpdated: string[];
  phase: string;
}

interface PlannedChange {
  resource: string;
  phase: string;
  fieldsToUpdate: string[];
  currentValues: Record<string, string>;
  newValue: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

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
  chiefComplaint: { _tag: 'chief-complaint' },
  historyOfPresentIllness: { _tag: 'history-of-present-illness' },
  mechanismOfInjury: { _tag: 'mechanism-of-injury' },
  ros: { _tag: 'ros' },
  accident: {},
  surgicalHistoryNote: { _tag: 'surgical-history-note' },
  medications: {},
  inhouseMedications: {},
  prescribedMedications: {},
  disposition: {},
  procedures: {},
  medicalDecision: { _tag: 'medical-decision' },
  episodeOfCare: {},
  notes: { _count: 10000 },
  observations: {},
  vitalsObservations: { _search_by: 'encounter' },
  birthHistory: {},
  externalLabResults: {},
  inHouseLabResults: {},
  reasonForVisit: {},
  patientInfoConfirmed: {},
  addendumNote: {},
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPatientName(patient: Patient): string {
  return `${patient.name?.[0]?.given?.join(' ') || ''} ${patient.name?.[0]?.family || ''}`.trim() || 'Unknown';
}

async function getEncounterForAppointment(appointmentId: string, oystehr: Oystehr): Promise<Encounter | undefined> {
  const encounters = (
    await oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [{ name: 'appointment', value: `Appointment/${appointmentId}` }],
    })
  ).unbundle();
  return encounters[0];
}

/**
 * Check if a resource references the given encounter.
 * Different resource types store the encounter reference in different fields:
 *   - encounter.reference  → Condition, AllergyIntolerance, Procedure, Observation,
 *                            Communication, ClinicalImpression, ServiceRequest,
 *                            MedicationRequest, Task
 *   - context.reference    → MedicationStatement, MedicationAdministration
 *   - context.encounter[]  → DocumentReference
 *   - focus.reference      → Task
 */
function resourceReferencesEncounter(resource: Resource, encounterId: string): boolean {
  const encounterRef = `Encounter/${encounterId}`;
  const r = resource as any;

  if (r.encounter?.reference === encounterRef) return true;
  if (r.context?.reference === encounterRef) return true;
  if (Array.isArray(r.context?.encounter)) {
    if (r.context.encounter.some((e: any) => e.reference === encounterRef)) return true;
  }
  if (r.focus?.reference === encounterRef) return true;

  return false;
}

/**
 * Detect which patient-reference fields on a resource point to the old patient.
 */
function detectPatientRefFields(resource: Resource, oldPatientId: string): string[] {
  const fields: string[] = [];
  const r = resource as any;
  const oldRef = `Patient/${oldPatientId}`;

  // Account.subject is an array — check it first
  if (Array.isArray(r.subject)) {
    if (r.subject.some((s: any) => s.reference === oldRef)) fields.push('subject[]');
  } else if (r.subject?.reference === oldRef) {
    fields.push('subject');
  }

  if (r.patient?.reference === oldRef) fields.push('patient');
  if (r.beneficiary?.reference === oldRef) fields.push('beneficiary');
  if (r.subscriber?.reference === oldRef) fields.push('subscriber');

  return fields;
}

/**
 * Mutate patient-reference fields on a resource so they point to the new patient.
 * Returns the list of field names that were changed.
 */
function patchPatientRef(resource: Resource, oldPatientId: string, newPatientRef: string): string[] {
  const updated: string[] = [];
  const r = resource as any;
  const oldRef = `Patient/${oldPatientId}`;

  // Account.subject is an array of References
  if (Array.isArray(r.subject)) {
    for (const subj of r.subject) {
      if (subj.reference === oldRef) {
        subj.reference = newPatientRef;
        if (!updated.includes('subject[]')) updated.push('subject[]');
      }
    }
  } else if (r.subject?.reference === oldRef) {
    r.subject.reference = newPatientRef;
    updated.push('subject');
  }

  if (r.patient?.reference === oldRef) {
    r.patient.reference = newPatientRef;
    updated.push('patient');
  }

  if (r.beneficiary?.reference === oldRef) {
    r.beneficiary.reference = newPatientRef;
    updated.push('beneficiary');
  }

  if (r.subscriber?.reference === oldRef) {
    r.subscriber.reference = newPatientRef;
    updated.push('subscriber');
  }

  return updated;
}

/**
 * Get login phone numbers for a patient by finding user-relatedperson RelatedPersons.
 */
async function getLoginPhoneNumbers(oystehr: Oystehr, patientId: string): Promise<string[]> {
  const resources = (
    await oystehr.fhir.search<Patient | RelatedPerson>({
      resourceType: 'Patient',
      params: [
        { name: '_id', value: patientId },
        { name: '_revinclude', value: 'RelatedPerson:patient' },
      ],
    })
  ).unbundle();

  return resources
    .filter(
      (r): r is RelatedPerson =>
        r.resourceType === 'RelatedPerson' &&
        getCoding(r.relationship, `${PRIVATE_EXTENSION_BASE_URL}/relationship`)?.code === 'user-relatedperson'
    )
    .map((rp) => rp.telecom?.find((t) => t.system === 'sms')?.value)
    .filter((v): v is string => Boolean(v));
}

/**
 * Merge patient record fields from source (old/duplicate) into target (new/surviving).
 * Strategy: "fill in blanks" — if target has a field, keep it; otherwise take from source.
 * For array fields (telecom, extension, contained), merge and deduplicate.
 * Returns list of field names that were filled from source.
 */
function mergePatientFields(target: Patient, source: Patient): string[] {
  const fieldsFilled: string[] = [];

  // Scalar fields — fill only if target is missing
  if (!target.birthDate && source.birthDate) {
    target.birthDate = source.birthDate;
    fieldsFilled.push('birthDate');
  }
  if (!target.gender && source.gender) {
    target.gender = source.gender;
    fieldsFilled.push('gender');
  }
  if (!target.maritalStatus && source.maritalStatus) {
    target.maritalStatus = source.maritalStatus;
    fieldsFilled.push('maritalStatus');
  }

  // Name — fill if target has none
  if ((!target.name || target.name.length === 0) && source.name && source.name.length > 0) {
    target.name = source.name;
    fieldsFilled.push('name');
  }

  // Address — fill if target has none
  if ((!target.address || target.address.length === 0) && source.address && source.address.length > 0) {
    target.address = source.address;
    fieldsFilled.push('address');
  }

  // Telecom — merge, add entries from source not already in target
  if (source.telecom && source.telecom.length > 0) {
    if (!target.telecom) target.telecom = [];
    const existingKeys = new Set(target.telecom.map((t) => `${t.system}:${t.value}`));
    const newEntries = source.telecom.filter((t) => !existingKeys.has(`${t.system}:${t.value}`));
    if (newEntries.length > 0) {
      target.telecom.push(...newEntries);
      fieldsFilled.push('telecom');
    }
  }

  // Contact — fill if target has none
  if ((!target.contact || target.contact.length === 0) && source.contact && source.contact.length > 0) {
    target.contact = source.contact;
    fieldsFilled.push('contact');
  }

  // Communication/language — fill if target has none
  if (
    (!target.communication || target.communication.length === 0) &&
    source.communication &&
    source.communication.length > 0
  ) {
    target.communication = source.communication;
    fieldsFilled.push('communication');
  }

  // Extensions — merge by URL, deduplicate
  if (source.extension && source.extension.length > 0) {
    if (!target.extension) target.extension = [];
    const existingUrls = new Set(target.extension.map((e) => e.url));
    const newExts = source.extension.filter((e) => !existingUrls.has(e.url));
    if (newExts.length > 0) {
      target.extension.push(...newExts);
      fieldsFilled.push('extension');
    }
  }

  // Contained resources (e.g. pharmacy Organizations)
  if (source.contained && source.contained.length > 0) {
    if (!target.contained) target.contained = [];
    const existingIds = new Set(target.contained.map((c) => c.id));
    const newContained = source.contained.filter((c) => c.id && !existingIds.has(c.id));
    if (newContained.length > 0) {
      target.contained.push(...newContained);
      fieldsFilled.push('contained');
    }
  }

  // GeneralPractitioner — fill if target has none
  if (
    (!target.generalPractitioner || target.generalPractitioner.length === 0) &&
    source.generalPractitioner &&
    source.generalPractitioner.length > 0
  ) {
    target.generalPractitioner = source.generalPractitioner;
    fieldsFilled.push('generalPractitioner');
  }

  return fieldsFilled;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Parse args. Note: `npm run` intercepts `--dry-run` as its own flag, so
  // either use `npm run <script> -- <args> --dry-run` or just `dry-run`.
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('dry-run');
  const positionalArgs = args.filter((a) => a !== '--dry-run' && a !== 'dry-run');

  const env = positionalArgs[0];
  const oldPatientId = positionalArgs[1];
  const newPatientId = positionalArgs[2];

  if (!env || !oldPatientId || !newPatientId) {
    console.error(
      '❌ Usage: npx ts-node <script> <env> <oldPatientId> <newPatientId> [--dry-run | dry-run]\n' +
        '   Merges all data from the old (duplicate) patient into the new (surviving) patient.\n' +
        '   The old patient is marked as merged (active=false, link=replaced-by).\n\n' +
        '   Example: npx ts-node transfer-appointment-to-another-patient.ts staging abc123 def456 dry-run'
    );
    process.exit(1);
  }

  if (oldPatientId === newPatientId) {
    console.error('❌ Old and new patient IDs cannot be the same.');
    process.exit(1);
  }

  if (dryRun) {
    console.log('\n🔍 DRY RUN MODE — no resources will be modified\n');
  } else {
    console.log('\n⚠️  LIVE MODE — resources WILL be modified\n');
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
  const oldPatientRef = `Patient/${oldPatientId}`;

  // ── Validate both patients exist ──────────────────────────────────────────
  console.log(`🔍 Validating patients...`);
  const [oldPatient, newPatient] = await Promise.all([
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: oldPatientId }),
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: newPatientId }),
  ]);
  if (!oldPatient) throw new Error(`❌ Patient/${oldPatientId} not found`);
  if (!newPatient) throw new Error(`❌ Patient/${newPatientId} not found`);

  const oldPatientName = getPatientName(oldPatient);
  const newPatientName = getPatientName(newPatient);
  console.log(
    `   Old (duplicate) patient: ${oldPatientName} (DOB: ${oldPatient.birthDate || 'N/A'}) [${oldPatientId}]`
  );
  console.log(
    `   New (surviving) patient: ${newPatientName} (DOB: ${newPatient.birthDate || 'N/A'}) [${newPatientId}]`
  );

  // Track processed resource IDs to avoid double-processing across phases
  const processedIds = new Set<string>();
  const allSummary: TransferSummary[] = [];
  const allPlannedChanges: PlannedChange[] = [];
  let totalErrors = 0;
  let totalSkipped = 0;

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 1: Transfer all visits (appointments + encounters + visit resources)
  // ════════════════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📋 Phase 1: Transfer Visits`);
  console.log(`${'═'.repeat(60)}`);

  const appointments = (
    await oystehr.fhir.search<Appointment>({
      resourceType: 'Appointment',
      params: [
        { name: 'actor', value: oldPatientRef },
        { name: '_count', value: '1000' },
      ],
    })
  ).unbundle();

  console.log(`\n   Found ${appointments.length} appointment(s) for old patient`);

  for (const appointment of appointments) {
    const apptId = appointment.id!;
    console.log(`\n   ── Appointment/${apptId} ──`);

    // Update appointment participant
    const hasOldParticipant = appointment.participant.some((p) => p.actor?.reference === oldPatientRef);
    if (hasOldParticipant) {
      if (dryRun) {
        allPlannedChanges.push({
          resource: `Appointment/${apptId}`,
          phase: 'visits',
          fieldsToUpdate: ['participant.actor'],
          currentValues: { 'participant.actor': oldPatientRef },
          newValue: newPatientRef,
        });
      } else {
        const updatedAppointment: Appointment = {
          ...appointment,
          participant: appointment.participant.map((p) => {
            if (p.actor?.reference === oldPatientRef) {
              return { ...p, actor: { ...p.actor, reference: newPatientRef } };
            }
            return p;
          }),
        };
        await oystehr.fhir.update<Appointment>(updatedAppointment);
        allSummary.push({
          resourceType: 'Appointment',
          id: apptId,
          fieldsUpdated: ['participant.actor'],
          phase: 'visits',
        });
        console.log(`      ✅ Appointment participant updated`);
      }
      processedIds.add(`Appointment/${apptId}`);
    }

    // Get encounter for this appointment
    const encounter = await getEncounterForAppointment(apptId, oystehr);
    if (!encounter?.id) {
      console.log(`      ⚠️  No encounter found, skipping visit resources`);
      continue;
    }
    const encounterId = encounter.id;

    // Update encounter subject
    if (dryRun) {
      allPlannedChanges.push({
        resource: `Encounter/${encounterId}`,
        phase: 'visits',
        fieldsToUpdate: ['subject'],
        currentValues: { subject: encounter.subject?.reference || 'N/A' },
        newValue: newPatientRef,
      });
    } else {
      await oystehr.fhir.update<Encounter>({ ...encounter, subject: { reference: newPatientRef } });
      allSummary.push({
        resourceType: 'Encounter',
        id: encounterId,
        fieldsUpdated: ['subject'],
        phase: 'visits',
      });
      console.log(`      ✅ Encounter/${encounterId} subject updated`);
    }
    processedIds.add(`Encounter/${encounterId}`);

    // ── Collect all visit-connected resources ──
    // Two getChartData calls needed: one for defaults, one for conditional fields.
    // Plus separate MedicationAdministration searches.
    console.log(`      🔍 Fetching visit resources...`);

    const { chartResources: defaultResources } = await getChartData(oystehr, token, encounterId);
    const { chartResources: conditionalResources } = await getChartData(
      oystehr,
      token,
      encounterId,
      CONDITIONAL_CHART_DATA_FIELDS
    );

    const immunizationResources = (
      await oystehr.fhir.search<MedicationAdministration>({
        resourceType: 'MedicationAdministration',
        params: [
          { name: '_tag', value: 'immunization' },
          { name: 'context', value: `Encounter/${encounterId}` },
        ],
      })
    ).unbundle();

    const medicationOrderResources = (
      await oystehr.fhir.search<MedicationAdministration>({
        resourceType: 'MedicationAdministration',
        params: [
          { name: '_tag', value: 'in-house-medication-administration-order' },
          { name: 'context', value: `Encounter/${encounterId}` },
        ],
      })
    ).unbundle();

    // Deduplicate by resourceType/id
    const resourceMap = new Map<string, Resource>();
    for (const r of [
      ...defaultResources,
      ...conditionalResources,
      ...immunizationResources,
      ...medicationOrderResources,
    ]) {
      if (r.id) resourceMap.set(`${r.resourceType}/${r.id}`, r);
    }

    // Filter to encounter-linked only, exclude already processed
    const visitResources = Array.from(resourceMap.values())
      .filter((r) => resourceReferencesEncounter(r, encounterId))
      .filter((r) => !processedIds.has(`${r.resourceType}/${r.id}`));

    const totalForEncounter = Array.from(resourceMap.values()).length;
    const skippedByFilter = totalForEncounter - visitResources.length;
    if (skippedByFilter > 0) {
      console.log(`      Filtered out ${skippedByFilter} resource(s) not linked to this encounter`);
    }
    console.log(`      Found ${visitResources.length} encounter-linked resource(s) to update`);

    for (const resource of visitResources) {
      const rid = `${resource.resourceType}/${resource.id}`;
      processedIds.add(rid);

      if (dryRun) {
        const fields = detectPatientRefFields(resource, oldPatientId);
        if (fields.length > 0) {
          const currentValues: Record<string, string> = {};
          const r = resource as any;
          for (const f of fields) {
            if (f === 'subject[]') {
              currentValues['subject[]'] = JSON.stringify(r.subject?.map((s: any) => s.reference));
            } else {
              currentValues[f] = r[f]?.reference || 'N/A';
            }
          }
          allPlannedChanges.push({
            resource: rid,
            phase: 'visits',
            fieldsToUpdate: fields,
            currentValues,
            newValue: newPatientRef,
          });
        }
      } else {
        const fieldsUpdated = patchPatientRef(resource, oldPatientId, newPatientRef);
        if (fieldsUpdated.length === 0) {
          totalSkipped++;
          continue;
        }
        try {
          await oystehr.fhir.update(resource as FhirResource);
          allSummary.push({ resourceType: resource.resourceType, id: resource.id!, fieldsUpdated, phase: 'visits' });
          console.log(`      ✅ ${rid} – ${fieldsUpdated.join(', ')}`);
        } catch (error) {
          totalErrors++;
          console.error(`      ❌ ${rid} – failed:`, error instanceof Error ? error.message : error);
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 2: Patient-level resources
  //   Resources that reference Patient but may not be linked to any encounter:
  //   QuestionnaireResponse, Consent, DocumentReference, RelatedPerson
  // ════════════════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📋 Phase 2: Patient-Level Resources`);
  console.log(`${'═'.repeat(60)}`);

  // ── QuestionnaireResponse ─────────────────────────────────────────────────
  console.log(`\n   🔍 Searching QuestionnaireResponses...`);
  const qrs = (
    await oystehr.fhir.search<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      params: [
        { name: 'subject', value: oldPatientRef },
        { name: '_count', value: '1000' },
      ],
    })
  ).unbundle();
  const unprocessedQrs = qrs.filter((r) => r.id && !processedIds.has(`QuestionnaireResponse/${r.id}`));
  console.log(`      Found ${unprocessedQrs.length} QuestionnaireResponse(s)`);

  for (const qr of unprocessedQrs) {
    const rid = `QuestionnaireResponse/${qr.id}`;
    processedIds.add(rid);

    if (dryRun) {
      allPlannedChanges.push({
        resource: rid,
        phase: 'patient-level',
        fieldsToUpdate: ['subject'],
        currentValues: { subject: qr.subject?.reference || 'N/A' },
        newValue: newPatientRef,
      });
    } else {
      qr.subject = { reference: newPatientRef };
      try {
        await oystehr.fhir.update(qr as FhirResource);
        allSummary.push({
          resourceType: 'QuestionnaireResponse',
          id: qr.id!,
          fieldsUpdated: ['subject'],
          phase: 'patient-level',
        });
        console.log(`      ✅ ${rid} – subject`);
      } catch (error) {
        totalErrors++;
        console.error(`      ❌ ${rid} – failed:`, error instanceof Error ? error.message : error);
      }
    }
  }

  // ── Consent ───────────────────────────────────────────────────────────────
  console.log(`\n   🔍 Searching Consents...`);
  const consents = (
    await oystehr.fhir.search<Consent>({
      resourceType: 'Consent',
      params: [
        { name: 'patient', value: oldPatientRef },
        { name: '_count', value: '1000' },
      ],
    })
  ).unbundle();
  const unprocessedConsents = consents.filter((r) => r.id && !processedIds.has(`Consent/${r.id}`));
  console.log(`      Found ${unprocessedConsents.length} Consent(s)`);

  for (const consent of unprocessedConsents) {
    const rid = `Consent/${consent.id}`;
    processedIds.add(rid);

    if (dryRun) {
      allPlannedChanges.push({
        resource: rid,
        phase: 'patient-level',
        fieldsToUpdate: ['patient'],
        currentValues: { patient: consent.patient?.reference || 'N/A' },
        newValue: newPatientRef,
      });
    } else {
      consent.patient = { reference: newPatientRef };
      try {
        await oystehr.fhir.update(consent as FhirResource);
        allSummary.push({
          resourceType: 'Consent',
          id: consent.id!,
          fieldsUpdated: ['patient'],
          phase: 'patient-level',
        });
        console.log(`      ✅ ${rid} – patient`);
      } catch (error) {
        totalErrors++;
        console.error(`      ❌ ${rid} – failed:`, error instanceof Error ? error.message : error);
      }
    }
  }

  // ── DocumentReference (patient-level) ─────────────────────────────────────
  // Encounter-linked DocRefs were already updated in Phase 1. This picks up
  // patient-level ones like photo IDs, insurance cards, etc.
  console.log(`\n   🔍 Searching remaining DocumentReferences...`);
  const docRefs = (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        { name: 'subject', value: oldPatientRef },
        { name: '_count', value: '1000' },
      ],
    })
  ).unbundle();
  const unprocessedDocRefs = docRefs.filter((r) => r.id && !processedIds.has(`DocumentReference/${r.id}`));
  console.log(`      Found ${unprocessedDocRefs.length} remaining DocumentReference(s)`);

  for (const docRef of unprocessedDocRefs) {
    const rid = `DocumentReference/${docRef.id}`;
    processedIds.add(rid);

    if (dryRun) {
      allPlannedChanges.push({
        resource: rid,
        phase: 'patient-level',
        fieldsToUpdate: ['subject'],
        currentValues: { subject: docRef.subject?.reference || 'N/A' },
        newValue: newPatientRef,
      });
    } else {
      docRef.subject = { reference: newPatientRef };
      try {
        await oystehr.fhir.update(docRef as FhirResource);
        allSummary.push({
          resourceType: 'DocumentReference',
          id: docRef.id!,
          fieldsUpdated: ['subject'],
          phase: 'patient-level',
        });
        console.log(`      ✅ ${rid} – subject`);
      } catch (error) {
        totalErrors++;
        console.error(`      ❌ ${rid} – failed:`, error instanceof Error ? error.message : error);
      }
    }
  }

  // ── RelatedPerson (non-user) ──────────────────────────────────────────────
  // User-relatedperson records are handled in Phase 4 (login phones).
  // Here we re-point guarantor, emergency contact, etc.
  console.log(`\n   🔍 Searching RelatedPerson resources...`);
  const relatedPersons = (
    await oystehr.fhir.search<RelatedPerson>({
      resourceType: 'RelatedPerson',
      params: [
        { name: 'patient', value: oldPatientRef },
        { name: '_count', value: '1000' },
      ],
    })
  ).unbundle();

  const nonUserRelatedPersons = relatedPersons
    .filter(
      (rp) => getCoding(rp.relationship, `${PRIVATE_EXTENSION_BASE_URL}/relationship`)?.code !== 'user-relatedperson'
    )
    .filter((rp) => rp.id && !processedIds.has(`RelatedPerson/${rp.id}`));
  console.log(`      Found ${nonUserRelatedPersons.length} non-user RelatedPerson(s)`);

  for (const rp of nonUserRelatedPersons) {
    const rid = `RelatedPerson/${rp.id}`;
    processedIds.add(rid);

    if (dryRun) {
      allPlannedChanges.push({
        resource: rid,
        phase: 'patient-level',
        fieldsToUpdate: ['patient'],
        currentValues: { patient: rp.patient?.reference || 'N/A' },
        newValue: newPatientRef,
      });
    } else {
      rp.patient = { reference: newPatientRef };
      try {
        await oystehr.fhir.update(rp as FhirResource);
        allSummary.push({
          resourceType: 'RelatedPerson',
          id: rp.id!,
          fieldsUpdated: ['patient'],
          phase: 'patient-level',
        });
        console.log(`      ✅ ${rid} – patient`);
      } catch (error) {
        totalErrors++;
        console.error(`      ❌ ${rid} – failed:`, error instanceof Error ? error.message : error);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 3: Billing resources (Account, Coverage, ChargeItem)
  // ════════════════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📋 Phase 3: Billing Resources`);
  console.log(`${'═'.repeat(60)}`);

  // ── Account ───────────────────────────────────────────────────────────────
  console.log(`\n   🔍 Searching Accounts...`);
  const accounts = (
    await oystehr.fhir.search<Account>({
      resourceType: 'Account',
      params: [
        { name: 'patient', value: oldPatientRef },
        { name: '_count', value: '100' },
      ],
    })
  ).unbundle();
  const unprocessedAccounts = accounts.filter((r) => r.id && !processedIds.has(`Account/${r.id}`));
  console.log(`      Found ${unprocessedAccounts.length} Account(s)`);

  for (const account of unprocessedAccounts) {
    const rid = `Account/${account.id}`;
    processedIds.add(rid);

    const hasOldSubjectRef = account.subject?.some((s) => s.reference === oldPatientRef);
    const hasOldGuarantorRef = account.guarantor?.some((g) => g.party?.reference === oldPatientRef);

    if (!hasOldSubjectRef && !hasOldGuarantorRef) {
      totalSkipped++;
      continue;
    }

    const fieldsToUpdate: string[] = [];
    if (hasOldSubjectRef) fieldsToUpdate.push('subject[]');
    if (hasOldGuarantorRef) fieldsToUpdate.push('guarantor[].party');

    if (dryRun) {
      allPlannedChanges.push({
        resource: rid,
        phase: 'billing',
        fieldsToUpdate,
        currentValues: {
          ...(hasOldSubjectRef ? { 'subject[]': JSON.stringify(account.subject?.map((s) => s.reference)) } : {}),
          ...(hasOldGuarantorRef
            ? { 'guarantor[].party': JSON.stringify(account.guarantor?.map((g) => g.party?.reference)) }
            : {}),
        },
        newValue: newPatientRef,
      });
    } else {
      // Re-point Account.subject[]
      if (account.subject) {
        for (const subj of account.subject) {
          if (subj.reference === oldPatientRef) {
            subj.reference = newPatientRef;
          }
        }
      }
      // Re-point Account.guarantor[].party
      if (account.guarantor) {
        for (const g of account.guarantor) {
          if (g.party?.reference === oldPatientRef) {
            g.party.reference = newPatientRef;
          }
        }
      }
      try {
        await oystehr.fhir.update(account as FhirResource);
        allSummary.push({ resourceType: 'Account', id: account.id!, fieldsUpdated: fieldsToUpdate, phase: 'billing' });
        console.log(`      ✅ ${rid} – ${fieldsToUpdate.join(', ')}`);
      } catch (error) {
        totalErrors++;
        console.error(`      ❌ ${rid} – failed:`, error instanceof Error ? error.message : error);
      }
    }
  }

  // ── Coverage ──────────────────────────────────────────────────────────────
  console.log(`\n   🔍 Searching Coverages...`);
  const coverages = (
    await oystehr.fhir.search<Coverage>({
      resourceType: 'Coverage',
      params: [
        { name: 'patient', value: oldPatientRef },
        { name: '_count', value: '100' },
      ],
    })
  ).unbundle();
  const unprocessedCoverages = coverages.filter((r) => r.id && !processedIds.has(`Coverage/${r.id}`));
  console.log(`      Found ${unprocessedCoverages.length} Coverage(s)`);

  for (const coverage of unprocessedCoverages) {
    const rid = `Coverage/${coverage.id}`;
    processedIds.add(rid);

    const fieldsToUpdate: string[] = [];
    if (coverage.beneficiary?.reference === oldPatientRef) fieldsToUpdate.push('beneficiary');
    if (coverage.subscriber?.reference === oldPatientRef) fieldsToUpdate.push('subscriber');

    if (fieldsToUpdate.length === 0) {
      totalSkipped++;
      continue;
    }

    if (dryRun) {
      allPlannedChanges.push({
        resource: rid,
        phase: 'billing',
        fieldsToUpdate,
        currentValues: {
          ...(fieldsToUpdate.includes('beneficiary') ? { beneficiary: oldPatientRef } : {}),
          ...(fieldsToUpdate.includes('subscriber') ? { subscriber: oldPatientRef } : {}),
        },
        newValue: newPatientRef,
      });
    } else {
      if (coverage.beneficiary?.reference === oldPatientRef) {
        coverage.beneficiary.reference = newPatientRef;
      }
      if (coverage.subscriber?.reference === oldPatientRef) {
        coverage.subscriber!.reference = newPatientRef;
      }
      try {
        await oystehr.fhir.update(coverage as FhirResource);
        allSummary.push({
          resourceType: 'Coverage',
          id: coverage.id!,
          fieldsUpdated: fieldsToUpdate,
          phase: 'billing',
        });
        console.log(`      ✅ ${rid} – ${fieldsToUpdate.join(', ')}`);
      } catch (error) {
        totalErrors++;
        console.error(`      ❌ ${rid} – failed:`, error instanceof Error ? error.message : error);
      }
    }
  }

  // ── ChargeItem ────────────────────────────────────────────────────────────
  console.log(`\n   🔍 Searching ChargeItems...`);
  const chargeItems = (
    await oystehr.fhir.search<ChargeItem>({
      resourceType: 'ChargeItem',
      params: [
        { name: 'subject', value: oldPatientRef },
        { name: '_count', value: '1000' },
      ],
    })
  ).unbundle();
  const unprocessedChargeItems = chargeItems.filter((r) => r.id && !processedIds.has(`ChargeItem/${r.id}`));
  console.log(`      Found ${unprocessedChargeItems.length} ChargeItem(s)`);

  for (const ci of unprocessedChargeItems) {
    const rid = `ChargeItem/${ci.id}`;
    processedIds.add(rid);

    if (dryRun) {
      allPlannedChanges.push({
        resource: rid,
        phase: 'billing',
        fieldsToUpdate: ['subject'],
        currentValues: { subject: (ci as any).subject?.reference || 'N/A' },
        newValue: newPatientRef,
      });
    } else {
      const fieldsUpdated = patchPatientRef(ci, oldPatientId, newPatientRef);
      if (fieldsUpdated.length === 0) {
        totalSkipped++;
        continue;
      }
      try {
        await oystehr.fhir.update(ci as FhirResource);
        allSummary.push({ resourceType: 'ChargeItem', id: ci.id!, fieldsUpdated, phase: 'billing' });
        console.log(`      ✅ ${rid} – ${fieldsUpdated.join(', ')}`);
      } catch (error) {
        totalErrors++;
        console.error(`      ❌ ${rid} – failed:`, error instanceof Error ? error.message : error);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 4: Login phone numbers
  // ════════════════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📋 Phase 4: Login Phone Numbers`);
  console.log(`${'═'.repeat(60)}`);

  const oldPatientPhones = await getLoginPhoneNumbers(oystehr, oldPatientId);
  const newPatientPhones = await getLoginPhoneNumbers(oystehr, newPatientId);
  const phonesToAdd = oldPatientPhones.filter((p) => !newPatientPhones.includes(p));

  console.log(`   Old patient phones: ${oldPatientPhones.length > 0 ? oldPatientPhones.join(', ') : 'none'}`);
  console.log(`   New patient phones: ${newPatientPhones.length > 0 ? newPatientPhones.join(', ') : 'none'}`);
  console.log(`   Phones to add:     ${phonesToAdd.length > 0 ? phonesToAdd.join(', ') : 'none'}`);

  let phonesAdded = 0;
  if (!dryRun && phonesToAdd.length > 0) {
    for (const phone of phonesToAdd) {
      try {
        await createUserResourcesForPatient(oystehr, newPatientId, phone);
        phonesAdded++;
        console.log(`   ✅ Added phone ${phone} to new patient`);
      } catch (error) {
        totalErrors++;
        console.error(`   ❌ Failed to add phone ${phone}:`, error instanceof Error ? error.message : error);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 5: Merge Patient record
  //   "Fill in blanks" strategy: new patient keeps its data, gaps are filled
  //   from the old patient's record.
  // ════════════════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📋 Phase 5: Merge Patient Record`);
  console.log(`${'═'.repeat(60)}`);

  // Re-fetch to get latest state (Phase 1 may have updated encounter subjects)
  const [latestOldPatient, latestNewPatient] = await Promise.all([
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: oldPatientId }),
    oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: newPatientId }),
  ]);

  const fieldsFilled = mergePatientFields(latestNewPatient, latestOldPatient);
  if (fieldsFilled.length > 0) {
    console.log(`   Fields to fill from old patient: ${fieldsFilled.join(', ')}`);
    if (dryRun) {
      allPlannedChanges.push({
        resource: `Patient/${newPatientId}`,
        phase: 'patient-merge',
        fieldsToUpdate: fieldsFilled,
        currentValues: Object.fromEntries(fieldsFilled.map((f) => [f, '(to be filled from old patient)'])),
        newValue: '(merged values)',
      });
    } else {
      try {
        await oystehr.fhir.update<Patient>(latestNewPatient);
        allSummary.push({
          resourceType: 'Patient',
          id: newPatientId,
          fieldsUpdated: fieldsFilled,
          phase: 'patient-merge',
        });
        console.log(`   ✅ Patient/${newPatientId} updated with merged fields`);
      } catch (error) {
        totalErrors++;
        console.error(`   ❌ Failed to merge patient record:`, error instanceof Error ? error.message : error);
      }
    }
  } else {
    console.log(`   No fields to fill — new patient record is already complete`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 6: Mark old patient as merged
  //   Sets Patient.active = false and Patient.link = replaced-by → new patient
  // ════════════════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📋 Phase 6: Mark Old Patient as Merged`);
  console.log(`${'═'.repeat(60)}`);

  if (dryRun) {
    allPlannedChanges.push({
      resource: `Patient/${oldPatientId}`,
      phase: 'mark-merged',
      fieldsToUpdate: ['active', 'link'],
      currentValues: {
        active: String(latestOldPatient.active ?? true),
        link: JSON.stringify(latestOldPatient.link || []),
      },
      newValue: `active=false, link=[{other: ${newPatientRef}, type: replaced-by}]`,
    });
    console.log(`   Would set Patient/${oldPatientId}.active = false`);
    console.log(`   Would add Patient/${oldPatientId}.link = replaced-by → ${newPatientRef}`);
  } else {
    latestOldPatient.active = false;
    latestOldPatient.link = [
      {
        other: { reference: newPatientRef },
        type: 'replaced-by',
      },
    ];
    try {
      await oystehr.fhir.update<Patient>(latestOldPatient);
      allSummary.push({
        resourceType: 'Patient',
        id: oldPatientId,
        fieldsUpdated: ['active', 'link'],
        phase: 'mark-merged',
      });
      console.log(`   ✅ Patient/${oldPatientId} marked as merged (active=false, link=replaced-by)`);
    } catch (error) {
      totalErrors++;
      console.error(`   ❌ Failed to mark patient as merged:`, error instanceof Error ? error.message : error);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Final Summary
  // ════════════════════════════════════════════════════════════════════════════
  if (dryRun) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFilename = `merge-dry-run-${oldPatientId}-${timestamp}.json`;
    const reportPath = path.join(__dirname, reportFilename);

    const report = {
      dryRun: true,
      timestamp: new Date().toISOString(),
      oldPatientId,
      oldPatientName,
      newPatientId,
      newPatientName,
      summary: {
        totalPlannedChanges: allPlannedChanges.length,
        byPhase: {
          visits: allPlannedChanges.filter((c) => c.phase === 'visits').length,
          patientLevel: allPlannedChanges.filter((c) => c.phase === 'patient-level').length,
          billing: allPlannedChanges.filter((c) => c.phase === 'billing').length,
          patientMerge: allPlannedChanges.filter((c) => c.phase === 'patient-merge').length,
          markMerged: allPlannedChanges.filter((c) => c.phase === 'mark-merged').length,
        },
        loginPhones: { oldPatientPhones, newPatientPhones, phonesToAdd },
        patientMergeFields: fieldsFilled,
      },
      plannedChanges: allPlannedChanges,
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📋 Dry Run Summary`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`   Old Patient: ${oldPatientName} [${oldPatientId}]`);
    console.log(`   New Patient: ${newPatientName} [${newPatientId}]`);
    console.log(`   ─────────────────────────────`);
    console.log(`   Visits:          ${appointments.length} appointment(s)`);
    console.log(`   Visit resources: ${allPlannedChanges.filter((c) => c.phase === 'visits').length}`);
    console.log(`   Patient-level:   ${allPlannedChanges.filter((c) => c.phase === 'patient-level').length}`);
    console.log(`   Billing:         ${allPlannedChanges.filter((c) => c.phase === 'billing').length}`);
    console.log(`   Phones to add:   ${phonesToAdd.length}`);
    console.log(`   Patient merge:   ${fieldsFilled.length > 0 ? fieldsFilled.join(', ') : 'none'}`);
    console.log(`   ─────────────────────────────`);
    console.log(`   Total changes:   ${allPlannedChanges.length}`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`\n📄 Report: ${reportPath}`);
    console.log('\n✅ Dry run complete — no changes were made.');
  } else {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📋 Merge Summary`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`   Old Patient: ${oldPatientName} [${oldPatientId}]`);
    console.log(`   New Patient: ${newPatientName} [${newPatientId}]`);
    console.log(`   ─────────────────────────────`);
    console.log(`   Resources updated: ${allSummary.length}`);
    console.log(`     - Visits:        ${allSummary.filter((s) => s.phase === 'visits').length}`);
    console.log(`     - Patient-level: ${allSummary.filter((s) => s.phase === 'patient-level').length}`);
    console.log(`     - Billing:       ${allSummary.filter((s) => s.phase === 'billing').length}`);
    console.log(`     - Patient merge: ${allSummary.filter((s) => s.phase === 'patient-merge').length}`);
    console.log(`     - Mark merged:   ${allSummary.filter((s) => s.phase === 'mark-merged').length}`);
    console.log(`   Phones added:      ${phonesAdded}`);
    console.log(`   Skipped:           ${totalSkipped}`);
    console.log(`   Errors:            ${totalErrors}`);
    console.log(`${'═'.repeat(60)}\n`);

    if (totalErrors > 0) {
      console.error('⚠️  Some resources failed to update. Review the errors above.');
      process.exit(1);
    }

    console.log('✅ Patient merge completed successfully.');
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
