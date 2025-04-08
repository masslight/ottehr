import { FhirResource } from 'fhir/r4b';

export function isNonPaperworkQuestionnaireResponse<T extends FhirResource>(resource: T): boolean {
  return (
    resource.resourceType === 'QuestionnaireResponse' &&
    !resource.questionnaire?.includes('https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson') &&
    !resource.questionnaire?.includes('https://ottehr.com/FHIR/Questionnaire/intake-paperwork-virtual')
  );
}
