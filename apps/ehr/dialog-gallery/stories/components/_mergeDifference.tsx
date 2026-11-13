// Shared setup for the two PatientsMergeDifference stories (not a story itself).
import { ReactElement } from 'react';
import { PatientsMergeDifference } from 'src/components/patients-merge/PatientsMergeDifference';
import type { FetchMock } from '../../harness/story';
import { patientA, patientB } from './_shared';

export const mergeDifferenceMocks: FetchMock[] = [
  {
    url: 'get-patient-account',
    response: ({ body }: { body: any }) => ({
      status: 200,
      output: {
        patient: body?.patientId === patientB.id ? patientB : patientA,
        coverages: {},
        insuranceOrgs: [],
        coverageChecks: [],
      },
    }),
  },
];

export const renderMergeDifference = (): ReactElement => (
  <PatientsMergeDifference open close={() => undefined} patientIds={[patientA.id as string, patientB.id as string]} />
);
