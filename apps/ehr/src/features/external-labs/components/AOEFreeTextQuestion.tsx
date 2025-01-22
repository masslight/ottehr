import { TextField, FormControl, FormHelperText } from '@mui/material';
import { UserProvidedAnswer, UserProvidedAnswerType } from './SampleCollection';
import { useState } from 'react';

interface FreeTextQuestionProps {
  questionCode: string;
  originalQuestionCode: string;
  question: string;
  answerRequired: boolean;
  userProvidedAnswer: UserProvidedAnswer;
  onChange: (answer: UserProvidedAnswerType, isValid: boolean) => void;
  submitAttempted: boolean;
}

export const AOEFreeTextQuestion: React.FC<FreeTextQuestionProps> = (props) => {
  // single select dropdown
  const { questionCode, question, answerRequired, userProvidedAnswer, onChange, submitAttempted } = props;

  const [wasFocused, setWasFocused] = useState(false);

  const isValidAnswer = (answer: UserProvidedAnswerType): boolean => {
    return answerRequired ? answer !== undefined && answer !== '' : true;
  };
  // when the user value comes in, it's undefined, but that isn't an error state on first render. however it is an error state if they attempted submit and it's still undefined
  // when a user types a value and then clears the field, it's an empty str
  // should also error if a user clicks into it, types nothing, and then unfocuses
  const isError = answerRequired && (wasFocused || submitAttempted) && !isValidAnswer(userProvidedAnswer.answer);

  return (
    <FormControl fullWidth error={isError}>
      <TextField
        id={`free-text-${questionCode}`}
        label={question}
        value={userProvidedAnswer.answer ?? ''}
        onChange={(event) => {
          const answer = event.target.value as string;
          onChange(answer, isValidAnswer(answer));
        }}
        onBlur={() => setWasFocused(true)}
        sx={{ width: '100%' }}
        required={answerRequired}
        error={isError}
      />
      {isError && <FormHelperText>Required</FormHelperText>}
    </FormControl>
  );
};
