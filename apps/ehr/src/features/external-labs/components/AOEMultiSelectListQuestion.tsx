import { Select, MenuItem, InputLabel, FormControl, OutlinedInput, Box, Chip, FormHelperText } from '@mui/material';
import { UserProvidedAnswer, UserProvidedAnswerType } from './SampleCollection';
import { useState } from 'react';

interface MultiListQuestionProps {
  questionCode: string;
  originalQuestionCode: string;
  question: string;
  answers: string[];
  verboseAnswers: string[];
  answerRequired: boolean;
  userProvidedAnswer: UserProvidedAnswer;
  onChange: (answer: UserProvidedAnswerType, isValid: boolean) => void;
  submitAttempted: boolean;
}

export const AOEMultiSelectListQuestion: React.FC<MultiListQuestionProps> = (props) => {
  // single select dropdown
  const {
    questionCode,
    question,
    answers,
    verboseAnswers,
    answerRequired,
    userProvidedAnswer,
    onChange,
    submitAttempted,
  } = props;

  const labelId = `multi-select-${questionCode}-label`;
  const [wasFocused, setWasFocused] = useState(false);

  const isValidAnswer = (answer: UserProvidedAnswerType): boolean => {
    return answerRequired ? answer instanceof Array && answer.length !== 0 : true;
  };

  // when the user value comes in, it's undefined, but that isn't an error state on first render. however it is an error state if they attempted submit and it's still undefined
  // when a user types a value and then clears the field, it's an empty str
  // should also error if a user clicks into it, types nothing, and then unfocuses
  const isError = (wasFocused || submitAttempted) && !isValidAnswer(userProvidedAnswer.answer);

  return (
    <FormControl fullWidth required={answerRequired} error={isError}>
      <InputLabel id={labelId}>{question}</InputLabel>
      <Select
        labelId={labelId}
        id={`multi-select-${questionCode}`}
        label={question}
        multiple
        value={(userProvidedAnswer.answer as string[]) ?? []}
        onChange={(event) => {
          const answer = event.target.value as string[];

          onChange(answer, isValidAnswer(answer));
        }}
        onBlur={() => setWasFocused(true)}
        error={isError}
        input={<OutlinedInput id="select-multiple-chip" label={question} />} // the label here has to match the label on the input and select otherwise the label won't size properly
        renderValue={(selected) => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selected?.map((value, idx) => <Chip key={idx} label={value} />)}
          </Box>
        )}
      >
        {verboseAnswers.map((verboseAnswer, idx) => (
          <MenuItem key={idx} value={answers[idx]}>
            {verboseAnswer}
          </MenuItem>
        ))}
      </Select>
      {isError && <FormHelperText>Required</FormHelperText>}
    </FormControl>
  );
};
