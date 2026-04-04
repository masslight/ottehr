/**
 * HPI Chatbot — HPI completeness suggestion quality tests.
 *
 * Tests the "missing HPI elements" suggestion feature that identifies
 * gaps in the provider's HPI documentation.
 *
 * Run: npx vitest run tests/hpi-chatbot/hpi-suggestions.test.ts
 */

import { createLLMAsJudge } from 'openevals';
import { HPI_SUGGESTION_QUALITY_PROMPT } from '../../src/evaluation-prompts.js';
import { runHpiSuggestion } from '../../src/models.js';

const judgeModel = process.env.JUDGE_MODEL ?? 'openai:o3-mini';

const hpiSuggestionJudge = createLLMAsJudge({
  prompt: HPI_SUGGESTION_QUALITY_PROMPT,
  model: judgeModel,
});

// ── Test cases ──────────────────────────────────────────────────────────────

interface SuggestionTestCase {
  id: string;
  description: string;
  hpiText: string;
  /** Elements we expect to be flagged as missing (empty = HPI is complete). */
  expectedMissing: string[];
}

const SUGGESTION_CASES: SuggestionTestCase[] = [
  {
    id: 'incomplete_hpi',
    description: 'HPI missing several key elements',
    hpiText:
      'The patient presents with a cough that started 3 days ago. The cough is productive with yellow sputum.',
    expectedMissing: ['Aggravating', 'Relieving', 'Severity', 'Associated Symptoms'],
  },
  {
    id: 'thorough_hpi',
    description: 'Thorough HPI covering most elements',
    hpiText:
      'The patient is a 45-year-old female presenting with sharp right lower quadrant abdominal pain ' +
      'that started 3 days ago (Onset). The pain is localized to the RLQ (Location) and has been ' +
      'constant for the past 72 hours (Duration). The pain is sharp in character (Characteristic), ' +
      'worsened by movement and palpation (Aggravating), and slightly improved by lying still ' +
      '(Relieving). The pain is constant without fluctuation (Timing). She rates the pain 8/10 ' +
      '(Severity). Associated symptoms include nausea, vomiting twice today, fever of 100.8°F, ' +
      'and constipation for 2 days (Associated Symptoms).',
    expectedMissing: [],
  },
  {
    id: 'partially_complete_hpi',
    description: 'HPI with some elements covered, some missing',
    hpiText:
      'The patient presents with a headache that started this morning. It is located in the ' +
      'frontal region and described as a throbbing pain rated 7/10. She denies nausea, vomiting, ' +
      'visual changes, or neck stiffness.',
    expectedMissing: ['Aggravating', 'Relieving', 'Timing'],
  },
  {
    id: 'very_minimal_hpi',
    description: 'Extremely brief HPI missing almost everything',
    hpiText: 'Patient has knee pain.',
    expectedMissing: [
      'Onset',
      'Location',
      'Duration',
      'Characteristic',
      'Aggravating',
      'Relieving',
      'Timing',
      'Severity',
      'Associated Symptoms',
    ],
  },
];

// ── Tests ───────────────────────────────────────────────────────────────────

describe('HPI Chatbot — Suggestion Quality', () => {
  for (const tc of SUGGESTION_CASES) {
    it(`${tc.id}: ${tc.description}`, async () => {
      const result = await runHpiSuggestion(tc.hpiText);

      console.log(`[${tc.id}] Raw response: ${result.raw}`);
      console.log(`[${tc.id}] Suggestions: ${JSON.stringify(result.parsed.suggestions)}`);

      // Basic format checks
      expect(result.parsed).toHaveProperty('suggestions');
      expect(Array.isArray(result.parsed.suggestions)).toBe(true);

      if (tc.expectedMissing.length === 0) {
        // Should return empty suggestions for thorough HPI
        expect(result.parsed.suggestions.length).toBe(0);
      } else {
        // Should have exactly one suggestion string
        expect(result.parsed.suggestions.length).toBe(1);
        expect(result.parsed.suggestions[0]).toMatch(/^HPI may not have covered/);
      }

      // LLM-as-judge evaluation
      const referenceOutput =
        tc.expectedMissing.length === 0
          ? '{"suggestions": []}'
          : `{"suggestions": ["HPI may not have covered ${tc.expectedMissing.join(', ')}"]}`;

      const evalResult = await hpiSuggestionJudge({
        inputs: tc.hpiText,
        outputs: JSON.stringify(result.parsed),
        referenceOutputs: referenceOutput,
      });

      console.log(`[${tc.id}] Suggestion quality score: ${evalResult.score}`);
      console.log(`[${tc.id}] Comment: ${evalResult.comment}`);

      expect(evalResult.score).toBe(true);
    });
  }
});
