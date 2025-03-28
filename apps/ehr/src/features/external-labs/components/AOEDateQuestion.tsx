import { UserProvidedAnswer, UserProvidedAnswerType } from './SampleCollection';
import { DatePicker, DateValidationError, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
<<<<<<< Updated upstream
import { FormControl, FormHelperText } from '@mui/material';
import { DateTime } from 'luxon';
import { useState } from 'react';

interface DateQuestionProps {
  questionCode: string;
  originalQuestionCode: string;
  question: string;
  // answers: string[]; // This was being used by the dorn api to pass a date format. Based on the LabCorp compendium, it is only ever a format
  answerRequired: boolean;
  userProvidedAnswer: UserProvidedAnswer;
  onChange: (answer: UserProvidedAnswerType, isValid: boolean) => void;
  submitAttempted: boolean;
=======
import { ControllerRenderProps, FieldValues, useFormContext } from 'react-hook-form';
import { Extension } from 'fhir/r4b';

interface DateQuestionProps {
  questionText: string;
  linkId: string;
  extension: Extension[];
  required: boolean;
  field: ControllerRenderProps<FieldValues, string>;
>>>>>>> Stashed changes
}

export const AOEDateQuestion: React.FC<DateQuestionProps> = (props) => {
  // single select dropdown
  const { questionCode, question, answerRequired, userProvidedAnswer, onChange, submitAttempted } = props;

  const [validationError, setValidationError] = useState<DateValidationError | null>(null);
  const [wasChanged, setWasChanged] = useState(false);

  const isValidAnswer = (answer: UserProvidedAnswerType): boolean => {
    return answerRequired ? answer !== undefined && answer instanceof DateTime && answer.isValid : true;
  };

  // TODO: datepicker doesn't make it easy at all to determine if the element was ever focused, so save the behavior of throwing error state
  // if a user clicks in and then clicks out without typing anything for another time
  const isError =
    ((submitAttempted || wasChanged) && !isValidAnswer(userProvidedAnswer.answer)) || validationError !== null;

  return (
    <FormControl fullWidth error={isError}>
      <LocalizationProvider dateAdapter={AdapterLuxon}>
        <DatePicker
          label={question}
          onChange={(newValue) => {
            setWasChanged(true);
            if (newValue) onChange(newValue, isValidAnswer(newValue));
          }}
          onError={(err) => {
            setValidationError(err);
          }}
          format={'MM/dd/yyyy'}
          slotProps={{
            textField: {
              style: { width: '100%' },
              required: answerRequired,
              id: `date-${questionCode}`,
              error: isError,
            },
            actionBar: { actions: ['today'] },
          }}
          disabled={false}
          value={(userProvidedAnswer.answer as DateTime) ?? null}
        />
      </LocalizationProvider>
      {isError && <FormHelperText>Required</FormHelperText>}
    </FormControl>
  );
};
