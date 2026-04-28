import { APIGatewayProxyResult } from 'aws-lambda';
import { BillingSuggestionOutput, fixAndParseJsonObjectFromString, getEmCodes } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { invokeChatbotVertexAI } from '../../shared/ai';
import { loadAndParseIcd10Data } from '../../shared/icd-10-search';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

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
      diagnoses,
      billing,
      secrets,
    } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

    const oystehr = createOystehrClient(m2mToken, secrets);
    const emCodeOptions = await getEmCodes(oystehr);

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
      3. Risk of Complications/Management: The SINGLE highest-risk element determines this category. Prescription drug management (any new or continued prescription) qualifies as Moderate risk, which alone supports 99214. OTC medications only support 99213.

      URGENT CARE CALIBRATION: The E&M codes differ by whether the patient is new or established, but the MDM complexity levels are the same:
      - Straightforward: 99202 (new) / 99212 (established) — ~3–8% of visits
      - Low: 99203 (new) / 99213 (established) — ~30–45% of visits
      - Moderate: 99204 (new) / 99214 (established) — ~45–60% of visits
      - High: 99205 (new) / 99215 (established) — ~1–3% of visits

      Use the new patient codes (99202–99205) when the patient is new to the practice, and the established patient codes (99212–99215) when the patient is established. The complexity thresholds are identical — only the code number differs.

      Moderate complexity is the most common level because most urgent care patients present with an acute illness or injury requiring at least a prescription, which meets Moderate risk. However, Low complexity is still appropriate for roughly a third of visits — those involving a single self-limited problem managed with OTC recommendations or simple reassurance.

      Common patterns:
      - Any visit resulting in a prescription → at minimum Moderate (99204/99214)
      - New undiagnosed problem with uncertain prognosis → Moderate (99204/99214)
      - Acute illness with systemic symptoms (fever, vomiting, etc.) → Moderate (99204/99214)
      - Multiple chronic conditions with exacerbation → Moderate or High (99204-05/99214-15)
      - Single acute uncomplicated illness, OTC recommendation only → Low (99203/99213)
      - Brief visit, known self-limited problem, simple reassurance → Low (99203/99213)
      - Minimal encounter, e.g., single follow-up question, suture removal → Straightforward (99202/99212)

      Do not default to Low complexity when the visit involves prescription drug management or a new problem requiring workup — those are Moderate. But do not upcode to Moderate when the visit is genuinely straightforward with no prescription and a self-limited problem.

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

    if (diagnoses && diagnoses.length > 0) {
      prompt += `\n ICD: ${diagnoses
        .map((diagnosis) => `${diagnosis.code} (${diagnosis.isPrimary ? 'primary' : 'secondary'})`)
        .join(', ')}`;
    }

    if (billing && billing.length > 0) {
      prompt += `\n CPT: ${billing.map((code) => code.code).join(', ')}`;
    }

    console.log(prompt);

    const aiResponseString = await invokeChatbotVertexAI([{ text: prompt }], secrets);
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

    // Validate ICD codes and get the descriptions for the codes
    if (suggestions?.icdCodes) {
      const allCodes = await loadAndParseIcd10Data();
      suggestions.icdCodes.forEach((code) => {
        const icdCode = allCodes.filter((codeTemp) => codeTemp.code === code.code);
        if (icdCode.length === 1) {
          icdSuggestions.push({
            code: code.code,
            description: icdCode[0].display,
            reason: code.reason,
          });
        } else {
          console.log("Didn't get an ICD code", code.code);
        }
      });
    }

    // Validate CPT codes and get the descriptions for the codes
    if (suggestions?.cptCodes) {
      await Promise.all(
        suggestions.cptCodes.map(async (code) => {
          const terminologyResponse = await oystehr?.terminology.searchCpt({
            query: code.code,
            searchType: 'code',
            limit: 100,
            strictMatch: true,
          });
          if (terminologyResponse.codes.length === 0) {
            const hcpcsSearchResponse = await oystehr?.terminology.searchHcpcs({
              query: code.code,
              searchType: 'code',
              limit: 100,
              strictMatch: true,
            });
            if (hcpcsSearchResponse.codes.length === 1) {
              cptSuggestions.push({
                code: code.code,
                description: hcpcsSearchResponse.codes[0].display,
                reason: code.reason,
              });
            } else {
              console.log("Didn't get an CPT or HCPCS code", code.code);
            }
          } else if (terminologyResponse.codes.length === 1) {
            cptSuggestions.push({
              code: code.code,
              description: terminologyResponse.codes[0].display,
              reason: code.reason,
            });
          }
        })
      );
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

    if (suggestions?.icdCodes) {
      suggestions.icdCodes = icdSuggestions;
    }
    if (suggestions?.cptCodes) {
      suggestions.cptCodes = cptSuggestions;
    }
    if (suggestions?.emCode) {
      suggestions.emCode = emCodeSuggestions;
    }

    return {
      statusCode: 200,
      body: JSON.stringify(suggestions),
    };
  }
);
