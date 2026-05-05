import Oystehr, { BatchInputPutRequest } from '@oystehr/sdk';
import {
  Account,
  Appointment,
  AuditEvent,
  ChargeItem,
  Consent,
  Coverage,
  DocumentReference,
  Encounter,
  FhirResource,
  List,
  MedicationAdministration,
  Patient,
  QuestionnaireResponse,
  RelatedPerson,
  Resource,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AUDIT_EVENT_OUTCOME_CODE,
  ChartDataRequestedFields,
  createUserResourcesForPatient,
  flattenQuestionnaireAnswers,
  getCoding,
  PATIENT_RECORD_QUESTIONNAIRE,
  PRIVATE_EXTENSION_BASE_URL,
  Secrets,
} from 'utils';
import { getStripeClient } from '../../shared';
import { getChartData } from '../get-chart-data';
import {
  accountMatchesType,
  createMasterRecordPatchOperations,
  createUpdatePharmacyPatchOps,
  getAccountAndCoverageResourcesForPatient,
  updatePatientAccountFromQuestionnaire,
  updateStripeCustomer,
} from '../shared/harvest';

export interface PerformMergeInput {
  mainPatientId: string;
  otherPatientId: string;
  questionnaireResponse: QuestionnaireResponse;
  providerProfileReference: string;
  secrets: Secrets | null;
}

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

function patchPatientRef(resource: Resource, oldPatientId: string, newPatientRef: string): string[] {
  const updated: string[] = [];
  const r = resource as any;
  const oldRef = `Patient/${oldPatientId}`;

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

async function getEncounterForAppointment(appointmentId: string, oystehr: Oystehr): Promise<Encounter | undefined> {
  const encounters = (
    await oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [{ name: 'appointment', value: `Appointment/${appointmentId}` }],
    })
  ).unbundle();
  return encounters[0];
}

