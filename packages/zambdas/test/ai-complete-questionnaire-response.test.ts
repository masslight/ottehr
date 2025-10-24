import { QuestionnaireResponse } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { completeInProgressAiQuestionnaireResponseIfPossible } from '../src/shared/ai-complete-questionnaire-response';

// Mock Oystehr SDK
const mockOystehr = {
  fhir: {
    search: vi.fn(),
    update: vi.fn(),
  },
};

describe('AI Questionnaire Helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip if no AI QuestionnaireResponse found', async () => {
    // Mock no QR found
    mockOystehr.fhir.search.mockResolvedValue({
      unbundle: () => [],
    });

    await completeInProgressAiQuestionnaireResponseIfPossible(mockOystehr as any, 'encounter-123');

    expect(mockOystehr.fhir.search).toHaveBeenCalledWith({
      resourceType: 'QuestionnaireResponse',
      params: [
        { name: 'encounter', value: 'Encounter/encounter-123' },
        { name: 'questionnaire', value: '#aiInterviewQuestionnaire' },
      ],
    });
    expect(mockOystehr.fhir.update).not.toHaveBeenCalled();
  });

  it('should skip if AI resources already exist (idempotency)', async () => {
    const inProgressQR: QuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      id: 'qr-123',
      status: 'in-progress',
      questionnaire: '#aiInterviewQuestionnaire',
    };

    mockOystehr.fhir.search
      .mockResolvedValueOnce({
        unbundle: () => [inProgressQR],
      })
      // Mock existing DocumentReference found
      .mockResolvedValueOnce({
        unbundle: () => [{ resourceType: 'DocumentReference', id: 'doc-123' }],
      });

    await completeInProgressAiQuestionnaireResponseIfPossible(mockOystehr as any, 'encounter-123');

    expect(mockOystehr.fhir.update).not.toHaveBeenCalled();
  });

  it('should skip if AI QuestionnaireResponse is already completed', async () => {
    const completedQR: QuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      id: 'qr-123',
      status: 'completed',
      questionnaire: '#aiInterviewQuestionnaire',
    };

    mockOystehr.fhir.search.mockResolvedValueOnce({
      unbundle: () => [completedQR],
    });

    await completeInProgressAiQuestionnaireResponseIfPossible(mockOystehr as any, 'encounter-123');

    expect(mockOystehr.fhir.update).not.toHaveBeenCalled();
  });

  it('should skip if AI QuestionnaireResponse has no user answers', async () => {
    const qrWithoutAnswers: QuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      id: 'qr-123',
      status: 'in-progress',
      questionnaire: '#aiInterviewQuestionnaire',
      item: [
        {
          linkId: '0', // Initial AI message
          answer: [{ valueString: 'Initial AI message' }],
        },
      ],
    };

    mockOystehr.fhir.search
      .mockResolvedValueOnce({
        unbundle: () => [qrWithoutAnswers],
      })
      // Mock no existing DocumentReference
      .mockResolvedValueOnce({
        unbundle: () => [],
      });

    await completeInProgressAiQuestionnaireResponseIfPossible(mockOystehr as any, 'encounter-123');

    expect(mockOystehr.fhir.update).not.toHaveBeenCalled();
  });

  it('should complete AI QuestionnaireResponse with user answers', async () => {
    const qrWithAnswers: QuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse',
      id: 'qr-123',
      status: 'in-progress',
      questionnaire: '#aiInterviewQuestionnaire',
      item: [
        {
          linkId: '0', // Initial AI message
          answer: [{ valueString: 'Initial AI message' }],
        },
        {
          linkId: '1', // User answer
          answer: [{ valueString: 'My head hurts' }],
        },
        {
          linkId: '2', // Another user answer
          answer: [{ valueString: 'Since yesterday' }],
        },
      ],
    };

    mockOystehr.fhir.search
      .mockResolvedValueOnce({
        unbundle: () => [qrWithAnswers],
      })
      // Mock no existing DocumentReference
      .mockResolvedValueOnce({
        unbundle: () => [],
      });

    await completeInProgressAiQuestionnaireResponseIfPossible(mockOystehr as any, 'encounter-123');

    expect(mockOystehr.fhir.update).toHaveBeenCalledWith({
      ...qrWithAnswers,
      status: 'completed',
    });
  });

  it('should handle errors gracefully without throwing', async () => {
    mockOystehr.fhir.search.mockRejectedValue(new Error('FHIR search failed'));

    // Should not throw
    await expect(
      completeInProgressAiQuestionnaireResponseIfPossible(mockOystehr as any, 'encounter-123')
    ).resolves.toBeUndefined();
  });
});
