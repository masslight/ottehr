import { ControllerRenderProps, FieldValues, useFormContext } from 'react-hook-form';
import React from 'react';
import { Extension } from 'fhir/r4b';
import InputMask from '../../../components/InputMask';
import { TextField } from '@mui/material';

interface NumberQuestionProps {
  questionText: string;
  linkId: string;
  extension: Extension[];
  required: boolean;
  idString: string;
  field: ControllerRenderProps<FieldValues, string>;
}

export const AOENumberQuestion: React.FC<NumberQuestionProps> = (props) => {
  const {
    formState: { errors },
  } = useFormContext();

  // Note: the extension will tell you the necessary number validation. See DORN docs for full explanation
  const { questionText, linkId, extension, required, idString, field } = props;

  // splitting out the RHF passed ref here so it gets passed correctly to the styled component
  const { ref: fieldRef, ...otherField } = field;

  const numberType = extension.find(
    (extensionTemp) =>
      extensionTemp.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/formatted-input-requirement'
  )?.valueString;
  // if numberType is ###.## then `decimals` will be 2
  let decimals = null;
  if (numberType?.includes('.')) {
    decimals = numberType?.split('.')[1].length;
  }

  return (
    <TextField
      type="number"
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
          mask: numberType?.replaceAll('#', '0'),
          step: decimals ? `0.${'0'.padStart(decimals - 1, '0')}1` : null,
        },
      }}
    />
  );
};
