/**
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StandaloneFormDTO } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

vi.mock('../../src/api/api', () => ({
  updateVisitForm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: vi.fn(() => ({ oystehrZambda: {} })),
}));

import { updateVisitForm } from '../../src/api/api';
import { EditFormResponseDialog } from '../../src/components/dialogs/EditFormResponseDialog';
import { dataTestIds } from '../../src/constants/data-test-ids';

const page = (
  linkId: string,
  questions: { linkId: string; text: string }[]
): StandaloneFormDTO['allItems'][number] => ({
  linkId,
  type: 'group',
  acceptsMultipleAnswers: false,
  alwaysFilter: false,
  item: questions.map((question) => ({
    ...question,
    type: 'string',
    acceptsMultipleAnswers: false,
    alwaysFilter: false,
  })),
});

const singlePageForm = (): StandaloneFormDTO => ({
  questionnaireId: 'work-status',
  questionnaireTitle: 'Work Status Form',
  allItems: [page('page-one', [{ linkId: 'employer', text: 'Employer name' }])],
  questionnaireResponse: {
    resourceType: 'QuestionnaireResponse',
    id: 'qr-1',
    status: 'completed',
    item: [{ linkId: 'page-one', item: [{ linkId: 'employer', answer: [{ valueString: 'Acme Corp' }] }] }],
  },
});

// A form that spans several pages is a wizard in the patient app, but the dialog is one page: every
// question is on screen at once and one Save writes them all.
const twoPageForm = (): StandaloneFormDTO => ({
  questionnaireId: 'work-status',
  questionnaireTitle: 'Work Status Form',
  allItems: [
    page('page-one', [{ linkId: 'employer', text: 'Employer name' }]),
    page('page-two', [{ linkId: 'supervisor', text: 'Supervisor name' }]),
  ],
  questionnaireResponse: {
    resourceType: 'QuestionnaireResponse',
    id: 'qr-1',
    status: 'completed',
    item: [
      { linkId: 'page-one', item: [{ linkId: 'employer', answer: [{ valueString: 'Acme Corp' }] }] },
      { linkId: 'page-two', item: [{ linkId: 'supervisor', answer: [{ valueString: 'Dana' }] }] },
    ],
  },
});

// A form bundled into a paperwork flow is handed the whole flow's response, so the dialog sees pages
// that belong to other forms. Only this form's own pages may be written back.
const flowMemberForm = (): StandaloneFormDTO => ({
  ...singlePageForm(),
  questionnaireResponse: {
    resourceType: 'QuestionnaireResponse',
    id: 'visit-paperwork-qr',
    status: 'completed',
    item: [
      { linkId: 'contact-info-page', item: [{ linkId: 'email', answer: [{ valueString: 'p@example.com' }] }] },
      { linkId: 'page-one', item: [{ linkId: 'employer', answer: [{ valueString: 'Acme Corp' }] }] },
    ],
  },
});

type Callback = Mock<() => void>;

interface RenderOptions {
  onClose?: Callback;
  onSaved?: Callback;
}

const renderDialog = (
  form: StandaloneFormDTO,
  { onClose = vi.fn(), onSaved = vi.fn() }: RenderOptions = {}
): { onClose: Callback; onSaved: Callback } => {
  render(
    <MemoryRouter>
      <EditFormResponseDialog form={form} patientId="patient-1" onClose={onClose} onSaved={onSaved} />
    </MemoryRouter>
  );
  return { onClose, onSaved };
};

const saveButton = (): HTMLElement => screen.getByTestId(dataTestIds.visitDetailsPage.editFormResponseSaveButton);

describe('EditFormResponseDialog', () => {
  beforeEach(() => {
    vi.mocked(updateVisitForm).mockClear();
    vi.mocked(updateVisitForm).mockResolvedValue(undefined);
  });

  it('opens with the submitted answers already filled in', async () => {
    renderDialog(singlePageForm());

    expect(screen.getByText('Work Status Form')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Acme Corp')).toBeEnabled();
  });

  // Save staying disabled until something has been edited is what keeps a reviewer who opened the
  // dialog to look at the answers from flipping the response's status to 'amended'. Any input that
  // normalizes its value on mount would flip the form dirty before the user touches it and break it.
  it('enables Save only once an answer has been edited', async () => {
    renderDialog(singlePageForm());

    const input = await screen.findByDisplayValue('Acme Corp');
    expect(saveButton()).toBeDisabled();

    await userEvent.type(input, '!');

    await waitFor(() => expect(saveButton()).toBeEnabled());
  });

  // Enter in a text field submits the surrounding form, so an untouched dialog would otherwise fire
  // a save that flips the response's status to 'amended' without a single answer having changed.
  it('does not save an untouched form when Enter is pressed in a field', async () => {
    renderDialog(singlePageForm());

    const input = await screen.findByDisplayValue('Acme Corp');
    await userEvent.type(input, '{Enter}');

    await waitFor(() => expect(input).toHaveFocus());
    expect(updateVisitForm).not.toHaveBeenCalled();
  });

  it('saves the corrected answer against the form response', async () => {
    const { onSaved } = renderDialog(singlePageForm());

    const input = await screen.findByDisplayValue('Acme Corp');
    await userEvent.clear(input);
    await userEvent.type(input, 'Beta Industries');
    await userEvent.click(saveButton());

    await waitFor(() => expect(updateVisitForm).toHaveBeenCalledOnce());
    expect(vi.mocked(updateVisitForm).mock.calls[0][1]).toEqual({
      questionnaireResponseId: 'qr-1',
      questionnaireId: 'work-status',
      patientId: 'patient-1',
      pages: [{ linkId: 'page-one', item: [{ linkId: 'employer', answer: [{ valueString: 'Beta Industries' }] }] }],
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  });

  it('writes every page of a multi-page form from the one Save', async () => {
    renderDialog(twoPageForm());

    expect(await screen.findByDisplayValue('Acme Corp')).toBeInTheDocument();
    const supervisor = screen.getByDisplayValue('Dana');
    await userEvent.clear(supervisor);
    await userEvent.type(supervisor, 'Alex');
    await userEvent.click(saveButton());

    await waitFor(() => expect(updateVisitForm).toHaveBeenCalledOnce());
    expect(vi.mocked(updateVisitForm).mock.calls[0][1].pages).toEqual([
      { linkId: 'page-one', item: [{ linkId: 'employer', answer: [{ valueString: 'Acme Corp' }] }] },
      { linkId: 'page-two', item: [{ linkId: 'supervisor', answer: [{ valueString: 'Alex' }] }] },
    ]);
  });

  it("sends only this form's page when the response is the shared visit paperwork", async () => {
    renderDialog(flowMemberForm());

    const input = await screen.findByDisplayValue('Acme Corp');
    await userEvent.clear(input);
    await userEvent.type(input, 'Beta Industries');
    await userEvent.click(saveButton());

    await waitFor(() => expect(updateVisitForm).toHaveBeenCalledOnce());
    const { questionnaireResponseId, pages } = vi.mocked(updateVisitForm).mock.calls[0][1];
    expect(questionnaireResponseId).toBe('visit-paperwork-qr');
    expect(pages.map((page) => page.linkId)).toEqual(['page-one']);
  });

  it('keeps the dialog open with the edit on screen and reports the failure when the save is rejected', async () => {
    vi.mocked(updateVisitForm).mockRejectedValueOnce(new Error('nope'));
    const { onSaved } = renderDialog(singlePageForm());

    const input = await screen.findByDisplayValue('Acme Corp');
    await userEvent.clear(input);
    await userEvent.type(input, 'Beta Industries');
    await userEvent.click(saveButton());

    expect(await screen.findByText(/couldn't save these answers/i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Beta Industries')).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it('closes without saving when the edit is abandoned', async () => {
    const { onClose } = renderDialog(singlePageForm());

    const input = await screen.findByDisplayValue('Acme Corp');
    await userEvent.clear(input);
    await userEvent.type(input, 'Beta Industries');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(updateVisitForm).not.toHaveBeenCalled();
  });
});
