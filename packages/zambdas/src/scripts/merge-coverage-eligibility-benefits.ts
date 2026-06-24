// cSpell:ignore elig
import Oystehr from '@oystehr/sdk';
import {
  CoverageEligibilityRequest,
  CoverageEligibilityResponse,
  CoverageEligibilityResponseInsuranceItem,
  Extension,
} from 'fhir/r4b';
import * as fs from 'fs';
import * as path from 'path';
import { Secrets } from 'utils';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience, projectApiUrlFromAuth0Audience } from './helpers';

const RAW_RESPONSE_EXTENSION_URL = 'https://extensions.fhir.oystehr.com/raw-response';
const RAW_REQUEST_EXTENSION_URL = 'https://extensions.fhir.oystehr.com/raw-request';

// The EHR derives the ELIGIBLE / NOT ELIGIBLE status from insurance[].item "Active Coverage"
// (see parseCoverageEligibilityResponse). An item with one of the ELIGIBILITY_BENEFIT_CODES
// (UC,86,30) plus an Active Coverage benefit marks the check as eligible.
const ACTIVE_COVERAGE_ITEM: CoverageEligibilityResponseInsuranceItem = {
  category: { coding: [{ code: '30' }] },
  benefit: [{ type: { text: 'Active Coverage' } }],
};

interface EnvConfig extends Record<string, unknown> {
  PROJECT_ID?: string;
  FHIR_API?: string;
  PROJECT_API?: string;
  AUTH0_AUDIENCE?: string;
}

