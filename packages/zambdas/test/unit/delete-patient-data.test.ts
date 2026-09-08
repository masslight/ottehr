import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { deletePatientData } from '../../src/scripts/delete-patient-data';

const CUT_OFF = DateTime.fromISO('2026-01-01');

const responseTooLarge = (): Error =>
  new Oystehr.OystehrSdkError({
    code: 4130,
    message: 'An internal response size (7,340,032) exceeds the maximum allowed size (6,291,456).',
  });

// A patient with no appointment or encounter is the shape the script deletes outright.
const patientOnlyPage = (): unknown => {
  const patient = {
    resourceType: 'Patient',
    id: 'patient-1',
  };
  return {
    total: 1,
    entry: [
      {
        resource: patient,
        search: {
          mode: 'match',
        },
      },
    ],
    unbundle: () => [patient],
  };
};

const requestedCounts = (search: Mock): (string | undefined)[] =>
  search.mock.calls.map(
    ([arg]) => (arg.params as { name: string; value: string }[]).find((param) => param.name === '_count')?.value
  );

const stubClient = (
  search: Mock
): {
  oystehr: Oystehr;
  batch: Mock;
} => {
  const batch = vi.fn().mockResolvedValue({});
  return {
    oystehr: {
      fhir: {
        search,
        batch,
      },
    } as unknown as Oystehr,
    batch,
  };
};

describe('deletePatientData response size handling', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('deletes the resources a reduced page size finally returned', async () => {
    const search = vi.fn().mockRejectedValueOnce(responseTooLarge()).mockResolvedValueOnce(patientOnlyPage());
    const { oystehr, batch } = stubClient(search);

    const result = await deletePatientData(oystehr, 'patient-1', CUT_OFF);

    expect(result).toEqual({
      patients: 1,
      otherResources: 0,
    });
    expect(batch).toHaveBeenCalled();
  });

  it('does not re-run the whole drain at a page size the helper already tried', async () => {
    const search = vi.fn().mockRejectedValue(responseTooLarge());
    const { oystehr, batch } = stubClient(search);

    const result = await deletePatientData(oystehr, 'patient-1', CUT_OFF);

    expect(result).toEqual({
      patients: 0,
      otherResources: 0,
    });
    expect(requestedCounts(search)).toEqual(['10', '5', '2', '1']);
    expect(batch).not.toHaveBeenCalled();
  });

  it('skips the patient when the search fails for a reason a smaller page cannot fix', async () => {
    const search = vi.fn().mockRejectedValue(new Error('401 unauthorized'));
    const { oystehr, batch } = stubClient(search);

    const result = await deletePatientData(oystehr, 'patient-1', CUT_OFF);

    expect(result).toEqual({
      patients: 0,
      otherResources: 0,
    });
    expect(requestedCounts(search)).toEqual(['10']);
    expect(batch).not.toHaveBeenCalled();
  });
});
