import { QuestionnaireItem, QuestionnaireResponseItem } from 'fhir/r4b';
import {
  buildEnableWhenContext,
  evalEnableWhen,
  IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE,
  IntakeQuestionnaireItem,
  mapQuestionnaireAndValueSetsToItemsList,
} from 'utils';

export class QuestionnaireHelper {
  private static inPersonQuestionnaireItems: IntakeQuestionnaireItem[] = [];
  private static hasLoadedInPersonQuestionnaire = false;

  private static loadInPersonQuestionnaireItems(): IntakeQuestionnaireItem[] {
    if (!QuestionnaireHelper.hasLoadedInPersonQuestionnaire) {
      // todo: make a convenience func for this in utils?
      QuestionnaireHelper.inPersonQuestionnaireItems = mapQuestionnaireAndValueSetsToItemsList(
        IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE().item ?? [],
        []
      );
      QuestionnaireHelper.hasLoadedInPersonQuestionnaire = true;
    }
    return QuestionnaireHelper.inPersonQuestionnaireItems;
  }

  private static flattenItems(items: QuestionnaireItem[]): QuestionnaireItem[] {
    return items.reduce<QuestionnaireItem[]>((acc, item) => {
      acc.push(item);
      if (item.item?.length) {
        acc.push(...QuestionnaireHelper.flattenItems(item.item));
      }
      return acc;
    }, []);
  }

  /**
   * Checks if an item with the given linkId exists in the questionnaire (regardless of enableWhen conditions).
   */
  static inPersonQuestionnaireHasItem(linkId: string): boolean {
    const items = QuestionnaireHelper.flattenItems(QuestionnaireHelper.loadInPersonQuestionnaireItems());
    return items.some((item) => item.linkId === linkId);
  }

  /**
   * Checks if an item with the given linkId is visible given the current questionnaire response context.
   * This accounts for enableWhen conditions on the item.
   *
   * @param linkId - The linkId of the item to check
   * @param responseItems - The current questionnaire response items (filled form data)
   * @returns true if the item exists and is visible, false otherwise
   */
  static inPersonQuestionnaireItemIsVisible(linkId: string, responseItems: QuestionnaireResponseItem[]): boolean {
    const allItems = QuestionnaireHelper.loadInPersonQuestionnaireItems();
    const flatItems = QuestionnaireHelper.flattenItems(allItems);
    const targetItem = flatItems.find((item) => item.linkId === linkId);

    if (!targetItem) {
      return false;
    }

    // If item has no enableWhen, it's always visible
    if (!targetItem.enableWhen || targetItem.enableWhen.length === 0) {
      return true;
    }

    // Build context for enableWhen evaluation
    const context = buildEnableWhenContext(responseItems);

    // Evaluate enableWhen condition
    return evalEnableWhen(targetItem as IntakeQuestionnaireItem, allItems, context);
  }

  /**
   * Checks if the employer information page exists in the questionnaire.
   * Note: This does NOT check if it's visible based on enableWhen conditions.
   * Use inPersonQuestionnaireItemIsVisible() to check visibility.
   */
  static hasEmployerInformationPage(): boolean {
    return QuestionnaireHelper.inPersonQuestionnaireHasItem('employer-information-page');
  }

  /**
   * Checks if the employer information page is visible given the current questionnaire response context.
   *
   * @param responseItems - The current questionnaire response items (filled form data)
   * @returns true if the page exists and is visible, false otherwise
   */
  static employerInformationPageIsVisible(responseItems: QuestionnaireResponseItem[]): boolean {
    return QuestionnaireHelper.inPersonQuestionnaireItemIsVisible('employer-information-page', responseItems);
  }

  static hasAttorneyPage(): boolean {
    return QuestionnaireHelper.inPersonQuestionnaireHasItem('attorney-mva-page');
  }

  static attorneyPageIsVisible(responseItems: QuestionnaireResponseItem[]): boolean {
    return QuestionnaireHelper.inPersonQuestionnaireItemIsVisible('attorney-mva-page', responseItems);
  }
}
