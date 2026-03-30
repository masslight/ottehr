import { BillingSuggestionOutput, emCodeOptions, fixAndParseJsonObjectFromString } from 'utils';
import { invokeChatbotVertexAI } from '../../src/shared/ai';
import { SECRETS } from '../data/secrets';

function getPrompt(visit: {
  newPatient?: boolean;
  hpi?: string;
  mdm?: string;
  externalLabOrders?: string;
  internalLabOrders?: string;
  radiologyOrders?: string;
  procedures?: string;
  diagnoses?: { code: string; isPrimary: boolean }[];
  billing?: { code: string }[];
}): string {
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
  } = visit;
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
        "description": "description",
        "upcodingSuggestion": "upcodingSuggestion"
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
  return prompt;
}

async function getAPI(prompt: string): Promise<any> {
  const aiResponseString = await invokeChatbotVertexAI([{ text: prompt }], SECRETS);
  // const aiResponseString = (await invokeChatbot([{ role: 'user', content: prompt }], secrets)).content.toString();

  let suggestions: BillingSuggestionOutput | undefined;
  try {
    suggestions = JSON.parse(aiResponseString);
  } catch {
    // console.warn('Failed to parse AI CPT codes response, attempting to fix JSON format:', parseError);
    suggestions = fixAndParseJsonObjectFromString(aiResponseString) as unknown as BillingSuggestionOutput;
  }

  return suggestions;
}

async function test1(): Promise<void> {
  const visit: any = {
    newPatient: true,
    hpi: 'the patient has a cough and might have flu',
    mdm: 'aaaaaaaaaaaaaa',
    diagnoses: [
      {
        code: 'A00.9',
        // display: 'Cholera, unspecified',
        isPrimary: true,
      },
      {
        code: 'Z13.89',
        // display: 'Encounter for screening for other disorder',
        isPrimary: false,
      },
      {
        code: 'J11.1',
        // display: 'Influenza due to unidentified influenza virus with other respiratory manifestations',
        isPrimary: false,
      },
      {
        code: 'Z03.89',
        // display: 'Encounter for observation for other suspected diseases and conditions ruled out',
        isPrimary: false,
      },
    ],
    billing: [
      {
        code: '87804',
        // display: 'Detection test by immunoassay with direct visual observation for influenza virus',
      },
      {
        code: '0217U',
        // display: 'DNA analysis of gene sequence of 51 genes for identification and characterization of abnormalites associated with inherited disorders of movement (ataxia)',
      },
      {
        code: '0216U',
        // display: 'DNA analysis of gene sequence of 12 genes for identification and characterization of abnormalites associated with inherited disorders of movement (ataxia)',
      },
      {
        code: '0217U',
        // display: 'DNA analysis of gene sequence of 51 genes for identification and characterization of abnormalites associated with inherited disorders of movement (ataxia)',
      },
      {
        code: '0165U',
        // display: 'Test for detection of antigens associated with peanut allergy in blood specimen, reported as probability of peanut allergy',
      },
      {
        code: '85025',
        // display: 'Complete blood cell count (red cells, white blood cell, platelets), automated test and automated differential white blood cell count',
      },
      {
        code: '69210',
        // display: 'Removal of impacted ear wax',
      },
      {
        code: '71045',
        // display: 'X-ray of chest, 1 view',
      },
      {
        code: '74018',
        // display: 'X-ray of abdomen, 1 view',
      },
    ],
    externalLabOrders: 'CBC W Auto Differential panel in Blood',
    internalLabOrders: '',
    radiologyOrders:
      '71045 — Radiologic examination, chest; single view, 74018 — Radiologic examination, abdomen; 1 view, 71045 — Radiologic examination, chest; single view',
    procedures: 'Ear Lavage / Cerumen Removal',
  };
  let prompt = getPrompt(visit);

  let response = await getAPI(prompt);
  if (response.icdCodes == undefined) {
    console.error('No ICD codes suggested');
  }
  if (response.cptCodes == undefined) {
    console.error('No CPT codes suggested');
  }
  if (response.emCode == undefined) {
    console.error('No E&M code suggested');
  }
  if (response.codingSuggestions == undefined) {
    console.error('No coding suggestions provided');
  }

  let tests = 0;
  let passes = 0;
  const expectedICDCodes = ['J11.1', 'Z03.89', 'H61.21'];
  for (const expectedCode of expectedICDCodes) {
    tests++;
    if (response.icdCodes.some((suggestion: any) => suggestion.code === expectedCode)) {
      passes++;
    } else {
      console.error(`Expected ICD code ${expectedCode} not found in suggestions`);
    }
  }

  const expectedCPTCodes = ['85025', '71045', '69210'];
  for (const expectedCode of expectedCPTCodes) {
    tests++;
    if (response.cptCodes.some((suggestion: any) => suggestion.code === expectedCode)) {
      passes++;
    } else {
      console.error(`Expected CPT code ${expectedCode} not found in suggestions`);
    }
  }

  let expectedEMCodes = ['99204'];
  for (const expectedCode of expectedEMCodes) {
    tests++;
    if (response.emCode.some((suggestion: any) => suggestion.code === expectedCode)) {
      passes++;
    } else {
      console.error(`Expected E&M code ${expectedCode} not found in suggestions`);
    }
  }

  visit.newPatient = false;
  prompt = getPrompt(visit);
  response = await getAPI(prompt);
  expectedEMCodes = ['99214'];
  for (const expectedCode of expectedEMCodes) {
    tests++;
    if (response.emCode.some((suggestion: any) => suggestion.code === expectedCode)) {
      passes++;
    } else {
      console.error(`Expected E&M code ${expectedCode} not found in suggestions`);
    }
  }

  visit.newPatient = undefined;
  prompt = getPrompt(visit);
  response = await getAPI(prompt);
  expectedEMCodes = ['99201', '99214'];
  for (const expectedCode of expectedEMCodes) {
    tests++;
    if (response.emCode.some((suggestion: any) => suggestion.code === expectedCode)) {
      passes++;
    } else {
      console.error(`Expected E&M code ${expectedCode} not found in suggestions`);
    }
  }

  console.log(getTestStatistics(passes, tests));
}

test1().catch((error) => console.log(error));

function getTestStatistics(passes: number, tests: number): string {
  return `${passes}/${tests}, ${((passes / tests) * 100).toFixed(2)}%`;
}
