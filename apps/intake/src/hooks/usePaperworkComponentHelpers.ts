import { QuestionnaireItemAnswerOption, QuestionnaireResponse } from 'fhir/r4b';
import api from 'src/api/ottehrApi';
import { useOystehrAPIClient } from 'src/telemed/utils';
import { PaperworkComponentHelpers } from 'ui-components/lib/components/paperwork/context';
import {
  GetAnswerOptionsRequest,
  HandleAnswerInput,
  PaymentMethodSetDefaultParameters,
  SearchPlacesInput,
  SearchPlacesOutput,
  StartInterviewInput,
} from 'utils';
import { useUCZambdaClient } from './useUCZambdaClient';

export const usePaperworkComponentHelpers = (): PaperworkComponentHelpers => {
  const tokenfulZambdaClient = useUCZambdaClient({ tokenless: false });
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });
  const oystehrApiClient = useOystehrAPIClient();

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
    await api.createZ3Object(appointmentID, fileType, fileFormat, tokenlessZambdaClient, file);
  };

  return {
    handleSearchPlaces,
    createZ3Object,
    aIInterviewStart,
    aIInterviewHandleAnswer,
    setDefaultPaymentMethod,
    getAnswerOptions,
  };
};
