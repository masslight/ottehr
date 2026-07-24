import Oystehr from '@oystehr/sdk';
import {
  apiErrorToThrow,
  BillingChargeItemDefinition,
  BillingCodeOption,
  BillingProviderOption,
  BillingRulesResponse,
  BulkAddChargeItemDefinitionProcedureCodesInputSchema,
  chooseJson,
  ClaimDetailResponse,
  CreateBillingClaimInputSchema,
  CreateBillingCoverageInputSchema,
  CreateBillingPatientInputSchema,
  CreateBillingProviderInputSchema,
  CreateChargeItemDefinitionInputSchema,
  CreatedClaimResponse,
  CreatedResourceResponse,
  DeleteBillingCoverageInputSchema,
  DeleteBillingProviderInputSchema,
  DeleteBillingTagInputSchema,
  DeleteChargeItemDefinitionInputSchema,
  DeletedResponse,
  DeleteServiceFacilityInputSchema,
  EraDetailResponse,
  ExportClaimX12InputSchema,
  ExportClaimX12Response,
  GetBillingProviderInputSchema,
  GetBillingRulesInputSchema,
  GetChargeItemDefinitionInputSchema,
  GetClaimDetailInputSchema,
  GetClaimHistoryInputSchema,
  GetClaimHistoryResponse,
  GetEraDetailInputSchema,
  GetPatientCoveragesInputSchema,
  GetPatientCoveragesResponse,
  GetPatientDetailInputSchema,
  GetServiceFacilityInputSchema,
  ImportEraInputSchema,
  MatchClaimResponseToClaimInputSchema,
  PatientDetailResponse,
  RecordBillingManualPaymentInputSchema,
  RecordBillingManualPaymentResponse,
  RunBillingRulesEngineInputSchema,
  RunBillingRulesEngineResponse,
  SaveBillingRulesInputSchema,
  SaveBillingTagInputSchema,
  SavedResourceResponse,
  SaveServiceFacilityInputSchema,
  SearchBillingClaimsInputSchema,
  SearchBillingClaimsResponse,
  SearchBillingErasResponse,
  SearchBillingLocationsInputSchema,
  SearchBillingLocationsResponse,
  SearchBillingPatientsInputSchema,
  SearchBillingPatientsResponse,
  SearchBillingPayersInputSchema,
  SearchBillingPayersResponse,
  SearchBillingProcedureCodesResponse,
  SearchBillingProvidersInputSchema,
  SearchBillingProvidersResponse,
  SearchBillingServicesInputSchema,
  SearchBillingServicesResponse,
  SearchBillingTagsResponse,
  SearchChargeItemDefinitionsInputSchema,
  SearchChargeItemDefinitionsResponse,
  SearchErasInputSchema,
  SearchServiceFacilitiesInputSchema,
  SearchServiceFacilitiesResponse,
  ServiceFacilityItem,
  TagBillingClaimInputSchema,
  TaggedClaimResponse,
  UpdateBillingCoverageInputSchema,
  UpdateBillingPatientInputSchema,
  UpdateBillingProviderInputSchema,
  UpdateBillingResourceInputSchema,
  UpdateChargeItemDefinitionInputSchema,
} from 'utils';
import z from 'zod';

async function executeBillingZambda<T>(oystehr: Oystehr, id: string, parameters?: Record<string, unknown>): Promise<T> {
  try {
    const response = await oystehr.zambda.execute({
      id,
      ...parameters,
    });
    return chooseJson<T>(response);
  } catch (error: unknown) {
    throw apiErrorToThrow(error);
  }
}

// --- Rules engines ---

export const getBillingRules = (
  oystehr: Oystehr,
  parameters: z.input<typeof GetBillingRulesInputSchema>
): Promise<BillingRulesResponse> => executeBillingZambda(oystehr, 'get-billing-rules', parameters);

export const saveBillingRules = (
  oystehr: Oystehr,
  parameters: z.input<typeof SaveBillingRulesInputSchema>
): Promise<BillingRulesResponse> => executeBillingZambda(oystehr, 'save-billing-rules', parameters);

