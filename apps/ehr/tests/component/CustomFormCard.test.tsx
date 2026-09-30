/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StandaloneFormDTO } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { describe, expect, it, vi } from 'vitest';
import { CustomFormCard } from '../../src/components/CustomFormCard';
import { dataTestIds } from '../../src/constants/data-test-ids';

const form: StandaloneFormDTO = {
  questionnaireId: 'work-status',
  questionnaireTitle: 'Work Status Form',
  allItems: [
    {
      linkId: 'page-one',
      type: 'group',
      acceptsMultipleAnswers: false,
      alwaysFilter: false,
      item: [
        {
          linkId: 'employer',
          type: 'string',
          text: 'Employer name',
          acceptsMultipleAnswers: false,
          alwaysFilter: false,
        },
      ],
    },
  ],
  questionnaireResponse: {
    resourceType: 'QuestionnaireResponse',
    id: 'qr-1',
    status: 'completed',
    item: [{ linkId: 'page-one', item: [{ linkId: 'employer', answer: [{ valueString: 'Acme Corp' }] }] }],
  },
};

const openMenu = async (): Promise<void> => {
  await userEvent.click(screen.getByTestId(dataTestIds.visitDetailsPage.customFormMenuButton(form.questionnaireId)));
};

describe('CustomFormCard', () => {
  it('offers Edit and Delete for a form that owns its response', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<CustomFormCard form={form} deletable={true} onEdit={onEdit} onDelete={onDelete} />);

    await openMenu();
    await userEvent.click(screen.getByTestId(dataTestIds.visitDetailsPage.customFormEditMenuItem));
    expect(onEdit).toHaveBeenCalledOnce();

    await openMenu();
    await userEvent.click(screen.getByTestId(dataTestIds.visitDetailsPage.customFormDeleteMenuItem));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  // A form bundled into the visit's paperwork flow shares one QuestionnaireResponse with every other
  // form in that flow, so there is no per-form resource to delete — deleting would take the whole
  // visit's paperwork with it. Edit stays available because it writes only that form's pages.
  it('leaves Delete unavailable for a form whose response is the shared visit paperwork', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<CustomFormCard form={form} deletable={false} onEdit={onEdit} onDelete={onDelete} />);

    await openMenu();

    expect(screen.queryByTestId(dataTestIds.visitDetailsPage.customFormDeleteMenuItem)).not.toBeInTheDocument();
    expect(screen.getByText('Delete')).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(screen.getByTestId(dataTestIds.visitDetailsPage.customFormEditMenuItem));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('still renders the submitted answers alongside the actions', () => {
    render(<CustomFormCard form={form} deletable={true} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText('Work Status Form')).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
  });
});
