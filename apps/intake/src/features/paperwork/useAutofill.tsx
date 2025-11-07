import { QuestionnaireResponseItem } from 'fhir/r4b';
import { useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { IntakeQuestionnaireItem } from 'utils';
import { usePaperworkContext } from './context';
import { getPaperworkFieldId, useQRState } from './useFormHelpers';
import { getItemDisplayStrategy } from './useSelectItems';

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
  const { questionnaireResponse } = usePaperworkContext();
  // console.log('all fields', allFields);
  const [replacedValues, setReplacedValues] = useState<string[]>([]);

  const itemsToFill = useMemo(() => {
    return questionnaireItems.filter((qi) => {
      if (!allFields) {
        return false;
      }
      // console.log('allFields use items to auto fill', allFields);
      const displayStrategy = getItemDisplayStrategy(qi, questionnaireItems, allFields, questionnaireResponse);
      if (displayStrategy === 'hidden' || displayStrategy === 'protected') {
        return qi.autofillFromWhenDisabled !== undefined;
      }
      return false;
    });
  }, [allFields, questionnaireItems, questionnaireResponse]);
  const { getValues, setValue } = useFormContext();
  return useEffect(() => {
    // console.log('autofill effect fired', itemsToFill, Object.entries(replacedValues.current));
    if (itemsToFill.length === 0) {
      replacedValues.forEach((key) => {
        const pathNodes = key.split('.');
        const currentVal = pathNodes.reduce((accum, current) => {
          if (accum === undefined) {
            return undefined;
          }
          const newVal = (accum as any)[current];
          if (newVal) {
            return newVal;
          }
          return (accum.item ?? []).find((i: any) => i?.linkId && i.linkId === current);
        }, allFields as any);
        // console.log('autofill currentVal', currentVal);
        // const currentVal = allFields[key];
        // console.log('new val, current val', newVal, currentVal);
        if (currentVal?.answer !== undefined || currentVal?.item !== undefined) {
          // console.log('autofill unsetting a value', val || undefined);
          setValue(key, { linkId: key });
          setReplacedValues((rp) => {
            return rp.filter((val) => val !== key);
          });
        }
      });
      return;
    }
    let shouldUpdateValue = false;
    // for each item that needs to be auto filled, get the source value and set it into the form state
    itemsToFill.forEach((item) => {
      const autofillSource = item.autofillFromWhenDisabled; // the name of the field that's the source of the auto fill value
      if (!autofillSource) {
        return;
      }
      const autofillValue = allFields[autofillSource ?? ''];
      if (!autofillValue) {
        return;
      }

      // call site 1: ignore result when no parent item
      const id = parentItem ? getPaperworkFieldId({ parentItem, item }) : item.linkId;
      const currentValue = getValues(id) || makeEmptyResponseItem(item);

      const autoFilled = autoFill(autofillValue, item);
      // console.log('autoFilled', autoFilled);
      shouldUpdateValue = // the comparison between autofillValue and currentValue is necessary to avoid an infinite render loop
        autofillSource && autofillValue && typeof autofillValue === 'object' && !objectsEqual(autoFilled, currentValue);
      // console.log('should update', shouldUpdateValue, item.linkId);

      if (shouldUpdateValue) {
        if (autoFilled.answer && autoFilled.answer.length > 0) {
          setReplacedValues((rp) => {
            return [...rp, id];
          });
          setValue(id, autoFilled, { shouldValidate: true });
        }
      }
    });
    // replace previously autoFilled values
  }, [allFields, setValue, itemsToFill, formValues, parentItem, getValues, fieldId, replacedValues]);
};
