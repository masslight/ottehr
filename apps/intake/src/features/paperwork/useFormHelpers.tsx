import { DateTime } from 'luxon';
import { useCallback, useMemo } from 'react';
import { FieldValues, RefCallBack, useFormContext, useFormState } from 'react-hook-form';
import {
  DOB_DATE_FORMAT,
  IntakeQuestionnaireItem,
  pickFirstValueFromAnswerItem,
  pickValueAsStringListFromAnswerItem,
} from 'utils';
import { usePaperworkContext } from './context';

interface PaperworkFormHelpers {
  value: any;
  inputRef: RefCallBack;
  onChange: (e: any) => void;
}

interface UserPaperworkFieldIdInput {
  item: IntakeQuestionnaireItem;
  parentItem?: IntakeQuestionnaireItem;
  parentFieldId?: string;
}
interface UsePaperworkFormHelpersInput extends UserPaperworkFieldIdInput {
  renderValue: any;
  fieldId: string;
  renderOnChange: (e: any) => void;
}

const stringValTypes = ['text', 'choice', 'open-choice', 'string'];

const isReferenceValueTypeItem = (item: IntakeQuestionnaireItem): boolean => {
  return item.answerLoadingOptions?.answerSource !== undefined;
};

const isStringValueTypeItem = (item: IntakeQuestionnaireItem): boolean => {
  return stringValTypes.includes(item.type) && !isReferenceValueTypeItem(item);
};

// todo here: take an existing fieldIdBase param to allow arbitrarily deep nesting of groups within groups
export const getPaperworkFieldId = (input: UserPaperworkFieldIdInput): string => {
  const { item, parentItem, parentFieldId } = input;
  if (parentItem === undefined) {
    return item.linkId;
  }
  const idx = Math.max(
    (parentItem.item ?? [])
      .filter((i) => i.type !== 'display' && !i.readOnly)
      .findIndex((it) => {
        return it.linkId === item.linkId;
      }),
    0
  );
  return `${parentFieldId ?? parentItem.linkId}.item.${idx}`;
};

export function usePaperworkFormHelpers(input: UsePaperworkFormHelpersInput): PaperworkFormHelpers {
  const { item, renderValue, fieldId: fieldIdBase, renderOnChange } = input;
  // console.log('renderValue', renderValue, item.linkId);
  const { register, setValue } = useFormContext();
  const memoizedItems = useMemo(() => {
    const value = (() => {
      if (isStringValueTypeItem(item)) {
        if (item.acceptsMultipleAnswers) {
          return pickValueAsStringListFromAnswerItem(renderValue);
        } else {
          return pickFirstValueFromAnswerItem(renderValue) ?? '';
        }
      }
      if (isReferenceValueTypeItem(item)) {
        if (item.acceptsMultipleAnswers) {
          return pickValueAsStringListFromAnswerItem(renderValue, 'reference');
        } else {
          return pickFirstValueFromAnswerItem(renderValue, 'reference') ?? null;
        }
      }
      if (item.type === 'boolean') {
        return pickFirstValueFromAnswerItem(renderValue, 'boolean') ?? false;
      }
      if (item.type === 'attachment') {
        return pickFirstValueFromAnswerItem(renderValue, 'attachment') ?? undefined;
      }
      if (item.type === 'date') {
        return pickFirstValueFromAnswerItem(renderValue) ?? '';
      }
      return undefined;
    })();

    const { inputRef } = (() => {
      let valueTypeString = isStringValueTypeItem(item) ? 'valueString' : '';
      if (isReferenceValueTypeItem(item)) {
        valueTypeString = 'valueReference';
      }
      if (item.type === 'boolean') {
        valueTypeString = 'valueBoolean';
      }
      if (item.type === 'attachment') {
        valueTypeString = 'valueAttachment';
      }
      const fieldId = item.acceptsMultipleAnswers
        ? `${fieldIdBase}.answer`
        : `${fieldIdBase}.answer.0.${valueTypeString}`;
      // console.log('registering', fieldId);
      return { inputRef: register(fieldId).ref };
    })();
    return { value, inputRef };
  }, [item, renderValue, fieldIdBase, register]);

  const onChange = useCallback(
    (e: any): void => {
      // todo: this is temporarily hardcoded. want to work this into the questionnaire schema.
      if (item.linkId === 'payment-option' && e.target.value !== 'I have insurance') {
        setValue('display-secondary-insurance.answer.0.valueBoolean', false);
      }
      const base = { linkId: item.linkId };
      if (isStringValueTypeItem(item)) {
        if (item.acceptsMultipleAnswers) {
          const answer = e.target.value?.map((val: string) => {
            const valueString = val?.trimStart();
            return { valueString };
          });
          return renderOnChange({ ...base, answer });
        }
        let valueString = e.target.value.trimStart();
        // restrict user from ever entering non-numeric digits
        if (item.dataType === 'ZIP') {
          valueString = valueString.replace(/[^0-9]/g, '');
        }
        return renderOnChange({ ...base, answer: [{ valueString }] });
      } else if (isReferenceValueTypeItem(item)) {
        if (item.acceptsMultipleAnswers) {
          const answer = e.target.value;
          return renderOnChange({ ...base, answer });
        } else {
          const valueReference = e.target.value;
          if (valueReference?.reference) {
            return renderOnChange({ ...base, answer: [{ valueReference }] });
          } else {
            return renderOnChange({ ...base, answer: [] });
          }
        }
      } else if (item.type === 'boolean') {
        return renderOnChange({ ...base, answer: [{ valueBoolean: !(memoizedItems.value ?? false) }] });
      } else if (item.type === 'attachment') {
        // the file upload component will give us the attachment directly; de don't pull it from an event
        return renderOnChange({ ...base, answer: [{ valueAttachment: e }] });
      } else if (item.type === 'date' && item.dataType === 'DOB') {
        const luxonDate = DateTime.fromObject(e?.c);
        if (luxonDate.isValid) {
          const dateString = luxonDate.toFormat(DOB_DATE_FORMAT);
          return renderOnChange({ ...base, answer: [{ valueString: dateString }] });
        }
      }
    },
    [item, setValue, renderOnChange, memoizedItems.value]
  );

  return { ...memoizedItems, onChange };
}

