/**
 * Custom LLM-as-judge evaluation prompts for clinical AI quality assessment.
 *
 * Each prompt is a template consumed by openevals' createLLMAsJudge().
 * Variables in {braces} are automatically interpolated from the evaluator call.
 */

/**
 * Evaluates whether the HPI (History of Present Illness) narrative is
 * clinically accurate, complete, and well-written.
 */
export const HPI_NARRATIVE_QUALITY_PROMPT = `You are a board-certified emergency medicine physician reviewing an AI-generated
History of Present Illness (HPI) narrative extracted from a patient interview transcript.

<transcript>
{inputs}
</transcript>

<ai_generated_hpi>
{outputs}
</ai_generated_hpi>

<reference_hpi>
{reference_outputs}
</reference_hpi>

Evaluate the AI-generated HPI on these criteria:
1. **Clinical Accuracy**: Does it accurately represent what the patient reported? No hallucinated or fabricated details?
2. **Completeness**: Does it capture all clinically relevant information from the transcript (chief complaint, onset, duration, quality, severity, modifying factors, associated symptoms)?
3. **Appropriate Negatives**: Does it correctly note relevant negatives the patient denied, without including conditions the patient denies having (as positive findings)?
4. **Clinical Writing Style**: Is it written in proper third-person clinical prose ("The patient presents with...")?
5. **No Fabrication**: Does it avoid adding information not present in the transcript?

Return a score of true if the HPI meets professional clinical documentation standards
(accurate, reasonably complete, no fabrications), or false if it has significant
clinical errors, fabrications, or critical omissions.

Provide a brief explanation for your score.`;

/**
 * Evaluates whether structured data fields (medications, allergies, PMH, etc.)
 * are accurately extracted from the transcript.
 */
export const STRUCTURED_EXTRACTION_QUALITY_PROMPT = `You are a clinical informaticist reviewing AI-extracted structured medical data
from a patient interview transcript.

<transcript>
{inputs}
</transcript>

<ai_extracted_data>
{outputs}
</ai_extracted_data>

<reference_data>
{reference_outputs}
</reference_data>

Evaluate the AI extraction on these criteria:
1. **Accuracy**: Are all extracted items actually mentioned in the transcript?
2. **Completeness**: Are there any items mentioned in the transcript that were missed?
3. **Correct Categorization**: Are items placed in the correct fields (e.g., medications in medicationsHistory, not in allergies)?
4. **Negation Handling**: Items the patient denies should NOT appear (e.g., if patient says "I don't smoke", smoking should not appear in socialHistory as a positive finding).
5. **Format Compliance**: Are medications formatted with dose and timing when available? Are allergies formatted with reactions?

Return a score of true if the extraction is clinically acceptable (no major errors,
no dangerous omissions like missed allergies, no hallucinated items), or false if
there are significant errors.

Provide a brief explanation for your score.`;

/**
 * Evaluates the overall JSON response format compliance.
 */
export const FORMAT_COMPLIANCE_PROMPT = `You are reviewing an AI-generated JSON response for format compliance.

<ai_response>
{outputs}
</ai_response>

Check these format requirements:
1. The response must be valid JSON (it has been parsed, so just verify structure).
2. "historyOfPresentIllness" and "mechanismOfInjury" (if present) must be strings (clinical prose), NOT arrays.
3. All other fields must be JSON arrays of strings.
4. Keys must be camelCase.
5. Sections with no relevant information should be omitted entirely (not present as empty arrays).
6. No markdown formatting in the response.

Return true if the format is correct, false if there are format violations.

Provide a brief explanation for your score.`;

/**
 * Evaluates the mechanism of injury extraction for workers' comp cases.
 */
export const MECHANISM_OF_INJURY_PROMPT = `You are a board-certified occupational medicine physician reviewing an AI-generated
Mechanism of Injury (MOI) narrative extracted from a workers' compensation visit transcript.

<transcript>
{inputs}
</transcript>

<ai_generated_moi>
{outputs}
</ai_generated_moi>

<reference_moi>
{reference_outputs}
</reference_moi>

Evaluate the MOI on these criteria:
1. **Accuracy**: Does it accurately describe how the injury occurred based on the transcript?
2. **Key Details**: Does it include the activity at time of injury, body mechanics involved, forces/weights, and timing?
3. **Work-Relatedness**: Does it clearly establish the injury occurred in a work context?
4. **Clinical Prose**: Is it written as a proper clinical narrative, not a list?
5. **No Fabrication**: Does it avoid adding details not present in the transcript?

Return true if the MOI meets occupational medicine documentation standards,
false if it has significant errors or omissions.

Provide a brief explanation for your score.`;

/**
 * Evaluates HPI suggestion quality (missing elements detection).
 */
export const HPI_SUGGESTION_QUALITY_PROMPT = `You are a clinical documentation specialist reviewing an AI system's assessment
of potentially missing elements in an HPI (History of Present Illness).

The standard HPI elements for an urgent care visit are:
Onset, Location, Duration, Characteristic, Aggravating, Relieving, Timing, Severity, Associated Symptoms

<hpi_text>
{inputs}
</hpi_text>

<ai_suggestions>
{outputs}
</ai_suggestions>

<reference_suggestions>
{reference_outputs}
</reference_suggestions>

Evaluate the AI's suggestions:
1. **Accuracy**: Are the identified missing elements actually missing from the HPI?
2. **No False Positives**: Does it avoid flagging elements that ARE adequately covered?
3. **Completeness**: Does it catch the important missing elements?
4. **Format**: Is the response a single sentence starting with "HPI may not have covered"?
5. **Appropriate Empty Response**: If the HPI is thorough, is the suggestions array empty?

Return true if the suggestions are clinically helpful and accurate, false if they
contain significant errors (flagging covered elements or missing obviously absent ones).

Provide a brief explanation for your score.`;
