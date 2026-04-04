/**
 * Model comparison test — run the same cases through different models
 * and compare quality scores side-by-side.
 *
 * This test is useful for evaluating whether switching models (e.g., from
 * Gemini to Claude, or upgrading model versions) improves output quality.
 *
 * Run: npx vitest run tests/model-comparison.test.ts
 */

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

describe('Model Comparison', () => {
  const models: Array<'gemini' | 'claude'> = [];

  // Only test models for which we have API keys
  beforeAll(() => {
    if (process.env.GOOGLE_API_KEY) models.push('gemini');
    if (process.env.ANTHROPIC_API_KEY) models.push('claude');

    if (models.length < 2) {
      console.warn(
        'Model comparison requires both GOOGLE_API_KEY and ANTHROPIC_API_KEY. ' +
          `Only ${models.length} model(s) available. Set both keys to compare.`
      );
    }
  });

  it('compares extraction quality across models', async () => {
    if (models.length === 0) {
      console.log('Skipping: no model API keys configured');
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
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║              MODEL COMPARISON RESULTS                    ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    for (const model of models) {
      const modelScores = scores.filter((s) => s.model === model);
      const hpiPass = modelScores.filter((s) => s.hpiScore).length;
      const structuredPass = modelScores.filter((s) => s.structuredScore === true).length;
      const structuredTotal = modelScores.filter((s) => s.structuredScore !== null).length;

      console.log(`📊 ${model.toUpperCase()}`);
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
