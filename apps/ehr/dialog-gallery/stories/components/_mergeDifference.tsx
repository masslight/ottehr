// Shared setup for the two PatientsMergeDifference stories (not a story itself).
import { ReactElement } from 'react';
import { PatientsMergeDifference } from 'src/components/patients-merge/PatientsMergeDifference';
import { patientA, patientB } from './_shared';

/**
 * get-patient-account must answer per patientId, but the Oystehr SDK calls fetch with a Request
 * object and the harness fetch mock only exposes `init.body` to response functions. So this answers
 * that one zambda itself (reading the Request body) and defers everything else to the harness mock.
 */
export const mockPatientAccounts = (): void => {
  const next = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('get-patient-account')) return next(input, init);
    let body: any = {};
    try {
      body = input instanceof Request ? await input.clone().json() : JSON.parse(String(init?.body ?? '{}'));
    } catch {
      // keep the default
    }
    const output = {
      patient: body?.patientId === patientB.id ? patientB : patientA,
      coverages: {},
      insuranceOrgs: [],
      coverageChecks: [],
    };
    return new Response(JSON.stringify({ status: 200, output }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
};

export const renderMergeDifference = (): ReactElement => (
  <PatientsMergeDifference open close={() => undefined} patientIds={[patientA.id as string, patientB.id as string]} />
);
