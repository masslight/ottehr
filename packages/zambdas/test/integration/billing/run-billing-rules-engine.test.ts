import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, Provenance, Task } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { RunBillingRulesEngineResponse } from 'utils/lib/types/data/billing/rules-engine.schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RULES_ENGINE_FHIR, RULES_ENGINE_TASK_SYSTEM } from '../../../src/billing/rules-engine/constants';
import {
  RULES_ENGINE_INPUT_SKIP_RULES_CODE,
  RULES_ENGINE_INPUT_SUBMISSION_INSURANCE_CODE,
  RULES_ENGINE_INPUT_SUBMISSION_TYPE_CODE,
  RULES_ENGINE_INPUT_SYSTEM,
} from '../../../src/billing/rules-engine/serialization';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

const SETTLE_TIMEOUT_MS = 60_000;

describe('run-billing-rules-engine', () => {
  let billing: Oystehr;
  let caller: Oystehr;
  let callerProfile: string;
  let cleanup: () => Promise<void>;
  let claimId: string;
  const taskIds: string[] = [];

  const waitForTaskToSettle = async (taskId: string): Promise<void> => {
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const task = await billing.fhir.get<Task>({ resourceType: 'Task', id: taskId });
      if (task.status !== 'requested' && task.status !== 'in-progress') return;
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/run-billing-rules-engine.test.ts',
      M2MClientMockType.provider
    );
    billing = setup.oystehrBilling;
    caller = setup.oystehrTestUserM2M;
    callerProfile = setup.testUserM2MProfile;
    cleanup = setup.cleanup;

    const claim = await billing.fhir.create<Claim>(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Claim',
          meta: { tag: [{ system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.patient }] },
          status: 'draft',
          use: 'claim',
          type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
          patient: { display: 'Integration Test Patient' },
          created: '2026-01-01',
          provider: { display: 'Unknown' },
          priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
          insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
        },
        setup.processId
      ) as Claim
    );
    claimId = claim.id!;
  }, 120_000);

  afterAll(async () => {
    for (const taskId of taskIds) await waitForTaskToSettle(taskId);
    const provenances = (
      await billing.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Claim/${claimId}` }],
      })
    ).unbundle();
    await billing.fhir.batch({
      requests: [
        ...provenances.map(
          (provenance): BatchInputDeleteRequest => ({ method: 'DELETE', url: `Provenance/${provenance.id}` })
        ),
        ...taskIds.map((id): BatchInputDeleteRequest => ({ method: 'DELETE', url: `Task/${id}` })),
        { method: 'DELETE', url: `Claim/${claimId}` },
      ],
    });
    await cleanup();
  }, SETTLE_TIMEOUT_MS + 60_000);

  it("queues the engine for the claim's AR stage, requested by the caller", async () => {
    const output = (
      await caller.zambda.execute({
        id: 'run-billing-rules-engine',
        claimIds: [claimId],
        skipRules: true,
        submissionType: 'new',
        submissionInsurance: 'primary',
      })
    ).output as RunBillingRulesEngineResponse;
    taskIds.push(...output.results.map((result) => result.taskId));

    expect(output.results).toEqual([
      {
        claimId,
        engine: 'patient-ar-pre-invoice',
        skipRules: true,
        submissionType: 'new',
        submissionInsurance: 'primary',
        taskId: expect.any(String),
      },
    ]);

    const task = await billing.fhir.get<Task>({ resourceType: 'Task', id: output.results[0].taskId });
    expect(task.code?.coding).toEqual([
      { system: RULES_ENGINE_TASK_SYSTEM, code: RULES_ENGINE_FHIR['patient-ar-pre-invoice'].taskCode },
    ]);
    expect(task.focus).toEqual({ reference: `Claim/${claimId}` });
    expect(task.requester).toEqual({ reference: callerProfile });
    expect(task.input).toEqual([
      {
        type: { coding: [{ system: RULES_ENGINE_INPUT_SYSTEM, code: RULES_ENGINE_INPUT_SKIP_RULES_CODE }] },
        valueBoolean: true,
      },
      {
        type: { coding: [{ system: RULES_ENGINE_INPUT_SYSTEM, code: RULES_ENGINE_INPUT_SUBMISSION_TYPE_CODE }] },
        valueString: 'new',
      },
      {
        type: { coding: [{ system: RULES_ENGINE_INPUT_SYSTEM, code: RULES_ENGINE_INPUT_SUBMISSION_INSURANCE_CODE }] },
        valueString: 'primary',
      },
    ]);
  }, 60_000);
});
