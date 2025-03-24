import { FhirResource } from 'fhir/r4b';

export function isNonPaperworkQuestionnaireResponse<T extends FhirResource>(resource: T): boolean {
  return (
    resource.resourceType === 'QuestionnaireResponse' &&
    resource.questionnaire?.startsWith('https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson') == false &&
    resource.questionnaire?.startsWith('https://ottehr.com/FHIR/Questionnaire/intake-paperwork-virtual') === false
  );
}
