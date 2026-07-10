// todo sarah double check all of these against other places intake may be using them
// i want to avoid code duplication as much as possible so we should just have intake grab from here
// if they are being used else where

import { SxProps } from '@mui/system';
import { QuestionnaireResponse } from 'fhir/r4b';
import { HandleAnswerInput, SearchPlacesInput, SearchPlacesOutput, StartInterviewInput } from 'utils';

export interface ControlButtonsProps {
  submitLabel?: string;
  submitDisabled?: boolean;
  backButton?: boolean;
  backButtonLabel?: string;
  loading?: boolean;
  onBack?: () => void;
  onSubmit?: () => void;
}

export interface SelectInputOption {
  value: string;
  label: string;
}

export type RadioStyling = {
  radio?: SxProps;
  label?: SxProps;
  height?: string;
};

export interface PaperworkComponentHelpers {
  /** PharmacyCollection */
  handleSearchPlaces: ((input: SearchPlacesInput) => Promise<SearchPlacesOutput>) | undefined;
  /** FileInput */
  createZ3Object:
    | ((input: { appointmentID: string; fileType: string; fileFormat: string; file: File }) => Promise<any>)
    | undefined;
  /** AiInterview */
  aIInterviewStart: ((input: StartInterviewInput) => Promise<QuestionnaireResponse>) | undefined;
  /** AiInterview */
  aIInterviewHandleAnswer: ((input: HandleAnswerInput) => Promise<QuestionnaireResponse>) | undefined;
}
