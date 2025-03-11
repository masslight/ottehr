import { AOEListQuestion } from './AOEListQuestion';
import { AOEMultiSelectListQuestion } from './AOEMultiSelectListQuestion';
import { AOEFreeTextQuestion } from './AOEFreeTextQuestion';
import { AOEQuestionWithAnswer, UserProvidedAnswerType } from './SampleCollection';
import { AOEDateQuestion } from './AOEDateQuestion';
import { Grid } from '@mui/material';
<<<<<<< Updated upstream

interface AOEQuestionProps {
  question: AOEQuestionWithAnswer;
  onChange: (answer: UserProvidedAnswerType, isValid: boolean) => void;
  submitAttempted: boolean;
=======
import { AOENumberQuestion } from './AOENumberQuestion';
import { AOEYesNoQuestion } from './AOEYesNoQuestion';
import { FormControl } from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';
import { QuestionnaireItem } from 'fhir/r4b';

interface AOEQuestionProps {
  question: QuestionnaireItem;
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
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
=======
  if (!text) {
    throw new Error('question text is not defined');
  }

  return (
    // Athena TODO: consider Stack instead of grid...
    <Grid item xs={12}>
      <Controller
        name={linkId}
        control={control}
        defaultValue={defaultValue}
        render={({ field }) => (
          <>
            <FormControl fullWidth required={required} error={!!errors[linkId]}>
              {type === 'choice' && answerOption && extension === undefined && (
                <AOEListQuestion
                  questionText={text}
                  linkId={linkId}
                  answerOption={answerOption}
                  required={required || false}
                  field={field}
                />
              )}
              {type === 'choice' &&
                answerOption &&
                extension?.some((ext) => ext.valueString === 'multi-select list') && (
                  <AOEMultiSelectListQuestion
                    questionText={text}
                    linkId={linkId}
                    answerOption={answerOption}
                    required={required || false}
                    field={field}
                  />
                )}
              {type === 'text' && (
                <AOEFreeTextQuestion questionText={text} linkId={linkId} required={required || false} />
              )}
              {type === 'date' && extension && (
                <AOEDateQuestion
                  questionText={text}
                  linkId={linkId}
                  extension={extension}
                  required={required || false}
                  field={field}
                />
              )}
              {type === 'integer' && extension && (
                <AOENumberQuestion
                  questionText={text}
                  linkId={linkId}
                  extension={extension}
                  required={required || false}
                  idString={`integer-${linkId}`}
                  onKeyDown={(event) => {
                    if (event.key === '.' || event.key === 'e') {
                      event.preventDefault();
                      return false;
                    }
                    return true;
                  }}
                  field={field}
                />
              )}
              {type === 'decimal' && extension && (
                <AOENumberQuestion
                  questionText={text}
                  linkId={linkId}
                  extension={extension}
                  required={required || false}
                  idString={`decimal-${linkId}`}
                  onKeyDown={(event) => {
                    if (event.key === 'e') {
                      event.preventDefault();
                      return false;
                    }
                    return true;
                  }}
                  field={field}
                />
              )}
              {type === 'boolean' && (
                <AOEYesNoQuestion questionText={text} linkId={linkId} required={required || false} field={field} />
              )}
              {/* {!!errors[questionText] && <FormHelperText>{errors[questionText]}</FormHelperText>} */}
            </FormControl>
          </>
        )}
      />
>>>>>>> Stashed changes
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
