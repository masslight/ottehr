import { APIGatewayProxyResult } from 'aws-lambda';
import { DateTime } from 'luxon';
import { getEmCodes } from 'utils/lib/helpers/em-codes';
import {
  BillingSuggestionOutput,
  MedicationDTO,
  PrescribedMedicationDTO,
} from 'utils/lib/types/api/chart-data/chart-data.types';
import { fixAndParseJsonObjectFromString } from 'utils/lib/validation/json-fix';
import { invokeChatbotVertexAI } from '../../shared/ai';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const EXCLUDED_PRESCRIPTION_STATUSES = new Set(['cancelled', 'entered-in-error', 'stopped']);
const CURRENT_MEDICATION_PROMPT_LIMIT = 20;

// Logs how long an async step takes. Used to pinpoint which part of the endpoint dominates latency
// in production (the E&M code lookup vs. the LLM call vs. the terminology lookups).
const timed = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    console.log(`[recommend-billing-suggestions] ${label} took ${Date.now() - start}ms`);
  }
};

function formatRenewalStatus(isRenewal: boolean | undefined): string {
  if (isRenewal === true) return 'refill/renewal';
  if (isRenewal === false) return 'new prescription';
  return 'renewal status unknown';
}

export function formatPrescribedMedicationsForBillingPrompt(
  prescribedMedications: PrescribedMedicationDTO[] | undefined
): string {
  const currentVisitPrescriptions = (prescribedMedications ?? []).filter((medication) => {
    if (!medication.name && !medication.instructions) return false;
    return !medication.status || !EXCLUDED_PRESCRIPTION_STATUSES.has(medication.status);
  });

  if (currentVisitPrescriptions.length === 0) return '';

  return currentVisitPrescriptions
    .map((medication) => {
      const parts = [
        `Medication: ${medication.name || 'Unknown medication'}`,
        `Status: ${medication.status || 'unknown'}`,
        `Order type: ${formatRenewalStatus(medication.isRenewal)}`,
      ];
      if (medication.instructions) parts.push(`SIG: ${medication.instructions}`);
      return parts.join(' | ');
    })
    .join('\n');
}

function formatIntakeDate(date: string | undefined): string | undefined {
  if (!date) return undefined;

  // setZone keeps the offset the chart recorded, so an evening dose doesn't shift a day in the
  // lambda's UTC clock.
  const parsedDate = DateTime.fromISO(date, { setZone: true });
  return parsedDate.isValid ? parsedDate.toFormat('yyyy-MM-dd') : date;
}

// Sort key for prompt ordering. Undated entries sort last: with a limited number of slots, a
// medication nobody dated is the weakest candidate to spend one on. MIN_SAFE_INTEGER rather than
// -Infinity so two undated entries compare equal instead of producing NaN.
function intakeSortKey(medication: MedicationDTO): number {
  if (!medication.intakeInfo?.date) return Number.MIN_SAFE_INTEGER;

  const parsedDate = DateTime.fromISO(medication.intakeInfo.date);
  return parsedDate.isValid ? parsedDate.toMillis() : Number.MIN_SAFE_INTEGER;
}

