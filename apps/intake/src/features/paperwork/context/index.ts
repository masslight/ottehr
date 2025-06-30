import { QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { useOutletContext } from 'react-router-dom';
import {
  AppointmentSummary,
  IntakeQuestionnaireItem,
  PaperworkPatient,
  QuestionnaireFormFields,
  UCGetPaperworkResponse,
} from 'utils';

export interface PaperworkContext
  extends Omit<UCGetPaperworkResponse, 'patient' | 'appointment' | 'questionnaireResponse'> {
  paperwork: QuestionnaireResponseItem[];
  paperworkInProgress: { [pageId: string]: QuestionnaireFormFields };
  pageItems: IntakeQuestionnaireItem[];
  pages: IntakeQuestionnaireItem[];
  appointment: AppointmentSummary | undefined;
  patient: PaperworkPatient | undefined;
  questionnaireResponse: QuestionnaireResponse | undefined;
  saveButtonDisabled?: boolean;
  setSaveButtonDisabled: (newVal: boolean) => void;
  findAnswerWithLinkId: (linkId: string) => QuestionnaireResponseItem | undefined;
}

export const usePaperworkContext = (): PaperworkContext => {
  return useOutletContext<PaperworkContext>();
};
