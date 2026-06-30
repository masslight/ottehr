import { FC } from 'react';
import {
  PagedQuestionnaire as SharedPagedQuestionnaire,
  PaperworkInjections,
  PaperworkInjectionsProvider,
  PaperworkThemeProvider,
  RenderAttachmentProps,
  RenderCreditCardProps,
  RenderMedicalHistoryProps,
  RenderPharmacyProps,
  UsePreSubmit,
} from 'ui-components';
import { IntakeQuestionnaireItem, QuestionnaireFormFields } from 'utils';
import { otherColors } from '../../IntakeThemeProvider';
import { useAnswerOptionsQuery } from '../../telemed/features/paperwork';
import { ControlButtonsProps } from '../../types';
import AIInterview from './components/AIInterview';
import { CardErrorDialog } from './components/CardErrorDialog';
import { CreditCardVerification } from './components/CreditCardVerification';
import FileInput from './components/FileInput';
import { PharmacyCollection } from './components/PharmacyCollection';
import { usePaperworkContext } from './context';
import { useCreditCardSave } from './hooks/useCreditCardSave';

// Intake's specialized inputs stay in intake; they are bound here as injected renderers for the
// shared PagedQuestionnaire. The vanilla render path lives in ui-components and is unchanged.

interface PagedQuestionnaireOptions {
  bottomComponent?: React.ReactElement;
  hideControls?: boolean;
  controlButtons?: ControlButtonsProps;
}

interface PagedQuestionnaireInput {
  items: IntakeQuestionnaireItem[];
  pageId: string;
  pageItem?: IntakeQuestionnaireItem;
  pageSubtitle?: string;
  defaultValues?: QuestionnaireFormFields;
  options?: PagedQuestionnaireOptions;
  isSaving?: boolean;
  onSubmit: (data: QuestionnaireFormFields) => void;
  saveProgress: (data: QuestionnaireFormFields) => void;
}

const renderCreditCard = (props: RenderCreditCardProps): React.ReactElement => <CreditCardVerification {...props} />;

const renderMedicalHistory = (props: RenderMedicalHistoryProps): React.ReactElement => <AIInterview {...props} />;

const renderAttachment = (props: RenderAttachmentProps): React.ReactElement => (
  <FileInput {...props} usePaperworkContext={usePaperworkContext} />
);

const renderPharmacy = (props: RenderPharmacyProps): React.ReactElement => <PharmacyCollection {...props} />;

// Bridges intake's credit-card save (module-scoped store) to the shared pre-submit gate.
const usePreSubmit: UsePreSubmit = () => {
  const { isSavingCard, handleCardSave } = useCreditCardSave();
  return { isSaving: isSavingCard, preSubmit: handleCardSave };
};

const injections: PaperworkInjections = {
  renderCreditCard,
  renderMedicalHistory,
  renderAttachment,
  renderPharmacy,
  useAnswerOptions: (queryKey, enabled, params) => useAnswerOptionsQuery(queryKey, enabled, params),
  usePreSubmit,
  bottomSlot: (onContinueAnyway) => (
    <CardErrorDialog onContinueAnyway={() => onContinueAnyway({ skipValidation: true })} />
  ),
};

const PagedQuestionnaire: FC<PagedQuestionnaireInput> = (props) => {
  return (
    <PaperworkThemeProvider otherColors={otherColors}>
      <PaperworkInjectionsProvider value={injections}>
        <SharedPagedQuestionnaire {...props} />
      </PaperworkInjectionsProvider>
    </PaperworkThemeProvider>
  );
};

export default PagedQuestionnaire;