async function collectEncounterResources(
  oystehr: Oystehr,
  m2mToken: string,
  encounterId: string,
  otherPatientId: string,
  newPatientRef: string,
  processedIds: Set<string>
): Promise<FhirResource[]> {
  const { chartResources: defaultResources } = await getChartData(oystehr, m2mToken, encounterId);
  const { chartResources: conditionalResources } = await getChartData(
    oystehr,
    m2mToken,
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

  const resourceMap = new Map<string, Resource>();
  for (const r of [
    ...defaultResources,
    ...conditionalResources,
    ...immunizationResources,
    ...medicationOrderResources,
  ]) {
    if (r.id) resourceMap.set(`${r.resourceType}/${r.id}`, r);
  }

  const visitResources = Array.from(resourceMap.values()).filter((r) => !processedIds.has(`${r.resourceType}/${r.id}`));

  const resourcesToUpdate: FhirResource[] = [];
  for (const resource of visitResources) {
    const rid = `${resource.resourceType}/${resource.id}`;
    processedIds.add(rid);
    const fieldsUpdated = patchPatientRef(resource, otherPatientId, newPatientRef);
    if (fieldsUpdated.length === 0) continue;
    resourcesToUpdate.push(resource as FhirResource);
  }
  return resourcesToUpdate;
}

export async function performMerge(input: PerformMergeInput, oystehr: Oystehr, m2mToken: string): Promise<void> {
  const { mainPatientId, otherPatientId, questionnaireResponse } = input;
  const oldPatientRef = `Patient/${otherPatientId}`;
  const newPatientRef = `Patient/${mainPatientId}`;

  const processedIds = new Set<string>();
  const requests: BatchInputPutRequest<FhirResource>[] = [];

  // ════════════════════════════════════════════════════════════════════════
  // Step 1: Apply merged patient record fields via update-patient-account logic
  // ════════════════════════════════════════════════════════════════════════
  console.log('Step 1: Applying merged patient record fields');

  const items = questionnaireResponse.item ?? [];
  if (items.length > 0) {
    const questionnaire = PATIENT_RECORD_QUESTIONNAIRE();

    let patientResource = await oystehr.fhir.get<Patient>({
      resourceType: 'Patient',
      id: mainPatientId,
    });

    const questionnaireForEnableWhenFiltering = questionnaire;
    const patientPatchOps = createMasterRecordPatchOperations(
      {
        questionnaireResponseItems: items,
        sourceQuestionnaire: questionnaireForEnableWhenFiltering,
        options: { filterByEnableWhen: true },
      },
      patientResource
    );

    if (patientPatchOps.patient.patchOpsForDirectUpdate.length > 0) {
      console.log(`  Patching patient with ${patientPatchOps.patient.patchOpsForDirectUpdate.length} operations`);
      try {
        patientResource = await oystehr.fhir.patch({
          resourceType: 'Patient',
          id: patientResource.id!,
          operations: patientPatchOps.patient.patchOpsForDirectUpdate,
        });
      } catch (error: any) {
        console.error(
          `Error: Step 1 patient patch failed for Patient/${mainPatientId}.`,
          'message:',
          error?.message,
          'cause:',
          JSON.stringify(error?.cause ?? null),
          'operations:',
          JSON.stringify(patientPatchOps.patient.patchOpsForDirectUpdate)
        );
        throw new Error(`Step 1: failed to patch main patient: ${error?.message ?? 'unknown error'}.`);
      }
    }

    const pharmacyPatchOps = createUpdatePharmacyPatchOps(patientResource, flattenQuestionnaireAnswers(items));
    if (pharmacyPatchOps.length > 0) {
      try {
        await oystehr.fhir.patch<Patient>({
          resourceType: 'Patient',
          id: patientResource.id!,
          operations: pharmacyPatchOps,
        });
      } catch (error: any) {
        console.error(
          `Error: Step 1 pharmacy patch failed for Patient/${mainPatientId}.`,
          'message:',
          error?.message,
          'operations:',
          JSON.stringify(pharmacyPatchOps)
        );
        throw new Error(`Step 1: failed to apply pharmacy patch: ${error?.message ?? 'unknown error'}.`);
      }
    }

    try {
      await updatePatientAccountFromQuestionnaire(
        {
          questionnaireResponseItem: items,
          patientId: mainPatientId,
          patient: patientResource,
          preserveOmittedCoverages: true,
          questionnaireForEnableWhenFiltering,
        },
        oystehr
      );
    } catch (error: any) {
      console.error(
        `Error: Step 1 updatePatientAccountFromQuestionnaire failed for Patient/${mainPatientId}.`,
        'message:',
        error?.message,
        'cause:',
        JSON.stringify(error?.cause ?? null)
      );
      throw new Error(
        `Step 1: failed to update patient account/coverage from questionnaire: ${error?.message ?? 'unknown error'}.`
      );
    }

    try {
      const { account, guarantorResource } = await getAccountAndCoverageResourcesForPatient(mainPatientId, oystehr);
      const stripeClient = getStripeClient(input.secrets);
      if (account && guarantorResource) {
        await updateStripeCustomer({ account, guarantorResource, stripeClient });
      }
    } catch (e) {
      console.error('Error updating stripe details (non-fatal)', e);
    }

    console.log('  Patient record fields merged successfully');
  }

  // ════════════════════════════════════════════════════════════════════════
  // Step 2: Collect all visits (appointments + encounters + visit resources)
  // ════════════════════════════════════════════════════════════════════════
  console.log('Step 2: Collecting visits');

  const appointments = (
    await oystehr.fhir.search<Appointment>({
      resourceType: 'Appointment',
      params: [
        { name: 'actor', value: oldPatientRef },
        { name: '_count', value: '1000' },
      ],
    })
  ).unbundle();

  console.log(`  Found ${appointments.length} appointment(s) for other patient`);

  for (const appointment of appointments) {
    const apptId = appointment.id!;
    const hasOldParticipant = appointment.participant.some((p) => p.actor?.reference === oldPatientRef);

    if (hasOldParticipant) {
      appointment.participant = appointment.participant.map((p) => {
        if (p.actor?.reference === oldPatientRef) {
          return { ...p, actor: { ...p.actor, reference: newPatientRef } };
        }
        return p;
      });
      processedIds.add(`Appointment/${apptId}`);
      requests.push({ method: 'PUT', url: `/Appointment/${apptId}`, resource: appointment });
    }

    const encounter = await getEncounterForAppointment(apptId, oystehr);
    if (!encounter?.id) continue;
    const encounterId = encounter.id;

    const visitResources = await collectEncounterResources(
      oystehr,
      m2mToken,
      encounterId,
      otherPatientId,
      newPatientRef,
      processedIds
    );
    for (const r of visitResources) {
      requests.push({ method: 'PUT', url: `/${r.resourceType}/${r.id}`, resource: r });
    }

    encounter.subject = { reference: newPatientRef };
    processedIds.add(`Encounter/${encounterId}`);
    requests.push({ method: 'PUT', url: `/Encounter/${encounterId}`, resource: encounter });
  }

  const remainingEncounters = (
    await oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [
        { name: 'subject', value: oldPatientRef },
        { name: '_count', value: '1000' },
      ],
    })
  ).unbundle();

  for (const enc of remainingEncounters) {
    if (!enc.id || processedIds.has(`Encounter/${enc.id}`)) continue;
    const encId = enc.id;
    processedIds.add(`Encounter/${encId}`);

    const visitResources = await collectEncounterResources(
      oystehr,
      m2mToken,
      encId,
      otherPatientId,
      newPatientRef,
      processedIds
    );
    for (const r of visitResources) {
      requests.push({ method: 'PUT', url: `/${r.resourceType}/${r.id}`, resource: r });
    }

    enc.subject = { reference: newPatientRef };
    requests.push({ method: 'PUT', url: `/Encounter/${encId}`, resource: enc });
    console.log(`  Collected remaining Encounter/${encId}`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Step 3: Patient-level resources (QR, Consent, DocRef, RelatedPerson)
  // ════════════════════════════════════════════════════════════════════════
  console.log('Step 3: Collecting patient-level resources');

  const qrs = (
    await oystehr.fhir.search<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      params: [
        { name: 'subject', value: oldPatientRef },
        { name: '_count', value: '1000' },
      ],
    })
  ).unbundle();
  for (const qr of qrs) {
    if (!qr.id || processedIds.has(`QuestionnaireResponse/${qr.id}`)) continue;
    processedIds.add(`QuestionnaireResponse/${qr.id}`);
    qr.subject = { reference: newPatientRef };
    requests.push({ method: 'PUT', url: `/QuestionnaireResponse/${qr.id}`, resource: qr as FhirResource });
  }

  const consents = (
    await oystehr.fhir.search<Consent>({
      resourceType: 'Consent',
      params: [
        { name: 'patient', value: oldPatientRef },
        { name: '_count', value: '1000' },
      ],
    })
  ).unbundle();
  for (const consent of consents) {
    if (!consent.id || processedIds.has(`Consent/${consent.id}`)) continue;
    processedIds.add(`Consent/${consent.id}`);
    consent.patient = { reference: newPatientRef };
    requests.push({ method: 'PUT', url: `/Consent/${consent.id}`, resource: consent as FhirResource });
  }

  const docRefs = (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        { name: 'subject', value: oldPatientRef },
        { name: '_count', value: '1000' },
      ],
    })
  ).unbundle();
  for (const docRef of docRefs) {
    if (!docRef.id || processedIds.has(`DocumentReference/${docRef.id}`)) continue;
    processedIds.add(`DocumentReference/${docRef.id}`);
    docRef.subject = { reference: newPatientRef };
    requests.push({ method: 'PUT', url: `/DocumentReference/${docRef.id}`, resource: docRef as FhirResource });
  }

  // Document folders (List) — migrate entries between patients' folders.
  const [oldPatientLists, mainPatientLists] = await Promise.all([
    oystehr.fhir
      .search<List>({
        resourceType: 'List',
        params: [
          { name: 'subject', value: oldPatientRef },
          { name: 'code', value: 'patient-docs-folder' },
          { name: '_count', value: '100' },
        ],
      })
      .then((r) => r.unbundle()),
    oystehr.fhir
      .search<List>({
        resourceType: 'List',
        params: [
          { name: 'subject', value: newPatientRef },
          { name: 'code', value: 'patient-docs-folder' },
          { name: '_count', value: '100' },
        ],
      })
      .then((r) => r.unbundle()),
  ]);

  const mainListsToPatch = new Map<string, List>();
  for (const oldList of oldPatientLists) {
    if (!oldList.id || processedIds.has(`List/${oldList.id}`)) continue;
    const entries = (oldList.entry ?? []).filter((e) => e.item?.reference);
    if (entries.length === 0) {
      processedIds.add(`List/${oldList.id}`);
      continue;
    }

    const mainList = mainPatientLists.find((l) => l.title && l.title === oldList.title);
    if (mainList?.id) {
      const working = mainListsToPatch.get(mainList.id) ?? { ...mainList, entry: [...(mainList.entry ?? [])] };
      const existingRefs = new Set((working.entry ?? []).map((e) => e.item?.reference).filter(Boolean));
      for (const entry of entries) {
        if (!existingRefs.has(entry.item.reference)) {
          working.entry = [...(working.entry ?? []), entry];
          existingRefs.add(entry.item.reference);
        }
      }
      mainListsToPatch.set(mainList.id, working);

      processedIds.add(`List/${oldList.id}`);
      oldList.entry = [];
      requests.push({ method: 'PUT', url: `/List/${oldList.id}`, resource: oldList as FhirResource });
    } else {
      processedIds.add(`List/${oldList.id}`);
      oldList.subject = { reference: newPatientRef };
      requests.push({ method: 'PUT', url: `/List/${oldList.id}`, resource: oldList as FhirResource });
    }
  }

  for (const [listId, list] of mainListsToPatch) {
    processedIds.add(`List/${listId}`);
    requests.push({ method: 'PUT', url: `/List/${listId}`, resource: list as FhirResource });
  }

  const relatedPersons = (
    await oystehr.fhir.search<RelatedPerson>({
      resourceType: 'RelatedPerson',
      params: [
        { name: 'patient', value: oldPatientRef },
        { name: '_count', value: '1000' },
      ],
    })
  ).unbundle();
  const nonUserRelatedPersons = relatedPersons.filter(
    (rp) =>
      getCoding(rp.relationship, `${PRIVATE_EXTENSION_BASE_URL}/relationship`)?.code !== 'user-relatedperson' &&
      rp.id &&
      !processedIds.has(`RelatedPerson/${rp.id}`)
  );
  for (const rp of nonUserRelatedPersons) {
    processedIds.add(`RelatedPerson/${rp.id}`);
    rp.patient = { reference: newPatientRef };
    requests.push({ method: 'PUT', url: `/RelatedPerson/${rp.id}`, resource: rp as FhirResource });
  }

  const clinicalSearches = [
    { resourceType: 'AllergyIntolerance' as const, searchParam: 'patient' },
    { resourceType: 'Condition' as const, searchParam: 'subject' },
    { resourceType: 'MedicationStatement' as const, searchParam: 'subject' },
    { resourceType: 'Procedure' as const, searchParam: 'subject' },
    { resourceType: 'Observation' as const, searchParam: 'subject' },
    { resourceType: 'Communication' as const, searchParam: 'subject' },
    { resourceType: 'ServiceRequest' as const, searchParam: 'subject' },
    { resourceType: 'MedicationRequest' as const, searchParam: 'subject' },
    { resourceType: 'ClinicalImpression' as const, searchParam: 'subject' },
    { resourceType: 'EpisodeOfCare' as const, searchParam: 'patient' },
    { resourceType: 'MedicationAdministration' as const, searchParam: 'subject' },
  ];

  for (const { resourceType, searchParam } of clinicalSearches) {
    const resources = (
      await oystehr.fhir.search<FhirResource>({
        resourceType,
        params: [
          { name: searchParam, value: oldPatientRef },
          { name: '_count', value: '1000' },
        ],
      })
    ).unbundle();

    let count = 0;
    for (const resource of resources) {
      const rid = `${resource.resourceType}/${resource.id}`;
      if (!resource.id || processedIds.has(rid)) continue;
      processedIds.add(rid);
      const fieldsUpdated = patchPatientRef(resource, otherPatientId, newPatientRef);
      if (fieldsUpdated.length === 0) continue;
      requests.push({ method: 'PUT', url: `/${rid}`, resource: resource as FhirResource });
      count++;
    }
    if (count > 0) console.log(`  Transferred ${count} ${resourceType} resource(s)`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Step 4: Billing resources (Account, Coverage, ChargeItem)
  // ════════════════════════════════════════════════════════════════════════
  console.log('Step 4: Collecting billing resources');

  const [oldPatientAccountsRaw, mainPatientAccountsRaw] = await Promise.all([
    oystehr.fhir
      .search<Account>({
        resourceType: 'Account',
        params: [
          { name: 'patient', value: oldPatientRef },
          { name: '_count', value: '100' },
        ],
      })
      .then((r) => r.unbundle()),
    oystehr.fhir
      .search<Account>({
        resourceType: 'Account',
        params: [
          { name: 'patient', value: newPatientRef },
          { name: '_count', value: '100' },
        ],
      })
      .then((r) => r.unbundle()),
  ]);

  const isActive = (a: Account): boolean => a.status === 'active';
  const mainActiveAccounts = mainPatientAccountsRaw.filter(isActive);

  const accountIdRedirects = new Map<string, string>();
  const mainAccountUpdates = new Map<string, Account>();

  const dedupedRefs = <T extends { reference?: string } | undefined>(items: T[] | undefined): Set<string> =>
    new Set((items ?? []).map((i) => (i as any)?.reference).filter((s): s is string => !!s));

  const consolidateCoverages = (
    main: Account['coverage'] = [],
    other: Account['coverage'] = []
  ): Account['coverage'] => {
    const seen = dedupedRefs((main ?? []).map((c) => c.coverage));
    const merged = [...(main ?? [])];
    for (const c of other ?? []) {
      if (c.coverage?.reference && !seen.has(c.coverage.reference)) {
        merged.push(c);
        seen.add(c.coverage.reference);
      }
    }
    return merged;
  };

  const consolidateGuarantors = (
    mainAccount: Account,
    other: Account
  ): { guarantor: Account['guarantor']; contained: Account['contained'] } => {
    const mainGuarantor = mainAccount.guarantor ?? [];
    const mainContained = mainAccount.contained ?? [];

    if (mainGuarantor.length > 0) {
      return { guarantor: mainGuarantor, contained: mainContained };
    }

    const containedIds = new Set((mainContained ?? []).map((c) => c.id).filter((id): id is string => !!id));
    const newGuarantor: NonNullable<Account['guarantor']> = [];
    const newContained = [...(mainContained ?? [])];

    for (const g of other.guarantor ?? []) {
      const ref = g.party?.reference;
      if (!ref) continue;
      if (ref.startsWith('#')) {
        const sourceId = ref.substring(1);
        const source = (other.contained ?? []).find((c) => c.id === sourceId);
        if (!source) continue;
        let uniqueId = sourceId;
        let suffix = 1;
        while (containedIds.has(uniqueId)) {
          uniqueId = `${sourceId}-${suffix++}`;
        }
        containedIds.add(uniqueId);
        newContained.push({ ...source, id: uniqueId });
        newGuarantor.push({ ...g, party: { ...g.party!, reference: `#${uniqueId}` } });
      } else {
        const repointed = ref === oldPatientRef ? { ...g, party: { ...g.party!, reference: newPatientRef } } : g;
        newGuarantor.push(repointed);
      }
    }
    return { guarantor: newGuarantor, contained: newContained };
  };

  for (const oldAccount of oldPatientAccountsRaw) {
    if (!oldAccount.id || processedIds.has(`Account/${oldAccount.id}`)) continue;
    processedIds.add(`Account/${oldAccount.id}`);

    const mainMatch = isActive(oldAccount)
      ? mainActiveAccounts.find(
          (m) => m.id !== oldAccount.id && oldAccount.type && accountMatchesType(m, oldAccount.type)
        )
      : undefined;

    if (mainMatch?.id) {
      const working = mainAccountUpdates.get(mainMatch.id) ?? { ...mainMatch };
      working.coverage = consolidateCoverages(working.coverage, oldAccount.coverage);
      const { guarantor, contained } = consolidateGuarantors(working, oldAccount);
      working.guarantor = guarantor;
      working.contained = contained;
      mainAccountUpdates.set(mainMatch.id, working);

      if (oldAccount.subject) {
        for (const subj of oldAccount.subject) {
          if (subj.reference === oldPatientRef) subj.reference = newPatientRef;
        }
      }
      if (oldAccount.guarantor) {
        for (const g of oldAccount.guarantor) {
          if (g.party?.reference === oldPatientRef) g.party.reference = newPatientRef;
        }
      }
      oldAccount.status = 'inactive';
      accountIdRedirects.set(oldAccount.id, mainMatch.id);
      requests.push({ method: 'PUT', url: `/Account/${oldAccount.id}`, resource: oldAccount as FhirResource });
      console.log(`  Consolidated Account/${oldAccount.id} into Account/${mainMatch.id}`);
    } else {
      let changed = false;
      if (oldAccount.subject) {
        for (const subj of oldAccount.subject) {
          if (subj.reference === oldPatientRef) {
            subj.reference = newPatientRef;
            changed = true;
          }
        }
      }
      if (oldAccount.guarantor) {
        for (const g of oldAccount.guarantor) {
          if (g.party?.reference === oldPatientRef) {
            g.party.reference = newPatientRef;
            changed = true;
          }
        }
      }
      if (changed) {
        requests.push({ method: 'PUT', url: `/Account/${oldAccount.id}`, resource: oldAccount as FhirResource });
      }
    }
  }

  for (const [id, acct] of mainAccountUpdates) {
    requests.push({ method: 'PUT', url: `/Account/${id}`, resource: acct as FhirResource });
  }

  const coverages = (
    await oystehr.fhir.search<Coverage>({
      resourceType: 'Coverage',
      params: [
        { name: 'patient', value: oldPatientRef },
        { name: '_count', value: '100' },
      ],
    })
  ).unbundle();
  for (const coverage of coverages) {
    if (!coverage.id || processedIds.has(`Coverage/${coverage.id}`)) continue;
    processedIds.add(`Coverage/${coverage.id}`);
    let changed = false;
    if (coverage.beneficiary?.reference === oldPatientRef) {
      coverage.beneficiary.reference = newPatientRef;
      changed = true;
    }
    if (coverage.subscriber?.reference === oldPatientRef) {
      coverage.subscriber!.reference = newPatientRef;
      changed = true;
    }
    if (!changed) continue;
    requests.push({ method: 'PUT', url: `/Coverage/${coverage.id}`, resource: coverage as FhirResource });
  }

  const chargeItems = (
    await oystehr.fhir.search<ChargeItem>({
      resourceType: 'ChargeItem',
      params: [
        { name: 'subject', value: oldPatientRef },
        { name: '_count', value: '1000' },
      ],
    })
  ).unbundle();
  for (const ci of chargeItems) {
    if (!ci.id || processedIds.has(`ChargeItem/${ci.id}`)) continue;
    processedIds.add(`ChargeItem/${ci.id}`);
    const fieldsUpdated = patchPatientRef(ci, otherPatientId, newPatientRef);
    if (fieldsUpdated.length === 0) continue;
    requests.push({ method: 'PUT', url: `/ChargeItem/${ci.id}`, resource: ci as FhirResource });
  }

  if (accountIdRedirects.size > 0) {
    for (const req of requests) {
      const r = req.resource as { resourceType?: string; account?: { reference?: string }[] } | undefined;
      if (!r || (r.resourceType !== 'Encounter' && r.resourceType !== 'ChargeItem')) continue;
      if (!Array.isArray(r.account)) continue;
      for (const ref of r.account) {
        const match = ref?.reference?.match(/^Account\/(.+)$/);
        const oldId = match?.[1];
        if (oldId && accountIdRedirects.has(oldId)) {
          ref.reference = `Account/${accountIdRedirects.get(oldId)}`;
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Step 5: Mark other patient as merged (add to transaction)
  // ════════════════════════════════════════════════════════════════════════
  console.log('Step 5: Marking other patient as merged');

  const otherPatient = await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: otherPatientId });
  otherPatient.active = false;
  const existingLinks = otherPatient.link ?? [];
  const replacedByLink = {
    other: { reference: newPatientRef },
    type: 'replaced-by' as const,
  };
  const hasReplacedByLink = existingLinks.some(
    (link) => link.type === replacedByLink.type && link.other?.reference === replacedByLink.other.reference
  );
  otherPatient.link = hasReplacedByLink ? existingLinks : [...existingLinks, replacedByLink];
  requests.push({ method: 'PUT', url: `/Patient/${otherPatientId}`, resource: otherPatient });

  // ════════════════════════════════════════════════════════════════════════
  // Execute Steps 2–5 as a single atomic transaction.
  // ════════════════════════════════════════════════════════════════════════
  console.log(`Executing FHIR transaction with ${requests.length} operations`);
  try {
    await oystehr.fhir.transaction({ requests });
  } catch (error: any) {
    const requestSummary = requests.map((r) => `${r.method} ${r.url}`);
    console.error(
      `Error: FHIR transaction failed (${requests.length} operations).`,
      'message:',
      error?.message,
      'cause:',
      JSON.stringify(error?.cause ?? null),
      'requests:',
      JSON.stringify(requestSummary)
    );
    throw new Error(
      `Merge transaction failed: ${error?.message ?? 'unknown error'}. See logs for the failing operation list.`
    );
  }
  console.log(`Merge complete: ${requests.length} resources updated`);

  // ════════════════════════════════════════════════════════════════════════
  // Step 6: Write audit event
  // ════════════════════════════════════════════════════════════════════════
  console.log('Step 6: Writing audit event');

  const auditEvent: AuditEvent = {
    resourceType: 'AuditEvent',
    type: {
      system: 'http://terminology.hl7.org/CodeSystem/iso-21089-lifecycle',
      code: 'merge',
      display: 'Merge Record Lifecycle Event',
    },
    recorded: DateTime.now().toISO(),
    outcome: AUDIT_EVENT_OUTCOME_CODE.success,
    agent: [
      {
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'AUT',
              display: 'author (originator)',
            },
          ],
        },
        who: {
          reference: input.providerProfileReference,
        },
        requestor: true,
      },
    ],
    source: {
      site: 'Ottehr',
      observer: {
        reference: input.providerProfileReference,
      },
    },
    entity: [
      {
        what: { reference: newPatientRef },
        role: {
          system: 'http://terminology.hl7.org/CodeSystem/object-role',
          code: '1',
          display: 'Patient',
        },
        description: 'Surviving (main) patient record',
      },
      {
        what: { reference: oldPatientRef },
        role: {
          system: 'http://terminology.hl7.org/CodeSystem/object-role',
          code: '1',
          display: 'Patient',
        },
        description: 'Merged (deprecated) patient record',
      },
    ],
  };
  try {
    const ae = await oystehr.fhir.create(auditEvent);
    console.log(`  Wrote audit event: AuditEvent/${ae.id}`);
  } catch (error: any) {
    console.error(
      `Error: Step 6 failed to write audit event (non-fatal).`,
      'message:',
      error?.message,
      'cause:',
      JSON.stringify(error?.cause ?? null)
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // Step 7: Transfer login phone numbers (after transaction to avoid partial state)
  // ════════════════════════════════════════════════════════════════════════
  console.log('Step 7: Transferring login phone numbers');

  try {
    const oldPatientPhones = await getLoginPhoneNumbers(oystehr, otherPatientId);
    const newPatientPhones = await getLoginPhoneNumbers(oystehr, mainPatientId);
    const phonesToAdd = oldPatientPhones.filter((p) => !newPatientPhones.includes(p));

    for (const phone of phonesToAdd) {
      try {
        await createUserResourcesForPatient(oystehr, mainPatientId, phone);
        console.log(`  Added phone ${phone} to main patient`);
      } catch (error: any) {
        console.error(
          `Error: Step 7 failed to add phone ${phone} to Patient/${mainPatientId} (non-fatal).`,
          'message:',
          error?.message
        );
      }
    }
  } catch (error: any) {
    console.error(`Error: Step 7 failed to enumerate login phone numbers (non-fatal).`, 'message:', error?.message);
  }
}
