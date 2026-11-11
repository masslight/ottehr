// The immunization CPT blank holds "90461 ×5": a count per code, like procedure quick picks.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { FC, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetCPTHCPCSSearch: () => ({
    isFetching: false,
    data: {
      codes: [
        { code: '90460', display: 'Imm admin thru 18yr 1st component' },
        { code: '90461', display: 'Imm admin thru 18yr addl component' },
      ],
    },
  }),
}));

vi.mock('src/features/visits/in-person/hooks/useImmunization', () => ({
  useGetVaccines: () => ({ data: [], isLoading: false }),
}));
vi.mock('src/features/immunization/hooks/useImmunizationDiagnosisOptions', () => ({
  useImmunizationDiagnosisOptions: () => [],
}));
vi.mock('src/components/input/EmployeeSelectInput', () => ({
  useEmployeeOptions: () => ({ options: [], isLoading: false }),
}));
vi.mock('src/features/immunization/hooks/useVaccineInventory', () => ({
  useVfcEligibility: () => ({ data: undefined, isLoading: false }),
  useConfirmVfcEligibility: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useVaccineLotsOnHand: () => ({ data: [] }),
}));

import { CptCodeEntry, CptCodesInput } from 'src/components/input/CptCodesInput';
import { dataTestIds } from 'src/constants/data-test-ids';
import { emptyImmunizationLine } from 'src/features/immunization/components/immunizationLines';
import { ImmunizationSentences } from 'src/features/immunization/components/ImmunizationSentences';

let latest: CptCodeEntry[] = [];
const Harness: FC = () => {
  const [codes, setCodes] = useState<CptCodeEntry[]>([]);
  latest = codes;
  return (
    <CptCodesInput
      cptCodes={codes}
      onChange={(next) => {
        latest = next;
        setCodes(next);
      }}
      isEditable
      withBillableUnits
    />
  );
};

function pick(code: string): void {
  const input = screen.getByRole('combobox');
  fireEvent.mouseDown(input);
  fireEvent.change(input, { target: { value: '9046' } });
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  const listbox = screen.getByRole('listbox');
  fireEvent.click(within(listbox).getByText(new RegExp(`^${code}`)));
}

describe('immunization CPT code counts', () => {
  it('picking 90461 five times keeps one entry with a count of 5, and the count can be typed', () => {
    render(<Harness />);
    pick('90460');
    for (let i = 0; i < 5; i++) pick('90461');

    expect(latest).toEqual([
      { code: '90460', display: 'Imm admin thru 18yr 1st component', billableUnits: 1 },
      { code: '90461', display: 'Imm admin thru 18yr addl component', billableUnits: 5 },
    ]);
    expect(screen.getAllByText(/^90461 /)).toHaveLength(1);

    const units = screen.getByRole('spinbutton', { name: 'Units for 90461' });
    expect(units).toHaveValue(5);
    fireEvent.change(units, { target: { value: '3' } });
    expect(latest.find((c) => c.code === '90461')?.billableUnits).toBe(3);
    // not a count
    fireEvent.change(units, { target: { value: '0' } });
    expect(latest.find((c) => c.code === '90461')?.billableUnits).toBe(3);
  });

  it('the CPT blank reads the counts', () => {
    render(
      <ImmunizationSentences
        line={{
          ...emptyImmunizationLine(),
          administrationDetails: {
            cptCodes: [
              { code: '90460', display: 'first', billableUnits: 1 },
              { code: '90461', display: 'additional', billableUnits: 5 },
            ],
          },
        }}
        index={0}
        onChange={vi.fn()}
        quickPicks={[]}
        onQuickPick={vi.fn()}
        errors={[]}
        readOnly={false}
      />
    );

    expect(screen.getByTestId(dataTestIds.vaccineDetailsPage.cptCode)).toHaveTextContent('90460, 90461 ×5');
  });
});
