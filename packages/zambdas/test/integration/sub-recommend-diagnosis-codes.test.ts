import { FakeListChatModel } from '@langchain/core/utils/testing';
import Oystehr from '@oystehr/sdk';
import { Condition, Task } from 'fhir/r4b';
import { M2MClientMockType, OttehrTaskSystem, PRIVATE_EXTENSION_BASE_URL } from 'utils';
import { createDiagnosisCodeRecommendations } from '../../src/subscriptions/task/sub-recommend-diagnosis-codes';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

let baseResources: InsertFullAppointmentDataBaseResult;

describe('sub-recommend-diagnosis-codes integration tests', () => {
  // let oystehrLocalZambdas: Oystehr;
  let oystehr: Oystehr;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('sub-recommend-diagnosis-codes.test.ts', M2MClientMockType.provider);
    // oystehrLocalZambdas = setup.oystehrTestUserM2M;
    oystehr = setup.oystehr;
    baseResources = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    cleanup = setup.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('sub-recommend-diagnosis-codes happy paths', () => {
    it('should retrieve recommendations and save them-- success', async () => {
      const task: Task = {
        id: '8665a43e-d0d5-41d2-9f0e-1322db6f1bd5',
        resourceType: 'Task',
        status: 'requested',
        intent: 'order',
        focus: { reference: `Encounter/${baseResources.encounter.id}` },
        code: {
          coding: [
            {
              system: OttehrTaskSystem,
              code: 'recommend-diagnosis-codes',
            },
          ],
        },
      };
      const mockAIClient = new FakeListChatModel({
        responses: [
          `{
  "potentialDiagnoses": [
    {
      "diagnosis": "Allergic contact dermatitis",
      "icd10": "L23.9"
    }
  ]
}`,
        ],
      });

      let result: { taskStatus: Task['status']; statusReason?: string } | undefined;
      let error: any;
      try {
        result = await createDiagnosisCodeRecommendations(task, oystehr, mockAIClient);
      } catch (err) {
        error = err as Error;
      }
      expect(error).toBeUndefined();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('taskStatus');
      expect(result?.taskStatus).toEqual('completed');
      expect(result).toHaveProperty('statusReason');
      expect(result?.statusReason).toEqual('Recommended 1 diagnosis codes');

      const savedConditions = (
        await oystehr.fhir.search<Condition>({
          resourceType: 'Condition',
          params: [{ name: 'encounter', value: baseResources.encounter.id! }],
        })
      ).unbundle();
      const aiConditions = savedConditions.filter((resource) => {
        return (
          resource.meta?.tag?.find((tag) => tag.system === `${PRIVATE_EXTENSION_BASE_URL}/ai-potential-diagnosis`)
            ?.code === 'ai-potential-diagnosis'
        );
      });
      expect(aiConditions.length).toBe(1);
      expect(aiConditions[0].code?.coding?.[0].code).toBe('L23.9');
      expect(aiConditions[0].code?.coding?.[0].display).toBe('Allergic contact dermatitis');
    });
    it('handles multiple results in json in markdown-- success', async () => {
      const task: Task = {
        id: '8665a43e-d0d5-41d2-9f0e-1322db6f1bd5',
        resourceType: 'Task',
        status: 'requested',
        intent: 'order',
        focus: { reference: `Encounter/${baseResources.encounter.id}` },
        code: {
          coding: [
            {
              system: OttehrTaskSystem,
              code: 'recommend-diagnosis-codes',
            },
          ],
        },
      };
      const mockAIClient = new FakeListChatModel({
        responses: [
          `\`\`\`json
{
  "potentialDiagnoses": [
    {
      "diagnosis": "Allergic contact dermatitis",
      "icd10": "L23.9"
    },
    {
      "diagnosis": "Influenza virus infection",
      "icd10": "J11.1"
    }
  ]
}
\`\`\``,
        ],
      });

      let result: { taskStatus: Task['status']; statusReason?: string } | undefined;
      let error: any;
      try {
        result = await createDiagnosisCodeRecommendations(task, oystehr, mockAIClient);
      } catch (err) {
        error = err as Error;
      }
      expect(error).toBeUndefined();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('taskStatus');
      expect(result?.taskStatus).toEqual('completed');
      expect(result).toHaveProperty('statusReason');
      expect(result?.statusReason).toEqual('Recommended 2 diagnosis codes');

      const savedConditions = (
        await oystehr.fhir.search<Condition>({
          resourceType: 'Condition',
          params: [
            { name: 'encounter', value: baseResources.encounter.id! },
            { name: '_sort', value: '_lastUpdated' },
          ],
        })
      ).unbundle();
      const aiConditions = savedConditions.filter((resource) => {
        return (
          resource.meta?.tag?.find((tag) => tag.system === `${PRIVATE_EXTENSION_BASE_URL}/ai-potential-diagnosis`)
            ?.code === 'ai-potential-diagnosis'
        );
      });
      expect(aiConditions.length).toBe(2);
      expect(aiConditions[0].code?.coding?.[0].code).toBe('L23.9');
      expect(aiConditions[0].code?.coding?.[0].display).toBe('Allergic contact dermatitis');
      expect(aiConditions[1].code?.coding?.[0].code).toBe('J11.1');
      expect(aiConditions[1].code?.coding?.[0].display).toBe('Influenza virus infection');
    });
    it('should remove prior recommendations-- success', async () => {
      const task: Task = {
        id: '8665a43e-d0d5-41d2-9f0e-1322db6f1bd5',
        resourceType: 'Task',
        status: 'requested',
        intent: 'order',
        focus: { reference: `Encounter/${baseResources.encounter.id}` },
        code: {
          coding: [
            {
              system: OttehrTaskSystem,
              code: 'recommend-diagnosis-codes',
            },
          ],
        },
      };
      const mockAIClient = new FakeListChatModel({
        responses: [
          `{
  "potentialDiagnoses": [
    {
      "diagnosis": "Sneezing",
      "icd10": "R06.02"
    }
  ]
}`,
        ],
      });

      let result: { taskStatus: Task['status']; statusReason?: string } | undefined;
      let error: any;
      try {
        result = await createDiagnosisCodeRecommendations(task, oystehr, mockAIClient);
      } catch (err) {
        error = err as Error;
      }
      expect(error).toBeUndefined();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('taskStatus');
      expect(result?.taskStatus).toEqual('completed');
      expect(result).toHaveProperty('statusReason');
      expect(result?.statusReason).toEqual('Recommended 1 diagnosis codes');

      const savedConditions = (
        await oystehr.fhir.search<Condition>({
          resourceType: 'Condition',
          params: [{ name: 'encounter', value: baseResources.encounter.id! }],
        })
      ).unbundle();
      const aiConditions = savedConditions.filter((resource) => {
        return (
          resource.meta?.tag?.find((tag) => tag.system === `${PRIVATE_EXTENSION_BASE_URL}/ai-potential-diagnosis`)
            ?.code === 'ai-potential-diagnosis'
        );
      });
      expect(aiConditions.length).toBe(1);
      expect(aiConditions[0].code?.coding?.[0].code).toBe('R06.02');
      expect(aiConditions[0].code?.coding?.[0].display).toBe('Sneezing');
    });
    it('should remove all prior recommendations when all input is empty-- success', async () => {
      const task: Task = {
        id: '8665a43e-d0d5-41d2-9f0e-1322db6f1bd5',
        resourceType: 'Task',
        status: 'requested',
        intent: 'order',
        focus: { reference: `Encounter/${baseResources.encounter.id}` },
        code: {
          coding: [
            {
              system: OttehrTaskSystem,
              code: 'recommend-diagnosis-codes',
            },
          ],
        },
      };
      const mockAIClient = new FakeListChatModel({
        responses: [
          `{
  "potentialDiagnoses": [
    {
      "diagnosis": "Sneezing",
      "icd10": "R06.02"
    }
  ]
}`,
        ],
      });

      await oystehr.fhir.delete({ resourceType: 'ClinicalImpression', id: baseResources.clinicalImpression.id! });

      let result: { taskStatus: Task['status']; statusReason?: string } | undefined;
      let error: any;
      try {
        result = await createDiagnosisCodeRecommendations(task, oystehr, mockAIClient);
      } catch (err) {
        error = err as Error;
      }
      expect(error).toBeUndefined();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('taskStatus');
      expect(result?.taskStatus).toEqual('completed');
      expect(result).toHaveProperty('statusReason');
      expect(result?.statusReason).toEqual('Recommended 0 diagnosis codes');

      const savedConditions = (
        await oystehr.fhir.search<Condition>({
          resourceType: 'Condition',
          params: [{ name: 'encounter', value: baseResources.encounter.id! }],
        })
      ).unbundle();
      const aiConditions = savedConditions.filter((resource) => {
        return (
          resource.meta?.tag?.find((tag) => tag.system === `${PRIVATE_EXTENSION_BASE_URL}/ai-potential-diagnosis`)
            ?.code === 'ai-potential-diagnosis'
        );
      });
      expect(aiConditions.length).toBe(0);
    });
  });
});
