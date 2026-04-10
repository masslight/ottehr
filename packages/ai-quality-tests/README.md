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
- Side-by-side quality comparison across any set of models

## Setup

```bash
# From repo root
npm install

# Configure environment
cp packages/ai-quality-tests/.env.example packages/ai-quality-tests/.env
# Edit .env with your API keys and model choice
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `EXTRACTION_MODEL` | Model under test. Format: `provider:model-name` (see examples below) |
| `GOOGLE_CLOUD_PROJECT_ID` | GCP project for Vertex AI (required for Gemini models) |
| `GOOGLE_CLOUD_API_KEY` | API key for Vertex AI (required for Gemini models) |
| `ANTHROPIC_API_KEY` | API key for Anthropic (required for Claude models) |
| `OPENAI_API_KEY` | API key for the judge model that evaluates outputs |
| `JUDGE_MODEL` | Override judge model (default: `openai:o3-mini`) |
| `COMPARISON_MODELS` | Comma-separated list for model comparison test |

### EXTRACTION_MODEL examples

```bash
# Production default (Gemini via Vertex AI)
EXTRACTION_MODEL=gemini:gemini-3.1-flash-lite-preview

# Claude models
EXTRACTION_MODEL=claude:claude-haiku-4-5-20251001
EXTRACTION_MODEL=claude:claude-opus-4-20250514
EXTRACTION_MODEL=claude:claude-sonnet-4-20250514
```

## Running Tests

```bash
cd packages/ai-quality-tests

# Run all quality tests with the configured EXTRACTION_MODEL
npx vitest run

# Run only HPI chatbot tests
npx vitest run tests/hpi-chatbot

# Run only ambient scribe tests
npx vitest run tests/ambient-scribe

# Run model comparison (requires COMPARISON_MODELS env var)
COMPARISON_MODELS=gemini:gemini-3.1-flash-lite-preview,claude:claude-opus-4-20250514 \
  npx vitest run tests/model-comparison.test.ts

# Watch mode (re-runs on file changes)
npx vitest
```

## Changing Prompts or Models

### Testing a different model
Set `EXTRACTION_MODEL` in your `.env` and re-run the tests:
```bash
EXTRACTION_MODEL=claude:claude-opus-4-20250514 npx vitest run
```

### Testing a prompt change
1. Edit the prompt in `src/prompts.ts` (mirrors production prompts from `packages/zambdas/src/shared/ai.ts`)
2. Run the tests to see if quality improves or regresses
3. If satisfied, apply the same change to the production code

### Comparing models side-by-side
```bash
COMPARISON_MODELS=gemini:gemini-3.1-flash-lite-preview,claude:claude-opus-4-20250514 \
  npx vitest run tests/model-comparison.test.ts
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
