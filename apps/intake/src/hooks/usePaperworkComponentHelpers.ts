import { useQueryClient } from '@tanstack/react-query';
import { QuestionnaireItemAnswerOption, QuestionnaireResponse } from 'fhir/r4b';
import api from 'src/api/ottehrApi';
import { useOystehrAPIClient } from 'src/telemed/utils';
import { CardSuggestionsInput, PaperworkComponentHelpers } from 'ui-components/lib/components/paperwork/context';
import {
  GetAnswerOptionsRequest,
  GetInsuranceCardSuggestionsResponse,
  GetPhotoIdSuggestionsResponse,
  HandleAnswerInput,
  PaymentMethodSetDefaultParameters,
  SearchPlacesInput,
  SearchPlacesOutput,
  StartInterviewInput,
} from 'utils';
import { useUCZambdaClient } from './useUCZambdaClient';

// cardSlot identifies which upload (e.g. 'insurance-card-front-2') a suggestions call is for; a
// trailing '-2' means secondary insurance, so suggestions cache separately from primary.
const insuranceOrdinalForCardSlot = (cardSlot: string): 1 | 2 => (cardSlot.endsWith('-2') ? 2 : 1);

export const usePaperworkComponentHelpers = (): PaperworkComponentHelpers => {
  const tokenfulZambdaClient = useUCZambdaClient({ tokenless: false });
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });
  const oystehrApiClient = useOystehrAPIClient();
  const queryClient = useQueryClient();

  const handleSearchPlaces = async (input: SearchPlacesInput): Promise<SearchPlacesOutput> => {
    if (!tokenfulZambdaClient) throw new Error('error searching, api client is undefined');
    return await api.searchPlaces(input, tokenfulZambdaClient);
  };

  const aIInterviewStart = async (input: StartInterviewInput): Promise<QuestionnaireResponse> => {
    if (tokenfulZambdaClient == null) throw new Error('error searching, api client is undefined');
    return await api.aIInterviewStart(input, tokenfulZambdaClient);
  };

  const aIInterviewHandleAnswer = async (input: HandleAnswerInput): Promise<QuestionnaireResponse> => {
    if (tokenfulZambdaClient == null) throw new Error('error searching, api client is undefined');
    return await api.aIInterviewHandleAnswer(input, tokenfulZambdaClient);
  };

  const setDefaultPaymentMethod = async (input: PaymentMethodSetDefaultParameters): Promise<unknown> => {
    if (oystehrApiClient == null) throw new Error('error setting default payment method, api client is undefined');
    return await oystehrApiClient.setDefaultPaymentMethod(input);
  };

  const getAnswerOptions = async (input: GetAnswerOptionsRequest): Promise<QuestionnaireItemAnswerOption[]> => {
    if (oystehrApiClient == null) throw new Error('error fetching answer options, api client is undefined');
    if (!input.answerSource) throw new Error('missing answerSource for getAnswerOptions');

    const zambdaId = input.answerSource.zambdaId;

    switch (zambdaId) {
      case 'get-answer-options':
        return await oystehrApiClient.getAnswerOptions(input);
      case 'get-all-insurance-payers':
        return await oystehrApiClient.getAllInsuranceOptions(input);
      case 'get-patient-insurance-payers':
        return await oystehrApiClient.getPatientInsuranceOptions(input);
      default:
        throw new Error(`Unknown zambdaId "${zambdaId}" for getAnswerOptions`);
    }
  };

  const createZ3Object = async (input: {
    appointmentID: string;
    fileType: string;
    fileFormat: string;
    file: File;
  }): Promise<any> => {
    if (tokenlessZambdaClient == null) throw new Error('error searching, api client is undefined');
    const { appointmentID, fileType, fileFormat, file } = input;
    return await api.createZ3Object(appointmentID, fileType, fileFormat, tokenlessZambdaClient, file);
  };

  const getInsuranceCardSuggestions = async (
    input: CardSuggestionsInput
  ): Promise<GetInsuranceCardSuggestionsResponse> => {
    if (tokenlessZambdaClient == null) throw new Error('error fetching suggestions, api client is undefined');
    const { cardSlot, ...zambdaInput } = input;
    const response = await api.getInsuranceCardSuggestions(zambdaInput, tokenlessZambdaClient);
    queryClient.setQueryData(
      ['insurance-card-suggestions', input.appointmentID, insuranceOrdinalForCardSlot(cardSlot)],
      response
    );
    return response;
  };

  const getPhotoIdSuggestions = async (input: CardSuggestionsInput): Promise<GetPhotoIdSuggestionsResponse> => {
    if (tokenlessZambdaClient == null) throw new Error('error fetching suggestions, api client is undefined');
    const { cardSlot: _cardSlot, ...zambdaInput } = input;
    const response = await api.getPhotoIdSuggestions(zambdaInput, tokenlessZambdaClient);
    queryClient.setQueryData(['photo-id-suggestions', input.appointmentID], response);
    return response;
  };

  return {
    handleSearchPlaces,
    createZ3Object,
    getInsuranceCardSuggestions,
    getPhotoIdSuggestions,
    aIInterviewStart,
    aIInterviewHandleAnswer,
    setDefaultPaymentMethod,
    getAnswerOptions,
  };
};
