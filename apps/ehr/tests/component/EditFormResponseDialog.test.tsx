/**
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StandaloneFormDTO } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

vi.mock('../../src/api/api', () => ({
  updateVisitForm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: vi.fn(() => ({ oystehrZambda: {} })),
}));

import { updateVisitForm } from '../../src/api/api';
import { EditFormResponseDialog } from '../../src/components/dialogs/EditFormResponseDialog';

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

// A form bundled into a paperwork flow is handed the whole flow's response, so the dialog sees pages
// that belong to other forms. Only this form's own page may be written back.
const flowMemberForm = (): StandaloneFormDTO => ({
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
    id: 'visit-paperwork-qr',
    status: 'completed',
    item: [
      { linkId: 'contact-info-page', item: [{ linkId: 'email', answer: [{ valueString: 'p@example.com' }] }] },
      { linkId: 'page-one', item: [{ linkId: 'employer', answer: [{ valueString: 'Acme Corp' }] }] },
    ],
  },
});

const renderDialog = (form: StandaloneFormDTO, onSaved = vi.fn()): { onSaved: ReturnType<typeof vi.fn> } => {
  render(
    <MemoryRouter>
      <EditFormResponseDialog open={true} form={form} patientId="patient-1" onClose={vi.fn()} onSaved={onSaved} />
    </MemoryRouter>
  );
  return { onSaved };
};

describe('EditFormResponseDialog', () => {
  beforeEach(() => {
    vi.mocked(updateVisitForm).mockClear();
  });

  it('opens with the submitted answers already filled in', async () => {
    renderDialog(singlePageForm());

    expect(await screen.findByDisplayValue('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Work Status Form')).toBeInTheDocument();
  });

  // The 'Save' lookup is load-bearing: PagedQuestionnaire only honors `continueLabel` when the
  // response it renders carries the sent-manually tag, which the dialog adds to its in-memory copy.
  // Drop that tag and the button falls back to a translation key the EHR has no i18n bundle for.
  it('saves the corrected answer against the form response', async () => {
    const { onSaved } = renderDialog(singlePageForm());

    const input = await screen.findByDisplayValue('Acme Corp');
    await userEvent.clear(input);
    await userEvent.type(input, 'Beta Industries');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateVisitForm).toHaveBeenCalledOnce());
    expect(vi.mocked(updateVisitForm).mock.calls[0][1]).toEqual({
      questionnaireResponseId: 'qr-1',
      patientId: 'patient-1',
      pages: [{ linkId: 'page-one', item: [{ linkId: 'employer', answer: [{ valueString: 'Beta Industries' }] }] }],
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  });

  it("sends only this form's page when the response is the shared visit paperwork", async () => {
    renderDialog(flowMemberForm());

    const input = await screen.findByDisplayValue('Acme Corp');
    await userEvent.clear(input);
    await userEvent.type(input, 'Beta Industries');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateVisitForm).toHaveBeenCalledOnce());
    const { questionnaireResponseId, pages } = vi.mocked(updateVisitForm).mock.calls[0][1];
    expect(questionnaireResponseId).toBe('visit-paperwork-qr');
    expect(pages.map((page) => page.linkId)).toEqual(['page-one']);
  });

  it('keeps the dialog open and reports the failure when the save is rejected', async () => {
    vi.mocked(updateVisitForm).mockRejectedValueOnce(new Error('nope'));
    const { onSaved } = renderDialog(singlePageForm());

    const input = await screen.findByDisplayValue('Acme Corp');
    await userEvent.clear(input);
    await userEvent.type(input, 'Beta Industries');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/couldn't save these answers/i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
