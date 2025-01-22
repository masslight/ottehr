import { AOEListQuestion } from './AOEListQuestion';
import { AOEMultiSelectListQuestion } from './AOEMultiSelectListQuestion';
import { AOEFreeTextQuestion } from './AOEFreeTextQuestion';
import { AOEQuestionWithAnswer, UserProvidedAnswerType } from './SampleCollection';
import { AOEDateQuestion } from './AOEDateQuestion';
import { Grid } from '@mui/material';

interface AOEQuestionProps {
  question: AOEQuestionWithAnswer;
  onChange: (answer: UserProvidedAnswerType, isValid: boolean) => void;
  submitAttempted: boolean;
}

export const AOEQuestion: React.FC<AOEQuestionProps> = (questionProps) => {
  const { question: questionProp, onChange, submitAttempted } = questionProps;
  const {
    questionCode,
    originalQuestionCode,
    question,
    answers,
    verboseAnswers,
    questionType,
    answerRequired,
    userProvidedAnswer,
  } = questionProp;

  // Based on the LabCorp compendium, these are the possible AOE question types
  // List', 'Free Text', 'Formatted Input', 'Multi-Select List'
  return (
    // Athena TODO: consider Stack instead of grid...
    <Grid item xs={12}>
      {questionType === 'List' && answers && verboseAnswers && (
        <AOEListQuestion
          questionCode={questionCode}
          originalQuestionCode={originalQuestionCode}
          question={question}
          answers={answers}
          verboseAnswers={verboseAnswers}
          answerRequired={answerRequired}
          userProvidedAnswer={userProvidedAnswer}
          onChange={onChange}
          submitAttempted={submitAttempted}
        />
      )}
      {questionType === 'Multi-Select List' && answers && verboseAnswers && (
        <AOEMultiSelectListQuestion
          questionCode={questionCode}
          originalQuestionCode={originalQuestionCode}
          question={question}
          answers={answers}
          verboseAnswers={verboseAnswers}
          answerRequired={answerRequired}
          userProvidedAnswer={userProvidedAnswer}
          onChange={onChange}
          submitAttempted={submitAttempted}
        />
      )}
      {questionType === 'Free Text' && (
        <AOEFreeTextQuestion
          questionCode={questionCode}
          originalQuestionCode={originalQuestionCode}
          question={question}
          answerRequired={answerRequired}
          userProvidedAnswer={userProvidedAnswer}
          onChange={onChange}
          submitAttempted={submitAttempted}
        />
      )}
      {questionType === 'Formatted Input' && (
        <AOEDateQuestion
          questionCode={questionCode}
          originalQuestionCode={originalQuestionCode}
          question={question}
          answerRequired={answerRequired}
          userProvidedAnswer={userProvidedAnswer}
          onChange={onChange}
          submitAttempted={submitAttempted}
        />
      )}
    </Grid>
  );
};

// Example AOEs from Lab Corp compendium
// {
//   questionCode: 'fsmr6TlrOyzeiT8nDITdWw',
//   originalQuestionCode: 'FSTING',
//   question: 'FASTING',
//   answers: ['Y', 'N'],
//   verboseAnswers: ['Yes', 'No'],
//   questionType: 'List',
//   answerRequired: false,
// },
// {
//   questionCode: '2eGvXUd0Y0eau69fOkRbOg',
//   originalQuestionCode: 'COLVOL',
//   question: 'URINE VOLUME (MILLILITERS)',
//   questionType: 'Free Text',
//   answerRequired: false,
// },
// {
//   questionCode: 'X6Lyv33OWonjBAQEnggqFA',
//   originalQuestionCode: 'CYTOPI',
//   question: 'OTHER PATIENT INFORMATION',
//   answers: [
//     'PREGNANT',
//     'POST-PART',
//     'LACTATING',
//     'MENOPAUSAL',
//     'OC',
//     'ESTRO-RX',
//     'PMP-BLEEDING',
//     'IUD',
//     'ALL-OTHER-PAT',
//   ],
//   verboseAnswers: [
//     'PREGNANT',
//     'POST-PART',
//     'LACTATING',
//     'MENOPAUSAL',
//     'ORAL CONTRACEPTIVES',
//     'ESTRO-RX',
//     'PMP-BLEEDING',
//     'IUD',
//     'ALL-OTHER-PAT',
//   ],
//   questionType: 'Multi-Select List',
//   answerRequired: false,
// },
// {
//   questionCode: 'iLS4T4HJXIlvECCvX-R8Tw',
//   originalQuestionCode: 'GESADT',
//   question: 'GESTATIONAL AGE DATE OF CALCULATION',
//   answers: ['YYYYMMDD'],
//   questionType: 'Formatted Input',
//   answerRequired: false,
// },
