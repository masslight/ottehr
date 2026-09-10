import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import {
  adminUpdateProgressNoteConfig,
  adminUpdateVitalsAlertConfig,
  getProgressNoteConfig,
  getVitalsAlertConfig,
} from 'src/api/api';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  VITAL_ALERT_TYPES,
  VitalAlertType,
  VitalsAlertConfig,
} from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { DEFAULT_PROGRESS_NOTE_CONFIG } from 'utils/lib/utils/progress-note-config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProgressNoteAdminPage from '../../src/features/admin/ProgressNoteAdminPage';

vi.mock('src/api/api', () => ({
  getProgressNoteConfig: vi.fn(),
  adminUpdateProgressNoteConfig: vi.fn(),
  getVitalsAlertConfig: vi.fn(),
  adminUpdateVitalsAlertConfig: vi.fn(),
}));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: vi.fn() }));
vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

const createWrapper =
  () =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}
    >
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );

const RANGE_IDS = ['r0-3mo', 'r3-6mo', 'r6-12mo', 'r12mo-plus'] as const;

/**
 * Every cell gets a unique, decodable value: vitalIndex * 1000 + rangeIndex * 10 + levelOffset.
 * A value that moved between vitals or between ranges is therefore immediately identifiable, and a
 * value that was reset shows up as undefined.
 */
const cellValue = (vitalIndex: number, rangeIndex: number, levelOffset: number): number =>
  vitalIndex * 1000 + rangeIndex * 10 + levelOffset;

const buildTaggedConfig = (): VitalsAlertConfig => ({
  ageRanges: [
    { id: RANGE_IDS[0], minAge: { unit: 'months', value: 0 }, maxAge: { unit: 'months', value: 3 } },
    { id: RANGE_IDS[1], minAge: { unit: 'months', value: 3 }, maxAge: { unit: 'months', value: 6 } },
    { id: RANGE_IDS[2], minAge: { unit: 'months', value: 6 }, maxAge: { unit: 'months', value: 12 } },
    { id: RANGE_IDS[3], minAge: { unit: 'months', value: 12 } },
  ],
  thresholds: Object.fromEntries(
    VITAL_ALERT_TYPES.map((vital, vitalIndex) => [
      vital,
      Object.fromEntries(
        RANGE_IDS.map((rangeId, rangeIndex) => [
          rangeId,
          {
            criticalLow: cellValue(vitalIndex, rangeIndex, 1),
            abnormalLow: cellValue(vitalIndex, rangeIndex, 2),
            abnormalHigh: cellValue(vitalIndex, rangeIndex, 3),
            criticalHigh: cellValue(vitalIndex, rangeIndex, 4),
          },
        ])
      ),
    ])
  ) as VitalsAlertConfig['thresholds'],
});

const expectedCell = (vital: VitalAlertType, rangeIndex: number): Record<string, number> => {
  const vitalIndex = VITAL_ALERT_TYPES.indexOf(vital);
  return {
    criticalLow: cellValue(vitalIndex, rangeIndex, 1),
    abnormalLow: cellValue(vitalIndex, rangeIndex, 2),
    abnormalHigh: cellValue(vitalIndex, rangeIndex, 3),
    criticalHigh: cellValue(vitalIndex, rangeIndex, 4),
  };
};

const renderPage = async (config: VitalsAlertConfig): Promise<void> => {
  vi.mocked(getVitalsAlertConfig).mockResolvedValue(config);
  render(<ProgressNoteAdminPage />, { wrapper: createWrapper() });
  await waitFor(() => expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.addAgeRangeButton)).toBeInTheDocument());
};

const removeAgeRange = async (index: number): Promise<void> => {
  fireEvent.click(screen.getByTestId(dataTestIds.vitalsAlertConfig.removeAgeRangeButton(index)));
  await waitFor(() =>
    expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.removeAgeRangeDescription)).toBeInTheDocument()
  );
  fireEvent.click(screen.getByTestId(dataTestIds.dialog.proceedButton));
  await waitFor(() =>
    expect(screen.queryByTestId(dataTestIds.vitalsAlertConfig.removeAgeRangeDescription)).not.toBeInTheDocument()
  );
};

