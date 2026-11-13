// Shared abnormal-vitals mock data (not a story itself).
import { GetVitalsResponseData } from 'utils/lib/types/api/chart-data/get-vitals.types';
import { ENCOUNTER_ID, PATIENT_ID } from './_fixtures';

const base = {
  patientId: PATIENT_ID,
  encounterId: ENCOUNTER_ID,
  authorId: 'practitioner-1',
  authorName: 'Alex Morgan, RN',
  lastUpdated: '2026-11-13T15:06:00.000Z',
};

export const abnormalVitals = {
  'vital-temperature': [
    { ...base, resourceId: 'obs-temp', field: 'vital-temperature', value: 39.6, alertCriticality: 'abnormal' },
  ],
  'vital-heartbeat': [
    { ...base, resourceId: 'obs-hr', field: 'vital-heartbeat', value: 148, alertCriticality: 'critical' },
  ],
  'vital-blood-pressure': [
    {
      ...base,
      resourceId: 'obs-bp',
      field: 'vital-blood-pressure',
      systolicPressure: 162,
      diastolicPressure: 98,
      alertCriticality: 'abnormal',
    },
  ],
} as unknown as GetVitalsResponseData;
