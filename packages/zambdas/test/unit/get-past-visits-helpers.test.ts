import Oystehr from '@oystehr/sdk';
import { describe, expect, test, vi } from 'vitest';
import { getFhirResources } from '../../src/patient/appointment/get-past-visits/helpers';

describe('get-past-visits helpers', () => {
  // Appointment:actor puts any booked Practitioner in the result set, and iterating Encounter:participant from it
  // pulled in every Encounter that provider ever attended into one patient's past-visits search. Encounters are
  // mapped by appointment, so only Encounter:appointment matches are used.
  test("does not revinclude encounters by participant, which pulls in a booked provider's whole history", async () => {
    const search = vi.fn(async () => ({ unbundle: () => [] }));

    await getFhirResources({ fhir: { search } } as unknown as Oystehr, [], 'patient-1');

    expect(search).toHaveBeenCalledOnce();
    const [{ params }] = search.mock.calls[0] as unknown as [{ params: { name: string; value: string }[] }];
    expect(params).toContainEqual({ name: '_revinclude:iterate', value: 'Encounter:appointment' });
    expect(params).not.toContainEqual({ name: '_revinclude:iterate', value: 'Encounter:participant' });
  });
});
