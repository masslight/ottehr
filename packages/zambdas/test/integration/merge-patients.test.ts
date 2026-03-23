import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import {
  Account,
  Appointment,
  ChargeItem,
  Consent,
  Coverage,
  DocumentReference,
  Encounter,
  Patient,
  QuestionnaireResponse,
  RelatedPerson,
} from 'fhir/r4b';
import { M2MClientMockType, MergePatientsResponse } from 'utils';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Searches for resources linked to a patient that insertInPersonAppointmentBase creates
 * but doesn't return directly (Consent, DocumentReference, Account).
 */
const findPatientLinkedResources = async (
  oystehr: Oystehr,
  patientId: string
): Promise<{
  consents: Consent[];
  documentReferences: DocumentReference[];
  accounts: Account[];
}> => {
  const [consents, documentReferences, accounts] = await Promise.all([
    oystehr.fhir
      .search<Consent>({
        resourceType: 'Consent',
        params: [{ name: 'patient', value: `Patient/${patientId}` }],
      })
      .then((r) => r.unbundle()),
    oystehr.fhir
      .search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [{ name: 'subject', value: `Patient/${patientId}` }],
      })
      .then((r) => r.unbundle()),
    oystehr.fhir
      .search<Account>({
        resourceType: 'Account',
        params: [{ name: 'patient', value: `Patient/${patientId}` }],
      })
      .then((r) => r.unbundle()),
  ]);
  return { consents, documentReferences, accounts };
};

/**
 * Creates a Coverage linked to a Patient (not provided by seed data).
 */
const createTestCoverage = async (oystehr: Oystehr, processId: string, patientId: string): Promise<Coverage> => {
  const resource = addProcessIdMetaTagToResource(
    {
      resourceType: 'Coverage',
      status: 'active',
      beneficiary: { reference: `Patient/${patientId}` },
      subscriber: { reference: `Patient/${patientId}` },
      payor: [{ display: 'Test Insurance' }],
    },
    processId
  ) as Coverage;
  return oystehr.fhir.create<Coverage>(resource);
};

/**
 * Creates a ChargeItem linked to a Patient and Encounter (not provided by seed data).
 */
const createTestChargeItem = async (
  oystehr: Oystehr,
  processId: string,
  patientId: string,
  encounterId: string
): Promise<ChargeItem> => {
  const resource = addProcessIdMetaTagToResource(
    {
      resourceType: 'ChargeItem',
      status: 'billable',
      subject: { reference: `Patient/${patientId}` },
      context: { reference: `Encounter/${encounterId}` },
      code: {
        coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '99213' }],
      },
    },
    processId
  ) as ChargeItem;
  return oystehr.fhir.create<ChargeItem>(resource);
};

/**
 * Builds a minimal QuestionnaireResponse that the merge-patients zambda will accept.
 */