// this is a somewhat hacky way of bubbling up errors from deeply nested fields to be displayed on the root field's error label
const recursiveFindError = (errorObj: any): string => {
  if (!errorObj) {
    return '';
  }
  let error = errorObj?.message;
  // console.log('error recurs', error);

  if (!error && errorObj && Object.keys(errorObj).length > 0) {
    // one of the valueType fields has an error
    Object.values(errorObj).forEach((obj) => {
      const newError = recursiveFindError(obj);
      if (newError) {
        error = newError;
      }
    });
  }
  return typeof error === 'string' ? error : '';
};
interface FieldError {
  hasError: boolean;
  errorMessage?: string;
}
export const useFieldError = (fieldId: string): FieldError => {
  const { errors } = useFormState();

  const path = fieldId.split('.');

  const error = path.reduce(
    (accum, cur) => {
      return accum?.[cur];
    },
    { ...errors } as any
  );

  return {
    hasError: error !== undefined,
    errorMessage: error?.message ?? recursiveFindError(errors?.[fieldId]),
  };
};

export interface QRState {
  // all fields/values currently maintained in form state by react-hook-form
  formValues: FieldValues;

  // the current state of the entire QR, including what has been persisted so far
  // and what is actively being managed in state by react-hook-form
  allFields: FieldValues;
}

// all fields/values currently maintained in form state by react-hook-form
export const useFormValues: () => FieldValues = () => {
  const { watch, getValues } = useFormContext();
  const watchedFields = watch();
  return useMemo(() => {
    return { ...getValues(), ...watchedFields };
  }, [getValues, watchedFields]);
};

// the current state of the entire QR, including what has been persisted so far
// and what is actively being managed in state by react-hook-form
export const useQRState: () => QRState = () => {
  const formValues = useFormValues();
  const { paperwork } = usePaperworkContext();
  const flatPaperwork = paperwork.flatMap((page) => page.item ?? []);
  const paperworkObj = flatPaperwork.reduce((accum, curr) => {
    accum[curr.linkId] = { ...curr };
    return accum;
  }, {} as any);
  // console.log('form values', JSON.stringify(formValues));
  return { formValues, allFields: { ...paperworkObj, ...formValues } };
};
