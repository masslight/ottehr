import { describe, expect, test } from 'vitest';
import { toProviderDetails } from '../../src/features/visits/shared/hooks/useGetEmployees';

// Pin a load-bearing identifier-namespace invariant: the `practitionerId`
// field returned by toProviderDetails must come from the FHIR Practitioner
// reference embedded in `profile`, NOT from any other id on the source
// object. Downstream consumers of the EmployeeSelectInput value (the
// chosen assignee in AssignTaskDialog, the provider URL filter on the
// appointments page, the Tasks "Assigned to" pre-select) use this id as
// a Practitioner identifier — useAssignTask in particular builds
// `'Practitioner/' + assignee.id` to construct a FHIR reference on
// Task.owner.
//
// The Oystehr User id (e.g. EmployeeDetails.id) lives in a DIFFERENT
// id-space from the Practitioner id. Mapping from the wrong source
// silently produces broken FHIR references (`Practitioner/<user-id>`
// resolving to nothing) — a latent bug that shipped historically and was
// only surfaced when the input layer was rewritten to use
// toProviderDetails. This test ensures the boundary can't drift back.
describe('toProviderDetails', () => {
  test('practitionerId is the FHIR Practitioner id parsed from profile', () => {
    const result = toProviderDetails({
      profile: 'Practitioner/practitioner-abc-123',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(result.practitionerId).toBe('practitioner-abc-123');
  });

  test('practitionerId is NOT taken from any other id field on the source', () => {
    // EmployeeDetails carries an `id` (the User id) alongside `profile`.
    // toProviderDetails must ignore the User id and only use the parsed
    // Practitioner reference; mixing them up is the regression this test
    // exists to catch.
    const result = toProviderDetails({
      // @ts-expect-error -- intentionally including an extraneous id to
      // simulate the EmployeeDetails shape and prove it's not picked up.
      id: 'user-id-xyz',
      profile: 'Practitioner/practitioner-abc-123',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(result.practitionerId).toBe('practitioner-abc-123');
    expect(result.practitionerId).not.toBe('user-id-xyz');
  });

  test('name composes from firstName + lastName, trimmed', () => {
    expect(toProviderDetails({ profile: 'Practitioner/abc', firstName: 'Jane', lastName: 'Doe' }).name).toBe(
      'Jane Doe'
    );
    expect(toProviderDetails({ profile: 'Practitioner/abc', firstName: '', lastName: 'Doe' }).name).toBe('Doe');
    expect(toProviderDetails({ profile: 'Practitioner/abc', firstName: 'Jane', lastName: '' }).name).toBe('Jane');
  });

  test('name falls back to the canonical `name` field when firstName + lastName are both blank', () => {
    // The upstream filter in useGetEmployeesWithDetails admits employees on
    // EmployeeDetails.name (the canonical display string). If
    // toProviderDetails only consulted firstName/lastName, employees whose
    // canonical name was set but whose split-name fields were blank would
    // slip through the filter and render as blank dropdown options. The
    // fallback ensures the composed-or-canonical name is always non-blank
    // for surviving entries.
    const result = toProviderDetails({
      profile: 'Practitioner/abc',
      firstName: '',
      lastName: '',
      name: 'Dr. Smith',
    });
    expect(result.name).toBe('Dr. Smith');
  });

  test('composed firstName + lastName wins over the canonical name when both are present', () => {
    // The composed form is preferred when available — it's the explicit
    // structured representation. The canonical `name` is only consulted
    // when the composition would otherwise produce a blank.
    const result = toProviderDetails({
      profile: 'Practitioner/abc',
      firstName: 'Jane',
      lastName: 'Doe',
      name: 'Legacy Full Name',
    });
    expect(result.name).toBe('Jane Doe');
  });
});
