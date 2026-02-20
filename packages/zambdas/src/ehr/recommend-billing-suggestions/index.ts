import { APIGatewayProxyResult } from 'aws-lambda';
import { BillingSuggestionOutput, emCodeOptions, fixAndParseJsonObjectFromString, getSecret, SecretsKeys } from 'utils';
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
        hpi,
        mdm,
        externalLabOrders,
        internalLabOrders,
        radiologyOrders,
        procedures,
        diagnoses,
        billing,
        secrets,
      } = validatedParameters;
      console.groupEnd();
      console.debug('validateRequestParameters success');

      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

      let prompt = `Suggest appropriate CPT and ICD codes supported by clinical data provided for an urgent care visit in a simple list without commentary but with a code and a short reason why it was suggested for the supplied clinical data. Exactly 5 ICD and 5 CPT codes. If we don't know whether the patient is new or returning, suggest an E&M code for both a new and an established patient. Be sure to include a modifier to the E&M code if needed and HCPCS Q-codes as appropriate. Do not include E&M code in the list of CPT codes. Suggest the highest complexity E&M code reasonably likely to be approved given the clinical information.
      
      Include whether the patient is new or established when suggesting an E&M code. If there are not relevant results, return an empty list.

      Here are the E&M codes:

      ${emCodeOptions.map((option) => `${option.code}: ${option.display}`).join('\n')}

      Include in three or fewer sentences how this visit would differ if coded at a higher complexity E&M level and a sample MDM paragraph that would satisfy that level.

      Also take on a persona of a medical biller and coder looking for errors that might cause a claim to be rejected in an urgent care setting. Review the following claim based on provided ICD and CPT codes and provide a very concise single sentence explaining any possible issues or say "No coding changes."

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
            "suggestion": "suggestion"
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
      const emCodeSuggestions: { code: string; description: string; suggestion: string }[] = [];

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
          const emCodeOption = emCodeOptions.find((option) => option.code === code.code);
          if (emCodeOption) {
            emCodeSuggestions.push({
              code: code.code,
              description: emCodeOption.display,
              suggestion: code.suggestion,
            });
          } else {
            console.log("Didn't get an E&M code", code.code);
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
