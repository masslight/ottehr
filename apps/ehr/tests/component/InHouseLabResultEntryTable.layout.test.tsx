import { render } from '@testing-library/react';
import { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import {
  CodeableConceptDataEntryComponent,
  DataEntryComponent,
  QuantityDataEntryComponent,
  StringDataEntryComponent,
} from 'utils/lib/types/data/in-house/in-house.types';
import { describe, expect, it } from 'vitest';
import { CustomThemeProvider } from '../../src/CustomThemeProvider';
import { ResultEntryTable } from '../../src/features/in-house-labs/components/details/ResultsEntryTable';

const freeText = (componentName: string, observationDefinitionId: string): StringDataEntryComponent => ({
  componentName,
  loincCode: ['0000-0'],
  observationDefinitionId,
  dataType: 'string',
  displayType: 'Free Text',
});

const glucose: CodeableConceptDataEntryComponent = {
  componentName: 'Glucose',
  loincCode: ['1111-1'],
  observationDefinitionId: 'od-glucose',
  dataType: 'CodeableConcept',
  valueSet: [{ code: 'nd', display: 'Not detected' }],
  abnormalValues: [],
  displayType: 'Select',
  unit: 'mg/dL',
};

const quantity = (
  componentName: string,
  observationDefinitionId: string,
  nullOption?: QuantityDataEntryComponent['nullOption']
): QuantityDataEntryComponent => ({
  componentName,
  loincCode: ['2222-2'],
  observationDefinitionId,
  dataType: 'Quantity',
  unit: 'none',
  normalRange: { low: 5, high: 8, unit: 'none' },
  displayType: 'Numeric',
  nullOption,
});

const FormWrapper = ({ children }: { children: ReactNode }): JSX.Element => {
  const methods = useForm();
  return <FormProvider {...methods}>{children}</FormProvider>;
};

const renderTable = (components: DataEntryComponent[]): HTMLElement =>
  render(
    <CustomThemeProvider>
      <FormWrapper>
        <ResultEntryTable testItemComponents={components} />
      </FormWrapper>
    </CustomThemeProvider>
  ).container;

const bodyRows = (container: HTMLElement): HTMLTableRowElement[] =>
  Array.from(container.querySelectorAll<HTMLTableRowElement>('tbody tr'));

const cellPadding = (row: HTMLTableRowElement): { top: string; bottom: string }[] =>
  Array.from(row.cells).map((cell) => {
    const style = getComputedStyle(cell);
    return { top: style.paddingTop, bottom: style.paddingBottom };
  });

describe('In-house lab ResultEntryTable layout', () => {
  it('renders free text inputs at the same small size as select and numeric inputs', () => {
    const container = renderTable([freeText('Appearance', 'od-appearance'), glucose, quantity('pH', 'od-ph')]);
    const inputRoots = Array.from(container.querySelectorAll('tbody .MuiInputBase-root'));

    expect(inputRoots).toHaveLength(3);
    inputRoots.forEach((root) => expect(root).toHaveClass('MuiInputBase-sizeSmall'));
  });

  it('pads rows symmetrically so their content is vertically centered between dividers', () => {
    const container = renderTable([
      freeText('Appearance', 'od-appearance'),
      freeText('Urine color', 'od-urine-color'),
      glucose,
      quantity('pH', 'od-ph'),
      quantity('Specific gravity', 'od-sg'),
    ]);
    const rows = bodyRows(container);
    expect(rows).toHaveLength(5);

    // the last row sits on the table's own padding instead of a divider
    rows.slice(0, -1).forEach((row) => {
      cellPadding(row).forEach(({ top, bottom }) => {
        expect(top).not.toBe('0px');
        expect(bottom).toBe(top);
      });
    });
    cellPadding(rows[rows.length - 1]).forEach(({ bottom }) => expect(bottom).toBe('0px'));
  });

  it('keeps a null option checkbox attached to its input without a divider between them', () => {
    const container = renderTable([
      freeText('Appearance', 'od-appearance'),
      quantity('WBC', 'od-wbc', { text: 'Too numerous to count', code: 'tntc' }),
      quantity('pH', 'od-ph'),
    ]);
    const [, wbcRow, checkboxRow, phRow] = bodyRows(container);

    cellPadding(wbcRow).forEach(({ bottom }) => expect(bottom).toBe('0px'));
    const checkboxCell = getComputedStyle(checkboxRow.cells[0]);
    expect(checkboxCell.paddingTop).toBe('0px');
    expect(checkboxCell.borderTopStyle).not.toBe('solid');
    expect(checkboxCell.paddingBottom).toBe(getComputedStyle(wbcRow.cells[0]).paddingTop);
    expect(getComputedStyle(phRow.cells[0]).borderTopStyle).toBe('solid');
  });
});
