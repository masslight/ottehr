import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import {
  DiagnosticReport,
  DocumentReference,
  Location,
  Observation,
  Organization,
  Practitioner,
  Provenance,
  Questionnaire,
  QuestionnaireResponse,
  ServiceRequest,
  Specimen,
  Task,
} from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import {
  EXTERNAL_LAB_LABEL_PDF_DOC_REF_DOCTYPE,
  FHIR_IDC10_VALUESET_SYSTEM,
  LAB_ACCOUNT_NUMBER_SYSTEM,
  LAB_ORDER_TASK,
  LAB_RESULT_DOC_REF_CODING_CODE,
  OYSTEHR_LAB_GUID_SYSTEM,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
} from 'utils/lib/types/data/labs/labs.constants';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/lab/external/update-lab-order-resources/index';
import { SECRETS } from '../data/secrets';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

vi.hoisted(() => vi.resetModules());

const { sendOrderResultEmailToPatient } = vi.hoisted(() => ({ sendOrderResultEmailToPatient: vi.fn() }));

vi.mock('../../src/shared/communication', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/communication')>()),
  sendOrderResultEmailToPatient,
}));

const TEST_CODING = { system: OYSTEHR_LAB_OI_CODE_SYSTEM, code: '005009', display: 'CBC With Differential' };

const z3Location = (z3Url: string): { bucketName: string; 'objectPath+': string } => {
  const [bucketName, ...objectPath] = z3Url.split('/z3/')[1].split('/');
  return { bucketName, 'objectPath+': objectPath.join('/') };
};