const saveAndGetPayload = async (): Promise<VitalsAlertConfig> => {
  fireEvent.click(screen.getByTestId(dataTestIds.progressNoteAdmin.saveButton));
  await waitFor(() => expect(adminUpdateVitalsAlertConfig).toHaveBeenCalled());
  const [, payload] = vi.mocked(adminUpdateVitalsAlertConfig).mock.calls[0];
  return payload.config;
};

describe('deleting a shared age range', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApiClients).mockReturnValue({ oystehrZambda: {} as any } as any);
    vi.mocked(getProgressNoteConfig).mockResolvedValue(DEFAULT_PROGRESS_NOTE_CONFIG);
    vi.mocked(adminUpdateProgressNoteConfig).mockResolvedValue(undefined);
    vi.mocked(adminUpdateVitalsAlertConfig).mockResolvedValue(undefined);
  });

  it('warns that the span becomes unconfigured, without describing any merge', async () => {
    await renderPage(buildTaggedConfig());

    fireEvent.click(screen.getByTestId(dataTestIds.vitalsAlertConfig.removeAgeRangeButton(1)));

    const description = await waitFor(() =>
      screen.getByTestId(dataTestIds.vitalsAlertConfig.removeAgeRangeDescription)
    );
    expect(description).toHaveTextContent('3-6 mo');
    expect(description).toHaveTextContent(/alert levels for all vitals/i);
    expect(description).toHaveTextContent(/no configured alerts for any vital/i);
    expect(description).toHaveTextContent(/none of them is widened to cover this span/i);
    expect(description).not.toHaveTextContent('0-6 mo');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByTestId(dataTestIds.vitalsAlertConfig.removeAgeRangeDescription)).not.toBeInTheDocument()
    );
    expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.ageRangeRow(3))).toBeInTheDocument();
    expect(screen.getByTestId(dataTestIds.progressNoteAdmin.saveButton)).toBeDisabled();
  });

  it('drops only the deleted range from every vital and leaves all other cells byte-identical', async () => {
    await renderPage(buildTaggedConfig());

    // No accordion is expanded, so every threshold table is unmounted and the values have to
    // survive in form state alone.
    await removeAgeRange(1);

    const config = await saveAndGetPayload();

    expect(config.ageRanges.map((r) => r.id)).toEqual([RANGE_IDS[0], RANGE_IDS[2], RANGE_IDS[3]]);

    for (const vital of VITAL_ALERT_TYPES) {
      const perRange = config.thresholds[vital];
      expect(Object.keys(perRange).sort()).toEqual([RANGE_IDS[0], RANGE_IDS[2], RANGE_IDS[3]].sort());
      expect(perRange[RANGE_IDS[1]]).toBeUndefined();
      expect(perRange[RANGE_IDS[0]]).toEqual(expectedCell(vital, 0));
      expect(perRange[RANGE_IDS[2]]).toEqual(expectedCell(vital, 2));
      expect(perRange[RANGE_IDS[3]]).toEqual(expectedCell(vital, 3));
    }
  });

  it('leaves every surviving range boundary exactly as it was', async () => {
    const before = buildTaggedConfig();
    await renderPage(before);

    await removeAgeRange(1);
    const config = await saveAndGetPayload();

    expect(config.ageRanges).toEqual([before.ageRanges[0], before.ageRanges[2], before.ageRanges[3]]);
  });

  it('deleting the first range leaves a gap at the beginning rather than moving the next range down', async () => {
    const before = buildTaggedConfig();
    await renderPage(before);

    await removeAgeRange(0);
    const config = await saveAndGetPayload();

    expect(config.ageRanges).toEqual([before.ageRanges[1], before.ageRanges[2], before.ageRanges[3]]);
    expect(config.ageRanges[0].minAge).toEqual({ unit: 'months', value: 3 });

    for (const vital of VITAL_ALERT_TYPES) {
      const perRange = config.thresholds[vital];
      expect(perRange[RANGE_IDS[0]]).toBeUndefined();
      expect(perRange[RANGE_IDS[1]]).toEqual(expectedCell(vital, 1));
      expect(perRange[RANGE_IDS[2]]).toEqual(expectedCell(vital, 2));
      expect(perRange[RANGE_IDS[3]]).toEqual(expectedCell(vital, 3));
    }
  });

  it('deleting the last range leaves the previous range bounded rather than making it open-ended', async () => {
    const before = buildTaggedConfig();
    await renderPage(before);

    await removeAgeRange(3);
    const config = await saveAndGetPayload();

    expect(config.ageRanges).toEqual([before.ageRanges[0], before.ageRanges[1], before.ageRanges[2]]);
    expect(config.ageRanges[2].maxAge).toEqual({ unit: 'months', value: 12 });

    for (const vital of VITAL_ALERT_TYPES) {
      const perRange = config.thresholds[vital];
      expect(perRange[RANGE_IDS[3]]).toBeUndefined();
      expect(perRange[RANGE_IDS[0]]).toEqual(expectedCell(vital, 0));
      expect(perRange[RANGE_IDS[1]]).toEqual(expectedCell(vital, 1));
      expect(perRange[RANGE_IDS[2]]).toEqual(expectedCell(vital, 2));
    }
  });

  it('adding a range creates empty levels for every vital and copies nothing', async () => {
    const before = buildTaggedConfig();
    await renderPage(before);

    fireEvent.click(screen.getByTestId(dataTestIds.vitalsAlertConfig.addAgeRangeButton));
    await waitFor(() =>
      expect(screen.getByTestId(dataTestIds.vitalsAlertConfig.ageRangeRow(before.ageRanges.length))).toBeInTheDocument()
    );

    // Give the new row a valid span, bounding the previously open-ended range to make room.
    const lastExistingRow = screen.getByTestId(dataTestIds.vitalsAlertConfig.ageRangeRow(before.ageRanges.length - 1));
    fireEvent.change(lastExistingRow.querySelectorAll('input[type="number"]')[1], { target: { value: '24' } });
    const newRow = screen.getByTestId(dataTestIds.vitalsAlertConfig.ageRangeRow(before.ageRanges.length));
    fireEvent.change(newRow.querySelectorAll('input[type="number"]')[0], { target: { value: '24' } });

    const config = await saveAndGetPayload();
    const newRangeId = config.ageRanges[before.ageRanges.length].id;

    for (const vital of VITAL_ALERT_TYPES) {
      expect(config.thresholds[vital][newRangeId]).toEqual({});
      RANGE_IDS.forEach((rangeId, rangeIndex) => {
        expect(config.thresholds[vital][rangeId]).toEqual(expectedCell(vital, rangeIndex));
      });
    }
  });

  it('survives deleting a range while a different vital accordion is expanded', async () => {
    await renderPage(buildTaggedConfig());

    // Weight is mounted, the other six are not, when the delete happens.
    const weight = screen.getByTestId(dataTestIds.vitalsAlertConfig.vitalAccordion('vital-weight'));
    fireEvent.click(weight.querySelectorAll('button')[0]);
    await waitFor(() => expect(weight.querySelector('table')).toBeInTheDocument());

    await removeAgeRange(1);
    const config = await saveAndGetPayload();

    for (const vital of VITAL_ALERT_TYPES) {
      const perRange = config.thresholds[vital];
      expect(perRange[RANGE_IDS[1]]).toBeUndefined();
      expect(perRange[RANGE_IDS[0]]).toEqual(expectedCell(vital, 0));
      expect(perRange[RANGE_IDS[2]]).toEqual(expectedCell(vital, 2));
      expect(perRange[RANGE_IDS[3]]).toEqual(expectedCell(vital, 3));
    }
  });

  it('editing an age range boundary leaves every threshold value untouched', async () => {
    await renderPage(buildTaggedConfig());

    // Both sides of the boundary move, so no gap opens.
    const row0 = screen.getByTestId(dataTestIds.vitalsAlertConfig.ageRangeRow(0));
    const row1 = screen.getByTestId(dataTestIds.vitalsAlertConfig.ageRangeRow(1));
    fireEvent.change(row0.querySelectorAll('input[type="number"]')[1], { target: { value: '4' } });
    fireEvent.change(row1.querySelectorAll('input[type="number"]')[0], { target: { value: '4' } });

    const config = await saveAndGetPayload();

    expect(config.ageRanges[0].maxAge).toEqual({ unit: 'months', value: 4 });
    expect(config.ageRanges[1].minAge).toEqual({ unit: 'months', value: 4 });
    for (const vital of VITAL_ALERT_TYPES) {
      RANGE_IDS.forEach((rangeId, rangeIndex) => {
        expect(config.thresholds[vital][rangeId]).toEqual(expectedCell(vital, rangeIndex));
      });
    }
  });
});
