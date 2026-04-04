/**
 * HPI Chatbot — clinical data extraction quality tests.
 *
 * Uses openevals LLM-as-judge to evaluate the quality of AI-extracted
 * clinical data from patient chat transcripts.
 *
 * Run: npx vitest run tests/hpi-chatbot/hpi-extraction.test.ts
 */

import { createLLMAsJudge } from 'openevals';
import {
  FORMAT_COMPLIANCE_PROMPT,
  HPI_NARRATIVE_QUALITY_PROMPT,
  STRUCTURED_EXTRACTION_QUALITY_PROMPT,
} from '../../src/evaluation-prompts.js';
import { runExtraction } from '../../src/models.js';
import { CHAT_INTERVIEW_FIELDS } from '../../src/prompts.js';
import { HPI_CHATBOT_CASES } from '../../src/test-data/hpi-chatbot-cases.js';

const judgeModel = process.env.JUDGE_MODEL ?? 'openai:o3-mini';

// ── Evaluators ──────────────────────────────────────────────────────────────

const hpiNarrativeJudge = createLLMAsJudge({
  prompt: HPI_NARRATIVE_QUALITY_PROMPT,
  model: judgeModel,
});

const structuredExtractionJudge = createLLMAsJudge({
  prompt: STRUCTURED_EXTRACTION_QUALITY_PROMPT,
  model: judgeModel,
});

const formatJudge = createLLMAsJudge({
  prompt: FORMAT_COMPLIANCE_PROMPT,
  model: judgeModel,
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('HPI Chatbot — Extraction Quality', () => {
  // Cache extraction results so we don't call the model multiple times per case
  const results = new Map<string, Awaited<ReturnType<typeof runExtraction>>>();

  beforeAll(async () => {
    // Run all extractions in parallel
    const extractions = HPI_CHATBOT_CASES.map(async (tc) => {
      const result = await runExtraction(tc.transcript, tc.patientInfo, CHAT_INTERVIEW_FIELDS);
      results.set(tc.id, result);
    });
    await Promise.all(extractions);
  });

  describe('HPI narrative quality', () => {
    for (const tc of HPI_CHATBOT_CASES) {
      it(`${tc.id}: ${tc.description}`, async () => {
        const result = results.get(tc.id)!;
        const hpi = result.parsed.historyOfPresentIllness as string | undefined;
        expect(hpi).toBeDefined();

        const evalResult = await hpiNarrativeJudge({
          inputs: tc.transcript,
          outputs: hpi!,
          referenceOutputs: tc.expected.historyOfPresentIllness as string,
        });

        console.log(`[${tc.id}] HPI narrative score: ${evalResult.score}`);
        console.log(`[${tc.id}] Comment: ${evalResult.comment}`);

        expect(evalResult.score).toBe(true);
      });
    }
  });

  describe('Structured data extraction quality', () => {
    // Only run for cases that have structured expected data beyond HPI
    const casesWithStructuredData = HPI_CHATBOT_CASES.filter(
      (tc) => Object.keys(tc.expected).length > 1
    );

    for (const tc of casesWithStructuredData) {
      it(`${tc.id}: ${tc.description}`, async () => {
        const result = results.get(tc.id)!;

        // Extract only the structured fields (exclude HPI narrative)
        const { historyOfPresentIllness: _hpi, ...structuredOutput } = result.parsed as Record<string, unknown>;
        const { historyOfPresentIllness: _refHpi, ...structuredExpected } = tc.expected;

        const evalResult = await structuredExtractionJudge({
          inputs: tc.transcript,
          outputs: JSON.stringify(structuredOutput, null, 2),
          referenceOutputs: JSON.stringify(structuredExpected, null, 2),
        });

        console.log(`[${tc.id}] Structured extraction score: ${evalResult.score}`);
        console.log(`[${tc.id}] Comment: ${evalResult.comment}`);

        expect(evalResult.score).toBe(true);
      });
    }
  });

  describe('JSON format compliance', () => {
    for (const tc of HPI_CHATBOT_CASES) {
      it(`${tc.id}: ${tc.description}`, async () => {
        const result = results.get(tc.id)!;

        const evalResult = await formatJudge({
          inputs: tc.transcript,
          outputs: JSON.stringify(result.parsed, null, 2),
        });

        console.log(`[${tc.id}] Format compliance score: ${evalResult.score}`);
        console.log(`[${tc.id}] Comment: ${evalResult.comment}`);

        expect(evalResult.score).toBe(true);
      });
    }
  });
});
