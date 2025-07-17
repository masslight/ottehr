// cSpell:ignore AOEYes
import { Grid } from '@mui/material';
import { FormControl } from '@mui/material';
import { QuestionnaireItem } from 'fhir/r4b';
import { Controller, useFormContext } from 'react-hook-form';
import { LabQuestionnaireResponseItem } from 'utils';
import { AOEDateQuestion } from './AOEDateQuestion';
import { AOEFreeTextQuestion } from './AOEFreeTextQuestion';
import { AOEListQuestion } from './AOEListQuestion';
import { AOEMultiSelectListQuestion } from './AOEMultiSelectListQuestion';
import { AOENumberQuestion } from './AOENumberQuestion';
import { AOEYesNoQuestion } from './AOEYesNoQuestion';

interface AOEQuestionProps {
  question: QuestionnaireItem;
  answer?: LabQuestionnaireResponseItem;
  isReadOnly?: boolean;
}

export const AOEQuestion: React.FC<AOEQuestionProps> = (questionProps) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();

  const { question, answer } = questionProps;
  const { linkId, text, type, required, extension, answerOption } = question;

  const questionIsList = type === 'choice' && answerOption && extension === undefined;
  const questionIsMultiSelectList =
    type === 'choice' && answerOption && extension?.some((ext) => ext.valueString === 'multi-select list');

  let defaultValue = undefined;

  if (questionIsMultiSelectList) {
    if (!answer) {
      defaultValue = [];
    } else {
      defaultValue = answer;
    }
  } else {
    defaultValue = answer?.join(',');
  }

  // keep components in a controlled state
  if ((questionIsList || type === 'text' || type === 'boolean') && defaultValue === undefined) {
    defaultValue = '';
  }

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
              {questionIsList && (
                <AOEListQuestion
                  questionText={text}
                  linkId={linkId}
                  answerOption={answerOption}
                  required={required || false}
                  isReadOnly={questionProps.isReadOnly}
                  field={field}
                />
              )}
              {questionIsMultiSelectList && (
                <AOEMultiSelectListQuestion
                  questionText={text}
                  linkId={linkId}
                  answerOption={answerOption}
                  required={required || false}
                  isReadOnly={questionProps.isReadOnly}
                  field={field}
                />
              )}
              {type === 'text' && (
                <AOEFreeTextQuestion
                  questionText={text}
                  linkId={linkId}
                  required={required || false}
                  isReadOnly={questionProps.isReadOnly}
                  field={field}
                />
              )}
              {type === 'date' && extension && (
                <AOEDateQuestion
                  questionText={text}
                  linkId={linkId}
                  extension={extension}
                  required={required || false}
                  isReadOnly={questionProps.isReadOnly}
                  field={field}
                />
              )}
              {type === 'integer' && extension && (
                <AOENumberQuestion
                  questionText={text}
                  linkId={linkId}
                  extension={extension}
                  required={required || false}
                  isReadOnly={questionProps.isReadOnly}
                  idString={`integer-${linkId}`}
                  field={field}
                />
              )}
              {type === 'decimal' && extension && (
                <AOENumberQuestion
                  questionText={text}
                  linkId={linkId}
                  extension={extension}
                  required={required || false}
                  isReadOnly={questionProps.isReadOnly}
                  idString={`decimal-${linkId}`}
                  field={field}
                />
              )}
              {type === 'boolean' && (
                <AOEYesNoQuestion
                  questionText={text}
                  linkId={linkId}
                  required={required || false}
                  isReadOnly={questionProps.isReadOnly}
                  field={field}
                />
              )}
              {/* {!!errors[questionText] && <FormHelperText>{errors[questionText]}</FormHelperText>} */}
            </FormControl>
          </>
        )}
      />
    </Grid>
  );
};