describe('update-lab-order-resources integration', () => {
  let oystehr: Oystehr;
  let token: string;
  let cleanup: () => Promise<void>;
  let processId: string;
  let providerProfile: string;
  let base: InsertFullAppointmentDataBaseResult;
  let labOrg: Organization;
  let orderingProvider: Practitioner;
  let orderingLocation: Location;
  let aoeQuestionnaire: Questionnaire;
  const extraRefs: { resourceType: 'Observation' | 'Provenance'; id: string }[] = [];

  const tag = <T extends { resourceType: string }>(resource: T): T =>
    addProcessIdMetaTagToResource(resource as any, processId) as unknown as T;

  const create = async <T extends { resourceType: string }>(resource: T): Promise<T> =>
    oystehr.fhir.create(tag(resource) as any) as unknown as Promise<T>;

  const makeServiceRequest = (
    status: ServiceRequest['status'],
    extra: Partial<ServiceRequest> = {}
  ): ServiceRequest => ({
    resourceType: 'ServiceRequest',
    status,
    intent: 'order',
    priority: 'routine',
    authoredOn: new Date().toISOString(),
    subject: { reference: `Patient/${base.patient.id}` },
    encounter: { reference: `Encounter/${base.encounter.id}` },
    requester: { reference: `Practitioner/${orderingProvider.id}` },
    performer: [{ reference: `Organization/${labOrg.id}` }],
    locationReference: [{ type: 'Location', reference: `Location/${orderingLocation.id}` }],
    identifier: [{ system: OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM, value: randomUUID().replace(/-/g, '').slice(0, 18) }],
    code: { coding: [TEST_CODING] },
    reasonCode: [{ coding: [{ system: FHIR_IDC10_VALUESET_SYSTEM, code: 'R53.83' }], text: 'Other fatigue' }],
    instantiatesCanonical: ['#activityDefinitionId'],
    contained: [
      {
        resourceType: 'ActivityDefinition',
        id: 'activityDefinitionId',
        status: 'unknown',
        kind: 'ServiceRequest',
        publisher: labOrg.name,
        code: { coding: [TEST_CODING] },
      },
    ],
    ...extra,
  });

  const makePreSubmissionTask = (serviceRequestId: string, extra: Partial<Task> = {}): Task => ({
    resourceType: 'Task',
    status: 'ready',
    intent: 'order',
    code: { coding: [{ system: LAB_ORDER_TASK.system, code: LAB_ORDER_TASK.code.preSubmission }] },
    basedOn: [{ reference: `ServiceRequest/${serviceRequestId}` }],
    encounter: { reference: `Encounter/${base.encounter.id}` },
    for: { reference: `Patient/${base.patient.id}` },
    ...extra,
  });

  const searchProvenances = async (target: string): Promise<Provenance[]> =>
    (
      await oystehr.fhir.search<Provenance>({ resourceType: 'Provenance', params: [{ name: 'target', value: target }] })
    ).unbundle();

  const searchDocuments = async (related: string): Promise<DocumentReference[]> =>
    (
      await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [{ name: 'related', value: related }],
      })
    ).unbundle();

  const relatedTargets: string[] = [];

  beforeAll(async () => {
    const setup = await setupIntegrationTest('update-lab-order-resources.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;
    processId = setup.processId;
    providerProfile = setup.testUserM2MProfile;
    base = await insertInPersonAppointmentBase(oystehr, processId);

    [labOrg, orderingProvider, aoeQuestionnaire] = await Promise.all([
      create<Organization>({
        resourceType: 'Organization',
        name: `IT Lab ${randomUUID().slice(0, 8)}`,
        identifier: [{ system: OYSTEHR_LAB_GUID_SYSTEM, value: randomUUID() }],
      }),
      create<Practitioner>({ resourceType: 'Practitioner', name: [{ given: ['Ordering'], family: 'Provider' }] }),
      create<Questionnaire>({
        resourceType: 'Questionnaire',
        status: 'active',
        item: [{ linkId: 'fasting-hours', text: 'Hours fasting', type: 'text', required: true }],
      }),
    ]);

    orderingLocation = await create<Location>({
      resourceType: 'Location',
      status: 'active',
      name: `IT Lab Ordering Location ${randomUUID().slice(0, 8)}`,
      identifier: [
        {
          system: LAB_ACCOUNT_NUMBER_SYSTEM,
          value: `IT-${randomUUID().slice(0, 8)}`,
          assigner: { reference: `Organization/${labOrg.id}` },
        },
      ],
    });
  }, 60_000);

  afterAll(async () => {
    sendOrderResultEmailToPatient.mockReset();
    const [provenances, documents] = await Promise.all([
      Promise.all(relatedTargets.map(searchProvenances)).then((found) => found.flat()),
      Promise.all(relatedTargets.map(searchDocuments)).then((found) => found.flat()),
    ]);
    await Promise.all([
      ...[
        ...provenances.map((provenance) => ({ resourceType: 'Provenance' as const, id: provenance.id! })),
        ...extraRefs,
      ].map((ref) => oystehr.fhir.delete(ref).catch(() => undefined)),
      ...documents.flatMap((document) =>
        document.content
          .map((content) => content.attachment.url)
          .filter((url): url is string => !!url?.includes('/z3/'))
          .map((url) => oystehr.z3.deleteObject(z3Location(url)).catch(() => undefined))
      ),
    ]);
    await cleanup();
    await Promise.all(
      [
        orderingLocation?.id && { resourceType: 'Location' as const, id: orderingLocation.id },
        orderingProvider?.id && { resourceType: 'Practitioner' as const, id: orderingProvider.id },
        aoeQuestionnaire?.id && { resourceType: 'Questionnaire' as const, id: aoeQuestionnaire.id },
      ]
        .filter((ref): ref is { resourceType: 'Location' | 'Practitioner' | 'Questionnaire'; id: string } => !!ref)
        .map((ref) => oystehr.fhir.delete(ref).catch(() => undefined))
    );
    if (labOrg?.id) await oystehr.fhir.delete({ resourceType: 'Organization', id: labOrg.id }).catch(() => undefined);
  });

  it('marks a final result reviewed, records the review at the ordering location and alerts the patient', async () => {
    const serviceRequest = await create<ServiceRequest>(makeServiceRequest('active'));
    relatedTargets.push(`ServiceRequest/${serviceRequest.id}`);
    const pstProvenance = await create<Provenance>({
      resourceType: 'Provenance',
      target: [{ reference: `ServiceRequest/${serviceRequest.id}` }],
      recorded: new Date().toISOString(),
      agent: [{ who: { reference: `Practitioner/${orderingProvider.id}` } }],
      activity: { coding: [PROVENANCE_ACTIVITY_CODING_ENTITY.completePstTask] },
    });
    extraRefs.push({ resourceType: 'Provenance', id: pstProvenance.id! });
    await create<Task>(
      makePreSubmissionTask(serviceRequest.id!, {
        status: 'completed',
        relevantHistory: [{ reference: `Provenance/${pstProvenance.id}` }],
      })
    );
    const observation = await create<Observation>({
      resourceType: 'Observation',
      status: 'final',
      code: { coding: [{ system: OYSTEHR_LAB_OI_CODE_SYSTEM, code: '005025', display: 'WBC' }] },
      subject: { reference: `Patient/${base.patient.id}` },
      valueQuantity: { value: 6.1, unit: 'x10E3/uL' },
    });
    extraRefs.push({ resourceType: 'Observation', id: observation.id! });
    const diagnosticReport = await create<DiagnosticReport>({
      resourceType: 'DiagnosticReport',
      status: 'final',
      code: { coding: [TEST_CODING] },
      basedOn: [{ reference: `ServiceRequest/${serviceRequest.id}` }],
      subject: { reference: `Patient/${base.patient.id}` },
      encounter: { reference: `Encounter/${base.encounter.id}` },
      performer: [{ reference: `Organization/${labOrg.id}` }],
      effectiveDateTime: new Date().toISOString(),
      result: [{ reference: `Observation/${observation.id}` }],
    });
    relatedTargets.push(`DiagnosticReport/${diagnosticReport.id}`);
    const reviewTask = await create<Task>({
      resourceType: 'Task',
      status: 'ready',
      intent: 'order',
      authoredOn: new Date().toISOString(),
      code: { coding: [{ system: LAB_ORDER_TASK.system, code: LAB_ORDER_TASK.code.reviewFinalResult }] },
      basedOn: [{ reference: `DiagnosticReport/${diagnosticReport.id}` }],
      encounter: { reference: `Encounter/${base.encounter.id}` },
      for: { reference: `Patient/${base.patient.id}` },
    });

    const { statusCode } = await invokeZambdaHandler(
      index,
      {
        event: 'reviewed',
        taskId: reviewTask.id,
        serviceRequestId: serviceRequest.id,
        diagnosticReportId: diagnosticReport.id,
      },
      { token }
    );

    expect(statusCode).toBe(200);
    const [reviewedTask, reviewProvenances, resultDocuments, reviewer] = await Promise.all([
      oystehr.fhir.get<Task>({ resourceType: 'Task', id: reviewTask.id! }),
      searchProvenances(`DiagnosticReport/${diagnosticReport.id}`),
      searchDocuments(`DiagnosticReport/${diagnosticReport.id}`),
      oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: providerProfile.split('/')[1] }),
    ]);
    expect(reviewedTask.status).toBe('completed');
    expect(reviewedTask.owner?.reference).toBe(providerProfile);
    expect(reviewedTask.owner?.display).toBe(getFullestAvailableName(reviewer));
    expect(reviewProvenances).toHaveLength(1);
    expect(reviewedTask.relevantHistory?.[0]?.reference).toBe(`Provenance/${reviewProvenances[0].id}`);
    expect(reviewProvenances[0].activity?.coding?.[0]?.code).toBe(PROVENANCE_ACTIVITY_CODING_ENTITY.review.code);
    expect(reviewProvenances[0].location?.reference).toBe(`Location/${orderingLocation.id}`);
    expect(reviewProvenances[0].agent[0].who?.reference).toBe(providerProfile);
    expect(reviewProvenances[0].target.map((target) => target.reference)).toEqual([
      `DiagnosticReport/${diagnosticReport.id}`,
      `Observation/${observation.id}`,
      `ServiceRequest/${serviceRequest.id}`,
    ]);
    expect(resultDocuments.map((document) => document.type?.coding?.[0]?.code)).toEqual([
      LAB_RESULT_DOC_REF_CODING_CODE.code,
    ]);
    expect(sendOrderResultEmailToPatient).toHaveBeenCalledTimes(1);
    expect(sendOrderResultEmailToPatient.mock.calls[0][0].fhirPatient.id).toBe(base.patient.id);
    expect(sendOrderResultEmailToPatient.mock.calls[0][0].emailDetails).toEqual({
      orderType: 'lab',
      testName: TEST_CODING.display,
      visitDate: expect.stringMatching(/^\d{2}\/\d{2}\/\d{4}$/),
      appointmentId: base.appointment.id,
      locationName: orderingLocation.name,
    });
  });

  it('saves the collection data: AOE answers, specimen collection, completed pre-submission task and label', async () => {
    const specimen = await create<Specimen>({
      resourceType: 'Specimen',
      subject: { reference: `Patient/${base.patient.id}` },
    });
    const serviceRequest = await create<ServiceRequest>(
      makeServiceRequest('draft', { specimen: [{ type: 'Specimen', reference: `Specimen/${specimen.id}` }] })
    );
    relatedTargets.push(`ServiceRequest/${serviceRequest.id}`);
    const [preSubmissionTask, aoeResponse] = await Promise.all([
      create<Task>(makePreSubmissionTask(serviceRequest.id!)),
      create<QuestionnaireResponse>({
        resourceType: 'QuestionnaireResponse',
        status: 'in-progress',
        questionnaire: `${SECRETS.FHIR_API}/Questionnaire/${aoeQuestionnaire.id}`,
        basedOn: [{ reference: `ServiceRequest/${serviceRequest.id}` }],
        encounter: { reference: `Encounter/${base.encounter.id}` },
        subject: { reference: `Patient/${base.patient.id}` },
      }),
    ]);
    const collectedAt = new Date(Date.now() - 15 * 60_000).toISOString();

    const { statusCode, output } = await invokeZambdaHandler<{ presignedLabelURL?: string }>(
      index,
      {
        event: 'saveOrderCollectionData',
        serviceRequestId: serviceRequest.id,
        data: { 'fasting-hours': '12' },
        specimenCollectionDates: { [specimen.id!]: { date: collectedAt } },
        userTimezone: 'America/New_York',
      },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(output.presignedLabelURL).toEqual(expect.any(String));
    const [completedTask, answeredResponse, collectedSpecimen, provenances, labels] = await Promise.all([
      oystehr.fhir.get<Task>({ resourceType: 'Task', id: preSubmissionTask.id! }),
      oystehr.fhir.get<QuestionnaireResponse>({ resourceType: 'QuestionnaireResponse', id: aoeResponse.id! }),
      oystehr.fhir.get<Specimen>({ resourceType: 'Specimen', id: specimen.id! }),
      searchProvenances(`ServiceRequest/${serviceRequest.id}`),
      searchDocuments(`ServiceRequest/${serviceRequest.id}`),
    ]);
    expect(answeredResponse.status).toBe('completed');
    expect(answeredResponse.item).toEqual([{ linkId: 'fasting-hours', answer: [{ valueString: '12' }] }]);
    expect(completedTask.status).toBe('completed');
    expect(completedTask.owner?.reference).toBe(providerProfile);
    expect(provenances).toHaveLength(1);
    expect(completedTask.relevantHistory?.[0]?.reference).toBe(`Provenance/${provenances[0].id}`);
    expect(provenances[0].activity?.coding?.[0]?.code).toBe(PROVENANCE_ACTIVITY_CODING_ENTITY.completePstTask.code);
    expect(provenances[0].agent[0].who?.reference).toBe(providerProfile);
    expect(collectedSpecimen.collection?.collector?.reference).toBe(providerProfile);
    expect(new Date(collectedSpecimen.collection!.collectedDateTime!).getTime()).toBe(new Date(collectedAt).getTime());
    expect(labels.map((label) => label.type?.coding?.[0]?.code)).toEqual([EXTERNAL_LAB_LABEL_PDF_DOC_REF_DOCTYPE.code]);
  });
});
