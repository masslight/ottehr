import { Patient } from 'fhir/r4b';
import { TOKEN_CATALOG } from 'utils/lib/form-tokens/token-catalog';
import { describe, expect, it } from 'vitest';
import { FormFillContext, resolveToken, TOKEN_RESOLVERS } from '../../src/ehr/shared/form-token-resolvers';

describe('form token catalog', () => {
  it('has a resolver for every descriptor, and a descriptor for every resolver', () => {
    // The catalog is deliberately split across packages: descriptors ship to the browser to build the
    // mapping UI, resolvers stay server-side. A descriptor with no resolver is a token an administrator
    // can pick that silently never fills anything, and a resolver with no descriptor is unreachable.
    const descriptorKeys = TOKEN_CATALOG.map((token) => token.key).sort();
    const resolverKeys = Object.keys(TOKEN_RESOLVERS).sort();

    expect(resolverKeys).toEqual(descriptorKeys);
  });

  it('has unique keys', () => {
    const keys = TOKEN_CATALOG.map((token) => token.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every token a non-empty label and a group', () => {
    for (const token of TOKEN_CATALOG) {
      expect(token.label.trim(), `token ${token.key} needs a label`).not.toBe('');
      expect(token.group, `token ${token.key} needs a group`).toBeTruthy();
    }
  });

  it('resolves against a populated encounter', () => {
    const patient: Patient = {
      resourceType: 'Patient',
      id: 'patient-1',
      name: [{ given: ['Ada', 'Marie'], family: 'Lovelace' }],
      birthDate: '1985-01-14',
      gender: 'female',
      address: [{ use: 'home', line: ['1 Analytical Way', 'Apt 2'], city: 'Austin', state: 'TX', postalCode: '78701' }],
      telecom: [
        { system: 'phone', value: '512-555-0100' },
        { system: 'email', value: 'ada@example.com' },
      ],
    };

    const ctx = {
      patient,
      encounter: { resourceType: 'Encounter', id: 'enc-1' },
      allChartData: {
        chartData: {
          diagnosis: [
            { code: 'M54.5', display: 'Low back pain', isPrimary: true },
            { code: 'R51', display: 'Headache', isPrimary: false },
          ],
        },
      },
      appointmentPackage: {
        appointment: { resourceType: 'Appointment', start: '2026-08-26T15:00:00Z' },
        location: { resourceType: 'Location', name: 'Downtown Clinic' },
      },
    } as unknown as FormFillContext;

    expect(resolveToken('patient.firstName', ctx)).toBe('Ada');
    expect(resolveToken('patient.middleName', ctx)).toBe('Marie');
    expect(resolveToken('patient.lastName', ctx)).toBe('Lovelace');
    expect(resolveToken('patient.fullName', ctx)).toBe('Ada Lovelace');
    expect(resolveToken('patient.dateOfBirth', ctx)).toBe('1985-01-14');
    expect(resolveToken('patient.addressLine1', ctx)).toBe('1 Analytical Way');
    expect(resolveToken('patient.addressLine2', ctx)).toBe('Apt 2');
    expect(resolveToken('patient.postalCode', ctx)).toBe('78701');
    expect(resolveToken('patient.phone', ctx)).toBe('512-555-0100');
    expect(resolveToken('patient.email', ctx)).toBe('ada@example.com');
    expect(resolveToken('visit.date', ctx)).toBe('2026-08-26T15:00:00Z');
    expect(resolveToken('facility.name', ctx)).toBe('Downtown Clinic');
    expect(resolveToken('diagnosis.primaryCode', ctx)).toBe('M54.5');
    expect(resolveToken('diagnosis.allDisplays', ctx)).toBe('Low back pain, Headache');
  });

  it('returns undefined rather than throwing when the chart is empty', () => {
    // Absent data is the normal case, not an error case: the fill service treats undefined as "leave
    // the field alone". A resolver that throws on a sparse chart would fail an entire prefill.
    const empty = {
      patient: { resourceType: 'Patient', id: 'p' },
      encounter: { resourceType: 'Encounter' },
      allChartData: { chartData: {} },
      appointmentPackage: {},
    } as unknown as FormFillContext;

    for (const token of TOKEN_CATALOG) {
      expect(() => resolveToken(token.key, empty), `token ${token.key} threw on an empty chart`).not.toThrow();
    }

    expect(resolveToken('patient.firstName', empty)).toBeUndefined();
    expect(resolveToken('diagnosis.primaryCode', empty)).toBeUndefined();
    expect(resolveToken('insurance.payerName', empty)).toBeUndefined();
  });
});
