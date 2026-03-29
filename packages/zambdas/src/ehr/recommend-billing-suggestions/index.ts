import { APIGatewayProxyResult } from 'aws-lambda';
import {
  BillingSuggestionOutput,
  fixAndParseJsonObjectFromString,
  getSecret,
  PROVIDER_CONFIG,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { invokeChatbotVertexAI } from '../../shared/ai';
import { loadAndParseIcd10Data } from '../../shared/icd-10-search';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler(
  'recommend-billing-suggestions',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
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
        labResults,
        diagnoses,
        billing,
        secrets,
      } = validatedParameters;
      console.groupEnd();
      console.debug('validateRequestParameters success');

      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

      let prompt = `You are an expert medical coder for an urgent care clinic. Suggest appropriate ICD-10 and CPT codes for this visit.

      CRITICAL RULE — Lab & Radiology Results:
      Before suggesting ANY ICD codes, first review the "Lab Results" and "Radiology Reports" sections below. Every positive, abnormal, or clinically significant finding MUST have a corresponding specific ICD-10 diagnosis code in your suggestions. These result-driven codes take absolute priority and must appear before any general symptom or encounter codes. Never omit a diagnosis that is confirmed by a test result. Only suggest diagnoses that match the actual test results provided — do not infer conditions from tests that are not listed.

      Always prefer the most specific ICD-10 code available. Avoid unspecified, 'other specified,' or general symptom codes (e.g., codes ending in .9 or .8) when a more precise code exists based on the clinical data.

      Only suggest CPT codes for procedures, tests, and services that were actually performed or ordered during this visit. Do not suggest screening or preventive procedure codes unless the clinical data explicitly indicates they were performed. Ensure CPT codes are appropriate for the patient's age and sex.

      Suggest up to 5 ICD-10 and up to 5 CPT codes supported by the clinical data, in a simple list without commentary but with a code and a short reason why it was suggested. If we don't know whether the patient is new or returning, suggest an E&M code for both a new and an established patient. Be sure to include a modifier to the E&M code if needed and HCPCS Q-codes as appropriate. Do not include E&M code in the list of CPT codes. Suggest the most accurate E&M code based on the most recent AMA CPT Guidelines. Evaluate the MDM by scoring the complexity of problems, the data analyzed, and the risk of management (e.g., prescription drug management usually triggers Level 4).

      Include whether the patient is new or established when suggesting an E&M code. If there are not relevant results, return an empty list.

      Here are the E&M codes:

      ${PROVIDER_CONFIG.assessment.emCodeOptions.map((option) => `${option.code}: ${option.display}`).join('\n')}

      Include in three or fewer sentences how this visit would differ if coded at a higher complexity E&M level, identifying exactly which progress note data were the bottlenecks preventing a higher level and a sample MDM paragraph that would satisfy that level.

      Act as a Senior RCM Compliance Auditor specializing in Urgent Care. Review the final claim for 'Denial Triggers.' Specifically, check for:
      1. NCCI PTP (Procedure-to-Procedure) edits (e.g., unbundling an E&M with a procedure).
      2. Lack of medical necessity linking (does the primary ICD-10 support the E&M level/procedure?).
      3. Missing or misplaced modifiers (specifically -25, -57, or -59).
      4. Any other coding issues that might cause a claim denial.
      Provide a concise single-sentence 'Audit Finding' identifying the highest-risk issues, or say 'No coding changes' if the claim is clean and defensible.

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
        "codingSuggestions": "codingSuggestions"
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
      if (labResults) {
        prompt += `\n Lab Results: ${labResults}`;
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
        const oystehr = createOystehrClient(m2mToken, secrets);
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
            const emCodeOption = PROVIDER_CONFIG.assessment.emCodeOptions.find((option) => option.code === trimmedCode);
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
    } catch (error: any) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      await topLevelCatch('recommend-billing-suggestions', error, ENVIRONMENT);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: `Error recommending billing suggestions: ${error}` }),
      };
    }
  }
);
