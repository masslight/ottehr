import { checkEnable, FileURLs, PaperworkPage, Question, QuestionnaireDataType } from 'utils';
import { FormInputType } from '../types';

interface CompletedPaperwork {
  [fieldName: string]: any;
}

function valueExists(value: any): boolean {
  return value !== undefined && value !== '';
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

function isPatientDetailsComplete(completedPaperwork: CompletedPaperwork, questions: Question[]): boolean {
  return questions
    .filter((question) => {
      return question.required;
    })
    .every((question) => {
      return valueExists(completedPaperwork[question.id]);
    });
}

function isPaymentOptionComplete(completedPaperwork: CompletedPaperwork, questions: Question[]): boolean {
  const requiredResponsesExist = questions
    .filter((question) => {
      return question.required;
    })
    .every((question) => {
      return valueExists(completedPaperwork[question.id]);
    });

  const noInsurance = completedPaperwork['payment-option'] === 'I will pay without insurance';

  return noInsurance || requiredResponsesExist;
}

function isResponsiblePartyComplete(completedPaperwork: CompletedPaperwork, questions: Question[]): boolean {
  return questions
    .filter((question) => {
      return question.required;
    })
    .every((question) => {
      return valueExists(completedPaperwork[question.id]);
    });
}

function isConsentFormsComplete(completedPaperwork: CompletedPaperwork, questions: Question[]): boolean {
  return questions.every((question) => {
    return valueExists(completedPaperwork[question.id]);
  });
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
      return isPatientDetailsComplete(completedPaperwork, questions);
    case 'payment-option':
      return isPaymentOptionComplete(completedPaperwork, questions);
    case 'responsible-party':
      return isResponsiblePartyComplete(completedPaperwork, questions);
    case 'photo-id':
      return !!fileURLs && valueExists(fileURLs['photo-id-front']?.z3Url);
    case 'consent-forms':
      return isConsentFormsComplete(completedPaperwork, questions);
    default:
      throw new Error('Unknown paperwork page: ' + (paperworkPage?.reviewPageName || paperworkPage.page));
  }
}

export type PaperworkType = 'text' | 'email' | 'tel' | 'number';
export function getUCInputType(dataType: QuestionnaireDataType | undefined): PaperworkType {
  switch (dataType) {
    case 'Email':
      return 'email';
    case 'Phone Number':
      return 'tel';
    default:
      return 'text';
  }
}
