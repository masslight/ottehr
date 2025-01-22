import { Select, MenuItem, InputLabel, FormControl, FormHelperText } from '@mui/material';
import { UserProvidedAnswer, UserProvidedAnswerType } from './SampleCollection';
import { useState } from 'react';

interface ListQuestionProps {
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

export const AOEListQuestion: React.FC<ListQuestionProps> = (props) => {
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

  const [wasFocused, setWasFocused] = useState(false);

  const isValidAnswer = (answer: UserProvidedAnswerType): boolean => {
    return answerRequired ? answer !== undefined && answer !== '' : true;
  };

  const isError = answerRequired && (wasFocused || submitAttempted) && !isValidAnswer(userProvidedAnswer.answer);

  const labelId = `select-${questionCode}-label`;
  return (
    <FormControl fullWidth required={answerRequired} error={isError}>
      <InputLabel id={labelId}>{question}</InputLabel>
      <Select
        labelId={labelId}
        id={`select-${questionCode}`}
        label={question}
        value={userProvidedAnswer.answer ?? ''}
        onChange={(event) => {
          const answer = event.target.value as string;
          onChange(answer, isValidAnswer(answer));
        }}
        onBlur={() => setWasFocused(true)}
        error={isError}
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
