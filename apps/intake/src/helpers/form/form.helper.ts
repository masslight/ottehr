import { ReactElement } from 'react';
import { FieldValues } from 'react-hook-form';
import { FormInputType, FormInputTypeField, FormInputTypeGroup, OverrideValues } from 'src/types/form/form-input-type';
import { checkEnable } from 'utils/lib/helpers/paperwork/paperwork';
import { Question } from 'utils/lib/types/data/paperwork.types';
import { getFormInputField, getFormInputGroup } from './getFormInput';

// Checkbox values are returned as 'true' and 'false' instead of true and false respectively.
// This sets them as booleans.
export function formInputStringToBoolean(data: any, questions: Question[]): any {
  for (const questionTemp of questions) {
    if (questionTemp.type !== 'Checkbox') {
      continue;
    }

    for (const responseTemp of Object.keys(data)) {
      if (questionTemp.id === responseTemp) {
        if (data[responseTemp] === 'true') {
          data[responseTemp] = true;
        } else if (data[responseTemp] === 'false') {
          data[responseTemp] = false;
        }
        break;
      }
    }
  }
}

export const filterFormInputFields = (
  formInputFields: FormInputType[],
  values: FieldValues,
  methods: any,
  overrideValues?: OverrideValues
): ReactElement[] => {
  return formInputFields
    .filter((formInput) => checkEnable(formInput, values))
    .filter((formInput) => !formInput.hidden)
    .map((formInput) => {
      if ((formInput as any).fields === undefined) {
        return getFormInputField(formInput as FormInputTypeField, values, methods, overrideValues);
      } else {
        return getFormInputGroup(formInput as FormInputTypeGroup);
      }
    });
};
