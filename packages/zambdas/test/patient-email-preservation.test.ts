import { BatchInputBinaryPatchRequest } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Binary, Patient } from 'fhir/r4b';
import { PatientInfo } from 'utils';
import { describe, expect, it } from 'vitest';
import { creatingPatientUpdateRequest, getPatientPatchOpsPatientEmail } from '../src/shared/appointment/helpers';

// getPatchBinary encodes ops as btoa(unescape(encodeURIComponent(JSON.stringify(ops)))).
// For ASCII/JSON content this round-trips cleanly via Buffer.
function decodePatchOps(data: string): Operation[] {
  return JSON.parse(Buffer.from(data, 'base64').toString('utf-8'));
}

function isBinaryPatchRequest(req: unknown): req is BatchInputBinaryPatchRequest<Patient> {
  return typeof req === 'object' && req !== null && (req as any).method === 'PATCH' && 'resource' in (req as any);
}

function extractOps(request: ReturnType<typeof creatingPatientUpdateRequest>): Operation[] | null {
  if (!isBinaryPatchRequest(request)) return null;
  const data = (request.resource as Binary).data;
  if (!data) return null;
  return decodePatchOps(data);
}

const fhirPatientWithEmail: Patient = {
  resourceType: 'Patient',
  id: 'pt-001',
  name: [{ use: 'official', given: ['Jane'], family: 'Smith' }],
  telecom: [{ system: 'email', value: 'jane@example.com' }],
  extension: [],
};

const basePatientInfo: PatientInfo = {
  id: 'pt-001',
  firstName: 'Jane',
  lastName: 'Smith',
};

describe('getPatientPatchOpsPatientEmail', () => {
  it('produces no ops when email is undefined and patient has no email in telecom', () => {
    const patient: Patient = { resourceType: 'Patient', id: 'pt-002' };
    const ops = getPatientPatchOpsPatientEmail(patient, undefined);
    expect(ops).toHaveLength(0);
  });

  it('removes existing email from telecom when email is undefined', () => {
    const ops = getPatientPatchOpsPatientEmail(fhirPatientWithEmail, undefined);
    expect(ops.length).toBeGreaterThan(0);
    const removesEmail =
      ops.some((op) => op.op === 'remove') ||
      ops.some(
        (op) =>
          op.op === 'replace' &&
          Array.isArray(op.value) &&
          !(op.value as { system: string }[]).some((t) => t.system === 'email')
      );
    expect(removesEmail).toBe(true);
  });

  it('adds email to telecom when patient has none', () => {
    const patient: Patient = { resourceType: 'Patient', id: 'pt-003', telecom: [] };
    const ops = getPatientPatchOpsPatientEmail(patient, 'new@example.com');
    expect(ops.length).toBeGreaterThan(0);
    expect(ops.some((op) => JSON.stringify(op).includes('new@example.com'))).toBe(true);
  });
});

describe('creatingPatientUpdateRequest — email guard (OTR-3080 regression)', () => {
  it('preserves existing patient email when neither email nor noEmail is provided (EHR create-visit flow)', () => {
    // AddVisitPatientInfo omits email and noEmail — simulate that by not setting them.
    const patientInfo: PatientInfo = { ...basePatientInfo };

    const request = creatingPatientUpdateRequest(patientInfo, fhirPatientWithEmail);
    const ops = extractOps(request);

    if (ops !== null) {
      const telecomOps = ops.filter((op) => op.path === '/telecom' || op.path.startsWith('/telecom/'));
      expect(telecomOps).toHaveLength(0);
    }
    // ops === null means no patch at all — also correct, email is untouched
  });

  it('removes existing email when noEmail is explicitly true', () => {
    const patientInfo: PatientInfo = { ...basePatientInfo, noEmail: true };

    const request = creatingPatientUpdateRequest(patientInfo, fhirPatientWithEmail);
    const ops = extractOps(request);

    expect(ops).not.toBeNull();
    const telecomOps = ops!.filter((op) => op.path === '/telecom' || op.path.startsWith('/telecom/'));
    expect(telecomOps.length).toBeGreaterThan(0);

    const removesEmail =
      telecomOps.some((op) => op.op === 'remove') ||
      telecomOps.some(
        (op) =>
          op.op === 'replace' &&
          Array.isArray(op.value) &&
          !(op.value as { system: string }[]).some((t) => t.system === 'email')
      );
    expect(removesEmail).toBe(true);
  });

  it('updates existing email when a new email is explicitly provided', () => {
    const patientInfo: PatientInfo = { ...basePatientInfo, email: 'updated@example.com' };

    const request = creatingPatientUpdateRequest(patientInfo, fhirPatientWithEmail);
    const ops = extractOps(request);

    expect(ops).not.toBeNull();
    expect(ops!.some((op) => JSON.stringify(op).includes('updated@example.com'))).toBe(true);
  });
});
