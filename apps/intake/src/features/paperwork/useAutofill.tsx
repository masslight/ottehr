import { useMemo, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { IntakeQuestionnaireItem } from 'utils';
import { getItemDisplayStrategy } from './useSelectItems';
import { QuestionnaireResponseItem } from 'fhir/r4b';
import { getPaperworkFieldId, useQRState } from './useFormHelpers';

const objectsEqual = (obj1: any, obj2: any): boolean => {
  const objectOneNoLink = { ...obj1, linkId: undefined };
  const objectTwoNoLink = { ...obj2, linkId: undefined };
  return JSON.stringify(objectOneNoLink) === JSON.stringify(objectTwoNoLink);
};

const autoFill = (from: QuestionnaireResponseItem, to: IntakeQuestionnaireItem): QuestionnaireResponseItem => {
  const { item: fromItem, answer: fromAnswer } = from;
  const { linkId, item: toItem } = to;

  if (fromAnswer) {
    return { linkId, answer: fromAnswer };
  }
  if (!toItem) {
    return { linkId, answer: undefined };
  }
  if (fromItem) {
    if (toItem) {
      return {
        linkId,
        item: fromItem.map((item, index) => {
          return autoFill(item, toItem[index]);
        }),
      };
    } else {
      return { linkId, item: undefined };
    }
  } else {
    return { linkId, item: undefined };
  }
};

const makeEmptyResponseItem = (item: IntakeQuestionnaireItem): QuestionnaireResponseItem => {
  if (!item.item) {
    return {
      linkId: item.linkId,
    };
  }
  return {
    linkId: item.linkId,
    item: (item.item ?? []).map((i) => makeEmptyResponseItem(i)),
  };
};

interface AutofillInputs {
  questionnaireItems: IntakeQuestionnaireItem[];
  fieldId?: string; // an optional path representing where to find this list of items to auto fill within a deeply nested structure
  parentItem?: IntakeQuestionnaireItem; // the immediate parent item for the list of items (should each item to fill have its own parent item?)
}

// note: structuring this as an effect does cause a little "flash" effect when the autoFilled value is removed
// potentially this could be fixed by refactoring so that the setter on the field that triggers the effect also
// sets the values updated within the effect. (potential future enhancement)
export const useAutoFillValues = (input: AutofillInputs): void => {
  const { questionnaireItems, fieldId, parentItem } = input;
  const { formValues, allFields } = useQRState();
  const { getValues, setValue } = useFormContext();

  const visibleItemsToFill = useMemo(() => {
    if (!allFields) return [];

    return questionnaireItems.filter((qi) => {
      if (!allFields) {
        return false;
      }
      // console.log('allFields use items to auto fill', allFields);
      const displayStrategy = getItemDisplayStrategy(qi, questionnaireItems, allFields);
      return displayStrategy === 'enabled' && !!qi.autofillFromWhenDisabled;
    });
  }, [allFields, questionnaireItems]);

  useEffect(() => {
    if (visibleItemsToFill.length === 0) {
      return;
    }

    visibleItemsToFill.forEach((item) => {
      const autofillSource = item.autofillFromWhenDisabled;
      if (!autofillSource) return;

      const sourceValue = allFields[autofillSource];
      if (!sourceValue) return;

      const id = parentItem ? getPaperworkFieldId({ parentItem, item }) : item.linkId;
      const currentValue = getValues(id);

      const autoFilledValue = autoFill(sourceValue, item);

      const isEmptyValue =
        !currentValue || JSON.stringify(currentValue) === JSON.stringify(makeEmptyResponseItem(item));

      const shouldFill = isEmptyValue && !objectsEqual(currentValue, autoFilledValue);

      if (shouldFill) {
        // console.log(`🔄 Auto-filling field [${id}] with value:`, autoFilledValue);
        setValue(id, autoFilledValue, { shouldValidate: true });
      } else {
        // console.log(`⏭ Skipping autofill for [${id}]. Already has value or no change needed.`);
      }
    });
  }, [visibleItemsToFill, allFields, getValues, setValue, parentItem, fieldId, formValues]);
};
