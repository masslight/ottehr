import { render, screen } from '@testing-library/react';
import { QuestionnaireResponse } from 'fhir/r4b';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import AIInterview from '../../src/pages/AIInterview';

const mockAIInterviewStart = vi.fn();

vi.mock('../../src/api/ottehrApi', () => ({
  default: {
    aIInterviewStart: (...args: unknown[]) => mockAIInterviewStart(...args),
    aIInterviewHandleAnswer: vi.fn(),
  },
}));

vi.mock('../../src/hooks/useUCZambdaClient', () => ({
  useUCZambdaClient: () => ({ execute: vi.fn(), executePublic: vi.fn() }),
}));

vi.mock('../../src/pages/ThankYou', () => ({
  useVisitContext: () => ({ appointmentData: { appointment: { serviceMode: 'in-person' } } }),
}));

const questionnaireResponseWithFirstQuestion: QuestionnaireResponse = {
  resourceType: 'QuestionnaireResponse',
  id: 'questionnaire-response-id',
  status: 'in-progress',
  item: [{ linkId: '0', answer: [{ valueString: 'prompt' }] }],
  contained: [
    {
      resourceType: 'Questionnaire',
      id: 'ai-interview',
      status: 'active',
      item: [
        { linkId: '0', text: 'Initial message', type: 'text' },
        { linkId: '1', text: 'Are you the patient or their guardian?', type: 'text' },
      ],
    },
  ],
};

const renderInterview = (): void => {
  render(
    <MemoryRouter initialEntries={['/visit/appointment-id/ai-interview']}>
      <Routes>
        <Route path="/visit/:id/ai-interview" element={<AIInterview />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('AI interview start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('starts the interview once, despite the effect re-running', async () => {
    mockAIInterviewStart.mockResolvedValue(questionnaireResponseWithFirstQuestion);

    renderInterview();

    expect(await screen.findByText('Are you the patient or their guardian?')).toBeDefined();
    expect(mockAIInterviewStart).toHaveBeenCalledTimes(1);
  });

  test('asks the patient to try again when the call fails', async () => {
    mockAIInterviewStart.mockRejectedValue(new Error('The request timed out'));

    renderInterview();

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeDefined();
    expect(mockAIInterviewStart).toHaveBeenCalledTimes(1);
  });
});
