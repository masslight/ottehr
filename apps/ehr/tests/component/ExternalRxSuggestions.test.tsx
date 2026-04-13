import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the hook
vi.mock('src/features/visits/shared/hooks/useExternalMedicationHistory', () => ({
  useExternalMedicationHistory: vi.fn(),
}));

import { ExternalRxSuggestions } from '../../src/features/visits/shared/components/medical-history-tab/CurrentMedications/ExternalRxSuggestions';
import {
  ExternalMedication,
  useExternalMedicationHistory,
} from '../../src/features/visits/shared/hooks/useExternalMedicationHistory';

const wrapper = ({ children }: { children: ReactNode }): ReactNode => <BrowserRouter>{children}</BrowserRouter>;

const makeExternalMed = (overrides: Partial<ExternalMedication> & { name: string }): ExternalMedication => ({
  strength: null,
  doseForm: null,
  route: null,
  directions: null,
  writtenDate: '2026-01-15',
  lastFillDate: '2026-01-15',
  refills: '0',
  quantity: 30,
  matchedMedication: null,
  isExactMatch: false,
  ...overrides,
});

let nextMedId = 1;
const makeMatchedMed = (name: string, strength: string): ExternalMedication => {
  const id = nextMedId++;
  return makeExternalMed({
    name,
    strength,
    matchedMedication: {
      id,
      routedDoseFormDrugId: id,
      name,
      rxcui: null,
      ndc: null,
      strength,
      isObsolete: false,
    },
    isExactMatch: true,
  });
};

