import { Question } from 'ottehr-utils';
import { FieldValues } from 'react-hook-form';
import { FormInputType, FormInputTypeField, FormInputTypeGroup } from '../../types';
import { ReactElement } from 'react';
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

export function checkEnable(item: FormInputType, values: FieldValues): boolean {
  if (item.enableWhen) {
    const value = values[item.enableWhen.question];
    // console.log(item.name, item.enableWhen.answer, value);
    if (item.enableWhen.operator === '=') {
      const test = value === item.enableWhen.answer;
      // handle validatiation item field
      if (!test) {
        item.hidden = true;
      } else {
        item.hidden = false;
      }
      return test;
    }
  }

  return true;
}

export const filterFormInputFields = (
  formInputFields: FormInputType[],
  values: FieldValues,
  methods: any,
): ReactElement[] => {
  return formInputFields
    .filter((formInput) => checkEnable(formInput, values))
    .filter((formInput) => !formInput.hidden)
    .map((formInput) => {
      if ((formInput as any).fields === undefined) {
        return getFormInputField(formInput as FormInputTypeField, values, methods);
      } else {
        return getFormInputGroup(formInput as FormInputTypeGroup);
      }
    });
};