// The patient's medication history as the provider confirmed it in the chart. DoseSpot medication
// history is deliberately not queried here: the chart surfaces it as suggestions (see
// useExternalMedicationHistory / ExternalRxSuggestions) and only what the provider accepts becomes
// part of this list, so this is the reconciled record the coding prompt should reason over.
export function formatCurrentMedicationsForBillingPrompt(currentMedications: MedicationDTO[] | undefined): string {
  const confirmedMedications = (currentMedications ?? []).filter(
    (medication) =>
      medication.name &&
      medication.status === 'active' &&
      // Defensive, not load-bearing: the chart-data request behind this list searches
      // _tag=current-medication, so eRx-derived statements (tagged prescribed-medication) don't
      // reach us today. Keep them out if that ever changes — this section is meant to be the
      // reconciled list, and current-visit orders are already stated in the prescription context.
      // The scheduled/as-needed label below also assumes those two are the only types left here.
      medication.type !== 'prescribed-medication'
  );

  if (confirmedMedications.length === 0) return '';

  // The chart-data request behind this list applies no _sort (unlike the Current Medications card,
  // which asks for -_lastUpdated), and MedicationStatements never expire — a med recorded years ago
  // still reads as active. Order newest-taken first so the limit below drops the stalest entries
  // instead of an arbitrary 20.
  const medications = confirmedMedications
    .sort((a, b) => intakeSortKey(b) - intakeSortKey(a))
    .slice(0, CURRENT_MEDICATION_PROMPT_LIMIT)
    .map((medication) => {
      const lastTaken = formatIntakeDate(medication.intakeInfo?.date);
      const parts = [
        `Medication: ${medication.name}`,
        `Type: ${medication.type === 'as-needed' ? 'as needed' : 'scheduled'}`,
        medication.intakeInfo?.dose ? `Dose: ${medication.intakeInfo.dose}` : undefined,
        lastTaken ? `Last taken: ${lastTaken}` : undefined,
        medication.intakeInfo?.patientCouldNotConfirmDosage ? 'Patient could not confirm dosage' : undefined,
      ].filter(Boolean);
      return parts.join(' | ');
    });

  const omittedCount = confirmedMedications.length - medications.length;
  return [
    `Confirmed current medication count: ${confirmedMedications.length}`,
    ...medications,
    omittedCount > 0 ? `Additional confirmed medications omitted: ${omittedCount}` : undefined,
  ]
    .filter(Boolean)
    .join('\n');
}

