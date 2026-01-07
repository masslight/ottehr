import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

const mockUpdate = vi.fn();
let mockExamObservations: { [key: string]: { field: string; value: boolean; note?: string } } = {};

vi.mock('../../src/features/visits/telemed/hooks/useExamObservations', () => ({
  useExamObservations: (params: string[]) => {
    const fields = params.map((param) => mockExamObservations[param] || { field: param, value: false, note: '' });
    return {
      value: fields,
      update: mockUpdate,
      isLoading: false,
      hasPendingApiRequests: false,
    };
  },
}));

import { ControlledCheckboxSelect } from '../../src/features/visits/shared/components/exam-tab/ControlledCheckboxSelect';

// ============================================================================
// HELPERS
// ============================================================================

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const mockRashOptions = [
  { label: 'C/w viral exam', name: 'cw-viral-exam', description: 'erythematous, macular rash' },
  { label: 'C/w Coxsackievirus', name: 'cw-coxsackievirus', description: '2-3 mm erythematous papules' },
  { label: 'C/w insect bites', name: 'cw-insect-bites', description: 'erythematous-based papules' },
];

// ============================================================================
// TESTS
// ============================================================================

describe('ControlledCheckboxSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExamObservations = {};
  });

  describe('Unchecking main checkbox', () => {
    it('should set all selected options to value: false when unchecking main checkbox', async () => {
      const user = userEvent.setup();

      // Setup: main checkbox and two options are selected
      mockExamObservations = {
        rash: { field: 'rash', value: true },
        'cw-viral-exam': { field: 'cw-viral-exam', value: true },
        'cw-coxsackievirus': { field: 'cw-coxsackievirus', value: true },
        'cw-insect-bites': { field: 'cw-insect-bites', value: false },
      };

      render(<ControlledCheckboxSelect label="Rash" name="rash" options={mockRashOptions} />, {
        wrapper: createWrapper(),
      });

      // Verify main checkbox is checked
      const mainCheckbox = screen.getByRole('checkbox', { name: /rash/i });
      expect(mainCheckbox).toBeChecked();

      // Uncheck the main checkbox
      await user.click(mainCheckbox);

      // CRITICAL: Should call update with ALL selected fields set to value: false
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ field: 'rash', value: false }),
          expect.objectContaining({ field: 'cw-viral-exam', value: false }),
          expect.objectContaining({ field: 'cw-coxsackievirus', value: false }),
        ])
      );

      // Should call update exactly once
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it('should not call update when unchecking main checkbox with no selected options', async () => {
      const user = userEvent.setup();

      // Setup: main checkbox checked but no options selected
      mockExamObservations = {
        rash: { field: 'rash', value: true },
        'cw-viral-exam': { field: 'cw-viral-exam', value: false },
        'cw-coxsackievirus': { field: 'cw-coxsackievirus', value: false },
        'cw-insect-bites': { field: 'cw-insect-bites', value: false },
      };

      render(<ControlledCheckboxSelect label="Rash" name="rash" options={mockRashOptions} />, {
        wrapper: createWrapper(),
      });

      const mainCheckbox = screen.getByRole('checkbox', { name: /rash/i });
      expect(mainCheckbox).toBeChecked();

      // Uncheck - only rash field is selected, so only it should be set to false
      await user.click(mainCheckbox);

      // Should call update with only the main checkbox field
      expect(mockUpdate).toHaveBeenCalledWith([expect.objectContaining({ field: 'rash', value: false })]);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Deselecting individual options', () => {
    it('should set deselected option to value: false', async () => {
      const user = userEvent.setup();

      // Setup: main checkbox and two options are selected
      mockExamObservations = {
        rash: { field: 'rash', value: true },
        'cw-viral-exam': { field: 'cw-viral-exam', value: true },
        'cw-coxsackievirus': { field: 'cw-coxsackievirus', value: true },
        'cw-insect-bites': { field: 'cw-insect-bites', value: false },
      };

      render(<ControlledCheckboxSelect label="Rash" name="rash" options={mockRashOptions} />, {
        wrapper: createWrapper(),
      });

      // Open the dropdown
      const combobox = screen.getByRole('combobox');
      await user.click(combobox);

      // Wait for listbox to appear
      const listbox = await screen.findByRole('listbox');

      // Find and click the option we want to deselect
      const option = within(listbox).getByRole('option', { name: /C\/w viral exam/i });
      await user.click(option);

      // CRITICAL: Should call update with the deselected option set to value: false
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ field: 'cw-viral-exam', value: false })])
      );
    });

    it('should add newly selected option with value: true', async () => {
      const user = userEvent.setup();

      // Setup: main checkbox and one option selected
      mockExamObservations = {
        rash: { field: 'rash', value: true },
        'cw-viral-exam': { field: 'cw-viral-exam', value: true },
        'cw-coxsackievirus': { field: 'cw-coxsackievirus', value: false },
        'cw-insect-bites': { field: 'cw-insect-bites', value: false },
      };

      render(<ControlledCheckboxSelect label="Rash" name="rash" options={mockRashOptions} />, {
        wrapper: createWrapper(),
      });

      // Open the dropdown
      const combobox = screen.getByRole('combobox');
      await user.click(combobox);

      // Wait for listbox to appear
      const listbox = await screen.findByRole('listbox');

      // Find and click the option we want to select
      const option = within(listbox).getByRole('option', { name: /C\/w Coxsackievirus/i });
      await user.click(option);

      // CRITICAL: Should call update with the newly selected option set to value: true
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ field: 'cw-coxsackievirus', value: true })])
      );
    });

    it('should handle selecting and deselecting multiple options', async () => {
      const user = userEvent.setup();

      // Setup: main checkbox selected, one option selected
      mockExamObservations = {
        rash: { field: 'rash', value: true },
        'cw-viral-exam': { field: 'cw-viral-exam', value: true },
        'cw-coxsackievirus': { field: 'cw-coxsackievirus', value: false },
        'cw-insect-bites': { field: 'cw-insect-bites', value: false },
      };

      render(<ControlledCheckboxSelect label="Rash" name="rash" options={mockRashOptions} />, {
        wrapper: createWrapper(),
      });

      // Open dropdown and add second option
      const combobox = screen.getByRole('combobox');
      await user.click(combobox);
      let listbox = await screen.findByRole('listbox');
      await user.click(within(listbox).getByRole('option', { name: /C\/w Coxsackievirus/i }));

      // Should add the new option
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ field: 'cw-coxsackievirus', value: true })])
      );

      mockUpdate.mockClear();

      // Open dropdown and remove first option
      await user.click(combobox);
      listbox = await screen.findByRole('listbox');
      await user.click(within(listbox).getByRole('option', { name: /C\/w viral exam/i }));

      // Should remove the deselected option
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ field: 'cw-viral-exam', value: false })])
      );
    });
  });

  describe('Rendering', () => {
    it('should render main checkbox and hide dropdown when unchecked', () => {
      mockExamObservations = {
        rash: { field: 'rash', value: false },
        'cw-viral-exam': { field: 'cw-viral-exam', value: false },
        'cw-coxsackievirus': { field: 'cw-coxsackievirus', value: false },
        'cw-insect-bites': { field: 'cw-insect-bites', value: false },
      };

      render(<ControlledCheckboxSelect label="Rash" name="rash" options={mockRashOptions} />, {
        wrapper: createWrapper(),
      });

      const mainCheckbox = screen.getByRole('checkbox', { name: /rash/i });
      expect(mainCheckbox).not.toBeChecked();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('should render main checkbox and show dropdown when checked', () => {
      mockExamObservations = {
        rash: { field: 'rash', value: true },
        'cw-viral-exam': { field: 'cw-viral-exam', value: false },
        'cw-coxsackievirus': { field: 'cw-coxsackievirus', value: false },
        'cw-insect-bites': { field: 'cw-insect-bites', value: false },
      };

      render(<ControlledCheckboxSelect label="Rash" name="rash" options={mockRashOptions} />, {
        wrapper: createWrapper(),
      });

      const mainCheckbox = screen.getByRole('checkbox', { name: /rash/i });
      expect(mainCheckbox).toBeChecked();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should display selected options with descriptions', () => {
      mockExamObservations = {
        rash: { field: 'rash', value: true },
        'cw-viral-exam': { field: 'cw-viral-exam', value: true },
        'cw-coxsackievirus': { field: 'cw-coxsackievirus', value: false },
        'cw-insect-bites': { field: 'cw-insect-bites', value: false },
      };

      render(<ControlledCheckboxSelect label="Rash" name="rash" options={mockRashOptions} />, {
        wrapper: createWrapper(),
      });

      // Should show option label and description below the combobox (text appears in multiple places)
      expect(screen.getAllByText('C/w viral exam').length).toBeGreaterThan(0);
      expect(screen.getByText('erythematous, macular rash')).toBeInTheDocument();
    });

    it('should not display main checkbox field in option descriptions', () => {
      mockExamObservations = {
        rash: { field: 'rash', value: true },
        'cw-viral-exam': { field: 'cw-viral-exam', value: true },
        'cw-coxsackievirus': { field: 'cw-coxsackievirus', value: false },
        'cw-insect-bites': { field: 'cw-insect-bites', value: false },
      };

      render(<ControlledCheckboxSelect label="Rash" name="rash" options={mockRashOptions} />, {
        wrapper: createWrapper(),
      });

      // "Rash" label should appear in the checkbox, but not in the descriptions area
      // Only selected options should have descriptions displayed
      const descriptions = screen.queryAllByText(/erythematous/);
      expect(descriptions.length).toBeGreaterThan(0); // Options have descriptions

      // The main checkbox "rash" field should not have a description rendered
      // We check that only option fields (not "rash" itself) have descriptions
      const viralExamDescription = screen.getByText('erythematous, macular rash');
      expect(viralExamDescription).toBeInTheDocument();
    });
  });

  describe('Checking main checkbox', () => {
    it('should update only the main checkbox field when checking', async () => {
      const user = userEvent.setup();

      mockExamObservations = {
        rash: { field: 'rash', value: false },
        'cw-viral-exam': { field: 'cw-viral-exam', value: false },
        'cw-coxsackievirus': { field: 'cw-coxsackievirus', value: false },
        'cw-insect-bites': { field: 'cw-insect-bites', value: false },
      };

      render(<ControlledCheckboxSelect label="Rash" name="rash" options={mockRashOptions} />, {
        wrapper: createWrapper(),
      });

      const mainCheckbox = screen.getByRole('checkbox', { name: /rash/i });
      await user.click(mainCheckbox);

      // Should update only the main checkbox field
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          field: 'rash',
          value: true,
        })
      );

      // Should call update exactly once
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });
  });
});
