import Oystehr, { BatchInputPutRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
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
import {
  ChartDataRequestedFields,
  createUserResourcesForPatient,
  flattenQuestionnaireAnswers,
  getCoding,
  getSecret,
  isValidUUID,
  MergePatientsResponse,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  NOT_AUTHORIZED,
  PATIENT_RECORD_QUESTIONNAIRE,
  PRIVATE_EXTENSION_BASE_URL,
  QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR,
  Secrets,
  SecretsKeys,
  userMe,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getStripeClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { getChartData } from '../get-chart-data';
import {
  createMasterRecordPatchOperations,
  createUpdatePharmacyPatchOps,
  getAccountAndCoverageResourcesForPatient,
  updatePatientAccountFromQuestionnaire,
  updateStripeCustomer,
} from '../shared/harvest';

const ZAMBDA_NAME = 'merge-patients';

let m2mToken: string;

// ─── Chart data fields for visit resource collection ──────────────────────────

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

// function resourceReferencesEncounter(resource: Resource, encounterId: string): boolean {
//   const encounterRef = `Encounter/${encounterId}`;
//   const r = resource as any;
//   if (r.encounter?.reference === encounterRef) return true;
//   if (r.context?.reference === encounterRef) return true;
//   if (Array.isArray(r.context?.encounter)) {
//     if (r.context.encounter.some((e: any) => e.reference === encounterRef)) return true;
//   }
//   if (r.focus?.reference === encounterRef) return true;
//   return false;
// }

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

// ─── Handler ──────────────────────────────────────────────────────────────────

interface BasicInput {
  userToken: string;
  secrets: Secrets | null;
  mainPatientId: string;
  otherPatientId: string;
  questionnaireResponse: QuestionnaireResponse;
}

interface FinishedInput extends BasicInput {
  providerProfileReference: string;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success');
    const { secrets } = validatedParameters;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const effectInput = await complexValidation(validatedParameters);
    await performEffect(effectInput, oystehr);
    const response: MergePatientsResponse = { result: 'success' };
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const validateRequestParameters = (input: ZambdaInput): BasicInput => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  const userToken = input.headers.Authorization.replace('Bearer ', '');
  if (!userToken) {
    throw new Error('user token unexpectedly missing');
  }
  const { secrets } = input;
  const { mainPatientId, otherPatientId, questionnaireResponse } = JSON.parse(input.body);

  if (!mainPatientId || !otherPatientId) {
    throw MISSING_REQUIRED_PARAMETERS(['mainPatientId', 'otherPatientId']);
  }
  if (!isValidUUID(mainPatientId) || !isValidUUID(otherPatientId)) {
    throw new Error('mainPatientId and otherPatientId must be valid UUIDs');
  }
  if (mainPatientId === otherPatientId) {
    throw new Error('mainPatientId and otherPatientId must be different');
  }
  if (!questionnaireResponse) {
    throw MISSING_REQUIRED_PARAMETERS(['questionnaireResponse']);
  }
  if (questionnaireResponse.resourceType !== 'QuestionnaireResponse') {
    throw QUESTIONNAIRE_RESPONSE_INVALID_CUSTOM_ERROR('questionnaireResponse must be of type QuestionnaireResponse');
  }

  return { userToken, secrets, mainPatientId, otherPatientId, questionnaireResponse };
};

const complexValidation = async (input: BasicInput): Promise<FinishedInput> => {
  const { secrets, userToken } = input;
  const user = await userMe(userToken, secrets);
  if (!user) {
    throw NOT_AUTHORIZED;
  }
  const providerProfileReference = user.profile;
  if (!providerProfileReference) {
    throw NOT_AUTHORIZED;
  }
  return { ...input, providerProfileReference };
};

/**
 * Collects all resources tied to an encounter (chart data, immunizations,
 * medication orders), re-points their patient references in memory,
 * and returns them for batch submission (no writes).
 */
async function collectEncounterResources(
  oystehr: Oystehr,
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

const performEffect = async (input: FinishedInput, oystehr: Oystehr): Promise<void> => {
  const { mainPatientId, otherPatientId, questionnaireResponse } = input;
  const oldPatientRef = `Patient/${otherPatientId}`;
  const newPatientRef = `Patient/${mainPatientId}`;

  // Track processed resource IDs to avoid double-processing
  const processedIds = new Set<string>();
  // Collect all PUT requests for a single atomic transaction (Steps 2–4, 6)
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

    // Same logic as update-patient-account zambda's performEffect
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
      patientResource = await oystehr.fhir.patch({
        resourceType: 'Patient',
        id: patientResource.id!,
        operations: patientPatchOps.patient.patchOpsForDirectUpdate,
      });
    }

    const pharmacyPatchOps = createUpdatePharmacyPatchOps(patientResource, flattenQuestionnaireAnswers(items));
    if (pharmacyPatchOps.length > 0) {
      await oystehr.fhir.patch<Patient>({
        resourceType: 'Patient',
        id: patientResource.id!,
        operations: pharmacyPatchOps,
      });
    }

    // Update Account, Coverage, RelatedPerson (guarantor/emergency), Organization (employer)
    await updatePatientAccountFromQuestionnaire(
      {
        questionnaireResponseItem: items,
        patientId: mainPatientId,
        preserveOmittedCoverages: true,
        questionnaireForEnableWhenFiltering,
      },
      oystehr
    );

    // Update Stripe customer
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

    // Collect visit-connected resources BEFORE modifying encounter subject,
    // because getChartData resolves the patient from encounter.subject
    const visitResources = await collectEncounterResources(
      oystehr,
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

  // Collect any remaining encounters by subject (e.g. follow-up encounters
  // that are not linked through an appointment)
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

    // Collect resources BEFORE modifying encounter subject
    const visitResources = await collectEncounterResources(oystehr, encId, otherPatientId, newPatientRef, processedIds);
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

  // QuestionnaireResponse
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

  // Consent
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

  // DocumentReference (patient-level)
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

  // RelatedPerson (non-user — guarantor, emergency contact, etc.)
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

  // ════════════════════════════════════════════════════════════════════════
  // Step 4: Billing resources (Account, Coverage, ChargeItem)
  // ════════════════════════════════════════════════════════════════════════
  console.log('Step 4: Collecting billing resources');

  // Account
  const accounts = (
    await oystehr.fhir.search<Account>({
      resourceType: 'Account',
      params: [
        { name: 'patient', value: oldPatientRef },
        { name: '_count', value: '100' },
      ],
    })
  ).unbundle();
  for (const account of accounts) {
    if (!account.id || processedIds.has(`Account/${account.id}`)) continue;
    processedIds.add(`Account/${account.id}`);
    let changed = false;
    if (account.subject) {
      for (const subj of account.subject) {
        if (subj.reference === oldPatientRef) {
          subj.reference = newPatientRef;
          changed = true;
        }
      }
    }
    if (account.guarantor) {
      for (const g of account.guarantor) {
        if (g.party?.reference === oldPatientRef) {
          g.party.reference = newPatientRef;
          changed = true;
        }
      }
    }
    if (!changed) continue;
    requests.push({ method: 'PUT', url: `/Account/${account.id}`, resource: account as FhirResource });
  }

  // Coverage
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

  // ChargeItem
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

  // ════════════════════════════════════════════════════════════════════════
  // Step 5: Transfer login phone numbers (separate — creates new resources)
  // ════════════════════════════════════════════════════════════════════════
  console.log('Step 5: Transferring login phone numbers');

  const oldPatientPhones = await getLoginPhoneNumbers(oystehr, otherPatientId);
  const newPatientPhones = await getLoginPhoneNumbers(oystehr, mainPatientId);
  const phonesToAdd = oldPatientPhones.filter((p) => !newPatientPhones.includes(p));

  for (const phone of phonesToAdd) {
    await createUserResourcesForPatient(oystehr, mainPatientId, phone);
    console.log(`  Added phone ${phone} to main patient`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Step 6: Mark other patient as merged (add to transaction)
  // ════════════════════════════════════════════════════════════════════════
  console.log('Step 6: Marking other patient as merged');

  const otherPatient = await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: otherPatientId });
  otherPatient.active = false;
  otherPatient.link = [
    {
      other: { reference: newPatientRef },
      type: 'replaced-by',
    },
  ];
  requests.push({ method: 'PUT', url: `/Patient/${otherPatientId}`, resource: otherPatient });

  // ════════════════════════════════════════════════════════════════════════
  // Execute single atomic transaction (Steps 2–4, 6)
  // ════════════════════════════════════════════════════════════════════════
  console.log(`Executing transaction with ${requests.length} operations`);
  await oystehr.fhir.transaction({ requests });
  console.log(`Merge complete: ${requests.length} resources updated in a single transaction`);
};
