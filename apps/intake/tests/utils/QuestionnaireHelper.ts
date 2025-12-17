import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

interface QuestionnaireItem {
  linkId?: string;
  item?: QuestionnaireItem[];
}

export class QuestionnaireHelper {
  private static inPersonQuestionnaireItems: QuestionnaireItem[] = [];
  private static hasLoadedInPersonQuestionnaire = false;
  private static readonly questionnairePath = path.resolve(
    QuestionnaireHelper.getDirname(),
    '../../../../config/oystehr/in-person-intake-questionnaire.json'
  );

  private static getDirname(): string {
    const filename = fileURLToPath(import.meta.url);
    return path.dirname(filename);
  }

  private static loadInPersonQuestionnaireItems(): QuestionnaireItem[] {
    if (!QuestionnaireHelper.hasLoadedInPersonQuestionnaire) {
      const questionnaireRaw = fs.readFileSync(QuestionnaireHelper.questionnairePath, 'utf-8');
      const questionnaireJson = JSON.parse(questionnaireRaw);
      const fhirResources = questionnaireJson?.fhirResources ?? {};
      const matchingKey = Object.keys(fhirResources).find((key) => key.startsWith('questionnaire-in-person-previsit'));
      const resourceWrapper = matchingKey ? fhirResources[matchingKey] : Object.values(fhirResources)[0];
      QuestionnaireHelper.inPersonQuestionnaireItems = resourceWrapper?.resource?.item ?? [];
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

  static inPersonQuestionnaireHasItem(linkId: string): boolean {
    const items = QuestionnaireHelper.flattenItems(QuestionnaireHelper.loadInPersonQuestionnaireItems());
    return items.some((item) => item.linkId === linkId);
  }

  static hasEmployerInformationPage(): boolean {
    return QuestionnaireHelper.inPersonQuestionnaireHasItem('employer-information-page');
  }

  static hasAttorneyPage(): boolean {
    return QuestionnaireHelper.inPersonQuestionnaireHasItem('attorney-mva-page');
  }
}