export const runBillingRulesEngine = (
  oystehr: Oystehr,
  parameters: z.input<typeof RunBillingRulesEngineInputSchema>
): Promise<RunBillingRulesEngineResponse> => executeBillingZambda(oystehr, 'run-billing-rules-engine', parameters);

// --- Patients ---

export const createBillingPatient = (
  oystehr: Oystehr,
  parameters: z.input<typeof CreateBillingPatientInputSchema>
): Promise<CreatedResourceResponse> => executeBillingZambda(oystehr, 'create-billing-patient', parameters);

export const searchBillingPatients = (
  oystehr: Oystehr,
  parameters: z.input<typeof SearchBillingPatientsInputSchema>
): Promise<SearchBillingPatientsResponse> => executeBillingZambda(oystehr, 'search-billing-patients', parameters);

export const getBillingPatientDetail = (
  oystehr: Oystehr,
  parameters: z.input<typeof GetPatientDetailInputSchema>
): Promise<PatientDetailResponse> => executeBillingZambda(oystehr, 'get-billing-patient-detail', parameters);

export const updateBillingPatient = (
  oystehr: Oystehr,
  parameters: z.input<typeof UpdateBillingPatientInputSchema>
): Promise<CreatedResourceResponse> => executeBillingZambda(oystehr, 'update-billing-patient', parameters);

// --- Claims ---

export const createBillingClaim = (
  oystehr: Oystehr,
  parameters: z.input<typeof CreateBillingClaimInputSchema>
): Promise<CreatedClaimResponse> => executeBillingZambda(oystehr, 'create-billing-claim', parameters);

export const searchBillingClaims = (
  oystehr: Oystehr,
  parameters: z.input<typeof SearchBillingClaimsInputSchema>
): Promise<SearchBillingClaimsResponse> => executeBillingZambda(oystehr, 'search-billing-claims', parameters);

export const getBillingClaimDetail = (
  oystehr: Oystehr,
  parameters: z.input<typeof GetClaimDetailInputSchema>
): Promise<ClaimDetailResponse> => executeBillingZambda(oystehr, 'get-billing-claim-detail', parameters);

export const getBillingClaimHistory = (
  oystehr: Oystehr,
  parameters: z.input<typeof GetClaimHistoryInputSchema>
): Promise<GetClaimHistoryResponse> => executeBillingZambda(oystehr, 'get-billing-claim-history', parameters);

export const exportClaimX12 = (
  oystehr: Oystehr,
  parameters: z.input<typeof ExportClaimX12InputSchema>
): Promise<ExportClaimX12Response> => executeBillingZambda(oystehr, 'export-billing-claim-x12', parameters);

export const updateBillingResource = (
  oystehr: Oystehr,
  parameters: z.input<typeof UpdateBillingResourceInputSchema>
): Promise<SavedResourceResponse> => executeBillingZambda(oystehr, 'update-billing-claim', parameters);

export const tagBillingClaim = (
  oystehr: Oystehr,
  parameters: z.input<typeof TagBillingClaimInputSchema>
): Promise<TaggedClaimResponse> => executeBillingZambda(oystehr, 'tag-billing-claim', parameters);

// --- Providers ---

export const createBillingProvider = (
  oystehr: Oystehr,
  parameters: z.input<typeof CreateBillingProviderInputSchema>
): Promise<CreatedResourceResponse> => executeBillingZambda(oystehr, 'create-billing-provider', parameters);

export const searchBillingProviders = (
  oystehr: Oystehr,
  parameters: z.input<typeof SearchBillingProvidersInputSchema>
): Promise<SearchBillingProvidersResponse> => executeBillingZambda(oystehr, 'search-billing-providers', parameters);

export const getBillingProvider = (
  oystehr: Oystehr,
  parameters: z.input<typeof GetBillingProviderInputSchema>
): Promise<BillingProviderOption> => executeBillingZambda(oystehr, 'get-billing-provider', parameters);

export const updateBillingProvider = (
  oystehr: Oystehr,
  parameters: z.input<typeof UpdateBillingProviderInputSchema>
): Promise<CreatedResourceResponse> => executeBillingZambda(oystehr, 'update-billing-provider', parameters);

