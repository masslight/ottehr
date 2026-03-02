import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { AddCreditCardFormHandle } from 'ui-components';
import { useCreditCardStore } from '../stores/useCreditCardStore';

interface UseCreditCardContextParams {
  fieldId: string;
  onChange: (event: { target: { value: boolean } }) => void;
  required: boolean;
  value?: boolean;
  hasSavedCards?: boolean;
}

export const useCreditCardContext = ({
  fieldId,
  onChange,
  required,
  value,
  hasSavedCards = false,
}: UseCreditCardContextParams): RefObject<AddCreditCardFormHandle> => {
  const cardFormRef = useRef<AddCreditCardFormHandle>(null);
  const { clearErrors } = useFormContext();

  useEffect(() => {
    useCreditCardStore.getState().initializeContext({
      cardFormRef,
      fieldId,
      onChange: (event) => onChange(event),
      required,
      value,
      clearErrors: (id) => clearErrors(id),
      hasSavedCards,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId, required, value, hasSavedCards]);

  return cardFormRef;
};
