import Oystehr from '@oystehr/sdk';
import { DiagnosticReport, DocumentReference, Organization, ServiceRequest, Task } from 'fhir/r4b';
import {
  DR_UNSOLICITED_PATIENT_REF,
  LAB_DR_TYPE_TAG,
  LAB_ORDER_TASK,
  LAB_RESULT_DOC_REF_CODING_CODE,
  M2MClientMockType,
} from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fetchRelatedResources } from '../../src/subscriptions/diagnostic-report/handle-lab-result/helpers';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

describe('fetchRelatedResources integration', () => {
  let oystehr: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let labOrg: Organization;
  let cleanup: () => Promise<void>;
  let processId: string;
  // Resources outside the standard appointment graph tracked for explicit deletion —
  // cleanAppointmentGraph walks outward from Appointment and won't reach DRs, SRs, etc.
  const extraRefs: string[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest('handle-lab-result.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    cleanup = setup.cleanup;
    processId = setup.processId;
    base = await insertInPersonAppointmentBase(oystehr, processId);

    labOrg = await oystehr.fhir.create<Organization>(
      addProcessIdMetaTagToResource({ resourceType: 'Organization', name: 'Test Lab Org' }, processId) as Organization
    );
    extraRefs.push(`Organization/${labOrg.id}`);
  }, 60_000);

  afterAll(async () => {
    for (const ref of [...extraRefs].reverse()) {
      const [resourceType, id] = ref.split('/');
      try {
        await oystehr.fhir.delete({ resourceType, id } as any);
      } catch {
        // ignore if already gone
      }
    }
    await cleanup();
  });

  describe('solicited final result', () => {
    let dr: DiagnosticReport;
    let sr: ServiceRequest;
    let preSubmissionTask: Task;
    let result: Awaited<ReturnType<typeof fetchRelatedResources>>;

    beforeAll(async () => {
      sr = await oystehr.fhir.create<ServiceRequest>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'ServiceRequest',
            status: 'active',
            intent: 'order',
            code: { text: 'CBC' },
            subject: { reference: `Patient/${base.patient.id}` },
            encounter: { reference: `Encounter/${base.encounter.id}` },
            performer: [{ reference: `Organization/${labOrg.id}` }],
          },
          processId
        ) as ServiceRequest
      );
      extraRefs.push(`ServiceRequest/${sr.id}`);

      preSubmissionTask = await oystehr.fhir.create<Task>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'Task',
            status: 'requested',
            intent: 'order',
            code: { coding: [{ system: LAB_ORDER_TASK.system, code: LAB_ORDER_TASK.code.preSubmission }] },
            basedOn: [{ reference: `ServiceRequest/${sr.id}` }],
            encounter: { reference: `Encounter/${base.encounter.id}` },
            for: { reference: `Patient/${base.patient.id}` },
          },
          processId
        ) as Task
      );
      extraRefs.push(`Task/${preSubmissionTask.id}`);

      dr = await oystehr.fhir.create<DiagnosticReport>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'DiagnosticReport',
            status: 'final',
            code: { text: 'CBC Panel' },
            basedOn: [{ reference: `ServiceRequest/${sr.id}` }],
            subject: { reference: `Patient/${base.patient.id}` },
            performer: [{ reference: `Organization/${labOrg.id}` }],
            encounter: { reference: `Encounter/${base.encounter.id}` },
          },
          processId
        ) as DiagnosticReport
      );
      extraRefs.push(`DiagnosticReport/${dr.id}`);

      result = await fetchRelatedResources(
        dr,
        { drType: undefined, isUnsolicited: false, isUnsolicitedAndMatched: false },
        oystehr
      );
    }, 30_000);

    it('returns the patient', () => {
      expect(result.patient?.id).toBe(base.patient.id);
    });

    it('returns the lab organization', () => {
      expect(result.labOrg?.id).toBe(labOrg.id);
    });

    it('returns the encounter', () => {
      expect(result.encounter?.id).toBe(base.encounter.id);
    });

    it('includes the pre-submission task', () => {
      expect(result.tasks.map((t) => t.id)).toContain(preSubmissionTask.id);
    });
  });

  describe('result with a lab-result attachment', () => {
    let dr: DiagnosticReport;
    let docRef: DocumentReference;
    let result: Awaited<ReturnType<typeof fetchRelatedResources>>;

    beforeAll(async () => {
      dr = await oystehr.fhir.create<DiagnosticReport>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'DiagnosticReport',
            status: 'final',
            code: { text: 'Attachment Test Panel' },
            subject: { reference: `Patient/${base.patient.id}` },
          },
          processId
        ) as DiagnosticReport
      );
      extraRefs.push(`DiagnosticReport/${dr.id}`);

      docRef = await oystehr.fhir.create<DocumentReference>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'DocumentReference',
            status: 'current',
            type: {
              coding: [{ system: LAB_RESULT_DOC_REF_CODING_CODE.system, code: LAB_RESULT_DOC_REF_CODING_CODE.code }],
            },
            subject: { reference: `Patient/${base.patient.id}` },
            context: { related: [{ reference: `DiagnosticReport/${dr.id}` }] },
            content: [{ attachment: { contentType: 'application/pdf', url: 'https://example.com/result.pdf' } }],
          },
          processId
        ) as DocumentReference
      );
      extraRefs.push(`DocumentReference/${docRef.id}`);

      result = await fetchRelatedResources(
        dr,
        { drType: undefined, isUnsolicited: false, isUnsolicitedAndMatched: false },
        oystehr
      );
    }, 30_000);

    it('includes the result attachment', () => {
      expect(result.attachments?.map((a) => a.id)).toContain(docRef.id);
    });
  });

  describe('result with a non-result DocumentReference', () => {
    let dr: DiagnosticReport;
    let docRef: DocumentReference;
    let result: Awaited<ReturnType<typeof fetchRelatedResources>>;

    beforeAll(async () => {
      dr = await oystehr.fhir.create<DiagnosticReport>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'DiagnosticReport',
            status: 'final',
            code: { text: 'Order DocRef Test Panel' },
            subject: { reference: `Patient/${base.patient.id}` },
          },
          processId
        ) as DiagnosticReport
      );
      extraRefs.push(`DiagnosticReport/${dr.id}`);

      // Linked to the DR but wrong coding — should not appear in attachments
      docRef = await oystehr.fhir.create<DocumentReference>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'DocumentReference',
            status: 'current',
            type: { coding: [{ system: 'http://loinc.org', code: '51991-8' }] }, // order form code, not result code
            subject: { reference: `Patient/${base.patient.id}` },
            context: { related: [{ reference: `DiagnosticReport/${dr.id}` }] },
            content: [{ attachment: { contentType: 'application/pdf', url: 'https://example.com/order.pdf' } }],
          },
          processId
        ) as DocumentReference
      );
      extraRefs.push(`DocumentReference/${docRef.id}`);

      result = await fetchRelatedResources(
        dr,
        { drType: undefined, isUnsolicited: false, isUnsolicitedAndMatched: false },
        oystehr
      );
    }, 30_000);

    it('does not include the non-result DocumentReference in attachments', () => {
      expect(result.attachments?.map((a) => a.id) ?? []).not.toContain(docRef.id);
    });
  });

  describe('unmatched unsolicited result', () => {
    let dr: DiagnosticReport;
    let result: Awaited<ReturnType<typeof fetchRelatedResources>>;

    beforeAll(async () => {
      const drInput: DiagnosticReport = {
        resourceType: 'DiagnosticReport',
        status: 'final',
        code: { text: 'Unsolicited Panel' },
        contained: [{ resourceType: 'Patient', id: DR_UNSOLICITED_PATIENT_REF, name: [{ family: 'Unknown' }] }],
        subject: { reference: `#${DR_UNSOLICITED_PATIENT_REF}` },
        meta: { tag: [{ system: LAB_DR_TYPE_TAG.system, code: LAB_DR_TYPE_TAG.code.unsolicited }] },
      };
      addProcessIdMetaTagToResource(drInput, processId);

      dr = await oystehr.fhir.create<DiagnosticReport>(drInput);
      extraRefs.push(`DiagnosticReport/${dr.id}`);

      result = await fetchRelatedResources(
        dr,
        { drType: LAB_DR_TYPE_TAG.code.unsolicited, isUnsolicited: true, isUnsolicitedAndMatched: false },
        oystehr
      );
    }, 30_000);

    it('returns no patient', () => {
      expect(result.patient).toBeUndefined();
    });

    it('returns no encounter', () => {
      expect(result.encounter).toBeUndefined();
    });

    it('returns no tasks', () => {
      expect(result.tasks).toHaveLength(0);
    });
  });

  describe('matched unsolicited result — patient only, no existing order', () => {
    let dr: DiagnosticReport;
    let result: Awaited<ReturnType<typeof fetchRelatedResources>>;

    beforeAll(async () => {
      const drInput: DiagnosticReport = {
        resourceType: 'DiagnosticReport',
        status: 'final',
        code: { text: 'Matched Unsolicited Panel' },
        subject: { reference: `Patient/${base.patient.id}` },
        meta: { tag: [{ system: LAB_DR_TYPE_TAG.system, code: LAB_DR_TYPE_TAG.code.unsolicited }] },
      };
      addProcessIdMetaTagToResource(drInput, processId);

      dr = await oystehr.fhir.create<DiagnosticReport>(drInput);
      extraRefs.push(`DiagnosticReport/${dr.id}`);

      result = await fetchRelatedResources(
        dr,
        { drType: LAB_DR_TYPE_TAG.code.unsolicited, isUnsolicited: true, isUnsolicitedAndMatched: true },
        oystehr
      );
    }, 30_000);

    it('returns the patient', () => {
      expect(result.patient?.id).toBe(base.patient.id);
    });

    it('returns no encounter (DR has no encounter reference)', () => {
      expect(result.encounter).toBeUndefined();
    });
  });
});
