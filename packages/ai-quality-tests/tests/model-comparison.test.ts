/**
 * Model comparison test — run the same cases through different models
 * and compare quality scores side-by-side.
 *
 * Configure via COMPARISON_MODELS env var (comma-separated list):
 *   COMPARISON_MODELS=gemini:gemini-3.1-flash-lite-preview,claude:claude-opus-4-20250514
 *
 * Each model needs its corresponding API keys set.
 *
 * Run: npx vitest run tests/model-comparison.test.ts
 */

import { describe, expect, it } from 'vitest';
import { createLLMAsJudge } from 'openevals';
import { HPI_NARRATIVE_QUALITY_PROMPT, STRUCTURED_EXTRACTION_QUALITY_PROMPT } from '../src/evaluation-prompts.js';
import { runExtraction } from '../src/models.js';
import { CHAT_INTERVIEW_FIELDS } from '../src/prompts.js';
import { HPI_CHATBOT_CASES } from '../src/test-data/hpi-chatbot-cases.js';

const judgeModel = process.env.JUDGE_MODEL ?? 'openai:o3-mini';

const hpiJudge = createLLMAsJudge({
  prompt: HPI_NARRATIVE_QUALITY_PROMPT,
  model: judgeModel,
});

const structuredJudge = createLLMAsJudge({
  prompt: STRUCTURED_EXTRACTION_QUALITY_PROMPT,
  model: judgeModel,
});

interface ModelScore {
  model: string;
  caseId: string;
  hpiScore: boolean;
  structuredScore: boolean | null;
  hpiComment: string;
  structuredComment: string | null;
}

function getComparisonModels(): string[] {
  const raw = process.env.COMPARISON_MODELS;
  if (!raw) {
    console.warn(
      'COMPARISON_MODELS not set. Set it to a comma-separated list of models to compare, e.g.:\n' +
        '  COMPARISON_MODELS=gemini:gemini-3.1-flash-lite-preview,claude:claude-opus-4-20250514'
    );
    return [];
  }
  return raw.split(',').map((m) => m.trim()).filter(Boolean);
}

describe('Model Comparison', () => {
  it('compares extraction quality across models', async () => {
    const models = getComparisonModels();
    if (models.length === 0) {
      console.log('Skipping: COMPARISON_MODELS not configured');
      return;
    }

    // Use a subset of cases to keep runtime manageable
    const testCases = HPI_CHATBOT_CASES.slice(0, 3);
    const scores: ModelScore[] = [];

    for (const model of models) {
      for (const tc of testCases) {
        try {
          const result = await runExtraction(tc.transcript, tc.patientInfo, CHAT_INTERVIEW_FIELDS, model);

          const hpi = result.parsed.historyOfPresentIllness as string;
          const hpiEval = await hpiJudge({
            inputs: tc.transcript,
            outputs: hpi ?? '',
            referenceOutputs: tc.expected.historyOfPresentIllness as string,
          });

          let structuredEval = null;
          if (Object.keys(tc.expected).length > 1) {
            const { historyOfPresentIllness: _, ...structuredOutput } = result.parsed as Record<string, unknown>;
            const { historyOfPresentIllness: _2, ...structuredExpected } = tc.expected;
            structuredEval = await structuredJudge({
              inputs: tc.transcript,
              outputs: JSON.stringify(structuredOutput, null, 2),
              referenceOutputs: JSON.stringify(structuredExpected, null, 2),
            });
          }

          scores.push({
            model,
            caseId: tc.id,
            hpiScore: hpiEval.score as boolean,
            structuredScore: structuredEval ? (structuredEval.score as boolean) : null,
            hpiComment: hpiEval.comment ?? '',
            structuredComment: structuredEval?.comment ?? null,
          });
        } catch (error) {
          console.error(`Error testing ${model} on ${tc.id}:`, error);
          scores.push({
            model,
            caseId: tc.id,
            hpiScore: false,
            structuredScore: false,
            hpiComment: `Error: ${error}`,
            structuredComment: null,
          });
        }
      }
    }

    // Print comparison table
    console.log('\n' + '='.length);
    console.log('MODEL COMPARISON RESULTS');
    console.log('='.repeat(60) + '\n');

    for (const model of models) {
      const modelScores = scores.filter((s) => s.model === model);
      const hpiPass = modelScores.filter((s) => s.hpiScore).length;
      const structuredPass = modelScores.filter((s) => s.structuredScore === true).length;
      const structuredTotal = modelScores.filter((s) => s.structuredScore !== null).length;

      console.log(`--- ${model} ---`);
      console.log(`   HPI Narrative:       ${hpiPass}/${modelScores.length} passed`);
      console.log(`   Structured Extract:  ${structuredPass}/${structuredTotal} passed`);
      console.log('');

      for (const s of modelScores) {
        console.log(`   [${s.caseId}] HPI: ${s.hpiScore ? 'PASS' : 'FAIL'} | Structured: ${s.structuredScore === null ? 'N/A' : s.structuredScore ? 'PASS' : 'FAIL'}`);
        if (!s.hpiScore) console.log(`     HPI comment: ${s.hpiComment}`);
        if (s.structuredScore === false) console.log(`     Structured comment: ${s.structuredComment}`);
      }
      console.log('');
    }

    // At least one model should pass
    const anyPass = scores.some((s) => s.hpiScore);
    expect(anyPass).toBe(true);
  });
});
