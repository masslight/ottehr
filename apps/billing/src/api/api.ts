import Oystehr from '@oystehr/sdk';
import {
  apiErrorToThrow,
  chooseJson,
  ClaimDetailResponse,
  CreateBillingClaimInput,
  CreateBillingPatientInput,
  CreateBillingProviderInput,
  CreatedClaimResponse,
  CreatedResourceResponse,
  DeleteBillingProviderInput,
  DeleteBillingTagInput,
  DeletedResponse,
  EraDetailResponse,
  GetClaimDetailInput,
  GetEraDetailInput,
  GetPatientCoveragesInput,
  GetPatientCoveragesResponse,
  GetPatientDetailInput,
  PatientDetailResponse,
  SaveBillingTagInput,
  SavedResourceResponse,
  SearchBillingClaimsInput,
  SearchBillingClaimsResponse,
  SearchBillingErasResponse,
  SearchBillingLocationsInput,
  SearchBillingLocationsResponse,
  SearchBillingPatientsInput,
  SearchBillingPatientsResponse,
  SearchBillingPayersInput,
  SearchBillingPayersResponse,
  SearchBillingProvidersInput,
  SearchBillingProvidersResponse,
  SearchBillingTagsResponse,
  SearchErasInput,
  TagBillingClaimInput,
  TaggedClaimResponse,
  UpdateBillingPatientInput,
  UpdateBillingProviderInput,
  UpdateBillingResourceInput,
} from 'utils';

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

// --- Patients ---

export const createBillingPatient = (
  oystehr: Oystehr,
  parameters: CreateBillingPatientInput
): Promise<CreatedResourceResponse> => executeBillingZambda(oystehr, 'create-billing-patient', parameters);

export const searchBillingPatients = (
  oystehr: Oystehr,
  parameters: SearchBillingPatientsInput
): Promise<SearchBillingPatientsResponse> => executeBillingZambda(oystehr, 'search-billing-patients', parameters);

export const getBillingPatientDetail = (
  oystehr: Oystehr,
  parameters: GetPatientDetailInput
): Promise<PatientDetailResponse> => executeBillingZambda(oystehr, 'get-billing-patient-detail', parameters);

export const updateBillingPatient = (
  oystehr: Oystehr,
  parameters: UpdateBillingPatientInput
): Promise<CreatedResourceResponse> => executeBillingZambda(oystehr, 'update-billing-patient', parameters);

// --- Claims ---

export const createBillingClaim = (
  oystehr: Oystehr,
  parameters: CreateBillingClaimInput
): Promise<CreatedClaimResponse> => executeBillingZambda(oystehr, 'create-billing-claim', parameters);

export const searchBillingClaims = (
  oystehr: Oystehr,
  parameters: SearchBillingClaimsInput
): Promise<SearchBillingClaimsResponse> => executeBillingZambda(oystehr, 'search-billing-claims', parameters);

export const getBillingClaimDetail = (
  oystehr: Oystehr,
  parameters: GetClaimDetailInput
): Promise<ClaimDetailResponse> => executeBillingZambda(oystehr, 'get-billing-claim-detail', parameters);

export const updateBillingResource = (
  oystehr: Oystehr,
  parameters: UpdateBillingResourceInput
): Promise<SavedResourceResponse> => executeBillingZambda(oystehr, 'update-billing-claim', parameters);

export const tagBillingClaim = (oystehr: Oystehr, parameters: TagBillingClaimInput): Promise<TaggedClaimResponse> =>
  executeBillingZambda(oystehr, 'tag-billing-claim', parameters);

// --- Providers ---

export const createBillingProvider = (
  oystehr: Oystehr,
  parameters: CreateBillingProviderInput
): Promise<CreatedResourceResponse> => executeBillingZambda(oystehr, 'create-billing-provider', parameters);

export const searchBillingProviders = (
  oystehr: Oystehr,
  parameters: SearchBillingProvidersInput
): Promise<SearchBillingProvidersResponse> => executeBillingZambda(oystehr, 'search-billing-providers', parameters);

export const updateBillingProvider = (
  oystehr: Oystehr,
  parameters: UpdateBillingProviderInput
): Promise<CreatedResourceResponse> => executeBillingZambda(oystehr, 'update-billing-provider', parameters);

export const deleteBillingProvider = (
  oystehr: Oystehr,
  parameters: DeleteBillingProviderInput
): Promise<DeletedResponse> => executeBillingZambda(oystehr, 'delete-billing-provider', parameters);

// --- Lookups (payers, locations, coverages) ---

export const searchBillingPayers = (
  oystehr: Oystehr,
  parameters: SearchBillingPayersInput
): Promise<SearchBillingPayersResponse> => executeBillingZambda(oystehr, 'search-billing-payers', parameters);

export const searchBillingLocations = (
  oystehr: Oystehr,
  parameters: SearchBillingLocationsInput
): Promise<SearchBillingLocationsResponse> => executeBillingZambda(oystehr, 'search-billing-locations', parameters);

export const getPatientCoverages = (
  oystehr: Oystehr,
  parameters: GetPatientCoveragesInput
): Promise<GetPatientCoveragesResponse> => executeBillingZambda(oystehr, 'get-patient-coverages', parameters);

// --- Tags ---

export const searchBillingTags = (oystehr: Oystehr): Promise<SearchBillingTagsResponse> =>
  executeBillingZambda(oystehr, 'search-billing-tags');

export const saveBillingTag = (oystehr: Oystehr, parameters: SaveBillingTagInput): Promise<SavedResourceResponse> =>
  executeBillingZambda(oystehr, 'save-billing-tag', parameters);

export const deleteBillingTag = (oystehr: Oystehr, parameters: DeleteBillingTagInput): Promise<DeletedResponse> =>
  executeBillingZambda(oystehr, 'delete-billing-tag', parameters);

// --- ERAs ---

export const searchBillingEras = (oystehr: Oystehr, parameters: SearchErasInput): Promise<SearchBillingErasResponse> =>
  executeBillingZambda(oystehr, 'search-billing-eras', parameters);

export const getBillingEraDetail = (oystehr: Oystehr, parameters: GetEraDetailInput): Promise<EraDetailResponse> =>
  executeBillingZambda(oystehr, 'get-billing-era-detail', parameters);