export const index = wrapHandler(
  'recommend-billing-suggestions',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const {
      newPatient,
      patientAge,
      patientSex,
      hpi,
      mdm,
      externalLabOrders,
      internalLabOrders,
      radiologyOrders,
      radiologyReports,
      procedures,
      rosFindings,
      diagnoses,
      billing,
      prescribedMedications,
      currentMedications,
      secrets,
    } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    const handlerStart = Date.now();

    m2mToken = await timed('checkOrCreateM2MClientToken', () => checkOrCreateM2MClientToken(m2mToken, secrets));

    const oystehr = createClinicalOystehrClient(m2mToken, secrets);
    const emCodeOptions = await timed('getEmCodes', () => getEmCodes(oystehr));
    const prescribedMedicationContext = formatPrescribedMedicationsForBillingPrompt(prescribedMedications);
    const currentMedicationContext = formatCurrentMedicationsForBillingPrompt(currentMedications);

    let prompt = `You are an expert medical coder for an urgent care clinic. Suggest appropriate ICD-10 and CPT codes for this visit.

      CRITICAL RULE — Lab Orders, Radiology Reports & Procedures:
      Before suggesting ANY ICD or CPT codes, first review the "Internal Lab Orders", "External Lab Orders", "Radiology Reports", and "Procedures" sections below. Every positive, abnormal, or clinically significant lab/radiology finding MUST have a corresponding specific ICD-10 diagnosis code in your suggestions. Every documented procedure MUST have its corresponding CPT code included. These result-driven and procedure-driven codes take absolute priority and must appear before any general symptom or encounter codes. Never omit a diagnosis that is confirmed by a test result or a CPT code for a procedure that was performed. Only suggest diagnoses that match the actual test results provided — do not infer conditions from tests that are not listed.

      Always prefer the most specific ICD-10 code available. Avoid unspecified, 'other specified,' or general symptom codes (e.g., codes ending in .9 or .8) when a more precise code exists based on the clinical data.

      Only suggest CPT codes for procedures, tests, and services that were actually performed or ordered during this visit. Do not suggest screening or preventive procedure codes unless the clinical data explicitly indicates they were performed. Ensure CPT codes are appropriate for the patient's age and sex.

      Suggest up to 5 ICD-10 and up to 5 CPT codes supported by the clinical data, in a simple list without commentary but with a code and a short reason why it was suggested. If we don't know whether the patient is new or returning, suggest an E&M code for both a new and an established patient. Be sure to include a modifier to the E&M code if needed and HCPCS Q-codes as appropriate. Do not include E&M code in the list of CPT codes.

      E&M CODE SELECTION — CRITICAL INSTRUCTIONS:
      Select the E&M code using the 2021 AMA/CMS MDM framework. The E&M level is determined by the HIGHEST of these three MDM elements (only two of three need to meet the level):
      1. Number and Complexity of Problems: A single acute uncomplicated illness is Low (99213). An acute illness with systemic symptoms, a new problem requiring additional workup, or a chronic illness with mild exacerbation is Moderate (99214). An acute or chronic illness posing threat to life/function is High (99215).
      2. Amount and Complexity of Data: Ordering or reviewing tests, obtaining history from external sources, or independent interpretation of tests increases data complexity.
      3. Risk of Complications/Management: The SINGLE highest-risk element determines this category. Non-refill prescription drug management ordered during this visit qualifies as Moderate risk, which alone supports 99214/99204. Renewal/refill-only eRx orders do not by themselves qualify as Moderate risk; do not suggest 99214/99204 solely because the current visit prescription context contains only refills. OTC medications only support 99213/99203.

      URGENT CARE CALIBRATION: The E&M codes differ by whether the patient is new or established, but the MDM complexity levels are the same:
      - Straightforward: 99202 (new) / 99212 (established) — ~3–8% of visits
      - Low: 99203 (new) / 99213 (established) — ~30–45% of visits
      - Moderate: 99204 (new) / 99214 (established) — ~45–60% of visits
      - High: 99205 (new) / 99215 (established) — ~1–3% of visits

      Use the new patient codes (99202–99205) when the patient is new to the practice, and the established patient codes (99212–99215) when the patient is established. The complexity thresholds are identical — only the code number differs.

      Moderate complexity is the most common level because most urgent care patients present with an acute illness or injury requiring at least a prescription, which meets Moderate risk. However, Low complexity is still appropriate for roughly a third of visits — those involving a single self-limited problem managed with OTC recommendations or simple reassurance.

      Common patterns:
      - Any visit resulting in a non-refill prescription → at minimum Moderate (99204/99214)
      - Renewal/refill-only eRx orders → do not upcode to Moderate by themselves; use the other MDM elements and documented problems/data/risk
      - New undiagnosed problem with uncertain prognosis → Moderate (99204/99214)
      - Acute illness with systemic symptoms (fever, vomiting, etc.) → Moderate (99204/99214)
      - Multiple chronic conditions with exacerbation → Moderate or High (99204-05/99214-15)
      - Single acute uncomplicated illness, OTC recommendation only → Low (99203/99213)
      - Brief visit, known self-limited problem, simple reassurance → Low (99203/99213)
      - Minimal encounter, e.g., single follow-up question, suture removal → Straightforward (99202/99212)

      Do not default to Low complexity when the visit involves non-refill prescription drug management or a new problem requiring workup — those are Moderate. But do not upcode to Moderate when the visit is genuinely straightforward, renewal-only, or has no prescription and a self-limited problem.

      PRESCRIPTION CONTEXT RULE:
      Review the "Current Visit Prescription Orders" section when present. If it includes a current-visit eRx order marked "new prescription" and the appropriate E&M code is not already charted, suggest the Moderate E&M code (99204 for new patients or 99214 for established patients) unless a higher level is otherwise supported. If all current-visit eRx orders are marked "refill/renewal", do not suggest Moderate E&M solely from prescription drug management. Use the "Confirmed Current Medications" section — the medication list the provider reconciled with the patient — only to understand chronic medication burden and complexity; the medications a patient is already taking are not proof of prescription drug management during this visit.

      Include whether the patient is new or established when suggesting an E&M code. If there are not relevant results, return an empty list.

      Here are the E&M codes:

      ${emCodeOptions.map((option) => `${option.code}: ${option.display}`).join('\n')}

      Include in three or fewer sentences how this visit would differ if coded at a higher complexity E&M level, identifying exactly which progress note data were the bottlenecks preventing a higher level and a sample MDM paragraph that would satisfy that level.

      AUDIT FINDING — Review the PROVIDER'S CURRENT CODES ONLY (the ICD, CPT, and E&M codes listed at the end of this prompt under "ICD:" and "CPT:"), NOT the codes you are suggesting above. If the provider has not entered any codes yet, respond with "No provider codes to audit yet."
      Acting as a Senior RCM Compliance Auditor specializing in Urgent Care, check the provider's current ICD, CPT, and E&M codes for:
      1. NCCI PTP (Procedure-to-Procedure) edits (e.g., unbundling an E&M with a procedure).
      2. Lack of medical necessity linking (does the primary ICD-10 support the E&M level/procedure?).
      3. Missing or misplaced modifiers (specifically -25, -57, or -59).
      4. Any other coding issues that might cause a claim denial.
      Provide a concise single-sentence 'Audit Finding' about the provider's current codes, or say 'No coding changes' if they are clean and defensible.

      Return the response in the following JSON:

      {
        "icdCodes": [
          {
            "code": "code",
            "reason": "reason"
          }
        ],
        "cptCodes": [
          {
            "code": "code",
            "reason": "reason"
          }
        ],
        "emCode": [
          {
            "code": "code",
            "description": "description",
            "upcodingSuggestion": "upcodingSuggestion. Include in three or fewer sentences how this visit would differ if coded at a higher complexity E&M level, identifying exactly which progress note data were the bottlenecks preventing a higher level and a sample MDM paragraph that would satisfy that level"
          }
        ],
        "codingSuggestions": "Audit Finding for the PROVIDER'S CURRENT CODES ONLY (the ICD, CPT, and E&M codes listed under 'ICD:' and 'CPT:' in this prompt). Do NOT audit your own suggestions. If the provider has no codes yet, say 'No provider codes to audit yet.'"
      }
      `;

    if (newPatient === undefined) {
      prompt += `\n It is unknown whether the patient is new or established with the practice.`;
    } else if (newPatient) {
      prompt += `\n The patient is new to the practice.`;
    } else {
      prompt += `\n The patient is established with the practice.`;
    }

    if (patientAge) {
      prompt += `\n Patient Age: ${patientAge}`;
    }
    if (patientSex) {
      prompt += `\n Patient Sex: ${patientSex}`;
    }

    if (hpi) {
      prompt += `\n HPI: ${hpi}`;
    }
    if (mdm) {
      prompt += `\n MDM: ${mdm}`;
    }
    if (externalLabOrders) {
      prompt += `\n External Lab Orders: ${externalLabOrders}`;
    }
    if (internalLabOrders) {
      prompt += `\n Internal Lab Orders: ${internalLabOrders}`;
    }
    if (radiologyOrders) {
      prompt += `\n Radiology Orders: ${radiologyOrders}`;
    }
    if (radiologyReports) {
      prompt += `\n Radiology Reports: ${radiologyReports}`;
    }
    if (procedures) {
      prompt += `\n Procedures: ${procedures}`;
    }
    if (prescribedMedicationContext) {
      prompt += `\n Current Visit Prescription Orders:\n${prescribedMedicationContext}`;
    }
    if (currentMedicationContext) {
      prompt += `\n Confirmed Current Medications:\n${currentMedicationContext}`;
    }
    if (rosFindings) {
      prompt += `\n Review of Systems (positive findings): ${rosFindings}`;
    }

    if (diagnoses && diagnoses.length > 0) {
      prompt += `\n ICD: ${diagnoses
        .map((diagnosis) => `${diagnosis.code} (${diagnosis.isPrimary ? 'primary' : 'secondary'})`)
        .join(', ')}`;
    }

    if (billing && billing.length > 0) {
      prompt += `\n CPT: ${billing.map((code) => code.code).join(', ')}`;
    }

    console.log(prompt);

    const billingSuggestionsSchema = {
      type: 'object',
      properties: {
        icdCodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['code', 'reason'],
          },
        },
        cptCodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['code', 'reason'],
          },
        },
        emCode: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              description: { type: 'string' },
              upcodingSuggestion: { type: 'string' },
            },
            required: ['code', 'description', 'upcodingSuggestion'],
          },
        },
        codingSuggestions: { type: 'string' },
      },
      required: ['icdCodes', 'cptCodes', 'emCode', 'codingSuggestions'],
    };

    console.log(`[recommend-billing-suggestions] prompt length ${prompt.length} chars`);

    const aiResponseString = await timed('invokeChatbotVertexAI', () =>
      invokeChatbotVertexAI([{ text: prompt }], secrets, billingSuggestionsSchema)
    );
    // const aiResponseString = (await invokeChatbot([{ role: 'user', content: prompt }], secrets)).content.toString();

    let suggestions: BillingSuggestionOutput | undefined;
    try {
      suggestions = JSON.parse(aiResponseString);
    } catch (parseError) {
      console.warn('Failed to parse AI CPT codes response, attempting to fix JSON format:', parseError);
      suggestions = fixAndParseJsonObjectFromString(aiResponseString) as unknown as BillingSuggestionOutput;
    }

    const icdSuggestions: { code: string; description: string; reason: string }[] = [];
    const cptSuggestions: { code: string; description: string; reason: string }[] = [];
    const emCodeSuggestions: { code: string; description: string; upcodingSuggestion: string }[] = [];

    const codeValidationStart = Date.now();

    // Validate the suggested codes and fetch their descriptions. The ICD phase and the CPT phase are
    // independent of each other, so they run concurrently: as two sequential awaits they put two full
    // terminology round trips on the critical path where one will do.
    //
    // Within each phase, the per-code lookups already ran concurrently. Promise.all keeps results in
    // input order regardless of which lookup settles first, so the AI's original ordering survives at
    // both levels. The HCPCS lookup stays sequential behind its own CPT lookup by necessity — it is
    // only attempted when the CPT search comes back empty — so a phase is one round trip deep, or two
    // for the CPT codes that fall through.
    const [validatedIcdCodes, validatedCptCodes] = await Promise.all([
      Promise.all(
        (suggestions?.icdCodes ?? []).map(async (code) => {
          const terminologyResponse = await oystehr.terminology.searchIcd10({
            query: code.code,
            searchType: 'code',
            limit: 100,
            strictMatch: true,
          });
          if (terminologyResponse.codes.length === 1) {
            return {
              code: code.code,
              description: terminologyResponse.codes[0].display,
              reason: code.reason,
            };
          }
          console.log("Didn't get an ICD code", code.code);
          return null;
        })
      ),
      Promise.all(
        (suggestions?.cptCodes ?? []).map(async (code) => {
          const cptCode = code.code.split('-')[0]; // Remove modifiers before lookup
          const terminologyResponse = await oystehr.terminology.searchCpt({
            query: cptCode,
            searchType: 'code',
            limit: 100,
            strictMatch: true,
          });
          if (terminologyResponse.codes.length === 0) {
            const hcpcsSearchResponse = await oystehr.terminology.searchHcpcs({
              query: cptCode,
              searchType: 'code',
              limit: 100,
              strictMatch: true,
            });
            if (hcpcsSearchResponse.codes.length === 1) {
              return {
                code: cptCode,
                description: hcpcsSearchResponse.codes[0].display,
                reason: code.reason,
              };
            }
            console.log("Didn't get an CPT or HCPCS code", cptCode);
            return null;
          } else if (terminologyResponse.codes.length === 1) {
            return {
              code: cptCode,
              description: terminologyResponse.codes[0].display,
              reason: code.reason,
            };
          }
          return null;
        })
      ),
    ]);

    for (const entry of validatedIcdCodes) {
      if (entry) icdSuggestions.push(entry);
    }
    for (const entry of validatedCptCodes) {
      if (entry) cptSuggestions.push(entry);
    }

    // Validate E&M codes and get the descriptions for the codes
    if (suggestions?.emCode) {
      suggestions.emCode.forEach((code) => {
        // AI sometimes returns combined codes like "99203 / 99213" — split and validate each
        const codeParts = code.code.split(/\s*\/\s*/);
        for (const codePart of codeParts) {
          const trimmedCode = codePart.trim();
          const emCodeOption = emCodeOptions.find((option) => option.code === trimmedCode);
          if (emCodeOption) {
            emCodeSuggestions.push({
              code: trimmedCode,
              description: emCodeOption.display,
              upcodingSuggestion: code.upcodingSuggestion,
            });
          } else {
            console.log("Didn't get an E&M code", trimmedCode);
          }
        }
      });
    }

    console.log(
      `[recommend-billing-suggestions] code validation took ${Date.now() - codeValidationStart}ms ` +
        `(icd=${suggestions?.icdCodes?.length ?? 0}, cpt=${suggestions?.cptCodes?.length ?? 0})`
    );

    if (suggestions?.icdCodes) {
      suggestions.icdCodes = icdSuggestions;
    }
    if (suggestions?.cptCodes) {
      suggestions.cptCodes = cptSuggestions;
    }
    if (suggestions?.emCode) {
      suggestions.emCode = emCodeSuggestions;
    }

    // Success-path total. Failed invocations are covered by the per-step timed() logs above (they
    // log from a finally) and by the Sentry transaction wrapHandler opens for this zambda.
    console.log(`[recommend-billing-suggestions] total handler time ${Date.now() - handlerStart}ms`);

    return {
      statusCode: 200,
      body: JSON.stringify(suggestions),
    };
  }
);
