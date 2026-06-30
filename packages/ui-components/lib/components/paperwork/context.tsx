import { QueryObserverResult, RefetchOptions } from '@tanstack/react-query';
import { QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { createContext, FC, PropsWithChildren, useContext } from 'react';
import {
  AppointmentSummary,
  CreditCardInfo,
  IntakeQuestionnaireItem,
  PaperworkPatient,
  PaymentMethodSetupZambdaOutput,
  QuestionnaireFormFields,
  UCGetPaperworkResponse,
} from 'utils';

/**
 * The context the shared `PagedQuestionnaire` render tree consumes.
 *
 * The vanilla render path reads only `paperwork`, `allItems`, `questionnaireResponse`,
 * `saveButtonDisabled`/`setSaveButtonDisabled`, `appointment` and (optionally) `continueLabel`.
 * The remaining members are consumed exclusively by intake's INJECTED specialized renderers
 * (credit card, AI interview, file upload, pharmacy) and are inert for EHR previews.
 */
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
  // Read by PagedQuestionnaire for the submit label on in-person paperwork. Supplied by intake
  // (sourced from its `usePaperworkStore`); inert for EHR previews.
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
}

const PaperworkReactContext = createContext<PaperworkContext | undefined>(undefined);

export interface PaperworkProviderProps extends PropsWithChildren {
  value: PaperworkContext;
}

export const PaperworkProvider: FC<PaperworkProviderProps> = ({ value, children }) => {
  return <PaperworkReactContext.Provider value={value}>{children}</PaperworkReactContext.Provider>;
};

export const usePaperworkContext = (): PaperworkContext => {
  const ctx = useContext(PaperworkReactContext);
  if (ctx === undefined) {
    throw new Error('usePaperworkContext must be used within a PaperworkProvider');
  }
  return ctx;
};