describe('ExternalRxSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nextMedId = 1;
  });

  it('shows loading state', () => {
    vi.mocked(useExternalMedicationHistory).mockReturnValue({
      isLoading: true,
      isAvailable: false,
      externalMedications: [],
      error: null,
    });

    render(<ExternalRxSuggestions chartedMedications={[]} />, { wrapper });
    expect(screen.getByText(/loading external medication history/i)).toBeInTheDocument();
  });

  it('shows not available state', () => {
    vi.mocked(useExternalMedicationHistory).mockReturnValue({
      isLoading: false,
      isAvailable: false,
      externalMedications: [],
      error: null,
    });

    render(<ExternalRxSuggestions chartedMedications={[]} />, { wrapper });
    expect(screen.getByText(/not available/i)).toBeInTheDocument();
  });

  it('shows empty state when all meds reconciled', () => {
    vi.mocked(useExternalMedicationHistory).mockReturnValue({
      isLoading: false,
      isAvailable: true,
      externalMedications: [],
      error: null,
    });

    render(<ExternalRxSuggestions chartedMedications={[]} />, { wrapper });
    expect(screen.getByText(/no external medications found/i)).toBeInTheDocument();
  });

  it('renders matched medications as clickable', () => {
    vi.mocked(useExternalMedicationHistory).mockReturnValue({
      isLoading: false,
      isAvailable: true,
      externalMedications: [makeMatchedMed('Omeprazole', '20 mg')],
      error: null,
    });

    render(<ExternalRxSuggestions chartedMedications={[]} />, { wrapper });
    expect(screen.getByText(/omeprazole/i)).toBeInTheDocument();
  });

  it('renders unmatched medications as not recognized', () => {
    vi.mocked(useExternalMedicationHistory).mockReturnValue({
      isLoading: false,
      isAvailable: true,
      externalMedications: [makeExternalMed({ name: 'UnknownDrug' })],
      error: null,
    });

    render(<ExternalRxSuggestions chartedMedications={[]} />, { wrapper });
    expect(screen.getByText(/not recognized/i)).toBeInTheDocument();
  });

  it('renders inexact match with warning', () => {
    const med = makeExternalMed({
      name: 'Omeprazole',
      matchedMedication: {
        id: 1,
        routedDoseFormDrugId: 1,
        name: 'Omeprazole Magnesium',
        rxcui: null,
        ndc: null,
        strength: '20 mg',
        isObsolete: false,
      },
      isExactMatch: false,
    });

    vi.mocked(useExternalMedicationHistory).mockReturnValue({
      isLoading: false,
      isAvailable: true,
      externalMedications: [med],
      error: null,
    });

    render(<ExternalRxSuggestions chartedMedications={[]} />, { wrapper });
    expect(screen.getByText(/inexact match/i)).toBeInTheDocument();
    expect(screen.getByText(/omeprazole magnesium/i)).toBeInTheDocument();
  });

  it('hides medication immediately after clicking (optimistic hide)', () => {
    const onSelect = vi.fn();
    const meds = [makeMatchedMed('Omeprazole', '20 mg'), makeMatchedMed('Metformin', '500 mg')];

    vi.mocked(useExternalMedicationHistory).mockReturnValue({
      isLoading: false,
      isAvailable: true,
      externalMedications: meds,
      error: null,
    });

    render(<ExternalRxSuggestions chartedMedications={[]} onSelectMedication={onSelect} />, { wrapper });

    expect(screen.getByText(/omeprazole/i)).toBeInTheDocument();
    expect(screen.getByText(/metformin/i)).toBeInTheDocument();

    // Click Omeprazole
    fireEvent.click(screen.getByText(/omeprazole/i));

    expect(onSelect).toHaveBeenCalledTimes(1);
    // Omeprazole should disappear, Metformin should remain
    expect(screen.queryByText(/omeprazole/i)).not.toBeInTheDocument();
    expect(screen.getByText(/metformin/i)).toBeInTheDocument();
  });

  it('calls onSelectMedication with correct data', () => {
    const onSelect = vi.fn();
    const med = makeExternalMed({
      name: 'Omeprazole',
      strength: '20 mg',
      directions: 'Take daily',
      matchedMedication: {
        id: 42,
        routedDoseFormDrugId: 42,
        name: 'Omeprazole',
        rxcui: null,
        ndc: null,
        strength: '20 mg',
        isObsolete: false,
      },
      isExactMatch: true,
    });

    vi.mocked(useExternalMedicationHistory).mockReturnValue({
      isLoading: false,
      isAvailable: true,
      externalMedications: [med],
      error: null,
    });

    render(<ExternalRxSuggestions chartedMedications={[]} onSelectMedication={onSelect} />, { wrapper });
    fireEvent.click(screen.getByText(/omeprazole/i));

    expect(onSelect).toHaveBeenCalledWith({
      medication: expect.objectContaining({ id: 42, name: 'Omeprazole' }),
      dose: '20 mg',
      directions: 'Take daily',
    });
  });

  it('does not call onSelectMedication for unmatched medications', () => {
    const onSelect = vi.fn();

    vi.mocked(useExternalMedicationHistory).mockReturnValue({
      isLoading: false,
      isAvailable: true,
      externalMedications: [makeExternalMed({ name: 'UnknownDrug' })],
      error: null,
    });

    render(<ExternalRxSuggestions chartedMedications={[]} onSelectMedication={onSelect} />, { wrapper });

    // Unmatched med text is not clickable
    const unmatched = screen.getByText(/not recognized/i);
    fireEvent.click(unmatched);

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows "Show more" when more than 5 medications', () => {
    const meds = Array.from({ length: 7 }, (_, i) => makeMatchedMed(`Med${i}`, `${i * 10} mg`));

    vi.mocked(useExternalMedicationHistory).mockReturnValue({
      isLoading: false,
      isAvailable: true,
      externalMedications: meds,
      error: null,
    });

    render(<ExternalRxSuggestions chartedMedications={[]} />, { wrapper });

    // First 5 visible, last 2 hidden
    expect(screen.getByText(/med0/i)).toBeInTheDocument();
    expect(screen.getByText(/med4/i)).toBeInTheDocument();
    expect(screen.queryByText(/med5/i)).not.toBeInTheDocument();
    expect(screen.getByText(/show more/i)).toBeInTheDocument();

    // Click show more
    fireEvent.click(screen.getByText(/show more/i));
    expect(screen.getByText(/med5/i)).toBeInTheDocument();
    expect(screen.getByText(/med6/i)).toBeInTheDocument();
  });
});
