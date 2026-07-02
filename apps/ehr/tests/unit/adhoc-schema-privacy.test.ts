import { describe, expect, it } from 'vitest';
import { buildSchema, FieldDef } from '../../src/features/reports/adHoc/schema';

// Privacy invariant: identifier / contact / sub-state-geography columns must NEVER have their
// value domain sent to the LLM, even on a narrow date range where the distinct set is small — that
// set IS the patients' names/phones/emails/ZIPs (HIPAA identifiers). Operational categoricals keep
// their domain. Regression guard for the confirmed PHI-leak finding.
describe('buildSchema value-domain withholding', () => {
  const defs: FieldDef[] = [
    { name: 'patientName', type: 'string', description: 'Patient full name.' },
    { name: 'firstName', type: 'string', description: 'Patient first name.' },
    { name: 'lastName', type: 'string', description: 'Patient last name.' },
    { name: 'phone', type: 'string', description: 'Patient phone.' },
    { name: 'email', type: 'string', description: 'Patient email.' },
    { name: 'city', type: 'string', description: 'Patient city.' },
    { name: 'zip', type: 'string', description: 'Patient ZIP.' },
    { name: 'patientId', type: 'string', description: 'Patient resource id.' },
    { name: 'appointmentId', type: 'string', description: 'Appointment resource id.' },
    { name: 'memberId', type: 'string', description: 'Insurance member id.' },
    { name: 'registeredByName', type: 'string', description: 'Registrar name.' },
    { name: 'dateOfBirth', type: 'date', description: 'DOB.' },
    { name: 'secretField', type: 'string', description: 'PII with a non-obvious name.', sensitive: true },
    // Kept — operational categoricals / non-identifying:
    { name: 'visitType', type: 'string', description: 'Visit type.' },
    { name: 'source', type: 'string', description: 'Marketing/discovery channel.' },
    { name: 'state', type: 'string', description: 'US state (not sub-state geography).' },
    { name: 'insurancePaid', type: 'number', description: 'Amount insurer paid.' },
    { name: 'icdCodes', type: 'string[]', description: 'ICD-10 codes.' },
    { name: 'age', type: 'number', description: 'Age in years.' },
  ];
  const rows = [
    {
      patientName: 'Jane Doe',
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '555-1212',
      email: 'jane@example.com',
      city: 'Trenton',
      zip: '08608',
      patientId: 'p-abc',
      appointmentId: 'a-abc',
      memberId: 'M123',
      registeredByName: 'Reg Istrar',
      dateOfBirth: '1989-12-09',
      secretField: 'hush',
      visitType: 'In-Person',
      source: 'Google',
      state: 'NJ',
      insurancePaid: 42,
      icdCodes: ['H66.90'],
      age: 36,
    },
  ] as unknown as Parameters<typeof buildSchema>[0];

  const schema = buildSchema(rows, { datasetId: 'd', label: 'D', description: '' }, defs);
  const field = (name: string): { values?: unknown; min?: unknown; max?: unknown } =>
    schema.fields.find((f) => f.name === name)!;

  it.each([
    'patientName',
    'firstName',
    'lastName',
    'phone',
    'email',
    'city',
    'zip',
    'patientId',
    'appointmentId',
    'memberId',
    'registeredByName',
    'secretField',
  ])('withholds the value domain for %s', (name) => {
    expect(field(name).values).toBeUndefined();
  });

  it('withholds the DOB range (exact birth dates are identifiers)', () => {
    expect(field('dateOfBirth').min).toBeUndefined();
    expect(field('dateOfBirth').max).toBeUndefined();
  });

  it.each(['visitType', 'source', 'state', 'icdCodes'])('keeps the value domain for %s', (name) => {
    expect(field(name).values).toBeDefined();
  });

  it('keeps numeric ranges (age, insurancePaid)', () => {
    expect(field('age').min).toBe(36);
    expect(field('insurancePaid').max).toBe(42);
  });
});
