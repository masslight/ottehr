# AI Quality Tests

LLM-as-judge quality tests for Ottehr's AI features, using [openevals](https://github.com/langchain-ai/openevals).

## Features Tested

### HPI Chatbot
- **HPI narrative extraction** — evaluates clinical accuracy, completeness, and writing style of extracted History of Present Illness
- **Structured data extraction** — evaluates accuracy of medications, allergies, PMH, surgical history, etc.
- **HPI completeness suggestions** — evaluates the "missing HPI elements" detection feature
- **JSON format compliance** — validates response structure matches expected schema

### Ambient Scribe
- **HPI narrative extraction** — same criteria as chatbot, applied to audio transcripts
- **Structured data extraction** — includes labs, prescriptions, and procedures (scribe-specific fields)
- **Mechanism of injury** — evaluates MOI narrative for workers' comp cases
- **JSON format compliance** — validates response structure

### Model Comparison
- Side-by-side quality comparison across different models (Gemini vs Claude)

## Setup

```bash
# From repo root
npm install

# Configure API keys
cp packages/ai-quality-tests/.env.example packages/ai-quality-tests/.env
# Edit .env with your API keys
```

### Required API Keys

| Key | Purpose |
|-----|---------|
| `OPENAI_API_KEY` | Judge model (evaluates outputs) |
| `GOOGLE_API_KEY` | Gemini model under test (production default) |
| `ANTHROPIC_API_KEY` | Claude model under test (alternative) |

## Running Tests

```bash
cd packages/ai-quality-tests

# Run all quality tests
npx vitest run

# Run only HPI chatbot tests
npx vitest run tests/hpi-chatbot

# Run only ambient scribe tests
npx vitest run tests/ambient-scribe

# Run model comparison
npx vitest run tests/model-comparison.test.ts

# Watch mode (re-runs on file changes)
npx vitest
```

## Changing Prompts or Models

### Testing a prompt change
1. Edit the prompt in `src/prompts.ts` (mirrors production prompts from `packages/zambdas/src/shared/ai.ts`)
2. Run the tests to see if quality improves or regresses
3. If satisfied, apply the same change to the production code

### Testing a different model
1. Edit `src/models.ts` to change the model name
2. Or use the model comparison test to compare models side-by-side

### Changing the judge model
Set `JUDGE_MODEL` in your `.env` file:
```
JUDGE_MODEL=anthropic:claude-sonnet-4-20250514
```

## Adding Test Cases

Add new cases to:
- `src/test-data/hpi-chatbot-cases.ts` — HPI chatbot scenarios
- `src/test-data/ambient-scribe-cases.ts` — ambient scribe scenarios

Each case needs:
- A realistic transcript
- Clinically accurate expected output (used as reference for the judge)

## Architecture

```
src/
  prompts.ts              # Production prompts (mirrored from zambdas)
  evaluation-prompts.ts   # LLM-as-judge rubrics
  models.ts               # Model invocation helpers
  test-data/              # Test cases with expected outputs
tests/
  hpi-chatbot/            # HPI chatbot quality tests
  ambient-scribe/         # Ambient scribe quality tests
  model-comparison.test.ts # Cross-model comparison
```
