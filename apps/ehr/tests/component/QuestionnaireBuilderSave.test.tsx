import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PracticeManagedQuestionnaire } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/features/visits/telemed/components/admin/questionnaires/components/QuestionnaireItemEditor', () => ({
  QuestionnaireItemEditor: () => null,
}));
vi.mock('src/features/visits/telemed/components/admin/questionnaires/components/QuestionnairePreview', () => ({
  QuestionnairePreview: () => null,
}));
vi.mock('src/features/visits/telemed/components/admin/questionnaires/components/QuestionnaireTestDialog', () => ({
  QuestionnaireTestDialog: () => null,
}));
vi.mock('src/features/visits/telemed/components/admin/questionnaires/components/QuestionnaireJsonPreview', () => ({
  QuestionnaireJsonPreview: () => null,
}));

import { QuestionnaireBuilder } from '../../src/features/visits/telemed/components/admin/questionnaires/components/QuestionnaireBuilder';

const onSave = vi.fn<(questionnaire: PracticeManagedQuestionnaire) => Promise<void>>();

const fillAndSave = ({ title, description }: { title: string; description?: string }): void => {
  render(
    <MemoryRouter>
      <QuestionnaireBuilder onSave={onSave} isSaving={false} />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: /Add Page/ }));
  fireEvent.change(screen.getByLabelText(/Title/), { target: { value: title } });
  if (description !== undefined) {
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: description } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Save Questionnaire' }));
};

describe('QuestionnaireBuilder save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSave.mockResolvedValue(undefined);
  });

  it('does not save a whitespace-only title and shows the title error', () => {
    fillAndSave({ title: '   ' });

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Title is required')).toBeInTheDocument();
  });

  it.each(['Анкета', '問診票', '???'])('gives a new questionnaire titled %s a non-empty name and url slug', (title) => {
    fillAndSave({ title });

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.title).toBe(title);
    expect(saved.name.trim()).not.toBe('');
    expect(saved.url).not.toMatch(/\/$/);
  });

  it('gives two new questionnaires whose titles have no slug characters different names and urls', () => {
    fillAndSave({ title: 'Анкета' });
    cleanup();
    fillAndSave({ title: '問診票' });

    const [first, second] = onSave.mock.calls.map(([saved]) => saved);
    expect(first.name).not.toBe(second.name);
    expect(first.url).not.toBe(second.url);
  });

  it('omits a whitespace-only description', () => {
    fillAndSave({ title: 'Intake', description: '  \n ' });

    expect(onSave.mock.calls[0][0]).not.toHaveProperty('description');
  });

  it('keeps a non-blank description as typed', () => {
    fillAndSave({ title: 'Intake', description: 'For new patients ' });

    expect(onSave.mock.calls[0][0].description).toBe('For new patients ');
  });
});
