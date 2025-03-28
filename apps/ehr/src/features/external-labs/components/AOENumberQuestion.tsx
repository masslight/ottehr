import { ControllerRenderProps, FieldValues, useFormContext } from 'react-hook-form';
import { NumberInput } from '../../../telemed/features/appointment/ExamTab/components/NumberInput';
import React, { KeyboardEvent } from 'react';
import { Extension } from 'fhir/r4b';

interface NumberQuestionProps {
  questionText: string;
  linkId: string;
  extension: Extension[];
  required: boolean;
  idString: string;
  onKeyDown(event: KeyboardEvent<HTMLDivElement>): boolean;
  field: ControllerRenderProps<FieldValues, string>;
}

export const AOENumberQuestion: React.FC<NumberQuestionProps> = (props) => {
  const {
    formState: { errors },
  } = useFormContext();

  // Note: the extension will tell you the necessary number validation. See DORN docs for full explanation
  const { questionText, linkId, extension: _, required, idString, onKeyDown, field } = props;

  // splitting out the RHF passed ref here so it gets passed correctly to the styled component
  const { ref: fieldRef, ...otherField } = field;

  return (
    <NumberInput
      {...otherField}
      inputRef={fieldRef}
      id={idString}
      label={questionText}
      // TODO: in future might consider taking step as a prop so arrow keys will work for accessibility for decimals, e.g. step=0.1
      // inputProps={{
      //   step: 1,
      // }}
      sx={{ width: '100%' }}
      size="medium"
      required={required}
      error={!!errors[linkId]}
      onKeyDown={onKeyDown}
    />
  );
};
