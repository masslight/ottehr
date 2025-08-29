import { APIGatewayProxyResult } from 'aws-lambda';
import * as fs from 'fs';
import { getSecret, INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, SecretsKeys } from 'utils';
import * as xml2js from 'xml2js';
import { topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';

interface Icd10SearchResponse {
  codes: Array<{
    code: string;
    display: string;
  }>;
}

interface Icd10SearchRequestParams {
  search: string;
}

interface DiagNode {
  name: string[];
  desc: string[];
  diag?: DiagNode[];
  sevenChrDef?: Array<{
    extension: Array<{
      $: { char: string };
      _: string;
    }>;
  }>;
}

interface ParsedXmlData {
  'ICD10CM.tabular': {
    chapter: Array<{
      section: Array<{
        diag: DiagNode[];
      }>;
    }>;
  };
}

interface Icd10Code {
  code: string;
  display: string;
}

function validateRequestParameters(input: ZambdaInput): Icd10SearchRequestParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { search } = JSON.parse(input.body);

  if (!search || typeof search !== 'string') {
    throw INVALID_INPUT_ERROR('search parameter is required and must be a string');
  }

  if (search.trim().length === 0) {
    throw INVALID_INPUT_ERROR('search parameter cannot be empty');
  }

  return {
    search: search.trim(),
  };
}

let cachedCodes: Icd10Code[] | null = null;

async function loadAndParseIcd10Data(): Promise<Icd10Code[]> {
  if (cachedCodes) {
    return cachedCodes;
  }

  console.log('Loading and parsing ICD-10-CM data...');

  const xmlFilePath = './icd-10-cm-tabular/icd10cm_tabular_2026.xml';

  if (!fs.existsSync(xmlFilePath)) {
    throw new Error(`ICD-10-CM data file not found at ${xmlFilePath}`);
  }

  const xmlData = fs.readFileSync(xmlFilePath, 'utf-8');
  const parser = new xml2js.Parser({ explicitArray: true });

  const parsed: ParsedXmlData = await parser.parseStringPromise(xmlData);

  const codes: Icd10Code[] = [];

  function extractCodesFromDiagNode(
    diagNode: DiagNode,
    parentSevenChrDef?: Array<{ char: string; desc: string }>
  ): void {
    const code = diagNode.name?.[0];
    const desc = diagNode.desc?.[0];

    // Check if this node has its own sevenChrDef
    let currentSevenChrDef: Array<{ char: string; desc: string }> | undefined;
    if (diagNode.sevenChrDef && diagNode.sevenChrDef[0]?.extension) {
      currentSevenChrDef = diagNode.sevenChrDef[0].extension.map((ext) => ({
        char: ext.$.char,
        desc: ext._,
      }));
    }

    // Use current sevenChrDef or inherit from parent
    const activeSevenChrDef = currentSevenChrDef || parentSevenChrDef;

    if (code && desc) {
      // Check if this is a leaf node (no child diag nodes)
      const isLeafNode = !diagNode.diag || diagNode.diag.length === 0;

      if (isLeafNode) {
        if (activeSevenChrDef) {
          // Generate billable codes with seventh characters
          activeSevenChrDef.forEach((extension) => {
            codes.push({
              code: `${code.trim()}${extension.char}`,
              display: `${desc.trim()}, ${extension.desc}`,
            });
          });
        } else {
          // No seventh character required, this is a billable code as-is
          codes.push({
            code: code.trim(),
            display: desc.trim(),
          });
        }
      }
    }

    // Recursively process child nodes, passing down the sevenChrDef
    if (diagNode.diag && Array.isArray(diagNode.diag)) {
      diagNode.diag.forEach((childDiag) => extractCodesFromDiagNode(childDiag, activeSevenChrDef));
    }
  }

  // Process all chapters and sections
  if (parsed['ICD10CM.tabular']?.chapter) {
    for (const chapter of parsed['ICD10CM.tabular'].chapter) {
      if (chapter.section && Array.isArray(chapter.section)) {
        for (const section of chapter.section) {
          if (section.diag && Array.isArray(section.diag)) {
            section.diag.forEach((diag) => extractCodesFromDiagNode(diag));
          }
        }
      }
    }
  }

  console.log(`Loaded ${codes.length} billable ICD-10-CM codes`);
  cachedCodes = codes;
  return codes;
}

export async function searchIcd10Codes(searchTerm: string): Promise<Icd10Code[]> {
  const allCodes = await loadAndParseIcd10Data();

  if (!searchTerm || searchTerm.trim().length === 0) {
    return [];
  }

  const normalizedSearch = searchTerm.toLowerCase().trim();

  const matches: Array<{ code: Icd10Code; score: number }> = [];

  for (const code of allCodes) {
    const normalizedCode = code.code.toLowerCase();
    const normalizedDisplay = code.display.toLowerCase();

    let score = 0;

    // Exact code match (highest priority)
    if (normalizedCode === normalizedSearch) {
      score = 1000;
    }
    // Code starts with search term
    else if (normalizedCode.startsWith(normalizedSearch)) {
      score = 900;
    }
    // Code contains search term
    else if (normalizedCode.includes(normalizedSearch)) {
      score = 800;
    }
    // Exact display match
    else if (normalizedDisplay === normalizedSearch) {
      score = 700;
    }
    // Display starts with search term
    else if (normalizedDisplay.startsWith(normalizedSearch)) {
      score = 600;
    }
    // Display contains search term
    else if (normalizedDisplay.includes(normalizedSearch)) {
      score = 500;
    }
    // Fuzzy match: display contains all words from search term
    else {
      const searchWords = normalizedSearch.split(/\s+/).filter((word) => word.length > 0);
      const displayWords = normalizedDisplay.split(/\s+/);

      let matchingWords = 0;
      for (const searchWord of searchWords) {
        for (const displayWord of displayWords) {
          if (displayWord.includes(searchWord)) {
            matchingWords++;
            break;
          }
        }
      }

      if (matchingWords === searchWords.length) {
        score = 400;
      } else if (matchingWords > 0) {
        score = 200 + (matchingWords / searchWords.length) * 100;
      }
    }

    if (score > 0) {
      matches.push({ code, score });
    }
  }

  // Sort by score (descending) and limit results
  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, 100).map((match) => match.code);
}

const ZAMBDA_NAME = 'icd-10-search';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { search } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    console.group('searchIcd10Codes');
    const codes = await searchIcd10Codes(search);
    console.groupEnd();
    console.debug('searchIcd10Codes success');

    const response: Icd10SearchResponse = {
      codes,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return await topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
