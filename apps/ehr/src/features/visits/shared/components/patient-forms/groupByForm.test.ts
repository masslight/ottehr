import { PatientFormResponse } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { describe, expect, it } from 'vitest';
import { groupByForm } from './groupByForm';

const response = (id: string, url: string, visitDate: string): PatientFormResponse => ({
  questionnaireId: `${url}-v1`,
  questionnaireTitle: url,
  questionnaireUrl: url,
  allItems: [],
  questionnaireResponse: { resourceType: 'QuestionnaireResponse', id, status: 'completed' },
  encounterId: `enc-${id}`,
  visitDate,
  deletable: true,
});

describe('groupByForm', () => {
  it('puts the form with the most recent response first and sorts each group newest first', () => {
    const groups = groupByForm([
      response('phq-old', 'phq9', '2025-05-20T10:00:00-04:00'),
      response('sdoh-new', 'sdoh', '2026-10-09T09:00:00-04:00'),
      response('phq-new', 'phq9', '2025-11-05T10:00:00-05:00'),
    ]);

    expect(groups.map((g) => g.map((r) => r.questionnaireResponse.id))).toEqual([['sdoh-new'], ['phq-new', 'phq-old']]);
  });

  it('orders by the actual moment when visits carry different UTC offsets', () => {
    // 9:00 Pacific is later than 11:00 Eastern on the same day, though it sorts first as text.
    const [group] = groupByForm([
      response('eastern', 'sdoh', '2026-10-09T11:00:00-04:00'),
      response('pacific', 'sdoh', '2026-10-09T09:00:00-07:00'),
    ]);

    expect(group.map((r) => r.questionnaireResponse.id)).toEqual(['pacific', 'eastern']);
  });
});
