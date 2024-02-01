import { Question } from 'utils';
import { FieldValues } from 'react-hook-form';
import { FormInputType } from '../../types';

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
