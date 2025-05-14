import { TestStatus } from './in-house.types';

export const inHouseLabsTestStatuses: Record<TestStatus, TestStatus> = {
  ORDERED: 'ORDERED',
  COLLECTED: 'COLLECTED',
  FINAL: 'FINAL',
};

export const IN_HOUSE_LAB_TASK = {
  system: 'in-house-lab-task',
  code: {
    collectSampleTask: 'CST',
    inputResultsTask: 'IRT',
  },
} as const;

export const IN_HOUSE_LAB_DOCREF_CATEGORY = {
  system: 'in-house-lab-document-type',
  code: {
    sampleLabel: 'sample-label-form',
    resultForm: 'result-form',
  },
} as const;