export const deleteBillingProvider = (
  oystehr: Oystehr,
  parameters: z.input<typeof DeleteBillingProviderInputSchema>
): Promise<DeletedResponse> => executeBillingZambda(oystehr, 'delete-billing-provider', parameters);

// --- Lookups (payers, locations, coverages) ---

export const searchBillingServices = (
  oystehr: Oystehr,
  parameters: z.input<typeof SearchBillingServicesInputSchema>
): Promise<SearchBillingServicesResponse> => executeBillingZambda(oystehr, 'search-billing-services', parameters);

export const searchBillingPayers = (
  oystehr: Oystehr,
  parameters: z.input<typeof SearchBillingPayersInputSchema>
): Promise<SearchBillingPayersResponse> => executeBillingZambda(oystehr, 'search-billing-payers', parameters);

export const searchBillingLocations = (
  oystehr: Oystehr,
  parameters: z.input<typeof SearchBillingLocationsInputSchema>
): Promise<SearchBillingLocationsResponse> => executeBillingZambda(oystehr, 'search-billing-locations', parameters);

export const getPatientCoverages = (
  oystehr: Oystehr,
  parameters: z.input<typeof GetPatientCoveragesInputSchema>
): Promise<GetPatientCoveragesResponse> => executeBillingZambda(oystehr, 'get-patient-coverages', parameters);

export const createBillingCoverage = (
  oystehr: Oystehr,
  parameters: z.input<typeof CreateBillingCoverageInputSchema>
): Promise<CreatedResourceResponse> => executeBillingZambda(oystehr, 'create-billing-coverage', parameters);

export const updateBillingCoverage = (
  oystehr: Oystehr,
  parameters: z.input<typeof UpdateBillingCoverageInputSchema>
): Promise<SavedResourceResponse> => executeBillingZambda(oystehr, 'update-billing-coverage', parameters);

export const deleteBillingCoverage = (
  oystehr: Oystehr,
  parameters: z.input<typeof DeleteBillingCoverageInputSchema>
): Promise<DeletedResponse> => executeBillingZambda(oystehr, 'delete-billing-coverage', parameters);

// --- Service Facilities ---

export const searchBillingServiceFacilities = (
  oystehr: Oystehr,
  parameters: z.input<typeof SearchServiceFacilitiesInputSchema>
): Promise<SearchServiceFacilitiesResponse> =>
  executeBillingZambda(oystehr, 'search-billing-service-facilities', parameters);

export const getBillingServiceFacility = (
  oystehr: Oystehr,
  parameters: z.input<typeof GetServiceFacilityInputSchema>
): Promise<ServiceFacilityItem> => executeBillingZambda(oystehr, 'get-billing-service-facility', parameters);

export const saveBillingServiceFacility = (
  oystehr: Oystehr,
  parameters: z.input<typeof SaveServiceFacilityInputSchema>
): Promise<SavedResourceResponse> => executeBillingZambda(oystehr, 'save-billing-service-facility', parameters);

export const deleteBillingServiceFacility = (
  oystehr: Oystehr,
  parameters: z.input<typeof DeleteServiceFacilityInputSchema>
): Promise<DeletedResponse> => executeBillingZambda(oystehr, 'delete-billing-service-facility', parameters);

// --- Terminology ---

// CPT and HCPCS share the service-line code field, so search both and merge. Called straight from the
export const searchBillingProcedureCodes = async (
  oystehr: Oystehr,
  parameters: { query: string }
): Promise<SearchBillingProcedureCodesResponse> => {
  const [cpt, hcpcs] = await Promise.all([
    oystehr.terminology.searchCpt({ query: parameters.query, searchType: 'all', limit: 50 }),
    oystehr.terminology.searchHcpcs({ query: parameters.query, searchType: 'all', limit: 50 }),
  ]);
  const seen = new Set<string>();
  const codes: BillingCodeOption[] = [];
  for (const c of [...cpt.codes, ...hcpcs.codes]) {
    if (seen.has(c.code)) continue;
    seen.add(c.code);
    codes.push({ code: c.code, display: c.display });
  }
  codes.sort((a, b) => a.code.localeCompare(b.code));
  return { codes };
};