const buildMergeQuestionnaireResponse = (
  mainPatientId: string,
  firstName: string,
  lastName: string
): QuestionnaireResponse => {
  return {
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    subject: { reference: `Patient/${mainPatientId}` },
    item: [
      {
        linkId: 'patient-details-page',
        item: [
          {
            linkId: 'patient-details-section',
            item: [
              {
                linkId: 'patient-first-name',
                answer: [{ valueString: firstName }],
              },
              {
                linkId: 'patient-last-name',
                answer: [{ valueString: lastName }],
              },
            ],
          },
        ],
      },
    ],
  };
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('merge-patients integration tests', () => {
  let oystehrZambdas: Oystehr;
  let oystehrAdmin: Oystehr;
  let processId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('merge-patients.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    oystehrAdmin = setup.oystehr;
    processId = setup.processId;
    cleanup = setup.cleanup;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  // ─── Helper: execute the merge-patients zambda ──────────────────────────────

  const executeMergePatients = async (input: {
    mainPatientId: string;
    otherPatientId: string;
    questionnaireResponse: QuestionnaireResponse;
  }): Promise<{ output: any; error?: Error }> => {
    try {
      const result = await oystehrZambdas.zambda.execute({
        id: 'MERGE-PATIENTS',
        ...input,
      });
      return { output: result.output };
    } catch (error) {
      console.error('Error executing merge-patients zambda:', error);
      return { output: undefined, error: error as Error };
    }
  };

  /**
   * Convenience: inserts a full appointment graph via the seed data.
   * Returns the base resources (patient, appointment, encounter, QR, etc.).
   */
  const insertPatientGraph = async (): Promise<InsertFullAppointmentDataBaseResult> => {
    return insertInPersonAppointmentBase(oystehrAdmin, processId);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // Validation / error cases
  // ═══════════════════════════════════════════════════════════════════════

  describe('validation error cases', () => {
    it('should fail when mainPatientId is missing', async () => {
      const { error } = await executeMergePatients({
        mainPatientId: '',
        otherPatientId: randomUUID(),
        questionnaireResponse: buildMergeQuestionnaireResponse(randomUUID(), 'A', 'B'),
      });
      expect(error).toBeDefined();
    });

    it('should fail when otherPatientId is missing', async () => {
      const { error } = await executeMergePatients({
        mainPatientId: randomUUID(),
        otherPatientId: '',
        questionnaireResponse: buildMergeQuestionnaireResponse(randomUUID(), 'A', 'B'),
      });
      expect(error).toBeDefined();
    });

    it('should fail when mainPatientId equals otherPatientId', async () => {
      const sameId = randomUUID();
      const { error } = await executeMergePatients({
        mainPatientId: sameId,
        otherPatientId: sameId,
        questionnaireResponse: buildMergeQuestionnaireResponse(sameId, 'A', 'B'),
      });
      expect(error).toBeDefined();
    });

    it('should fail when questionnaireResponse is missing resourceType', async () => {
      const { error } = await executeMergePatients({
        mainPatientId: randomUUID(),
        otherPatientId: randomUUID(),
        questionnaireResponse: { status: 'completed', item: [] } as any,
      });
      expect(error).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Step 1: Merged patient record fields
  // ═══════════════════════════════════════════════════════════════════════

  describe('Step 1: apply merged patient record fields', () => {
    it('should update the main patient name from the questionnaire response', async () => {
      const mainResources = await insertPatientGraph();
      const otherResources = await insertPatientGraph();

      const qr = buildMergeQuestionnaireResponse(mainResources.patient.id!, 'MergedFirst', 'MergedLast');

      const { output, error } = await executeMergePatients({
        mainPatientId: mainResources.patient.id!,
        otherPatientId: otherResources.patient.id!,
        questionnaireResponse: qr,
      });

      expect(error).toBeUndefined();
      const typedOutput = output as MergePatientsResponse;
      expect(typedOutput).toBeDefined();
      expect(typedOutput.result).toEqual('success');

      // Verify the main patient was updated
      const updatedMain = await oystehrAdmin.fhir.get<Patient>({
        resourceType: 'Patient',
        id: mainResources.patient.id!,
      });
      const officialName = updatedMain.name?.find((n) => n.use === 'official') ?? updatedMain.name?.[0];
      expect(officialName?.given?.[0]).toEqual('MergedFirst');
      expect(officialName?.family).toEqual('MergedLast');
    }, 120_000);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Step 2: Transfer visits (appointments + encounters)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Step 2: transfer visits', () => {
    it('should transfer appointments and encounters from other patient to main patient', async () => {
      const mainResources = await insertPatientGraph();
      const otherResources = await insertPatientGraph();

      const qr = buildMergeQuestionnaireResponse(mainResources.patient.id!, 'Main', 'Patient');

      const { output, error } = await executeMergePatients({
        mainPatientId: mainResources.patient.id!,
        otherPatientId: otherResources.patient.id!,
        questionnaireResponse: qr,
      });

      expect(error).toBeUndefined();
      expect((output as MergePatientsResponse).result).toEqual('success');

      // Verify appointment now references main patient
      const updatedAppt = await oystehrAdmin.fhir.get<Appointment>({
        resourceType: 'Appointment',
        id: otherResources.appointment.id!,
      });
      const patientParticipant = updatedAppt.participant.find((p) => p.actor?.reference?.startsWith('Patient/'));
      expect(patientParticipant?.actor?.reference).toEqual(`Patient/${mainResources.patient.id}`);

      // Verify encounter subject now references main patient
      const updatedEncounter = await oystehrAdmin.fhir.get<Encounter>({
        resourceType: 'Encounter',
        id: otherResources.encounter.id!,
      });
      expect(updatedEncounter.subject?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    }, 120_000);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Step 3: Transfer patient-level resources
  // ═══════════════════════════════════════════════════════════════════════

  describe('Step 3: transfer patient-level resources', () => {
    it('should transfer QuestionnaireResponses from other patient to main patient', async () => {
      const mainResources = await insertPatientGraph();
      const otherResources = await insertPatientGraph();

      const qr = buildMergeQuestionnaireResponse(mainResources.patient.id!, 'Main', 'Patient');

      const { error } = await executeMergePatients({
        mainPatientId: mainResources.patient.id!,
        otherPatientId: otherResources.patient.id!,
        questionnaireResponse: qr,
      });

      expect(error).toBeUndefined();

      const updatedQR = await oystehrAdmin.fhir.get<QuestionnaireResponse>({
        resourceType: 'QuestionnaireResponse',
        id: otherResources.questionnaireResponse.id!,
      });
      expect(updatedQR.subject?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    }, 120_000);

    it('should transfer Consents from other patient to main patient', async () => {
      const mainResources = await insertPatientGraph();
      const otherResources = await insertPatientGraph();

      // Consent is created by the seed data but not returned directly — search for it
      const { consents: otherConsents } = await findPatientLinkedResources(oystehrAdmin, otherResources.patient.id!);
      expect(otherConsents.length).toBeGreaterThan(0);
      const otherConsentId = otherConsents[0].id!;

      const qr = buildMergeQuestionnaireResponse(mainResources.patient.id!, 'Main', 'Patient');

      const { error } = await executeMergePatients({
        mainPatientId: mainResources.patient.id!,
        otherPatientId: otherResources.patient.id!,
        questionnaireResponse: qr,
      });

      expect(error).toBeUndefined();

      const updatedConsent = await oystehrAdmin.fhir.get<Consent>({
        resourceType: 'Consent',
        id: otherConsentId,
      });
      expect(updatedConsent.patient?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    }, 120_000);

    it('should transfer DocumentReferences from other patient to main patient', async () => {
      const mainResources = await insertPatientGraph();
      const otherResources = await insertPatientGraph();

      // DocumentReferences are created by the seed data but not returned directly
      const { documentReferences: otherDocRefs } = await findPatientLinkedResources(
        oystehrAdmin,
        otherResources.patient.id!
      );
      expect(otherDocRefs.length).toBeGreaterThan(0);
      const otherDocRefId = otherDocRefs[0].id!;

      const qr = buildMergeQuestionnaireResponse(mainResources.patient.id!, 'Main', 'Patient');

      const { error } = await executeMergePatients({
        mainPatientId: mainResources.patient.id!,
        otherPatientId: otherResources.patient.id!,
        questionnaireResponse: qr,
      });

      expect(error).toBeUndefined();

      const updatedDocRef = await oystehrAdmin.fhir.get<DocumentReference>({
        resourceType: 'DocumentReference',
        id: otherDocRefId,
      });
      expect(updatedDocRef.subject?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    }, 120_000);

    it('should transfer non-user RelatedPersons from other patient to main patient', async () => {
      const mainResources = await insertPatientGraph();
      const otherResources = await insertPatientGraph();

      // The seed data creates RelatedPersons; the one returned is one of them
      const otherRPId = otherResources.relatedPerson.id!;

      const qr = buildMergeQuestionnaireResponse(mainResources.patient.id!, 'Main', 'Patient');

      const { error } = await executeMergePatients({
        mainPatientId: mainResources.patient.id!,
        otherPatientId: otherResources.patient.id!,
        questionnaireResponse: qr,
      });

      expect(error).toBeUndefined();

      const updatedRP = await oystehrAdmin.fhir.get<RelatedPerson>({
        resourceType: 'RelatedPerson',
        id: otherRPId,
      });
      expect(updatedRP.patient?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    }, 120_000);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Step 4: Transfer billing resources
  // ═══════════════════════════════════════════════════════════════════════

  describe('Step 4: transfer billing resources', () => {
    it('should transfer Accounts from other patient to main patient', async () => {
      const mainResources = await insertPatientGraph();
      const otherResources = await insertPatientGraph();

      // Accounts are created by the seed data but not returned directly
      const { accounts: otherAccounts } = await findPatientLinkedResources(oystehrAdmin, otherResources.patient.id!);
      expect(otherAccounts.length).toBeGreaterThan(0);
      const otherAccountId = otherAccounts[0].id!;

      const qr = buildMergeQuestionnaireResponse(mainResources.patient.id!, 'Main', 'Patient');

      const { error } = await executeMergePatients({
        mainPatientId: mainResources.patient.id!,
        otherPatientId: otherResources.patient.id!,
        questionnaireResponse: qr,
      });

      expect(error).toBeUndefined();

      const updatedAccount = await oystehrAdmin.fhir.get<Account>({
        resourceType: 'Account',
        id: otherAccountId,
      });
      const subjectRefs = updatedAccount.subject?.map((s) => s.reference) ?? [];
      expect(subjectRefs).toContain(`Patient/${mainResources.patient.id}`);
      expect(subjectRefs).not.toContain(`Patient/${otherResources.patient.id}`);
    }, 120_000);

    it('should transfer Coverages from other patient to main patient', async () => {
      const mainResources = await insertPatientGraph();
      const otherResources = await insertPatientGraph();

      // Coverage is NOT in the seed data — create it manually
      const otherCoverage = await createTestCoverage(oystehrAdmin, processId, otherResources.patient.id!);

      const qr = buildMergeQuestionnaireResponse(mainResources.patient.id!, 'Main', 'Patient');

      const { error } = await executeMergePatients({
        mainPatientId: mainResources.patient.id!,
        otherPatientId: otherResources.patient.id!,
        questionnaireResponse: qr,
      });

      expect(error).toBeUndefined();

      const updatedCoverage = await oystehrAdmin.fhir.get<Coverage>({
        resourceType: 'Coverage',
        id: otherCoverage.id!,
      });
      expect(updatedCoverage.beneficiary?.reference).toEqual(`Patient/${mainResources.patient.id}`);
      expect(updatedCoverage.subscriber?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    }, 120_000);

    it('should transfer ChargeItems from other patient to main patient', async () => {
      const mainResources = await insertPatientGraph();
      const otherResources = await insertPatientGraph();

      // ChargeItem is NOT in the seed data — create it manually
      const otherChargeItem = await createTestChargeItem(
        oystehrAdmin,
        processId,
        otherResources.patient.id!,
        otherResources.encounter.id!
      );

      const qr = buildMergeQuestionnaireResponse(mainResources.patient.id!, 'Main', 'Patient');

      const { error } = await executeMergePatients({
        mainPatientId: mainResources.patient.id!,
        otherPatientId: otherResources.patient.id!,
        questionnaireResponse: qr,
      });

      expect(error).toBeUndefined();

      const updatedChargeItem = await oystehrAdmin.fhir.get<ChargeItem>({
        resourceType: 'ChargeItem',
        id: otherChargeItem.id!,
      });
      expect(updatedChargeItem.subject?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    }, 120_000);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Step 6: Mark other patient as merged
  // ═══════════════════════════════════════════════════════════════════════

  describe('Step 6: mark other patient as merged', () => {
    it('should set active=false and link=replaced-by on the other patient', async () => {
      const mainResources = await insertPatientGraph();
      const otherResources = await insertPatientGraph();

      const qr = buildMergeQuestionnaireResponse(mainResources.patient.id!, 'Main', 'Patient');

      const { output, error } = await executeMergePatients({
        mainPatientId: mainResources.patient.id!,
        otherPatientId: otherResources.patient.id!,
        questionnaireResponse: qr,
      });

      expect(error).toBeUndefined();
      expect((output as MergePatientsResponse).result).toEqual('success');

      const updatedOtherPatient = await oystehrAdmin.fhir.get<Patient>({
        resourceType: 'Patient',
        id: otherResources.patient.id!,
      });

      expect(updatedOtherPatient.active).toBe(false);
      expect(updatedOtherPatient.link).toBeDefined();
      expect(updatedOtherPatient.link).toHaveLength(1);
      expect(updatedOtherPatient.link![0].type).toEqual('replaced-by');
      expect(updatedOtherPatient.link![0].other?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    }, 120_000);

    it('should NOT deactivate the main patient', async () => {
      const mainResources = await insertPatientGraph();
      const otherResources = await insertPatientGraph();

      const qr = buildMergeQuestionnaireResponse(mainResources.patient.id!, 'Main', 'Patient');

      const { error } = await executeMergePatients({
        mainPatientId: mainResources.patient.id!,
        otherPatientId: otherResources.patient.id!,
        questionnaireResponse: qr,
      });

      expect(error).toBeUndefined();

      const updatedMainPatient = await oystehrAdmin.fhir.get<Patient>({
        resourceType: 'Patient',
        id: mainResources.patient.id!,
      });
      expect(updatedMainPatient.active).not.toBe(false);
      const replacedByLinks = updatedMainPatient.link?.filter((l) => l.type === 'replaced-by') ?? [];
      expect(replacedByLinks).toHaveLength(0);
    }, 120_000);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Full end-to-end merge scenario
  // ═══════════════════════════════════════════════════════════════════════

  describe('full merge scenario (all phases)', () => {
    it('should merge two patients with visits, patient-level resources, and billing', async () => {
      // ── Arrange: create two full patient graphs via seed data ──
      const mainResources = await insertPatientGraph();
      const otherResources = await insertPatientGraph();

      // Find extra resources the seed data creates but doesn't return
      const otherLinked = await findPatientLinkedResources(oystehrAdmin, otherResources.patient.id!);
      expect(otherLinked.consents.length).toBeGreaterThan(0);
      expect(otherLinked.documentReferences.length).toBeGreaterThan(0);
      expect(otherLinked.accounts.length).toBeGreaterThan(0);

      // Add resources not provided by seed data
      const otherCoverage = await createTestCoverage(oystehrAdmin, processId, otherResources.patient.id!);
      const otherChargeItem = await createTestChargeItem(
        oystehrAdmin,
        processId,
        otherResources.patient.id!,
        otherResources.encounter.id!
      );

      // ── Act ──
      const qr = buildMergeQuestionnaireResponse(mainResources.patient.id!, 'MergedFirst', 'MergedLast');

      const { output, error } = await executeMergePatients({
        mainPatientId: mainResources.patient.id!,
        otherPatientId: otherResources.patient.id!,
        questionnaireResponse: qr,
      });

      // ── Assert: zambda returned success ──
      expect(error).toBeUndefined();
      expect((output as MergePatientsResponse).result).toEqual('success');

      // ── Assert: main patient name updated ──
      const updatedMain = await oystehrAdmin.fhir.get<Patient>({
        resourceType: 'Patient',
        id: mainResources.patient.id!,
      });
      const officialName = updatedMain.name?.find((n) => n.use === 'official') ?? updatedMain.name?.[0];
      expect(officialName?.given?.[0]).toEqual('MergedFirst');
      expect(officialName?.family).toEqual('MergedLast');

      // ── Assert: visits transferred ──
      const updatedAppt = await oystehrAdmin.fhir.get<Appointment>({
        resourceType: 'Appointment',
        id: otherResources.appointment.id!,
      });
      expect(updatedAppt.participant.some((p) => p.actor?.reference === `Patient/${mainResources.patient.id}`)).toBe(
        true
      );
      expect(updatedAppt.participant.some((p) => p.actor?.reference === `Patient/${otherResources.patient.id}`)).toBe(
        false
      );

      const updatedEncounter = await oystehrAdmin.fhir.get<Encounter>({
        resourceType: 'Encounter',
        id: otherResources.encounter.id!,
      });
      expect(updatedEncounter.subject?.reference).toEqual(`Patient/${mainResources.patient.id}`);

      // ── Assert: patient-level resources transferred (from seed data) ──
      const updatedConsent = await oystehrAdmin.fhir.get<Consent>({
        resourceType: 'Consent',
        id: otherLinked.consents[0].id!,
      });
      expect(updatedConsent.patient?.reference).toEqual(`Patient/${mainResources.patient.id}`);

      const updatedDocRef = await oystehrAdmin.fhir.get<DocumentReference>({
        resourceType: 'DocumentReference',
        id: otherLinked.documentReferences[0].id!,
      });
      expect(updatedDocRef.subject?.reference).toEqual(`Patient/${mainResources.patient.id}`);

      const updatedQR = await oystehrAdmin.fhir.get<QuestionnaireResponse>({
        resourceType: 'QuestionnaireResponse',
        id: otherResources.questionnaireResponse.id!,
      });
      expect(updatedQR.subject?.reference).toEqual(`Patient/${mainResources.patient.id}`);

      // ── Assert: billing resources transferred ──
      const updatedAccount = await oystehrAdmin.fhir.get<Account>({
        resourceType: 'Account',
        id: otherLinked.accounts[0].id!,
      });
      expect(updatedAccount.subject?.map((s) => s.reference)).toContain(`Patient/${mainResources.patient.id}`);

      const updatedCoverage = await oystehrAdmin.fhir.get<Coverage>({
        resourceType: 'Coverage',
        id: otherCoverage.id!,
      });
      expect(updatedCoverage.beneficiary?.reference).toEqual(`Patient/${mainResources.patient.id}`);
      expect(updatedCoverage.subscriber?.reference).toEqual(`Patient/${mainResources.patient.id}`);

      const updatedChargeItem = await oystehrAdmin.fhir.get<ChargeItem>({
        resourceType: 'ChargeItem',
        id: otherChargeItem.id!,
      });
      expect(updatedChargeItem.subject?.reference).toEqual(`Patient/${mainResources.patient.id}`);

      // ── Assert: other patient marked as merged ──
      const updatedOther = await oystehrAdmin.fhir.get<Patient>({
        resourceType: 'Patient',
        id: otherResources.patient.id!,
      });
      expect(updatedOther.active).toBe(false);
      expect(updatedOther.link).toHaveLength(1);
      expect(updatedOther.link![0].type).toEqual('replaced-by');
      expect(updatedOther.link![0].other?.reference).toEqual(`Patient/${mainResources.patient.id}`);

      // ── Assert: main patient stays active ──
      expect(updatedMain.active).not.toBe(false);
    }, 180_000);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Edge cases
  // ═══════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should succeed with an empty questionnaire response item list', async () => {
      const mainResources = await insertPatientGraph();
      const otherResources = await insertPatientGraph();

      const emptyQR: QuestionnaireResponse = {
        resourceType: 'QuestionnaireResponse',
        status: 'completed',
        item: [],
      };

      const { output, error } = await executeMergePatients({
        mainPatientId: mainResources.patient.id!,
        otherPatientId: otherResources.patient.id!,
        questionnaireResponse: emptyQR,
      });

      expect(error).toBeUndefined();
      expect((output as MergePatientsResponse).result).toEqual('success');

      // Other patient should still be marked as merged even with no field changes
      const updatedOther = await oystehrAdmin.fhir.get<Patient>({
        resourceType: 'Patient',
        id: otherResources.patient.id!,
      });
      expect(updatedOther.active).toBe(false);
    }, 120_000);

    it('should not affect resources already belonging to the main patient', async () => {
      const mainResources = await insertPatientGraph();
      const otherResources = await insertPatientGraph();

      // Main patient's seed-created resources should remain untouched after merge
      const mainLinked = await findPatientLinkedResources(oystehrAdmin, mainResources.patient.id!);
      expect(mainLinked.consents.length).toBeGreaterThan(0);
      const mainConsentId = mainLinked.consents[0].id!;

      const qr = buildMergeQuestionnaireResponse(mainResources.patient.id!, 'Main', 'Patient');

      const { error } = await executeMergePatients({
        mainPatientId: mainResources.patient.id!,
        otherPatientId: otherResources.patient.id!,
        questionnaireResponse: qr,
      });

      expect(error).toBeUndefined();

      // Main patient's own consent should still point to main patient
      const updatedMainConsent = await oystehrAdmin.fhir.get<Consent>({
        resourceType: 'Consent',
        id: mainConsentId,
      });
      expect(updatedMainConsent.patient?.reference).toEqual(`Patient/${mainResources.patient.id}`);

      // Main patient's own appointment should still point to main patient
      const updatedMainAppt = await oystehrAdmin.fhir.get<Appointment>({
        resourceType: 'Appointment',
        id: mainResources.appointment.id!,
      });
      expect(
        updatedMainAppt.participant.some((p) => p.actor?.reference === `Patient/${mainResources.patient.id}`)
      ).toBe(true);
    }, 120_000);
  });
});
