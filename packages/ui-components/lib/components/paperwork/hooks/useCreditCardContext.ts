import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { AddCreditCardFormHandle } from '../../AddCreditCardForm';
import { useCreditCardStore } from './useCreditCardStore';

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
  const { clearErrors, setError } = useFormContext();

  useEffect(() => {
    useCreditCardStore.getState().initializeContext({
      cardFormRef,
      fieldId,
      onChange: (event) => onChange(event),
      required,
      value,
      clearErrors: (id) => clearErrors(id),
      setError: (id, message) => setError(id, { type: 'required', message }),
      hasSavedCards,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId, required, value, hasSavedCards]);

  // Reset the module-scoped credit card store when the credit card field unmounts.
  // Without this, stale state (isCreditCardRequired/creditCardFieldValue/setFieldError)
  // leaks into subsequent forms in the same SPA session and silently blocks submit
  // in PagedQuestionnaire's submitHandler -> useCreditCardSave.handleCardSave.
  useEffect(() => {
    return () => {
      useCreditCardStore.getState().reset();
    };
  }, []);

  return cardFormRef;
};
