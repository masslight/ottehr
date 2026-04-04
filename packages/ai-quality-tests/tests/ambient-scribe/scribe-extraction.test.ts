/**
 * Ambient Scribe — clinical data extraction quality tests.
 *
 * Tests the quality of AI-extracted clinical data from provider-patient
 * audio transcripts. The ambient scribe extracts the same fields as the
 * HPI chatbot, plus labs, erx, and procedures.
 *
 * Run: npx vitest run tests/ambient-scribe/scribe-extraction.test.ts
 */

import { createLLMAsJudge } from 'openevals';
import {
  FORMAT_COMPLIANCE_PROMPT,
  HPI_NARRATIVE_QUALITY_PROMPT,
  MECHANISM_OF_INJURY_PROMPT,
  STRUCTURED_EXTRACTION_QUALITY_PROMPT,
} from '../../src/evaluation-prompts.js';
import { runExtraction } from '../../src/models.js';
import { AUDIO_INTERVIEW_FIELDS, WORKERS_COMP_PREFIX } from '../../src/prompts.js';
import { AMBIENT_SCRIBE_CASES } from '../../src/test-data/ambient-scribe-cases.js';

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

const moiJudge = createLLMAsJudge({
  prompt: MECHANISM_OF_INJURY_PROMPT,
  model: judgeModel,
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Ambient Scribe — Extraction Quality', () => {
  const results = new Map<string, Awaited<ReturnType<typeof runExtraction>>>();

  beforeAll(async () => {
    const extractions = AMBIENT_SCRIBE_CASES.map(async (tc) => {
      const fields = tc.isWorkersComp ? WORKERS_COMP_PREFIX + AUDIO_INTERVIEW_FIELDS : AUDIO_INTERVIEW_FIELDS;
      const result = await runExtraction(tc.transcript, tc.patientInfo, fields);
      results.set(tc.id, result);
    });
    await Promise.all(extractions);
  });

  describe('HPI narrative quality', () => {
    for (const tc of AMBIENT_SCRIBE_CASES) {
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
    for (const tc of AMBIENT_SCRIBE_CASES) {
      it(`${tc.id}: ${tc.description}`, async () => {
        const result = results.get(tc.id)!;

        // Extract only the structured fields (exclude prose narratives)
        const { historyOfPresentIllness: _hpi, mechanismOfInjury: _moi, ...structuredOutput } = result.parsed as Record<string, unknown>;
        const { historyOfPresentIllness: _refHpi, mechanismOfInjury: _refMoi, ...structuredExpected } = tc.expected;

        // Skip if no structured fields expected
        if (Object.keys(structuredExpected).length === 0) return;

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

  describe('Mechanism of injury (workers comp cases)', () => {
    const workersCompCases = AMBIENT_SCRIBE_CASES.filter((tc) => tc.isWorkersComp);

    for (const tc of workersCompCases) {
      it(`${tc.id}: ${tc.description}`, async () => {
        const result = results.get(tc.id)!;
        const moi = result.parsed.mechanismOfInjury as string | undefined;
        expect(moi).toBeDefined();

        const evalResult = await moiJudge({
          inputs: tc.transcript,
          outputs: moi!,
          referenceOutputs: tc.expected.mechanismOfInjury as string,
        });

        console.log(`[${tc.id}] MOI score: ${evalResult.score}`);
        console.log(`[${tc.id}] Comment: ${evalResult.comment}`);

        expect(evalResult.score).toBe(true);
      });
    }
  });

  describe('Labs, eRx, and procedures extraction (scribe-specific)', () => {
    const casesWithTreatment = AMBIENT_SCRIBE_CASES.filter(
      (tc) => tc.expected.labs || tc.expected.erx || tc.expected.procedures
    );

    for (const tc of casesWithTreatment) {
      it(`${tc.id}: ${tc.description}`, async () => {
        const result = results.get(tc.id)!;

        // Check that treatment-related fields were extracted
        const treatmentOutput: Record<string, unknown> = {};
        const treatmentExpected: Record<string, unknown> = {};

        for (const field of ['labs', 'erx', 'procedures'] as const) {
          if (tc.expected[field]) {
            treatmentExpected[field] = tc.expected[field];
            treatmentOutput[field] = result.parsed[field] ?? [];
          }
        }

        const evalResult = await structuredExtractionJudge({
          inputs: tc.transcript,
          outputs: JSON.stringify(treatmentOutput, null, 2),
          referenceOutputs: JSON.stringify(treatmentExpected, null, 2),
        });

        console.log(`[${tc.id}] Treatment extraction score: ${evalResult.score}`);
        console.log(`[${tc.id}] Comment: ${evalResult.comment}`);

        expect(evalResult.score).toBe(true);
      });
    }
  });

  describe('JSON format compliance', () => {
    for (const tc of AMBIENT_SCRIBE_CASES) {
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
