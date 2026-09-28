// Stub paperwork state for rendering a questionnaire outside a visit: the EHR questionnaire
// builder preview and the renderPaperworkPage test harness.

import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { QR_DISTRIBUTION_TAG } from 'utils/lib/fhir/constants';
import { mapQuestionnaireAndValueSetsToItemsList } from 'utils/lib/helpers/paperwork/paperwork';
import {
  findQuestionnaireResponseItemLinkId,
  flattenIntakeQuestionnaireItems,
  IntakeQuestionnaireItem,
  QAndQRResponse,
} from 'utils/lib/types/data/paperwork/paperwork.types';
import { PaperworkComponentHelpers, PaperworkContext } from './context';

export const stubPaperworkResponseForPreview = (questionnaire: Questionnaire): QAndQRResponse => {
  // mapQuestionnaireAndValueSetsToItemsList mutates its input items in place, so pass a deep
  // copy to avoid corrupting the questionnaire object the builder holds in state.
  const itemsCopy = questionnaire.item ? structuredClone(questionnaire.item) : [];
  const allItems = mapQuestionnaireAndValueSetsToItemsList(itemsCopy, []);

  const stubQuestionnaireResponse: QuestionnaireResponse = {
    resourceType: 'QuestionnaireResponse',
    meta: { tag: [QR_DISTRIBUTION_TAG] }, // need this so the pagedQuestionnaire treats the stub as a one off form
    questionnaire: `${questionnaire.url}|${questionnaire.version}`,
    status: 'in-progress',
    item: questionnaire.item?.map((item) => {
      return {
        linkId: item.linkId,
        item: [],
      };
    }),
  };

  const questionnaireTitle = questionnaire.title ?? 'Form';

  return {
    allItems,
    questionnaireResponse: stubQuestionnaireResponse,
    questionnaireTitle,
  };
};

export interface StubPaperworkContextInput {
  pages: IntakeQuestionnaireItem[];
  allItems: IntakeQuestionnaireItem[];
  questionnaireResponse: QuestionnaireResponse;
  setContinueLabel?: (value: string | undefined) => void;
  continueLabel?: string;
  /** Helpers for specialized inputs; any not supplied stay undefined. */
  paperworkComponentHelpers?: Partial<PaperworkComponentHelpers>;
}

/**
 * A minimal PaperworkContext for rendering outside a visit. Only the vanilla render path's fields
 * are meaningful here (`paperwork`, `allItems`, `pages`, `pageItems`, `saveButtonDisabled`); the
 * specialized-input fields are inert, and their helpers are undefined unless
 * `paperworkComponentHelpers` supplies them.
 */
export function stubPaperworkContext({
  pages,
  allItems,
  questionnaireResponse,
  setContinueLabel,
  continueLabel,
  paperworkComponentHelpers,
}: StubPaperworkContextInput): PaperworkContext {
  const paperwork = questionnaireResponse.item ?? [];
  return {
    paperwork,
    paperworkInProgress: {},
    pageItems: pages,
    pages,
    allItems: flattenIntakeQuestionnaireItems(allItems ?? []),
    questionnaireResponse,
    appointment: undefined,
    patient: undefined,
    updateTimestamp: undefined,
    saveButtonDisabled: false,
    setSaveButtonDisabled: () => {},
    cardsAreLoading: false,
    paymentMethodStateInitializing: false,
    paymentMethods: [],
    stripeSetupData: undefined,
    setContinueLabel,
    continueLabel,
    refetchPaymentMethods: (async () => ({ data: { cards: [] } })) as any,
    refetchSetupData: (async () => ({})) as any,
    findAnswerWithLinkId: (linkId: string) => findQuestionnaireResponseItemLinkId(linkId, []),
    // the EHR preview doesn't need these to actually work at the moment
    // currently the form builder doesn't allow you to add these components to a custom form
    // when we do add them, there will need to be some refactoring done for the "test form" functionality to work
    // some sort of stub information will need to get filled in for the user to proceed
    paperworkComponentHelpers: {
      handleSearchPlaces: undefined,
      createZ3Object: undefined,
      getInsuranceCardSuggestions: undefined,
      getPhotoIdSuggestions: undefined,
      aIInterviewStart: undefined,
      aIInterviewHandleAnswer: undefined,
      setDefaultPaymentMethod: undefined,
      getAnswerOptions: undefined,
      ...paperworkComponentHelpers,
    },
  };
}
