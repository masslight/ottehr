import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import {
  Account,
  AllergyIntolerance,
  Appointment,
  ChargeItem,
  Consent,
  Coverage,
  DocumentReference,
  Encounter,
  EpisodeOfCare,
  MedicationStatement,
  Patient,
  Procedure,
  QuestionnaireResponse,
  RelatedPerson,
  Resource,
} from 'fhir/r4b';
import {
  FOLLOWUP_SYSTEMS,
  M2MClientMockType,
  MergePatientsResponse,
  PATIENT_BILLING_ACCOUNT_TYPE,
  RoleType,
  SaveChartDataRequest,
  SaveChartDataResponse,
  WORKERS_COMP_ACCOUNT_TYPE,
} from 'utils';
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
 * Saves clinical chart data via the SAVE-CHART-DATA zambda — the same code path used by the application.
 */
const saveChartDataForEncounter = async (
  oystehrZambdas: Oystehr,
  encounterId: string,
  data: Omit<SaveChartDataRequest, 'encounterId'>
): Promise<{ chartResources: Resource[] }> => {
  const input: SaveChartDataRequest = { encounterId, ...data };
  const result = await oystehrZambdas.zambda.execute({ id: 'SAVE-CHART-DATA', ...input });
  const output = result.output as SaveChartDataResponse;
  return { chartResources: output.chartResources };
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

    // merge-patients requires Administrator role; grant it to the test M2M client.
    const projectRoles = await oystehrAdmin.role.list();
    const adminRoleId = projectRoles.find((r) => r.name === RoleType.Administrator)?.id;
    if (adminRoleId) {
      const testM2M = (await oystehrAdmin.m2m.listV2({ name: 'merge-patients.test.ts' })).data[0];
      if (testM2M) {
        const m2mDetails = await oystehrAdmin.m2m.get({ id: testM2M.id });
        const existingRoleIds = (m2mDetails.roles ?? []).map((r: { id: string }) => r.id);
        if (!existingRoleIds.includes(adminRoleId)) {
          await oystehrAdmin.m2m.update({
            id: testM2M.id,
            roles: [...existingRoleIds, adminRoleId],
          });
        }
      }
    }
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  const executeMergePatients = async (input: {
    mainPatientId: string;
    otherPatientId: string;
    questionnaireResponse: QuestionnaireResponse;
  }): Promise<{ output: any; error?: Error }> => {
    try {
      const result = await oystehrZambdas.zambda.execute({ id: 'MERGE-PATIENTS', ...input });
      return { output: result.output };
    } catch (error) {
      console.error('Error executing merge-patients zambda:', error);
      return { output: undefined, error: error as Error };
    }
  };

  const insertPatientGraph = async (): Promise<InsertFullAppointmentDataBaseResult> => {
    return insertInPersonAppointmentBase(oystehrAdmin, processId);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // Validation / error cases (no merge needed — fast)
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
  // Main merge — single merge, all assertions
  // ═══════════════════════════════════════════════════════════════════════

  describe('merge behavior (single merge, all checks)', () => {
    // ── Shared state filled once in beforeAll ──
    let mainResources: InsertFullAppointmentDataBaseResult;
    let otherResources: InsertFullAppointmentDataBaseResult;
    let mainLinked: { consents: Consent[]; documentReferences: DocumentReference[]; accounts: Account[] };
    let otherLinked: { consents: Consent[]; documentReferences: DocumentReference[]; accounts: Account[] };
    let otherCoverage: Coverage;
    let otherChargeItem: ChargeItem;
    let otherAllergyId: string;
    let otherMedStatementId: string;
    let otherProcedureId: string;
    let otherEpisodeOfCareId: string;
    let followUpEncounter: Encounter;
    let followUpMedStatementId: string;
    let mergeOutput: MergePatientsResponse;

    beforeAll(async () => {
      // ── Create two full patient graphs ──
      mainResources = await insertPatientGraph();
      otherResources = await insertPatientGraph();

      // ── Find seed-created resources ──
      [mainLinked, otherLinked] = await Promise.all([
        findPatientLinkedResources(oystehrAdmin, mainResources.patient.id!),
        findPatientLinkedResources(oystehrAdmin, otherResources.patient.id!),
      ]);

      // ── Create billing resources (not in seed data) ──
      otherCoverage = await oystehrAdmin.fhir.create<Coverage>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'Coverage',
            status: 'active',
            beneficiary: { reference: `Patient/${otherResources.patient.id}` },
            subscriber: { reference: `Patient/${otherResources.patient.id}` },
            payor: [{ display: 'Test Insurance' }],
          },
          processId
        ) as Coverage
      );
      otherChargeItem = await oystehrAdmin.fhir.create<ChargeItem>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'ChargeItem',
            status: 'billable',
            subject: { reference: `Patient/${otherResources.patient.id}` },
            context: { reference: `Encounter/${otherResources.encounter.id}` },
            code: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '99213' }] },
          },
          processId
        ) as ChargeItem
      );

      // ── Create clinical resources via save-chart-data zambda ──
      const { chartResources: clinicalResources } = await saveChartDataForEncounter(
        oystehrZambdas,
        otherResources.encounter.id!,
        {
          allergies: [{ name: 'Penicillin', id: '12345', note: 'Causes rash', current: true }],
          medications: [
            {
              name: 'Amoxicillin 500mg',
              id: '5675',
              type: 'scheduled',
              intakeInfo: { date: '2025-10-16T11:00:00.000Z', dose: '500 mg' },
              status: 'active',
            },
          ],
          surgicalHistory: [{ code: '44950', display: 'Appendectomy' }],
          episodeOfCare: [{ code: 'H001', display: 'Hospitalization for pneumonia' }],
        }
      );
      otherAllergyId = clinicalResources.find((r) => r.resourceType === 'AllergyIntolerance')!.id!;
      otherMedStatementId = clinicalResources.find((r) => r.resourceType === 'MedicationStatement')!.id!;
      otherProcedureId = clinicalResources.find((r) => r.resourceType === 'Procedure')!.id!;
      otherEpisodeOfCareId = clinicalResources.find((r) => r.resourceType === 'EpisodeOfCare')!.id!;

      // ── Create a follow-up encounter with a medication attached ──
      const enc: Encounter = {
        resourceType: 'Encounter',
        status: 'in-progress',
        class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'VR', display: 'virtual' },
        subject: { reference: `Patient/${otherResources.patient.id}` },
        type: [
          {
            coding: [
              {
                system: FOLLOWUP_SYSTEMS.type.url,
                code: FOLLOWUP_SYSTEMS.type.code,
                display: 'Follow-up encounter',
              },
            ],
          },
        ],
        partOf: { reference: `Encounter/${otherResources.encounter.id}` },
        period: { start: new Date().toISOString() },
      };
      followUpEncounter = await oystehrAdmin.fhir.create<Encounter>(
        addProcessIdMetaTagToResource(enc, processId) as Encounter
      );

      const { chartResources: followUpResources } = await saveChartDataForEncounter(
        oystehrZambdas,
        followUpEncounter.id!,
        {
          medications: [
            {
              name: 'Ibuprofen 200mg',
              id: '7890',
              type: 'as-needed',
              intakeInfo: { date: '2025-11-01T09:00:00.000Z', dose: '200 mg' },
              status: 'active',
            },
          ],
        }
      );
      followUpMedStatementId = followUpResources.find((r) => r.resourceType === 'MedicationStatement')!.id!;

      // ── Execute merge ONCE ──
      const qr = buildMergeQuestionnaireResponse(mainResources.patient.id!, 'MergedFirst', 'MergedLast');
      const { output, error } = await executeMergePatients({
        mainPatientId: mainResources.patient.id!,
        otherPatientId: otherResources.patient.id!,
        questionnaireResponse: qr,
      });

      expect(error).toBeUndefined();
      mergeOutput = output as MergePatientsResponse;
    }, 180_000);

    // ── Step 1: Patient record fields ──

    it('should return success', () => {
      expect(mergeOutput).toBeDefined();
      expect(mergeOutput.result).toEqual('success');
    });

    it('should update the main patient name from the questionnaire response', async () => {
      const updatedMain = await oystehrAdmin.fhir.get<Patient>({
        resourceType: 'Patient',
        id: mainResources.patient.id!,
      });
      const officialName = updatedMain.name?.find((n) => n.use === 'official') ?? updatedMain.name?.[0];
      expect(officialName?.given?.[0]).toEqual('MergedFirst');
      expect(officialName?.family).toEqual('MergedLast');
    });

    // ── Step 2: Visits transferred ──

    it('should transfer appointment to main patient', async () => {
      const updatedAppt = await oystehrAdmin.fhir.get<Appointment>({
        resourceType: 'Appointment',
        id: otherResources.appointment.id!,
      });
      const patientParticipant = updatedAppt.participant.find((p) => p.actor?.reference?.startsWith('Patient/'));
      expect(patientParticipant?.actor?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    });

    it('should transfer encounter to main patient', async () => {
      const updatedEncounter = await oystehrAdmin.fhir.get<Encounter>({
        resourceType: 'Encounter',
        id: otherResources.encounter.id!,
      });
      expect(updatedEncounter.subject?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    });

    // ── Step 2: Clinical resources (via save-chart-data) ──

    it('should transfer AllergyIntolerance to main patient', async () => {
      const updated = await oystehrAdmin.fhir.get<AllergyIntolerance>({
        resourceType: 'AllergyIntolerance',
        id: otherAllergyId,
      });
      expect(updated.patient?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    });

    it('should transfer MedicationStatement to main patient', async () => {
      const updated = await oystehrAdmin.fhir.get<MedicationStatement>({
        resourceType: 'MedicationStatement',
        id: otherMedStatementId,
      });
      expect(updated.subject?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    });

    it('should transfer Procedure (surgical history) to main patient', async () => {
      const updated = await oystehrAdmin.fhir.get<Procedure>({
        resourceType: 'Procedure',
        id: otherProcedureId,
      });
      expect(updated.subject?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    });

    it('should transfer EpisodeOfCare (hospitalization) to main patient', async () => {
      const updated = await oystehrAdmin.fhir.get<EpisodeOfCare>({
        resourceType: 'EpisodeOfCare',
        id: otherEpisodeOfCareId,
      });
      expect(updated.patient?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    });

    // ── Follow-up encounters ──

    it('should transfer follow-up encounter to main patient', async () => {
      const updated = await oystehrAdmin.fhir.get<Encounter>({
        resourceType: 'Encounter',
        id: followUpEncounter.id!,
      });
      expect(updated.subject?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    });

    it('should transfer resources attached to follow-up encounter', async () => {
      const updated = await oystehrAdmin.fhir.get<MedicationStatement>({
        resourceType: 'MedicationStatement',
        id: followUpMedStatementId,
      });
      expect(updated.subject?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    });

    // ── Step 3: Patient-level resources ──

    it('should transfer QuestionnaireResponse to main patient', async () => {
      const updated = await oystehrAdmin.fhir.get<QuestionnaireResponse>({
        resourceType: 'QuestionnaireResponse',
        id: otherResources.questionnaireResponse.id!,
      });
      expect(updated.subject?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    });

    it('should transfer Consent to main patient', async () => {
      expect(otherLinked.consents.length).toBeGreaterThan(0);
      const updated = await oystehrAdmin.fhir.get<Consent>({
        resourceType: 'Consent',
        id: otherLinked.consents[0].id!,
      });
      expect(updated.patient?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    });

    it('should transfer DocumentReference to main patient', async () => {
      expect(otherLinked.documentReferences.length).toBeGreaterThan(0);
      const updated = await oystehrAdmin.fhir.get<DocumentReference>({
        resourceType: 'DocumentReference',
        id: otherLinked.documentReferences[0].id!,
      });
      expect(updated.subject?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    });

    it('should transfer non-user RelatedPerson to main patient', async () => {
      const rps = (
        await oystehrAdmin.fhir.search<RelatedPerson>({
          resourceType: 'RelatedPerson',
          params: [{ name: 'patient', value: `Patient/${mainResources.patient.id}` }],
        })
      ).unbundle();
      const nonUser = rps.find(
        (rp) => rp.relationship?.every((rel) => rel.coding?.every((c) => c.code !== 'user-relatedperson'))
      );
      expect(nonUser).toBeDefined();
      expect(nonUser?.patient?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    });

    // ── Step 4: Billing resources ──

    it('should transfer Account to main patient', async () => {
      expect(otherLinked.accounts.length).toBeGreaterThan(0);
      const updated = await oystehrAdmin.fhir.get<Account>({
        resourceType: 'Account',
        id: otherLinked.accounts[0].id!,
      });
      const subjectRefs = updated.subject?.map((s) => s.reference) ?? [];
      expect(subjectRefs).toContain(`Patient/${mainResources.patient.id}`);
      expect(subjectRefs).not.toContain(`Patient/${otherResources.patient.id}`);
    });

    it('should transfer Coverage to main patient', async () => {
      const updated = await oystehrAdmin.fhir.get<Coverage>({
        resourceType: 'Coverage',
        id: otherCoverage.id!,
      });
      expect(updated.beneficiary?.reference).toEqual(`Patient/${mainResources.patient.id}`);
      expect(updated.subscriber?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    });

    it('should transfer ChargeItem to main patient', async () => {
      const updated = await oystehrAdmin.fhir.get<ChargeItem>({
        resourceType: 'ChargeItem',
        id: otherChargeItem.id!,
      });
      expect(updated.subject?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    });

    // ── Step 6: Mark other patient as merged ──

    it('should set active=false and link=replaced-by on the other patient', async () => {
      const updated = await oystehrAdmin.fhir.get<Patient>({
        resourceType: 'Patient',
        id: otherResources.patient.id!,
      });
      expect(updated.active).toBe(false);
      expect(updated.link).toBeDefined();
      expect(updated.link).toHaveLength(1);
      expect(updated.link![0].type).toEqual('replaced-by');
      expect(updated.link![0].other?.reference).toEqual(`Patient/${mainResources.patient.id}`);
    });

    it('should NOT deactivate the main patient', async () => {
      const updated = await oystehrAdmin.fhir.get<Patient>({
        resourceType: 'Patient',
        id: mainResources.patient.id!,
      });
      expect(updated.active).not.toBe(false);
      const replacedByLinks = updated.link?.filter((l) => l.type === 'replaced-by') ?? [];
      expect(replacedByLinks).toHaveLength(0);
    });

    // ── Main patient's own resources should stay untouched ──

    it('should not affect resources already belonging to the main patient', async () => {
      expect(mainLinked.consents.length).toBeGreaterThan(0);
      const updatedConsent = await oystehrAdmin.fhir.get<Consent>({
        resourceType: 'Consent',
        id: mainLinked.consents[0].id!,
      });
      expect(updatedConsent.patient?.reference).toEqual(`Patient/${mainResources.patient.id}`);

      const updatedAppt = await oystehrAdmin.fhir.get<Appointment>({
        resourceType: 'Appointment',
        id: mainResources.appointment.id!,
      });
      expect(updatedAppt.participant.some((p) => p.actor?.reference === `Patient/${mainResources.patient.id}`)).toBe(
        true
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Step 4: Account consolidation by type
  // ═══════════════════════════════════════════════════════════════════════

  describe('account consolidation', () => {
    let mainResources: InsertFullAppointmentDataBaseResult;
    let otherResources: InsertFullAppointmentDataBaseResult;
    let mainPbillId: string;
    let otherPbillId: string;
    let otherWcompId: string;
    let mainCoverageId: string;
    let otherCoverageId: string;

    const PBILL_CODE = PATIENT_BILLING_ACCOUNT_TYPE!.coding![0].code!;
    const WCOMP_CODE = WORKERS_COMP_ACCOUNT_TYPE!.coding![0].code!;

    const findAccount = async (patientId: string, code: string): Promise<Account> => {
      const accounts = (
        await oystehrAdmin.fhir.search<Account>({
          resourceType: 'Account',
          params: [{ name: 'patient', value: `Patient/${patientId}` }],
        })
      ).unbundle();
      const match = accounts.find((a) => a.type?.coding?.some((c) => c.code === code));
      if (!match?.id) throw new Error(`No account of type ${code} for Patient/${patientId}`);
      return match;
    };

    beforeAll(async () => {
      mainResources = await insertPatientGraph();
      otherResources = await insertPatientGraph();

      const [mainPbill, otherPbill, otherWcomp] = await Promise.all([
        findAccount(mainResources.patient.id!, PBILL_CODE),
        findAccount(otherResources.patient.id!, PBILL_CODE),
        findAccount(otherResources.patient.id!, WCOMP_CODE),
      ]);
      mainPbillId = mainPbill.id!;
      otherPbillId = otherPbill.id!;
      otherWcompId = otherWcomp.id!;

      // Create one Coverage per patient and attach each to its PBILLACCT
      const [mainCov, otherCov] = await Promise.all([
        oystehrAdmin.fhir.create<Coverage>(
          addProcessIdMetaTagToResource(
            {
              resourceType: 'Coverage',
              status: 'active',
              beneficiary: { reference: `Patient/${mainResources.patient.id}` },
              subscriber: { reference: `Patient/${mainResources.patient.id}` },
              payor: [{ display: 'Main Insurance' }],
            },
            processId
          ) as Coverage
        ),
        oystehrAdmin.fhir.create<Coverage>(
          addProcessIdMetaTagToResource(
            {
              resourceType: 'Coverage',
              status: 'active',
              beneficiary: { reference: `Patient/${otherResources.patient.id}` },
              subscriber: { reference: `Patient/${otherResources.patient.id}` },
              payor: [{ display: 'Other Insurance' }],
            },
            processId
          ) as Coverage
        ),
      ]);
      mainCoverageId = mainCov.id!;
      otherCoverageId = otherCov.id!;

      await Promise.all([
        oystehrAdmin.fhir.patch<Account>({
          resourceType: 'Account',
          id: mainPbillId,
          operations: [
            {
              op: 'add',
              path: '/coverage',
              value: [{ coverage: { reference: `Coverage/${mainCoverageId}` }, priority: 1 }],
            },
          ],
        }),
        oystehrAdmin.fhir.patch<Account>({
          resourceType: 'Account',
          id: otherPbillId,
          operations: [
            {
              op: 'add',
              path: '/coverage',
              value: [{ coverage: { reference: `Coverage/${otherCoverageId}` }, priority: 1 }],
            },
          ],
        }),
      ]);

      // Attach the other patient's accounts to its encounter so we can verify redirection
      await oystehrAdmin.fhir.patch<Encounter>({
        resourceType: 'Encounter',
        id: otherResources.encounter.id!,
        operations: [
          {
            op: 'add',
            path: '/account',
            value: [{ reference: `Account/${otherPbillId}` }, { reference: `Account/${otherWcompId}` }],
          },
        ],
      });

      const qr = buildMergeQuestionnaireResponse(mainResources.patient.id!, 'Consolidated', 'Test');
      const { error } = await executeMergePatients({
        mainPatientId: mainResources.patient.id!,
        otherPatientId: otherResources.patient.id!,
        questionnaireResponse: qr,
      });
      expect(error).toBeUndefined();
    }, 180_000);

    it('should leave exactly one active PBILLACCT for the main patient', async () => {
      const accounts = (
        await oystehrAdmin.fhir.search<Account>({
          resourceType: 'Account',
          params: [{ name: 'patient', value: `Patient/${mainResources.patient.id}` }],
        })
      ).unbundle();
      const activePbill = accounts.filter(
        (a) => a.status === 'active' && a.type?.coding?.some((c) => c.code === 'PBILLACCT')
      );
      expect(activePbill).toHaveLength(1);
      expect(activePbill[0].id).toEqual(mainPbillId);
    });

    it('should leave exactly one active WCOMPACCT for the main patient', async () => {
      const accounts = (
        await oystehrAdmin.fhir.search<Account>({
          resourceType: 'Account',
          params: [{ name: 'patient', value: `Patient/${mainResources.patient.id}` }],
        })
      ).unbundle();
      const activeWcomp = accounts.filter(
        (a) => a.status === 'active' && a.type?.coding?.some((c) => c.code === 'WCOMPACCT')
      );
      expect(activeWcomp).toHaveLength(1);
    });

    it('should mark the consolidated old PBILLACCT as inactive with subject re-pointed to main', async () => {
      const updated = await oystehrAdmin.fhir.get<Account>({
        resourceType: 'Account',
        id: otherPbillId,
      });
      expect(updated.status).toEqual('inactive');
      const subjectRefs = updated.subject?.map((s) => s.reference) ?? [];
      expect(subjectRefs).toContain(`Patient/${mainResources.patient.id}`);
      expect(subjectRefs).not.toContain(`Patient/${otherResources.patient.id}`);
    });

    it('should merge coverages from both patients into the surviving PBILLACCT', async () => {
      const updated = await oystehrAdmin.fhir.get<Account>({
        resourceType: 'Account',
        id: mainPbillId,
      });
      const refs = (updated.coverage ?? []).map((c) => c.coverage?.reference);
      expect(refs).toContain(`Coverage/${mainCoverageId}`);
      expect(refs).toContain(`Coverage/${otherCoverageId}`);
    });

    it('should redirect Encounter.account references from the consolidated old account to the main one', async () => {
      const updated = await oystehrAdmin.fhir.get<Encounter>({
        resourceType: 'Encounter',
        id: otherResources.encounter.id!,
      });
      const refs = (updated.account ?? []).map((a) => a.reference);
      expect(refs).toContain(`Account/${mainPbillId}`);
      expect(refs).not.toContain(`Account/${otherPbillId}`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Edge case: empty QR (needs its own merge)
  // ═══════════════════════════════════════════════════════════════════════

  describe('edge case: empty questionnaire response', () => {
    it('should succeed and mark other patient as merged even with no field changes', async () => {
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

      const updatedOther = await oystehrAdmin.fhir.get<Patient>({
        resourceType: 'Patient',
        id: otherResources.patient.id!,
      });
      expect(updatedOther.active).toBe(false);
    }, 120_000);
  });
});
