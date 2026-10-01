/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StandaloneFormDTO } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { describe, expect, it, Mock, vi } from 'vitest';
import { CustomFormCard } from '../../src/components/CustomFormCard';
import { dataTestIds } from '../../src/constants/data-test-ids';

const singlePageForm = (): StandaloneFormDTO => ({
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
});

type Callback = Mock<() => void>;

interface RenderOptions {
  deletable?: boolean;
  onEdit?: Callback;
  onDelete?: Callback;
}

const renderCard = (
  form: StandaloneFormDTO,
  { deletable = true, onEdit = vi.fn(), onDelete = vi.fn() }: RenderOptions = {}
): { onEdit: Callback; onDelete: Callback } => {
  render(
    <MemoryRouter>
      <CustomFormCard form={form} deletable={deletable} onEdit={onEdit} onDelete={onDelete} />
    </MemoryRouter>
  );
  return { onEdit, onDelete };
};

const openMenu = async (): Promise<void> => {
  await userEvent.click(screen.getByTestId(dataTestIds.visitDetailsPage.customFormMenuButton('work-status')));
};

describe('CustomFormCard', () => {
  // The card is a read-only summary: editing happens in the dialog the Edit action opens, so no
  // answer on the card may be a form control the user could type into and lose.
  it('renders the submitted answers as plain text', () => {
    renderCard(singlePageForm());

    expect(screen.getByText('Work Status Form')).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Acme Corp')).not.toBeInTheDocument();
  });

  it('opens the editor from the Edit action', async () => {
    const { onEdit } = renderCard(singlePageForm());

    await openMenu();
    await userEvent.click(screen.getByTestId(dataTestIds.visitDetailsPage.customFormEditMenuItem));

    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('offers Delete for a form that owns its response', async () => {
    const { onDelete } = renderCard(singlePageForm());

    await openMenu();
    await userEvent.click(screen.getByTestId(dataTestIds.visitDetailsPage.customFormDeleteMenuItem));

    expect(onDelete).toHaveBeenCalledOnce();
  });

  // A form bundled into the visit's paperwork flow shares one QuestionnaireResponse with every other
  // form in that flow, so there is no per-form resource to delete — deleting would take the whole
  // visit's paperwork with it. Editing stays available because it writes only that form's pages.
  it('leaves Delete unavailable for a form whose response is the shared visit paperwork', async () => {
    const { onEdit, onDelete } = renderCard(singlePageForm(), { deletable: false });

    await openMenu();

    expect(screen.queryByTestId(dataTestIds.visitDetailsPage.customFormDeleteMenuItem)).not.toBeInTheDocument();
    expect(screen.getByText('Delete')).toHaveAttribute('aria-disabled', 'true');
    expect(onDelete).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId(dataTestIds.visitDetailsPage.customFormEditMenuItem));
    expect(onEdit).toHaveBeenCalledOnce();
  });
});
