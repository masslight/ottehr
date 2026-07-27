import { Operation } from 'fast-json-patch';
import { Appointment, Patient } from 'fhir/r4b';
import { OTTEHR_MODULE, PatientInfo } from 'utils';
import { describe, expect, it, test } from 'vitest';
import { isOnDemandVirtualAppointment } from '../src/shared';
import { creatingPatientUpdateRequest, getPatientPatchOpsPatientEmail } from '../src/shared/appointment/helpers';

const makeAppointment = (module: OTTEHR_MODULE, appointmentTypeText?: string): Appointment => ({
  resourceType: 'Appointment',
  status: 'booked',
  participant: [],
  meta: {
    tag: [{ code: module }],
  },
  ...(appointmentTypeText && {
    appointmentType: {
      text: appointmentTypeText,
    },
  }),
});

describe('isOnDemandVirtualAppointment', () => {
  test('returns true for a telemed walk-in appointment', () => {
    expect(isOnDemandVirtualAppointment(makeAppointment(OTTEHR_MODULE.TM, 'walkin'))).toBe(true);
  });

  test('returns true for a telemed appointment with no appointmentType (defaults to walk-in)', () => {
    expect(isOnDemandVirtualAppointment(makeAppointment(OTTEHR_MODULE.TM))).toBe(true);
  });

  test('returns false for a pre-booked telemed appointment', () => {
    expect(isOnDemandVirtualAppointment(makeAppointment(OTTEHR_MODULE.TM, 'prebook'))).toBe(false);
  });

  test('returns false for a post-telemed appointment', () => {
    expect(isOnDemandVirtualAppointment(makeAppointment(OTTEHR_MODULE.TM, 'posttelemed'))).toBe(false);
  });

  test('returns false for an in-person walk-in appointment', () => {
    expect(isOnDemandVirtualAppointment(makeAppointment(OTTEHR_MODULE.IP, 'walkin'))).toBe(false);
  });

  test('returns false for a pre-booked in-person appointment', () => {
    expect(isOnDemandVirtualAppointment(makeAppointment(OTTEHR_MODULE.IP, 'prebook'))).toBe(false);
  });
});

// Decode the base64-encoded JSON patch operations stored inside a PATCH Binary request.
function decodePatchOps(request: ReturnType<typeof creatingPatientUpdateRequest>): Operation[] {
  if (!request) return [];
  const data = (request as any).resource?.data as string | undefined;
  if (!data) return [];
  return JSON.parse(decodeURIComponent(escape(atob(data))));
}

const telecomOnlyOps = (ops: Operation[]): Operation[] => ops.filter((op) => op.path.startsWith('/telecom'));

// Returns a fresh FHIR Patient with an existing email address.
// A factory is used rather than a shared const because getPatientPatchOpsPatientEmail
// mutates the telecom array in place, which would corrupt a shared fixture across tests.
const makeFhirPatientWithEmail = (): Patient => ({
  resourceType: 'Patient',
  id: 'pt-existing',
  name: [{ use: 'official', family: 'Doe', given: ['Jane'] }],
  extension: [],
  telecom: [{ system: 'email', value: 'jane@example.com' }],
  birthDate: '1985-06-15',
  gender: 'female',
});

// The minimum PatientInfo that mirrors the FHIR patient but omits email/noEmail,
// matching what AddPatient.tsx sends when a staff member books a return visit.
const returningPatientInfoNoEmail: PatientInfo = {
  id: 'pt-existing',
  dateOfBirth: '1985-06-15',
  sex: 'female',
};

describe('getPatientPatchOpsPatientEmail', () => {
  it('produces a replace op when a new email value is supplied', () => {
    const ops = getPatientPatchOpsPatientEmail(makeFhirPatientWithEmail(), 'updated@example.com');
    expect(ops).toHaveLength(1);
    expect(ops[0].op).toBe('replace');
    expect(ops[0].path).toBe('/telecom');
  });

  it('produces no ops when the supplied email matches the existing one', () => {
    const ops = getPatientPatchOpsPatientEmail(makeFhirPatientWithEmail(), 'jane@example.com');
    expect(ops).toHaveLength(0);
  });

  it('produces a removal op when email is undefined (explicit noEmail path)', () => {
    // This is the raw function behaviour for the "user checked noEmail" case.
    // The call-site guard in creatingPatientUpdateRequest prevents this branch
    // from firing when email was simply absent from the form submission.
    const ops = getPatientPatchOpsPatientEmail(makeFhirPatientWithEmail(), undefined);
    expect(ops).toHaveLength(1);
    expect(ops[0].op).toBe('remove');
    expect(ops[0].path).toBe('/telecom');
  });

  it('produces no ops when email is undefined and the patient has no existing email', () => {
    const patientWithoutEmail: Patient = { ...makeFhirPatientWithEmail(), telecom: [] };
    const ops = getPatientPatchOpsPatientEmail(patientWithoutEmail, undefined);
    expect(ops).toHaveLength(0);
  });
});

describe('creatingPatientUpdateRequest — email preservation', () => {
  it('does not emit telecom patch ops when email and noEmail are both absent from the submission', () => {
    // Regression: AddPatient.tsx omits email/noEmail for returning patients, which
    // previously caused getPatientPatchOpsPatientEmail to be called with undefined
    // and silently wipe the patient's stored email address.
    const request = creatingPatientUpdateRequest(returningPatientInfoNoEmail, makeFhirPatientWithEmail());
    const telecomOps = telecomOnlyOps(decodePatchOps(request));
    expect(telecomOps).toHaveLength(0);
  });

  it('emits a telecom removal op when noEmail is explicitly true', () => {
    const patientInfo: PatientInfo = { ...returningPatientInfoNoEmail, noEmail: true };
    const request = creatingPatientUpdateRequest(patientInfo, makeFhirPatientWithEmail());
    const telecomOps = telecomOnlyOps(decodePatchOps(request));
    expect(telecomOps).toHaveLength(1);
    expect(telecomOps[0].op).toBe('remove');
  });

  it('emits a telecom replace op when a new email is supplied', () => {
    const patientInfo: PatientInfo = { ...returningPatientInfoNoEmail, email: 'new@example.com' };
    const request = creatingPatientUpdateRequest(patientInfo, makeFhirPatientWithEmail());
    const telecomOps = telecomOnlyOps(decodePatchOps(request));
    expect(telecomOps).toHaveLength(1);
    expect(telecomOps[0].op).toBe('replace');
  });
});
