import Oystehr from '@oystehr/sdk';
import { QuestionnaireResponse } from 'fhir/r4b';
import { AI_QUESTIONNAIRE_ID, VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE } from 'utils';

// complete AI QuestionnaireResponse if it exists and has user answers to trigger resource creation via subscription
// so provider can see the resources even for partially completed AI interviews
export async function completeInProgressAiQuestionnaireResponseIfPossible(
  oystehr: Oystehr,
  encounterId: string
): Promise<void> {
  console.log(`Checking AI QuestionnaireResponse for encounter: ${encounterId}`);

  try {
    const aiQR = await findAIInterviewQuestionnaireResponse(encounterId, oystehr);

    if (!aiQR) {
      console.log('No AI QuestionnaireResponse found for encounter:', encounterId);
      return;
    }

    if (aiQR.status !== 'in-progress') {
      console.log('AI QuestionnaireResponse is not in-progress, skipping:', aiQR.status);
      return;
    }

    const existingResources = await checkForExistingAiResources(oystehr, encounterId);

    if (existingResources) {
      console.log('AI resources already exist, skipping');
      return;
    }

    const hasUserAnswers = checkForUserAnswers(aiQR);

    if (!hasUserAnswers) {
      console.log('AI QuestionnaireResponse has no user answers, skipping completion');
      return;
    }

    console.log('AI QuestionnaireResponse has user answers, completing it to trigger resource creation');

    await oystehr.fhir.update<QuestionnaireResponse>({
      ...aiQR,
      status: 'completed',
    });

    console.log('Successfully completed AI QuestionnaireResponse');
  } catch (error) {
    console.error('Error in checkAndCompleteAiQuestionnaireResponse:', error);
    // Don't throw - this is a helper function and shouldn't break the main flow
  }
}

async function findAIInterviewQuestionnaireResponse(
  encounterId: string,
  oystehr: Oystehr
): Promise<QuestionnaireResponse | undefined> {
  const searchResult = await oystehr.fhir.search<QuestionnaireResponse>({
    resourceType: 'QuestionnaireResponse',
    params: [
      {
        name: 'encounter',
        value: 'Encounter/' + encounterId,
      },
      {
        name: 'questionnaire',
        value: '#' + AI_QUESTIONNAIRE_ID,
      },
    ],
  });

  return searchResult.unbundle()[0];
}

async function checkForExistingAiResources(oystehr: Oystehr, encounterId: string): Promise<boolean> {
  const existingDocRef = await oystehr.fhir.search({
    resourceType: 'DocumentReference',
    params: [
      { name: 'context', value: `Encounter/${encounterId}` },
      { name: 'type', value: VISIT_CONSULT_NOTE_DOC_REF_CODING_CODE.code },
    ],
  });

  return existingDocRef.unbundle().length > 0;
}

function checkForUserAnswers(qr: QuestionnaireResponse): boolean {
  if (!qr.item || qr.item.length <= 1) {
    return false;
  }

  // Look for items beyond the initial message (linkId: '0')
  const userAnswerItems = qr.item.filter(
    (item) =>
      item.linkId !== '0' &&
      item.answer &&
      item.answer.length > 0 &&
      item.answer.some((answer) => answer.valueString && answer.valueString.trim().length > 0)
  );

  console.log(`Found ${userAnswerItems.length} user answer items`);
  return userAnswerItems.length > 0;
}
