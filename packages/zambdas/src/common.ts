import { FhirResource } from 'fhir/r4b';
import { inPersonIntakeQuestionnaire, virtualIntakeQuestionnaire } from 'utils';

export function isNonPaperworkQuestionnaireResponse<T extends FhirResource>(resource: T): boolean {
  return (
    resource.resourceType === 'QuestionnaireResponse' &&
    !resource.questionnaire?.includes(inPersonIntakeQuestionnaire.resource.url) &&
    !resource.questionnaire?.includes(virtualIntakeQuestionnaire.resource.url)
  );
}
