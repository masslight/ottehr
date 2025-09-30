# AI ICD Code Generation Feature

## Overview

This feature automatically generates suggested ICD-10 codes using AI when healthcare providers update the History of Present Illness (HPI) or Medical Decision Making (MDM) fields in the EHR system.

## How It Works

### Backend Implementation

1. **Trigger**: When a provider updates either the HPI (Chief Complaint field) or MDM (Medical Decision field), the `save-chart-data` zambda is invoked.

2. **AI Processing**: The zambda calls the `generateIcdCodesFromClinicalNotes` function which:
   - Combines the HPI and MDM text into a structured prompt
   - Sends the prompt to the AI service (Claude via Anthropic)
   - Parses the AI response to extract potential ICD-10 diagnoses

3. **Data Management**: 
   - Existing AI-generated diagnoses are removed to prevent duplicates
   - New AI-generated diagnoses are saved as FHIR Condition resources with a special tag `'ai-potential-diagnosis'`
   - If no meaningful text is present, all AI diagnoses are cleared

### Frontend Display

The AI-generated ICD codes are automatically displayed in the `AiPotentialDiagnosesCard` component, which shows:
- A clearly labeled "OYSTEHR AI" section
- List of potential diagnoses with ICD-10 codes
- Same styling as existing AI suggestions from chatbot sessions

## Technical Details

### Key Files Modified

- `packages/zambdas/src/shared/ai.ts` - Added `generateIcdCodesFromClinicalNotes` function
- `packages/zambdas/src/ehr/save-chart-data/index.ts` - Integrated AI generation into chart data saving
- `packages/zambdas/src/shared/index.ts` - Exported AI functions

### AI Prompt Structure

The system sends a structured prompt to the AI that includes:
- Clear context about the task (ICD-10 code generation)
- Clinical information from HPI and/or MDM fields
- Specific format requirements for the JSON response
- Instructions to limit suggestions to 3-5 most relevant diagnoses

### Error Handling

- AI service failures are gracefully handled without interrupting chart data saving
- Malformed AI responses return empty arrays
- Network issues or timeouts don't affect other chart operations

### Data Flow

1. Provider updates HPI or MDM text
2. Frontend debounces input and calls save-chart-data API
3. Zambda processes the update and triggers AI generation (if text is present)
4. AI-generated diagnoses are saved as FHIR Condition resources
5. Frontend re-fetches chart data and displays updated AI suggestions
6. Provider sees AI suggestions in the familiar AI card format

## Testing

Unit tests are provided in `packages/zambdas/test/ai-icd-generation.test.ts` covering:
- Empty input handling
- Error scenarios
- Valid AI response parsing
- Edge cases with whitespace-only text

## Benefits

- **Real-time Suggestions**: ICD codes are generated as providers type clinical notes
- **Consistent Interface**: Uses the same UI component as existing AI features
- **Non-intrusive**: Doesn't interrupt workflow if AI service is unavailable
- **Accurate**: Based on actual clinical documentation rather than assumptions
- **Efficient**: Automatically manages duplicate suggestions and cleanup