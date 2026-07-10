import { QueryObserverResult, RefetchOptions } from '@tanstack/react-query';
import { QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { createContext, useContext } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AppointmentSummary,
  CreditCardInfo,
  HandleAnswerInput,
  IntakeQuestionnaireItem,
  PaperworkPatient,
  PaymentMethodSetupZambdaOutput,
  QuestionnaireFormFields,
  SearchPlacesInput,
  SearchPlacesOutput,
  StartInterviewInput,
  UCGetPaperworkResponse,
} from 'utils';
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

export interface PaperworkContext
  extends Omit<UCGetPaperworkResponse, 'patient' | 'appointment' | 'questionnaireResponse'> {
  paperwork: QuestionnaireResponseItem[];
  paperworkInProgress: { [pageId: string]: QuestionnaireFormFields };
  pageItems: IntakeQuestionnaireItem[];
  pages: IntakeQuestionnaireItem[];
  appointment: AppointmentSummary | undefined;
  patient: PaperworkPatient | undefined;
  questionnaireResponse: QuestionnaireResponse | undefined;
  cardsAreLoading: boolean;
  paymentMethodStateInitializing: boolean;
  paymentMethods: CreditCardInfo[];
  stripeSetupData: PaymentMethodSetupZambdaOutput | undefined;
  setContinueLabel?: (label: string | undefined) => void;
  continueLabel?: string;
  saveButtonDisabled?: boolean;
  refetchPaymentMethods: (options?: RefetchOptions | undefined) => Promise<
    QueryObserverResult<
      {
        cards: CreditCardInfo[];
      },
      Error
    >
  >;
  refetchSetupData: (
    options?: RefetchOptions | undefined
  ) => Promise<QueryObserverResult<PaymentMethodSetupZambdaOutput, Error>>;
  setSaveButtonDisabled: (newVal: boolean) => void;
  findAnswerWithLinkId: (linkId: string) => QuestionnaireResponseItem | undefined;
  paperworkComponentHelpers: PaperworkComponentHelpers;
}

// The main intake paperwork flow supplies this context through the router `<Outlet context={...}>`.
// Standalone consumers that live outside that outlet (e.g. the managed standalone form) can instead
// wrap their tree in `<PaperworkProvider value={...}>`. `usePaperworkContext` prefers an explicit
// provider and falls back to the outlet, so the existing flow is untouched.
const PaperworkReactContext = createContext<PaperworkContext | null>(null);
export const PaperworkProvider = PaperworkReactContext.Provider;

export const usePaperworkContext = (): PaperworkContext => {
  // Both hooks are called unconditionally (rules-of-hooks); we just pick which value to return.
  // `useOutletContext` returns null rather than throwing when there is no enclosing outlet.
  const fromProvider = useContext(PaperworkReactContext);
  const fromOutlet = useOutletContext<PaperworkContext>();
  return fromProvider ?? fromOutlet;
};
