import { QueryClient } from '@tanstack/react-query';
import { Encounter } from 'fhir/r4b';
import { ENCOUNTER_VISIT_OCCUPATIONAL_MEDICINE_EMPLOYER_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getVisitOccupationalMedicineEmployerFromEncounter } from 'utils/lib/fhir/encounter';
import { EHRVisitDetails } from 'utils/lib/types/data/visit-details.types';
import { describe, expect, test } from 'vitest';
import { applyVisitEmployerToVisitDetailsCache, buildVisitEmployerUpdate } from './visitEmployer';

describe('buildVisitEmployerUpdate', () => {
  test('passes a selected employer reference through', () => {
    const ref = { reference: 'Organization/abc', display: 'Acme' };
    expect(buildVisitEmployerUpdate('appt-1', ref)).toEqual({
      appointmentId: 'appt-1',
      bookingDetails: { visitOccupationalMedicineEmployer: ref },
    });
  });

  // The "clear" path is what the visit-details endpoint relies on to remove the extension.
  test('maps null/undefined employer to null (clear)', () => {
    expect(buildVisitEmployerUpdate('appt-1', null).bookingDetails.visitOccupationalMedicineEmployer).toBeNull();
    expect(buildVisitEmployerUpdate('appt-1', undefined).bookingDetails.visitOccupationalMedicineEmployer).toBeNull();
  });
});

describe('applyVisitEmployerToVisitDetailsCache', () => {
  const OLD_EMPLOYER = { reference: 'Organization/old-employer', display: 'Old Employer' };
  const NEW_EMPLOYER = {
    reference: 'https://fhir.ottehr.com/billing/non-insurance-organization/11111111-1111-4111-8111-111111111111',
    display: 'FedEx',
  };

  const seedCache = (queryClient: QueryClient, encounter: Encounter): void => {
    queryClient.setQueryData<Partial<EHRVisitDetails>>(['get-visit-details', 'appt-1'], { encounter });
  };

  const cachedEmployer = (
    queryClient: QueryClient
  ): ReturnType<typeof getVisitOccupationalMedicineEmployerFromEncounter> => {
    const details = queryClient.getQueryData<EHRVisitDetails>(['get-visit-details', 'appt-1']);
    return details?.encounter ? getVisitOccupationalMedicineEmployerFromEncounter(details.encounter) : undefined;
  };

  const encounterWithEmployer = (): Encounter =>
    ({
      resourceType: 'Encounter',
      id: 'enc-1',
      status: 'in-progress',
      extension: [
        { url: 'https://example.com/unrelated', valueString: 'keep-me' },
        {
          url: ENCOUNTER_VISIT_OCCUPATIONAL_MEDICINE_EMPLOYER_EXTENSION_URL,
          valueReference: OLD_EMPLOYER,
        },
      ],
    }) as Encounter;

  // The point of the cache write: reseeds between save and refetch must read the new employer,
  // never flash the previous one.
  test('replaces the cached employer with the just-saved one', () => {
    const queryClient = new QueryClient();
    seedCache(queryClient, encounterWithEmployer());

    applyVisitEmployerToVisitDetailsCache(queryClient, 'appt-1', NEW_EMPLOYER);

    expect(cachedEmployer(queryClient)).toEqual(NEW_EMPLOYER);
    const details = queryClient.getQueryData<EHRVisitDetails>(['get-visit-details', 'appt-1']);
    expect(details?.encounter?.extension).toContainEqual({
      url: 'https://example.com/unrelated',
      valueString: 'keep-me',
    });
  });

  test('clears the cached employer when the save removed it', () => {
    const queryClient = new QueryClient();
    seedCache(queryClient, encounterWithEmployer());

    applyVisitEmployerToVisitDetailsCache(queryClient, 'appt-1', null);

    expect(cachedEmployer(queryClient)).toBeUndefined();
  });

  test('no-ops when nothing is cached for the appointment', () => {
    const queryClient = new QueryClient();

    applyVisitEmployerToVisitDetailsCache(queryClient, 'appt-1', NEW_EMPLOYER);

    expect(queryClient.getQueryData(['get-visit-details', 'appt-1'])).toBeUndefined();
  });
});
