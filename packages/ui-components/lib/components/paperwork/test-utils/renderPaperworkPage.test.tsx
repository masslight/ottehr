import { screen, waitFor } from '@testing-library/react';
import { Questionnaire } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import { renderPaperworkPage } from './renderPaperworkPage';

const questionnaire: Questionnaire = {
  resourceType: 'Questionnaire',
  url: 'https://ottehr.com/FHIR/Questionnaire/render-paperwork-page-test',
  version: '1.0.0',
  status: 'active',
  title: 'Test form',
  item: [
    {
      linkId: 'contact-page',
      text: 'Contact information',
      type: 'group',
      item: [
        { linkId: 'patient-first-name', text: 'First name', type: 'string', required: true },
        {
          linkId: 'has-attorney',
          text: 'Do you have an attorney?',
          type: 'choice',
          answerOption: [{ valueString: 'Yes' }, { valueString: 'No' }],
        },
      ],
    },
    {
      linkId: 'attorney-page',
      text: 'Attorney',
      type: 'group',
      item: [
        {
          linkId: 'attorney-name',
          text: 'Attorney name',
          type: 'string',
          enableWhen: [{ question: 'has-attorney', operator: '=', answerString: 'Yes' }],
        },
      ],
    },
  ],
};

const hasAttorney = { 'has-attorney': { linkId: 'has-attorney', answer: [{ valueString: 'Yes' }] } };

describe('renderPaperworkPage', () => {
  it('renders the first page with its inputs under their linkIds', () => {
    const { container } = renderPaperworkPage(questionnaire);

    expect(screen.getByTestId('flow-page-title').textContent).toBe('Contact information');
    expect(screen.getByText('Test form')).toBeDefined();
    expect(container.querySelector('input#patient-first-name')).not.toBeNull();
  });

  it('prefills the page from values', () => {
    const { container } = renderPaperworkPage(questionnaire, {
      values: { 'patient-first-name': { linkId: 'patient-first-name', answer: [{ valueString: 'Jane' }] } },
    });

    expect(container.querySelector<HTMLInputElement>('input#patient-first-name')?.value).toBe('Jane');
  });

  it('evaluates enableWhen on the page named by pageId against values saved on other pages', () => {
    const answered = renderPaperworkPage(questionnaire, { pageId: 'attorney-page', values: hasAttorney });
    expect(screen.getByTestId('flow-page-title').textContent).toBe('Attorney');
    expect(answered.container.querySelector('input#attorney-name')).not.toBeNull();
    answered.unmount();

    const unanswered = renderPaperworkPage(questionnaire, { pageId: 'attorney-page' });
    expect(unanswered.container.querySelector('input#attorney-name')).toBeNull();
  });

  it('holds the submit with the required error until the field is filled, then submits the answers', async () => {
    const { container, onSubmit, user } = renderPaperworkPage(questionnaire);

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() =>
      expect(container.querySelector('#patient-first-name-helper-text')?.textContent).toBe('This field is required')
    );
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(container.querySelector('input#patient-first-name')!, 'Jane');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]['patient-first-name']).toEqual({
      linkId: 'patient-first-name',
      answer: [{ valueString: 'Jane' }],
    });
  });

  it('submits without validating when validate is false', async () => {
    const { onSubmit, user } = renderPaperworkPage(questionnaire, { validate: false });

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('puts helpers on the paperwork context', () => {
    const handleSearchPlaces = vi.fn();

    const { context } = renderPaperworkPage(questionnaire, { helpers: { handleSearchPlaces } });

    expect(context.paperworkComponentHelpers.handleSearchPlaces).toBe(handleSearchPlaces);
    expect(context.paperworkComponentHelpers.createZ3Object).toBeUndefined();
  });

  it('rejects an unknown page and values for items that are not on a page', () => {
    expect(() => renderPaperworkPage(questionnaire, { pageId: 'missing-page' })).toThrow('missing-page');
    expect(() =>
      renderPaperworkPage(questionnaire, { values: { 'attorney-page': { linkId: 'attorney-page' } } })
    ).toThrow('attorney-page');
  });
});
