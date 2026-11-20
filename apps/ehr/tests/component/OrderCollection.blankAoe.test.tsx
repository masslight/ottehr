import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionnaireItem } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/api/api', () => ({
  updateLabOrderResources: vi.fn().mockResolvedValue({}),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: {} }),
}));

vi.mock('src/features/visits/shared/hooks/usePrintExternalLabLabel', () => ({
  usePrintExternalLabLabel: () => ({ printExternalLabLabel: vi.fn() }),
}));

vi.mock('../../src/features/external-labs/components/OrderHistoryCard', () => ({
  OrderHistoryCard: () => <div />,
}));

vi.mock('../../src/features/external-labs/components/OrderInformationCard', () => ({
  OrderInformationCard: () => <div />,
}));

import { updateLabOrderResources } from 'src/api/api';
import { LabOrderDetailedPageDTO } from 'utils/lib/types/data/labs/labs.types';
import { OrderCollection } from '../../src/features/external-labs/components/OrderCollection';

const buildLabOrder = (items: QuestionnaireItem[]): LabOrderDetailedPageDTO =>
  ({
    serviceRequestId: 'sr-1',
    orderStatus: 'pending',
    isPSC: true,
    orderNumber: 'REQ-1',
    encounterTimezone: 'America/New_York',
    resultsDetails: [],
    samples: [],
    history: [],
    questionnaire: [
      {
        questionnaire: { resourceType: 'Questionnaire', status: 'active', item: items },
        questionnaireResponse: { resourceType: 'QuestionnaireResponse', status: 'in-progress' },
        questionnaireResponseItems: [],
        serviceRequestId: 'sr-1',
      },
    ],
  }) as unknown as LabOrderDetailedPageDTO;

const renderAndSubmit = async (items: QuestionnaireItem[], answers: Record<string, string>): Promise<void> => {
  const user = userEvent.setup();
  render(<OrderCollection labOrder={buildLabOrder(items)} onBack={vi.fn()} />);
  for (const [label, value] of Object.entries(answers)) {
    await user.type(screen.getByRole('textbox', { name: new RegExp(label) }), value);
  }
  await user.click(screen.getByRole('button', { name: /mark as ready/i }));
};

describe('OrderCollection AOE free-text answers', () => {
  beforeEach(() => {
    vi.mocked(updateLabOrderResources).mockClear();
  });

  it('omits a whitespace-only optional free-text answer from the saved data', async () => {
    await renderAndSubmit(
      [
        { linkId: 'optional-text', type: 'text', text: 'Optional comment' },
        { linkId: 'other-text', type: 'text', text: 'Other comment' },
      ],
      { 'Optional comment': '   ', 'Other comment': ' kept ' }
    );

    await waitFor(() => expect(updateLabOrderResources).toHaveBeenCalled());
    expect(vi.mocked(updateLabOrderResources).mock.calls[0][1]).toMatchObject({
      event: 'saveOrderCollectionData',
      data: { 'other-text': ' kept ' },
    });
    expect(vi.mocked(updateLabOrderResources).mock.calls[0][1]).not.toHaveProperty(['data', 'optional-text']);
  });

  it('does not submit when a required free-text answer is whitespace only', async () => {
    await renderAndSubmit([{ linkId: 'required-text', type: 'text', text: 'Fasting hours', required: true }], {
      'Fasting hours': '   ',
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(updateLabOrderResources).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: /Fasting hours/ })).toHaveAttribute('aria-invalid', 'true');
  });

  it('submits a required free-text answer with surrounding spaces as typed', async () => {
    await renderAndSubmit([{ linkId: 'required-text', type: 'text', text: 'Fasting hours', required: true }], {
      'Fasting hours': ' 12 ',
    });

    await waitFor(() => expect(updateLabOrderResources).toHaveBeenCalled());
    expect(vi.mocked(updateLabOrderResources).mock.calls[0][1]).toMatchObject({
      data: { 'required-text': ' 12 ' },
    });
  });
});
