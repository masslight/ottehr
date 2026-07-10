import { QuestionnaireResponse } from 'fhir/r4b';
import api from 'src/api/ottehrApi';
import { PaperworkComponentHelpers } from 'ui-components/lib/components/paperwork/context';
import { HandleAnswerInput, SearchPlacesInput, SearchPlacesOutput, StartInterviewInput } from 'utils';
import { useUCZambdaClient } from './useUCZambdaClient';

export const usePaperworkComponentHelpers = (): PaperworkComponentHelpers => {
  const tokenfulZambdaClient = useUCZambdaClient({ tokenless: false });
  const tokenlessZambdaClient = useUCZambdaClient({ tokenless: true });

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
  };
};
