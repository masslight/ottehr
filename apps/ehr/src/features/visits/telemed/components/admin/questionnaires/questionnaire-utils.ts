// ============= admin questionnaire builder helpers ===================== //

import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { PaperworkContext } from 'ui-components';
import {
  findQuestionnaireResponseItemLinkId,
  flattenIntakeQuestionnaireItems,
  IntakeQuestionnaireItem,
  mapQuestionnaireAndValueSetsToItemsList,
  QAndQRResponse,
  QR_DISTRIBUTION_TAG,
} from 'utils';

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

/**
 * A minimal PaperworkContext for the EHR builder previews. Only the vanilla render path's fields
 * are meaningful here (`paperwork`, `allItems`, `pages`, `pageItems`, `saveButtonDisabled`); the
 * specialized-input fields are inert because the EHR previews inject no specialized renderers.
 */
export function stubPaperworkContext(
  pages: IntakeQuestionnaireItem[],
  allItems: IntakeQuestionnaireItem[],
  questionnaireResponse: QuestionnaireResponse,
  setContinueLabel: (value: string | undefined) => void,
  continueLabel: string | undefined
): PaperworkContext {
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
    // we don't need these to actually work for the preview at the moment
    // currently the form builder doesn't allow you to add these components to a custom form
    // when we do add them, there will need to be some refactoring done for the "test form" functionality to work
    // some sort of stub information will need to get filled in for the user to proceed
    paperworkComponentHelpers: {
      handleSearchPlaces: undefined,
      createZ3Object: undefined,
      aIInterviewStart: undefined,
      aIInterviewHandleAnswer: undefined,
      setDefaultPaymentMethod: undefined,
      getAnswerOptions: undefined,
    },
  };
}
