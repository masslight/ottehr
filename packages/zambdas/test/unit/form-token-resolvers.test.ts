import { describe, expect, it } from 'vitest';
import { FormFillContext, resolveToken } from '../../src/ehr/shared/form-token-resolvers';

/**
 * Resolution of the tokens whose value is computed rather than copied.
 *
 * The catalog test covers the straight reads. These are the ones that convert units, pick between several
 * records, or reshape a stored value — where being wrong produces a plausible number on a form rather than
 * a blank, which is the failure this feature exists to avoid.
 */
const contextWith = (chartData: Record<string, unknown>, extra: Record<string, unknown> = {}): FormFillContext =>
  ({
    patient: { resourceType: 'Patient', id: 'patient-1' },
    encounter: { resourceType: 'Encounter', id: 'enc-1' },
    allChartData: { chartData },
    appointmentPackage: { appointment: { resourceType: 'Appointment' } },
    ...extra,
  }) as unknown as FormFillContext;

describe('vitals tokens', () => {
  const height = { field: 'vital-height', value: 180, lastUpdated: '2026-09-01T10:00:00Z' };
  const weight = { field: 'vital-weight', value: 70, lastUpdated: '2026-09-01T10:00:00Z' };

  it('converts a stored height into every unit a form might ask for', () => {
    const ctx = contextWith({ vitalsObservations: [height] });

    // Stored in centimetres; the rest is derived at read time so a form can ask however it likes.
    expect(resolveToken('vitals.heightCm', ctx)).toBe(180);
    expect(resolveToken('vitals.heightInches', ctx)).toBe(70.87);
    // The DOT medical exam splits these across two boxes.
    expect(resolveToken('vitals.heightFeet', ctx)).toBe(5);
    expect(resolveToken('vitals.heightInchesRemainder', ctx)).toBe(11);
  });

  it('converts a stored weight into pounds', () => {
    const ctx = contextWith({ vitalsObservations: [weight] });

    expect(resolveToken('vitals.weightKg', ctx)).toBe(70);
    expect(resolveToken('vitals.weightLbs', ctx)).toBe(154.3);
  });

  it('takes the most recent reading, not the first recorded', () => {
    // Vitals accumulate across a visit and arrive in no guaranteed order.
    const ctx = contextWith({
      vitalsObservations: [
        { field: 'vital-height', value: 165, lastUpdated: '2026-09-01T08:00:00Z' },
        { field: 'vital-height', value: 180, lastUpdated: '2026-09-01T11:00:00Z' },
        { field: 'vital-height', value: 170, lastUpdated: '2026-09-01T09:00:00Z' },
      ],
    });

    expect(resolveToken('vitals.heightCm', ctx)).toBe(180);
  });

  it('leaves a refused weight blank rather than writing a number that was never taken', () => {
    const ctx = contextWith({
      vitalsObservations: [{ field: 'vital-weight', extraWeightOptions: ['patient_refused'] }],
    });

    expect(resolveToken('vitals.weightKg', ctx)).toBeUndefined();
    expect(resolveToken('vitals.weightLbs', ctx)).toBeUndefined();
  });

  it('reads blood pressure as a pair and as its parts', () => {
    const ctx = contextWith({
      vitalsObservations: [{ field: 'vital-blood-pressure', systolicPressure: 128, diastolicPressure: 82 }],
    });

    expect(resolveToken('vitals.bloodPressureSystolic', ctx)).toBe(128);
    expect(resolveToken('vitals.bloodPressureDiastolic', ctx)).toBe(82);
    expect(resolveToken('vitals.bloodPressure', ctx)).toBe('128/82');
  });

  it('offers temperature in both units from one Celsius reading', () => {
    const ctx = contextWith({ vitalsObservations: [{ field: 'vital-temperature', value: 37 }] });

    expect(resolveToken('vitals.temperatureC', ctx)).toBe(37);
    expect(resolveToken('vitals.temperatureF', ctx)).toBe(98.6);
  });

  it('treats an empty last menstrual period as absent', () => {
    // Stored as `valueDateTime ?? ''`, so the empty string is the shape of "not recorded".
    const ctx = contextWith({ vitalsObservations: [{ field: 'vital-last-menstrual-period', value: '' }] });

    expect(resolveToken('vitals.lastMenstrualPeriod', ctx)).toBeUndefined();
  });

  it('resolves nothing when no vitals were taken', () => {
    const ctx = contextWith({});

    expect(resolveToken('vitals.heightCm', ctx)).toBeUndefined();
    expect(resolveToken('vitals.bloodPressure', ctx)).toBeUndefined();
  });
});