// TODO(oystehr): no ICD-10 (diagnosis) terminology search yet — the SDK only exposes searchCpt/searchHcpcs.
// When Oystehr adds ICD-10, add `searchBillingDiagnosisCodes` here (direct terminology call) and make the
// diagnosis fields autocompletes. Until then diagnoses stay free-text.

// --- Tags ---

export const searchBillingTags = (oystehr: Oystehr): Promise<SearchBillingTagsResponse> =>
  executeBillingZambda(oystehr, 'search-billing-tags');

export const saveBillingTag = (
  oystehr: Oystehr,
  parameters: z.input<typeof SaveBillingTagInputSchema>
): Promise<SavedResourceResponse> => executeBillingZambda(oystehr, 'save-billing-tag', parameters);

export const deleteBillingTag = (
  oystehr: Oystehr,
  parameters: z.input<typeof DeleteBillingTagInputSchema>
): Promise<DeletedResponse> => executeBillingZambda(oystehr, 'delete-billing-tag', parameters);

// --- ERAs ---

export const searchBillingEras = (
  oystehr: Oystehr,
  parameters: z.input<typeof SearchErasInputSchema>
): Promise<SearchBillingErasResponse> => executeBillingZambda(oystehr, 'search-billing-eras', parameters);

export const getBillingEraDetail = (
  oystehr: Oystehr,
  parameters: z.input<typeof GetEraDetailInputSchema>
): Promise<EraDetailResponse> => executeBillingZambda(oystehr, 'get-billing-era-detail', parameters);

export const importEra = (oystehr: Oystehr, parameters: z.input<typeof ImportEraInputSchema>): Promise<any> =>
  executeBillingZambda(oystehr, 'import-era', parameters);

export const matchClaimResponseToClaim = (
  oystehr: Oystehr,
  parameters: z.input<typeof MatchClaimResponseToClaimInputSchema>
): Promise<any> => executeBillingZambda(oystehr, 'match-claim-response', parameters);

// --- ChargeItemDefinitions --

export const searchChargeItemDefinitions = (
  oystehr: Oystehr,
  parameters: z.input<typeof SearchChargeItemDefinitionsInputSchema>
): Promise<SearchChargeItemDefinitionsResponse> =>
  executeBillingZambda(oystehr, 'search-charge-item-definitions', parameters);

export const createChargeItemDefinition = (
  oystehr: Oystehr,
  parameters: z.input<typeof CreateChargeItemDefinitionInputSchema>
): Promise<BillingChargeItemDefinition> => executeBillingZambda(oystehr, 'create-charge-item-definition', parameters);

export const getChargeItemDefinition = (
  oystehr: Oystehr,
  parameters: z.input<typeof GetChargeItemDefinitionInputSchema>
): Promise<BillingChargeItemDefinition> => executeBillingZambda(oystehr, 'get-charge-item-definition', parameters);

export const updateChargeItemDefinition = (
  oystehr: Oystehr,
  parameters: z.input<typeof UpdateChargeItemDefinitionInputSchema>
): Promise<BillingChargeItemDefinition> => executeBillingZambda(oystehr, 'update-charge-item-definition', parameters);

export const deleteChargeItemDefinition = (
  oystehr: Oystehr,
  parameters: z.input<typeof DeleteChargeItemDefinitionInputSchema>
): Promise<void> => executeBillingZambda(oystehr, 'delete-charge-item-definition', parameters);

export const bulkAddChargeItemDefinitionProcedureCodes = (
  oystehr: Oystehr,
  parameters: z.input<typeof BulkAddChargeItemDefinitionProcedureCodesInputSchema>
): Promise<BillingChargeItemDefinition> =>
  executeBillingZambda(oystehr, 'bulk-add-charge-item-definition-procedure-codes', parameters);

// --- Payments ---

export const recordBillingManualPayment = (
  oystehr: Oystehr,
  parameters: z.input<typeof RecordBillingManualPaymentInputSchema>
): Promise<RecordBillingManualPaymentResponse> =>
  executeBillingZambda(oystehr, 'record-billing-manual-payment', parameters);
