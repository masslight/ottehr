import { TextField } from '@mui/material';
import { Extension } from 'fhir/r4b';
import React from 'react';
import { ControllerRenderProps, FieldValues, useFormContext } from 'react-hook-form';
import InputMask from '../../../components/InputMask';

interface NumberQuestionProps {
  questionText: string;
  linkId: string;
  extension: Extension[];
  required: boolean;
  isReadOnly?: boolean;
  idString: string;
  field: ControllerRenderProps<FieldValues, string>;
}

export const AOENumberQuestion: React.FC<NumberQuestionProps> = (props) => {
  const {
    formState: { errors },
  } = useFormContext();

  // Note: the extension will tell you the necessary number validation. See Oystehr docs for full explanation
  const { questionText, linkId, extension, required, isReadOnly, idString, field } = props;

  // splitting out the RHF passed ref here so it gets passed correctly to the styled component
  const { ref: fieldRef, ...otherField } = field;

  const numberType = extension.find(
    (extensionTemp) =>
      extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/formatted-input-requirement'
  )?.valueString;
  if (!numberType) {
    throw new Error('numberType is not defined');
  }
  const maxNumber = +numberType.replaceAll('#', '9'); // replace #s with 9s, example ###.## -> 999.99
  if (!maxNumber) {
    throw new Error('maxNumber is not a number');
  }
  // if numberType is ###.## then `decimals` will be 2
  let decimals = null;
  if (numberType?.includes('.')) {
    decimals = numberType?.split('.')[1].length;
  }
  return (
    <TextField
      type="text"
      placeholder={numberType.replace(/#/g, '0')}
      {...otherField}
      inputRef={fieldRef}
      id={idString}
      label={questionText}
      sx={{ width: '100%' }}
      size="medium"
      required={required}
      error={!!errors[linkId]}
      InputProps={{
        inputComponent: InputMask as any,
        inputProps: {
          mask: Number,
          radix: '.',
          min: -maxNumber,
          max: maxNumber,
          padFractionalZeros: true,
          scale: decimals,
          // step: decimals ? `0.${'0'.padStart(decimals - 1, '0')}1` : null,
          readOnly: isReadOnly,
        },
      }}
    />
  );
};