function printUsageAndExit(): never {
  console.log('Usage: npm run merge-coverage-eligibility-benefits -- <env> <patientId> <benefits-json-file-path>');
  process.exit(0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadEnvConfig(env: string): EnvConfig {
  const configPath = path.resolve(__dirname, `../../../../config/.env/${env}.json`);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Environment config not found: ${configPath}`);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as EnvConfig;
  if (!config.PROJECT_ID) {
    throw new Error(`PROJECT_ID is missing in ${configPath}`);
  }

  return config;
}

function normalizeFhirApiUrl(fhirApi?: string): string | undefined {
  if (!fhirApi) return undefined;
  return fhirApi.replace(/\/r4\/?$/, '');
}

function resolveApiUrls(config: EnvConfig): { fhirApiUrl?: string; projectApiUrl?: string } {
  if (config.FHIR_API || config.PROJECT_API) {
    return {
      fhirApiUrl: normalizeFhirApiUrl(config.FHIR_API),
      projectApiUrl: config.PROJECT_API,
    };
  }

  if (!config.AUTH0_AUDIENCE) {
    throw new Error('Unable to resolve API URLs. Provide FHIR_API/PROJECT_API or AUTH0_AUDIENCE in env config.');
  }

  return {
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    projectApiUrl: projectApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
  };
}

function extractRawResponse(eligibilityResponse: CoverageEligibilityResponse): unknown | null {
  const rawResponseExtension = eligibilityResponse.extension?.find((ext) => ext.url === RAW_RESPONSE_EXTENSION_URL);

  const rawResponseValue =
    rawResponseExtension?.valueString ||
    (rawResponseExtension?.valueAttachment?.data
      ? Buffer.from(rawResponseExtension.valueAttachment.data, 'base64').toString('utf8')
      : undefined) ||
    rawResponseExtension?.valueBase64Binary;

  if (!rawResponseValue) {
    return null;
  }

  try {
    return JSON.parse(rawResponseValue);
  } catch {
    return null;
  }
}

function extractRawRequestExtensionValue(resource: { extension?: Extension[] }): Record<string, unknown> | null {
  const rawRequestExtension = resource.extension?.find((ext) => ext.url === RAW_REQUEST_EXTENSION_URL);
  const rawRequestValue =
    rawRequestExtension?.valueString ||
    (rawRequestExtension?.valueAttachment?.data
      ? Buffer.from(rawRequestExtension.valueAttachment.data, 'base64').toString('utf8')
      : undefined) ||
    rawRequestExtension?.valueBase64Binary;

  if (!rawRequestValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawRequestValue);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function withUpsertedRawRequestExtension<T extends { extension?: Extension[] }>(
  resource: T,
  rawRequestPayload: Record<string, unknown>
): T {
  const extensions = resource.extension ?? [];
  const rawRequestExtensionIndex = extensions.findIndex((ext) => ext.url === RAW_REQUEST_EXTENSION_URL);

  const nextRawRequestExtension: Extension = {
    ...(rawRequestExtensionIndex >= 0 ? extensions[rawRequestExtensionIndex] : {}),
    url: RAW_REQUEST_EXTENSION_URL,
    valueString: JSON.stringify(rawRequestPayload),
    valueAttachment: undefined,
    valueBase64Binary: undefined,
  };

  const nextExtensions = [...extensions];
  if (rawRequestExtensionIndex >= 0) {
    nextExtensions[rawRequestExtensionIndex] = nextRawRequestExtension;
  } else {
    nextExtensions.push(nextRawRequestExtension);
  }

  return {
    ...resource,
    extension: nextExtensions,
  };
}

function deriveRawRequestPayloadFromFhirEligibility(
  fhirRawResponse: Record<string, unknown>,
  fallbackRawRequest: Record<string, unknown> | null
): Record<string, unknown> {
  const fhirElig = isRecord(fhirRawResponse.elig) ? fhirRawResponse.elig : undefined;

  return {
    ...(fallbackRawRequest ?? {}),
    ...(fhirElig?.ins_name_f ? { pat_name_f: fhirElig.ins_name_f } : {}),
    ...(fhirElig?.ins_name_m ? { pat_name_m: fhirElig.ins_name_m } : {}),
    ...(fhirElig?.ins_name_l ? { pat_name_l: fhirElig.ins_name_l } : {}),
    ...(fhirElig?.ins_dob ? { pat_dob: fhirElig.ins_dob } : {}),
    ...(fhirElig?.ins_sex ? { pat_sex: fhirElig.ins_sex } : {}),
    ...(fhirElig?.ins_number ? { ins_number: fhirElig.ins_number } : {}),
    ...(fhirElig?.group_number ? { group_number: fhirElig.group_number } : {}),
    ...(fhirElig?.payer_id ? { payer_id: fhirElig.payer_id } : {}),
  };
}

function withUpdatedRawResponse(
  eligibilityResponse: CoverageEligibilityResponse,
  rawResponsePayload: Record<string, unknown>
): CoverageEligibilityResponse {
  const extensions = eligibilityResponse.extension ?? [];
  const rawResponseExtensionIndex = extensions.findIndex((ext) => ext.url === RAW_RESPONSE_EXTENSION_URL);

  if (rawResponseExtensionIndex < 0) {
    throw new Error(`CoverageEligibilityResponse/${eligibilityResponse.id} does not have a raw-response extension.`);
  }

  const updatedExtensions = [...extensions];
  updatedExtensions[rawResponseExtensionIndex] = {
    ...updatedExtensions[rawResponseExtensionIndex],
    valueString: JSON.stringify(rawResponsePayload),
    valueAttachment: undefined,
    valueBase64Binary: undefined,
  };

  return {
    ...eligibilityResponse,
    extension: updatedExtensions,
  };
}

function loadJsonFile(filePathArg: string): Record<string, unknown> {
  const resolvedPath = path.resolve(filePathArg);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`JSON file not found: ${resolvedPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error(`JSON file must contain an object: ${resolvedPath}`);
  }

  return parsed;
}

function getSourceRawResponse(sourceJson: Record<string, unknown>): Record<string, unknown> {
  if (sourceJson.resourceType === 'CoverageEligibilityResponse') {
    const raw = extractRawResponse(sourceJson as unknown as CoverageEligibilityResponse);
    if (!isRecord(raw)) {
      throw new Error('Source CoverageEligibilityResponse JSON does not contain a valid raw-response JSON payload.');
    }
    return raw;
  }

  if (isRecord(sourceJson.rawData)) {
    return sourceJson.rawData;
  }

  return sourceJson;
}

function mergeBenefitsAndCoverages(
  targetRawResponse: Record<string, unknown>,
  sourceRawResponse: Record<string, unknown>
): Record<string, unknown> {
  const targetElig = targetRawResponse.elig;
  const sourceElig = sourceRawResponse.elig;

  if (!isRecord(targetElig)) {
    throw new Error('Latest CoverageEligibilityResponse raw-response does not contain an elig object.');
  }

  if (!isRecord(sourceElig)) {
    throw new Error('Source JSON must contain an elig object with benefit/coverage data.');
  }

  // Replace-or-delete semantics: the source JSON is authoritative for these fields. When a field
  // exists in the source it overrides the destination; when it does not exist in the source it is
  // removed from the destination.
  const eligKeysToReplace = ['benefit', 'coverage', 'coverages'] as const;
  const topLevelKeysToReplace = ['coverage', 'coverages'] as const;

  const mergedElig: Record<string, unknown> = { ...targetElig };
  for (const key of eligKeysToReplace) {
    if (Object.prototype.hasOwnProperty.call(sourceElig, key)) {
      mergedElig[key] = sourceElig[key];
    } else {
      delete mergedElig[key];
    }
  }

  const mergedRaw: Record<string, unknown> = {
    ...targetRawResponse,
    elig: mergedElig,
  };

  for (const key of topLevelKeysToReplace) {
    if (Object.prototype.hasOwnProperty.call(sourceRawResponse, key)) {
      mergedRaw[key] = sourceRawResponse[key];
    } else {
      delete mergedRaw[key];
    }
  }

  return mergedRaw;
}

interface EligibilityErrorEntry {
  code?: string;
  message?: string;
}

function getEligibilityErrors(rawResponse: Record<string, unknown>): EligibilityErrorEntry[] {
  const elig = isRecord(rawResponse.elig) ? rawResponse.elig : undefined;

  // Errors can live either under `elig.error` (benefit-style payloads) or at the top level
  // (`error`), and each location may hold a single object or an array of objects.
  const errorCandidates = [elig?.error, rawResponse.error].flatMap((candidate) => {
    if (Array.isArray(candidate)) {
      return candidate;
    }
    return candidate !== undefined ? [candidate] : [];
  });

  if (errorCandidates.length === 0) {
    return [];
  }

  return errorCandidates
    .filter(isRecord)
    .map((entry) => ({
      code: typeof entry.error_code === 'string' ? entry.error_code : undefined,
      message: typeof entry.error_mesg === 'string' ? entry.error_mesg : undefined,
    }))
    .filter((entry) => entry.code !== undefined || entry.message !== undefined);
}

function buildFhirEligibilityErrors(
  errors: EligibilityErrorEntry[]
): NonNullable<CoverageEligibilityResponse['error']> {
  return errors.map((error) => ({
    code: {
      ...(error.code ? { coding: [{ code: error.code }] } : {}),
      ...(error.message ? { text: error.message } : {}),
    },
  }));
}

async function getLatestCoverageEligibilityResponse(
  oystehr: Oystehr,
  patientId: string
): Promise<CoverageEligibilityResponse | undefined> {
  const searchResult = await oystehr.fhir.search<CoverageEligibilityResponse>({
    resourceType: 'CoverageEligibilityResponse',
    params: [
      { name: 'patient._id', value: patientId },
      { name: '_sort', value: '-created' },
      { name: '_count', value: '1' },
    ],
  });

  return searchResult.unbundle()[0];
}

async function getLatestCoverageEligibilityRequest(
  oystehr: Oystehr,
  patientId: string
): Promise<CoverageEligibilityRequest | undefined> {
  const searchResult = await oystehr.fhir.search<CoverageEligibilityRequest>({
    resourceType: 'CoverageEligibilityRequest',
    params: [
      { name: 'patient._id', value: patientId },
      { name: '_sort', value: '-created' },
      { name: '_count', value: '1' },
    ],
  });

  return searchResult.unbundle()[0];
}

function cloneForCreate<T extends { id?: string; meta?: unknown; text?: unknown }>(resource: T): T {
  const cloned = { ...resource } as T;
  delete cloned.id;
  delete cloned.meta;
  delete cloned.text;
  return cloned;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length !== 3 || args.includes('--help') || args.includes('-h')) {
    printUsageAndExit();
  }

  const [env, patientId, jsonFilePath] = args;

  if (!env || !patientId || !jsonFilePath) {
    printUsageAndExit();
  }

  const envConfig = loadEnvConfig(env);
  const token = await getAuth0Token(envConfig as Secrets);
  if (!token) {
    throw new Error('Failed to fetch auth token from env config.');
  }

  const apiUrls = resolveApiUrls(envConfig);
  const projectId = envConfig.PROJECT_ID as string;

  const oystehr = new Oystehr({
    accessToken: token,
    projectId,
    ...apiUrls,
  });

  const latestResponse = await getLatestCoverageEligibilityResponse(oystehr, patientId);
  if (!latestResponse?.id) {
    throw new Error(`No CoverageEligibilityResponse found for patient ${patientId}.`);
  }

  const latestRequest = await getLatestCoverageEligibilityRequest(oystehr, patientId);
  if (!latestRequest?.id) {
    throw new Error(`No CoverageEligibilityRequest found for patient ${patientId}.`);
  }

  const latestRaw = extractRawResponse(latestResponse);
  if (!isRecord(latestRaw)) {
    throw new Error(`CoverageEligibilityResponse/${latestResponse.id} has no parseable raw-response JSON.`);
  }

  const sourceJson = loadJsonFile(jsonFilePath);
  const sourceRaw = getSourceRawResponse(sourceJson);

  const eligibilityErrors = getEligibilityErrors(sourceRaw);
  const isErrorResponse = eligibilityErrors.length > 0;

  const mergedRaw = isErrorResponse ? sourceRaw : mergeBenefitsAndCoverages(latestRaw, sourceRaw);
  const baselineRawRequest =
    extractRawRequestExtensionValue(latestRequest) ?? extractRawRequestExtensionValue(latestResponse);
  const mergedRawRequest = deriveRawRequestPayloadFromFhirEligibility(latestRaw, baselineRawRequest);

  const nowIso = new Date().toISOString();

  const requestToCreate: CoverageEligibilityRequest = withUpsertedRawRequestExtension(
    {
      ...cloneForCreate(latestRequest),
      created: nowIso,
    },
    mergedRawRequest
  );

  const createdRequest = await oystehr.fhir.create<CoverageEligibilityRequest>(requestToCreate);

  if (!createdRequest.id) {
    throw new Error('CoverageEligibilityRequest was created without an ID.');
  }

  const baseResponse: CoverageEligibilityResponse = {
    ...cloneForCreate(latestResponse),
    created: nowIso,
    request: {
      reference: `CoverageEligibilityRequest/${createdRequest.id}`,
    },
  };

  if (isErrorResponse) {
    // When the source response is an error, replace the coverage with the error response so
    // the EHR surfaces the failure instead of stale benefit/coverage data, and mark it NOT ELIGIBLE.
    baseResponse.outcome = 'error';
    baseResponse.error = buildFhirEligibilityErrors(eligibilityErrors);
    // Preserve the insurance[].coverage references so the EHR can still associate this check with
    // a Coverage (it drops checks without one), but clear the benefit items so it is not eligible.
    baseResponse.insurance = baseResponse.insurance?.map((insurance) => ({
      coverage: insurance.coverage,
    }));
  } else {
    // For a successful (non-error) response, mark the check ELIGIBLE so the EHR status chip stays
    // consistent with the imported benefits, and clear any stale error from the cloned response.
    baseResponse.outcome = 'complete';
    delete baseResponse.error;
    baseResponse.insurance = baseResponse.insurance?.map((insurance, index) =>
      index === 0 ? { ...insurance, item: [ACTIVE_COVERAGE_ITEM] } : insurance
    );
  }

  const responseToCreate: CoverageEligibilityResponse = withUpsertedRawRequestExtension(
    withUpdatedRawResponse(baseResponse, mergedRaw),
    mergedRawRequest
  );

  const createdResponse = await oystehr.fhir.create<CoverageEligibilityResponse>(responseToCreate);

  if (!createdResponse.id) {
    throw new Error('CoverageEligibilityResponse was created without an ID.');
  }

  const mergedBenefitCount = Array.isArray(isRecord(mergedRaw.elig) ? mergedRaw.elig.benefit : undefined)
    ? ((mergedRaw.elig as Record<string, unknown>).benefit as unknown[]).length
    : 0;

  console.log(`Created CoverageEligibilityRequest FHIR ID: ${createdRequest.id}`);
  console.log(`Created CoverageEligibilityResponse FHIR ID: ${createdResponse.id}`);
  console.log(`✅ Created newest eligibility request/response pair for patient ${patientId}.`);
  console.log(`   Environment: ${env}`);
  console.log(`   Project ID: ${projectId}`);
  console.log(`   Source file: ${path.resolve(jsonFilePath)}`);
  if (isErrorResponse) {
    const errorSummary = eligibilityErrors
      .map((error) => [error.code, error.message].filter(Boolean).join(': '))
      .join('; ');
    console.log(`   Imported eligibility error response: ${errorSummary}`);
  } else {
    console.log(`   Applied benefit entries: ${mergedBenefitCount}`);
  }
  console.log('   Response/request raw payload fields were aligned using the supplied JSON data.');
}

main().catch((error) => {
  console.error('❌ merge-coverage-eligibility-benefits failed:', error);
  process.exit(1);
});
