import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { InventoryLot } from 'utils/lib/types/api/config/in-house-medications';
import { VaccineFundingSource } from 'utils/lib/types/data/immunization/vfc';
import { describe, expect, it, vi } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import { VaccineLotBlank } from '../../src/features/immunization/components/VaccineLotBlank';

const inDays = (days: number): string => DateTime.now().plus({ days }).toISODate();

const lot = (
  id: string,
  lotNumber: string,
  fundingSource: VaccineFundingSource,
  expirationDate: string
): InventoryLot => ({
  id,
  catalogMedicationId: 'cat-mmr',
  locationId: 'loc-a',
  lotNumber,
  expirationDate,
  ndc: '00006-4681-00',
  manufacturer: 'Merck and Co., Inc.',
  mvx: 'MSD',
  fundingSource,
  onHand: 12,
  unit: 'dose',
  status: 'active',
});

// Deliberately out of order: the blank sorts the patient's stock first, then soonest expiration.
const LOTS = [
  lot('lot-p', 'Y0140', 'private', inDays(60)),
  lot('lot-v2', 'Y0113', 'vfc', inDays(300)),
  lot('lot-v1', 'Y0112', 'vfc', inDays(200)),
];

const renderBlank = (
  vfcEligibility: 'V01' | 'V02' | undefined
): { onPick: ReturnType<typeof vi.fn>; onType: ReturnType<typeof vi.fn> } => {
  const onPick = vi.fn();
  const onType = vi.fn();
  render(
    <VaccineLotBlank
      lots={LOTS}
      value={undefined}
      vfcEligibility={vfcEligibility}
      patientFirstName="Maya"
      readOnly={false}
      need
      onPick={onPick}
      onType={onType}
      dataTestId={dataTestIds.vaccineDetailsPage.lotNumber}
    />
  );
  return { onPick, onType };
};

const openList = async (): Promise<HTMLElement> => {
  await userEvent.click(screen.getByTestId(dataTestIds.vaccineDetailsPage.lotNumber));
  return screen.getByRole('listbox', { name: 'Lots on hand' });
};

describe('VaccineLotBlank', () => {
  it('lists VFC lots first for a VFC-eligible child, soonest expiration first, and says which match', async () => {
    renderBlank('V02');
    const list = await openList();
    expect(screen.getByText('Maya is VFC eligible (Medicaid): VFC lots first.')).toBeInTheDocument();
    const options = within(list).getAllByRole('option');
    expect(options.map((option) => within(option).getByText(/^Lot /).textContent)).toEqual([
      'Lot Y0112',
      'Lot Y0113',
      'Lot Y0140',
    ]);
    expect(within(options[0]).getByText('Matches eligibility')).toBeInTheDocument();
    expect(within(options[2]).getByText('Other stock')).toBeInTheDocument();
  });

  it('lists private lots first for a child who is not eligible', async () => {
    renderBlank('V01');
    const list = await openList();
    expect(screen.getByText('Maya is not VFC eligible: private lots first.')).toBeInTheDocument();
    expect(within(list).getAllByRole('option')[0]).toHaveTextContent('Lot Y0140');
  });

  it('picking the matching stock hands the lot over at once', async () => {
    const { onPick } = renderBlank('V02');
    const list = await openList();
    fireEvent.click(within(list).getByTestId(dataTestIds.vaccineLotBlank.option('lot-v1')));
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ lotNumber: 'Y0112', fundingSource: 'vfc' }),
      undefined
    );
  });

  it('picking the other stock warns, asks for the borrowing reason and then hands the lot over; it never blocks', async () => {
    const { onPick } = renderBlank('V01');
    const list = await openList();
    fireEvent.click(within(list).getByTestId(dataTestIds.vaccineLotBlank.option('lot-v1')));

    expect(screen.getByText('Use VFC stock for a patient who is not VFC eligible?')).toBeInTheDocument();
    expect(onPick).not.toHaveBeenCalled();

    // the reason is required for the borrowing report
    fireEvent.click(screen.getByTestId(dataTestIds.vaccineLotBlank.useBorrowedLot));
    expect(screen.getByText('Choose a reason for the borrowing report.')).toBeInTheDocument();
    expect(onPick).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Borrowing reason' }));
    fireEvent.click(
      within(screen.getAllByRole('listbox').at(-1)!).getByText('Short-dated vaccine would expire unused')
    );
    fireEvent.click(screen.getByTestId(dataTestIds.vaccineLotBlank.useBorrowedLot));

    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ lotNumber: 'Y0112' }),
      'Short-dated vaccine would expire unused'
    );
  });

  it('a lot not listed can still be typed and is kept as typed', async () => {
    const { onType, onPick } = renderBlank('V02');
    await openList();
    const typed = screen.getByTestId(dataTestIds.vaccineLotBlank.typedLot);
    fireEvent.change(typed, { target: { value: 'SAMPLE-9' } });
    fireEvent.keyDown(typed, { key: 'Enter' });
    expect(onType).toHaveBeenCalledWith('SAMPLE-9');
    expect(onPick).not.toHaveBeenCalled();
  });
});
