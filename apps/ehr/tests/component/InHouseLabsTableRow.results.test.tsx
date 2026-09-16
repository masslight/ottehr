import { render, screen } from '@testing-library/react';
import { OBSERVATION_CODES } from 'utils/lib/types/data/in-house/in-house.constants';
import {
  CodeableConceptDataEntryComponent,
  DataEntryComponentType,
  InHouseOrderListPageItemDTO,
  QuantityDataEntryComponent,
} from 'utils/lib/types/data/in-house/in-house.types';
import { describe, expect, it } from 'vitest';
import { CustomThemeProvider } from '../../src/CustomThemeProvider';
import { InHouseLabsTableRow } from '../../src/features/in-house-labs/components/orders/InHouseLabsTableRow';

// The 'results' column is the only one exercised here — the row is otherwise a passthrough
// for other columns, so we don't need to stub the rest of the DTO realistically.
const baseListItem: Omit<InHouseOrderListPageItemDTO, 'labDetails'> = {
  appointmentId: 'appt-1',
  serviceRequestId: 'sr-1',
  testItemName: 'Test Item',
  diagnosesDTO: [],
  status: 'FINAL',
  visitDate: '2026-01-01T00:00:00.000Z',
  resultReceivedDate: null,
  timezone: 'America/New_York',
  orderAddedDate: '2026-01-01T00:00:00.000Z',
  orderingPhysicianFullName: 'Dr. Test',
};

const makeQuantityComponent = (overrides: Partial<QuantityDataEntryComponent> = {}): QuantityDataEntryComponent => ({
  componentName: 'Glucose',
  loincCode: ['12345-6'],
  observationDefinitionId: 'obs-def-1',
  dataType: 'Quantity',
  unit: 'mg/dL',
  normalRange: { low: 70, high: 100, unit: 'mg/dL' },
  displayType: 'Numeric',
  result: { entry: '85', interpretationCode: OBSERVATION_CODES.NORMAL },
  ...overrides,
});

const makeCategoricalComponent = (
  overrides: Partial<CodeableConceptDataEntryComponent> = {}
): CodeableConceptDataEntryComponent => ({
  componentName: 'Pregnancy',
  loincCode: ['99999-9'],
  observationDefinitionId: 'obs-def-2',
  dataType: 'CodeableConcept',
  valueSet: [
    { code: 'pos', display: 'positive' },
    { code: 'neg', display: 'negative' },
  ],
  abnormalValues: [{ code: 'pos', display: 'positive' }],
  displayType: 'Radio',
  referenceRangeValues: [{ code: 'neg', display: 'not detected' }],
  result: { entry: 'Negative', interpretationCode: OBSERVATION_CODES.NORMAL },
  ...overrides,
});

const renderResultsColumn = (components: DataEntryComponentType): void => {
  const labOrderData: InHouseOrderListPageItemDTO = {
    ...baseListItem,
    labDetails: {
      name: 'Test Item',
      methods: {},
      method: 'Manual',
      device: 'Device',
      cptCode: [],
      repeatable: false,
      orderMode: 'standard',
      components,
      reflexAlert: undefined,
      adUrl: 'https://example.com/ad',
      adVersion: '1',
      adId: 'ad-1',
    },
  };

  render(
    <CustomThemeProvider>
      <table>
        <tbody>
          <InHouseLabsTableRow columns={['results']} labOrderData={labOrderData} />
        </tbody>
      </table>
    </CustomThemeProvider>
  );
};

describe('InHouseLabsTableRow results column', () => {
  it('renders nothing when there are no components', () => {
    renderResultsColumn({ type: 'empty', components: undefined });
    expect(screen.queryByRole('cell')?.textContent).toBe('');
  });

  it('renders nothing when no component has a result yet', () => {
    renderResultsColumn({
      type: 'grouped',
      components: [makeQuantityComponent({ result: undefined })],
    });
    expect(screen.queryByRole('cell')?.textContent).toBe('');
  });

  it('displays a quantity result with its unit and normal range, unbolded', () => {
    renderResultsColumn({
      type: 'grouped',
      components: [makeQuantityComponent({ result: { entry: '85', interpretationCode: OBSERVATION_CODES.NORMAL } })],
    });

    const resultText = screen.getByText('85 mg/dL');
    expect(resultText).toBeInTheDocument();
    expect(resultText).toHaveStyle({ fontWeight: 400 });
    expect(screen.getByText('70 - 100 mg/dL')).toBeInTheDocument();
  });

  it('bolds and highlights an abnormal quantity result', () => {
    renderResultsColumn({
      type: 'grouped',
      components: [makeQuantityComponent({ result: { entry: '250', interpretationCode: OBSERVATION_CODES.ABNORMAL } })],
    });

    const resultText = screen.getByText('250 mg/dL');
    expect(resultText).toHaveStyle({ fontWeight: 700 });
  });

  it('displays a categorical result and its capitalized reference range', () => {
    renderResultsColumn({
      type: 'grouped',
      components: [makeCategoricalComponent()],
    });

    expect(screen.getByText('Negative')).toBeInTheDocument();
    // categoricalRangeFormat capitalizes the first letter of each display value
    expect(screen.getByText('Not detected')).toBeInTheDocument();
  });

  it('shows "N/A" for a categorical result with no abnormal values configured (e.g. neutral tests)', () => {
    renderResultsColumn({
      type: 'grouped',
      components: [makeCategoricalComponent({ abnormalValues: [] })],
    });

    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('shows "No abnormal results" when a multi-component group has no abnormal findings', () => {
    renderResultsColumn({
      type: 'grouped',
      components: [
        makeQuantityComponent({ result: { entry: '85', interpretationCode: OBSERVATION_CODES.NORMAL } }),
        makeCategoricalComponent({ result: { entry: 'Negative', interpretationCode: OBSERVATION_CODES.NORMAL } }),
      ],
    });

    const resultText = screen.getByText('No abnormal results');
    expect(resultText).toBeInTheDocument();
    expect(resultText).toHaveStyle({ fontWeight: 400 });
  });

  it('reports a single abnormal result in a multi-component group using singular wording', () => {
    renderResultsColumn({
      type: 'grouped',
      components: [
        makeQuantityComponent({ result: { entry: '250', interpretationCode: OBSERVATION_CODES.ABNORMAL } }),
        makeCategoricalComponent({ result: { entry: 'Negative', interpretationCode: OBSERVATION_CODES.NORMAL } }),
      ],
    });

    const resultText = screen.getByText('1 abnormal result');
    expect(resultText).toBeInTheDocument();
    expect(resultText).toHaveStyle({ fontWeight: 700 });
  });

  it('reports multiple abnormal results in a multi-component group using plural wording', () => {
    renderResultsColumn({
      type: 'grouped',
      components: [
        makeQuantityComponent({ result: { entry: '250', interpretationCode: OBSERVATION_CODES.ABNORMAL } }),
        makeCategoricalComponent({ result: { entry: 'Positive', interpretationCode: OBSERVATION_CODES.ABNORMAL } }),
      ],
    });

    expect(screen.getByText('2 abnormal results')).toBeInTheDocument();
  });
});
