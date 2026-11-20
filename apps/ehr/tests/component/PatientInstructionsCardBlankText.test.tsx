import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatientInstructionsCard } from 'src/features/visits/shared/components/plan-tab/PatientInstructionsCard';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const saveChartData = vi.fn();
const savePatientInstruction = vi.fn();
const setPartialChartData = vi.fn();

vi.mock('src/features/visits/shared/hooks/useChartData', () => ({
  useChartData: () => ({ chartData: { instructions: [] }, setPartialChartData }),
}));

vi.mock('src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useSavePatientInstruction: () => ({ mutate: savePatientInstruction, isPending: false }),
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useSaveChartData: () => ({ mutate: saveChartData, isPending: false }),
  useDeleteChartData: () => ({ mutate: vi.fn() }),
}));

vi.mock('src/features/visits/shared/components/plan-tab/components/PatientInstructionsTemplatesDialog', () => ({
  PatientInstructionsTemplatesDialog: () => null,
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

const fill = (title: string, text: string): void => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Instruction title' }), { target: { value: title } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Instruction' }), { target: { value: text } });
};

const savedInstructions = (): unknown => saveChartData.mock.calls[0][0].instructions;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PatientInstructionsCard - blank title or instruction', () => {
  it.each([' ', '\n'])('drops the instruction text %j when only the title is filled', async (text) => {
    render(<PatientInstructionsCard />);
    fill('Wound care', text);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(savedInstructions()).toStrictEqual([{ title: 'Wound care', text: undefined }]);
    expect(setPartialChartData.mock.calls[0][0].instructions).toStrictEqual([{ title: 'Wound care', text: undefined }]);
  });

  it.each([' ', '\n'])('drops the title %j when only the instruction text is filled', async (title) => {
    render(<PatientInstructionsCard />);
    fill(title, 'Drink fluids');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(savedInstructions()).toStrictEqual([{ title: undefined, text: 'Drink fluids' }]);
  });

  it('sends no whitespace-only field to My Quick Picks on Add & Save', async () => {
    render(<PatientInstructionsCard />);
    fill('  ', 'Drink fluids');
    await userEvent.click(screen.getByRole('button', { name: 'Add & Save to My Quick Picks' }));

    expect(savePatientInstruction.mock.calls[0][0]).toStrictEqual({ text: 'Drink fluids', title: undefined });
    expect(savedInstructions()).toStrictEqual([{ title: undefined, text: 'Drink fluids' }]);
  });

  it('keeps a non-blank title and multi-line instruction exactly as typed', async () => {
    render(<PatientInstructionsCard />);
    fill(' Wound care ', '1. Keep dry\n2. Change dressing daily\n');
    await userEvent.click(screen.getByRole('button', { name: 'Add & Save to My Quick Picks' }));

    const typed = { title: ' Wound care ', text: '1. Keep dry\n2. Change dressing daily\n' };
    expect(savePatientInstruction.mock.calls[0][0]).toStrictEqual(typed);
    expect(savedInstructions()).toStrictEqual([typed]);
  });

  it('keeps Add disabled when both fields are whitespace-only', () => {
    render(<PatientInstructionsCard />);
    fill(' ', '\n');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add & Save to My Quick Picks' })).toBeDisabled();
  });
});