describe('allergy tokens', () => {
  it('joins current allergies, unwrapping the picker’s "Other" prefix', () => {
    const ctx = contextWith({
      allergies: [
        { name: 'Penicillin', current: true },
        // Free-text allergies are stored with the wrapper baked in; it is an entry artifact, not the
        // name of what the patient reacts to.
        { name: 'Other (peanuts)', current: true },
      ],
    });

    expect(resolveToken('allergies.all', ctx)).toBe('Penicillin, peanuts');
  });

  it('omits allergies the provider has retired', () => {
    const ctx = contextWith({
      allergies: [
        { name: 'Penicillin', current: true },
        { name: 'Sulfa', current: false },
      ],
    });

    expect(resolveToken('allergies.all', ctx)).toBe('Penicillin');
  });

  it('resolves nothing when none are recorded', () => {
    // Deliberately not "None": an empty list means nobody has said, which is not the same as a patient
    // with no allergies, and a form asserting the latter is a clinical claim we cannot make.
    expect(resolveToken('allergies.all', contextWith({ allergies: [] }))).toBeUndefined();
    expect(resolveToken('allergies.all', contextWith({}))).toBeUndefined();
  });
});

describe('patient tokens with logic behind them', () => {
  const withPatient = (patient: Record<string, unknown>): FormFillContext =>
    contextWith({}, { patient: { resourceType: 'Patient', id: 'p', ...patient } });

  it('builds a one-line address, skipping the parts that are absent', () => {
    const ctx = withPatient({
      address: [{ use: 'home', line: ['1 Analytical Way'], city: 'Austin', state: 'TX', postalCode: '78701' }],
    });

    expect(resolveToken('patient.addressFull', ctx)).toBe('1 Analytical Way, Austin, TX, 78701');
  });

  it('reads the Social Security number, and its last four separately', () => {
    const ctx = withPatient({
      identifier: [{ system: 'http://hl7.org/fhir/sid/us-ssn', value: '123-45-6789' }],
    });

    expect(resolveToken('patient.ssn', ctx)).toBe('123-45-6789');
    expect(resolveToken('patient.ssnLast4', ctx)).toBe('6789');
  });

  it('takes the last four from the digits, however the number was punctuated', () => {
    const ctx = withPatient({ identifier: [{ system: 'http://hl7.org/fhir/sid/us-ssn', value: '123456789' }] });

    expect(resolveToken('patient.ssnLast4', ctx)).toBe('6789');
  });
});

describe('workers compensation tokens', () => {
  const ctx = contextWith(
    {},
    {
      workersComp: {
        employer: {
          resourceType: 'Organization',
          name: 'Acme Roofing',
          address: [{ line: ['12 Ladder Lane'], city: 'Austin', state: 'TX', postalCode: '78702' }],
          telecom: [
            { system: 'phone', value: '512-555-0111' },
            { system: 'fax', value: '512-555-0112' },
          ],
          // A named person at the employer, which FHIR carries as a single HumanName rather than a list.
          contact: [{ name: { given: ['Wile'], family: 'Coyote' }, purpose: { text: 'Safety Officer' } }],
        },
        carrierName: 'State Fund',
      },
    }
  );

  it('resolves the employer and the person named there', () => {
    expect(resolveToken('workersComp.employerName', ctx)).toBe('Acme Roofing');
    expect(resolveToken('workersComp.employerFax', ctx)).toBe('512-555-0112');
    expect(resolveToken('workersComp.employerAddressFull', ctx)).toBe('12 Ladder Lane, Austin, TX, 78702');
    expect(resolveToken('workersComp.employerContactName', ctx)).toBe('Wile Coyote');
    expect(resolveToken('workersComp.employerContactTitle', ctx)).toBe('Safety Officer');
  });

  it('resolves the carrier', () => {
    // DWC073 asks for this by name in field 11.
    expect(resolveToken('workersComp.carrierName', ctx)).toBe('State Fund');
  });

  it('resolves nothing for a visit with no workers compensation account', () => {
    expect(resolveToken('workersComp.employerName', contextWith({}))).toBeUndefined();
  });
});

describe('form tokens', () => {
  it('gives today as a plain date, in the visit’s timezone', () => {
    const ctx = contextWith({}, { appointmentPackage: { timezone: 'America/Chicago' } });

    // Asserted by shape rather than value: the point is that it is a date-only string the date transform
    // can format, not which day the suite happens to run on.
    expect(resolveToken('form.currentDate', ctx)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
