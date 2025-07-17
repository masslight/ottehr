import { checkEnable, FileURLs, PaperworkPage, Question, SCHOOL_WORK_NOTE } from 'utils';
import { FormInputType } from '../../types';

interface CompletedPaperwork {
  [fieldName: string]: any;
}

function valueExists(value: any): boolean {
  return value !== undefined && value !== '';
}

function areAllQuestionsComplete(completedPaperwork: CompletedPaperwork, questions: Question[]): boolean {
  return questions.every((question) => {
    return valueExists(completedPaperwork[question.id]);
  });
}

function areAllRequiredQuestionsComplete(completedPaperwork: CompletedPaperwork, questions: Question[]): boolean {
  return areAllQuestionsComplete(
    completedPaperwork,
    questions.filter((question) => question.required)
  );
}

function isContactInformationComplete(completedPaperwork: CompletedPaperwork): boolean {
  const address =
    valueExists(completedPaperwork['patient-street-address']) &&
    valueExists(completedPaperwork['patient-city']) &&
    valueExists(completedPaperwork['patient-state']) &&
    valueExists(completedPaperwork['patient-zip']);
  const patientFillingOutAs = valueExists(completedPaperwork['patient-filling-out-as']);
  const patientInfoExists =
    valueExists(completedPaperwork['patient-email']) && valueExists(completedPaperwork['patient-number']);
  const guardianInfoExists =
    valueExists(completedPaperwork['guardian-email']) && valueExists(completedPaperwork['guardian-number']);

  return address && patientFillingOutAs && (patientInfoExists || guardianInfoExists);
}

function isPaymentOptionComplete(completedPaperwork: CompletedPaperwork, questions: Question[]): boolean {
  const mappedCompletedPaperwork = completedPaperwork['insurance-carrier-2']
    ? completedPaperwork
    : Object.keys(completedPaperwork).reduce((prev, curr) => {
        if (!curr.endsWith('-2')) {
          prev[curr] = completedPaperwork[curr];
        }
        return prev;
      }, {} as CompletedPaperwork);
  const mappedQuestions = completedPaperwork['insurance-carrier-2']
    ? questions
    : questions.filter((item) => !item.id.endsWith('-2'));

  const requiredResponsesExist = areAllRequiredQuestionsComplete(mappedCompletedPaperwork, mappedQuestions);

  const noInsurance = completedPaperwork['payment-option'] === 'Self-pay';

  return noInsurance || requiredResponsesExist;
}

function isPhotoIdComplete(questions: Question[], fileURLs: FileURLs): boolean {
  return questions.every((question) => {
    return valueExists(fileURLs[question.id]?.z3Url);
  });
}

export function isPaperworkPageComplete(
  completedPaperwork: CompletedPaperwork,
  paperworkPage: PaperworkPage,
  fileURLs?: FileURLs
): boolean {
  const questions = paperworkPage.questions
    .filter((itemTemp) => itemTemp.type !== 'Description' && itemTemp.type !== 'Header 3')
    // todo update this so we don't cast type
    .filter((itemTemp) => checkEnable(itemTemp as any as FormInputType, completedPaperwork));

  switch (paperworkPage.slug) {
    case 'contact-information':
      return isContactInformationComplete(completedPaperwork);
    case 'patient-details':
      return areAllRequiredQuestionsComplete(completedPaperwork, questions);
    case 'payment-option':
      return isPaymentOptionComplete(completedPaperwork, questions);
    case 'responsible-party':
      return areAllRequiredQuestionsComplete(completedPaperwork, questions);
    case 'photo-id':
      return !!fileURLs && isPhotoIdComplete(questions, fileURLs);
    case 'consent-forms':
      return areAllQuestionsComplete(completedPaperwork, questions);
    case 'additional':
      return areAllQuestionsComplete(completedPaperwork, questions);
    case 'primary-care-physician':
      return areAllQuestionsComplete(completedPaperwork, questions);
    case 'get-ready-for-the-visit':
      return areAllRequiredQuestionsComplete(completedPaperwork, questions);
    case 'person-accompanying-the-minor-patient':
      if (completedPaperwork['get-ready-for-the-visit-filling-out-as'] === 'I am the patient') {
        return true;
      } else {
        return areAllQuestionsComplete(completedPaperwork, questions);
      }
    case 'patient-condition':
      return areAllRequiredQuestionsComplete(completedPaperwork, questions);
    case SCHOOL_WORK_NOTE:
      return areAllRequiredQuestionsComplete(completedPaperwork, questions);
    case 'current-medications':
      return areAllQuestionsComplete(completedPaperwork, questions);
    case 'allergies':
      return areAllQuestionsComplete(completedPaperwork, questions);
    case 'medical-history':
      return areAllQuestionsComplete(completedPaperwork, questions);
    case 'surgical-history':
      return areAllQuestionsComplete(completedPaperwork, questions);
    case 'invite-participant':
      return areAllRequiredQuestionsComplete(completedPaperwork, questions);
    default:
      throw new Error('Unknown paperwork page: ' + (paperworkPage?.reviewPageName || paperworkPage.page));
  }
}

export function isPaperworkComplete(
  completedPaperwork: CompletedPaperwork,
  paperworkPages: PaperworkPage[],
  fileURLs?: FileURLs
): boolean {
  return paperworkPages.every((page) => {
    return isPaperworkPageComplete(completedPaperwork, page, fileURLs);
  });
}
