import { useCallback } from 'react';
import { UseFormSetValue } from 'react-hook-form';
import { useCreditCardStore } from '../stores/useCreditCardStore';

interface UseCreditCardSaveParams {
  setValue: UseFormSetValue<any>;
}

interface UseCreditCardSaveReturn {
  isSavingCard: boolean;
  handleCardSave: (options?: { skipValidation?: boolean }) => Promise<{ shouldContinue: boolean }>;
}

export const useCreditCardSave = ({ setValue }: UseCreditCardSaveParams): UseCreditCardSaveReturn => {
  const isSavingCard = useCreditCardStore((state) => state.isSavingCard);
  const getCardState = useCreditCardStore((state) => state.getCardState);
  const saveCard = useCreditCardStore((state) => state.saveCard);
  const setIsSavingCard = useCreditCardStore((state) => state.setIsSavingCard);
  const setCardSaveError = useCreditCardStore((state) => state.setCardSaveError);
  const setShowCardErrorDialog = useCreditCardStore((state) => state.setShowCardErrorDialog);
  const isCreditCardRequired = useCreditCardStore((state) => state.isCreditCardRequired);
  const creditCardFieldValue = useCreditCardStore((state) => state.creditCardFieldValue);

  const handleCardSave = useCallback(
    async ({ skipValidation = false }: { skipValidation?: boolean } = {}): Promise<{ shouldContinue: boolean }> => {
      if (skipValidation && !isCreditCardRequired) {
        return { shouldContinue: true };
      }

      const cardState = getCardState();

      if (cardState?.error) {
        setCardSaveError(cardState.error.message);
        setShowCardErrorDialog(true);
        return { shouldContinue: false };
      }

      if (cardState?.complete) {
        setIsSavingCard(true);
        const saveResult = await saveCard();
        setIsSavingCard(false);

        if (!saveResult?.success && saveResult?.error) {
          setCardSaveError(saveResult.error);
          setShowCardErrorDialog(true);
          return { shouldContinue: false };
        }

        if (saveResult?.success) {
          setValue('valid-card-on-file', { valueBoolean: true }, { shouldValidate: true });

          const { onCreditCardFieldChange } = useCreditCardStore.getState();

          if (onCreditCardFieldChange) {
            onCreditCardFieldChange({ target: { value: true } });
          }
        }
      }

      if (!cardState?.complete && isCreditCardRequired && creditCardFieldValue !== true) {
        return { shouldContinue: false };
      }

      return { shouldContinue: true };
    },
    [
      setValue,
      setCardSaveError,
      setShowCardErrorDialog,
      setIsSavingCard,
      getCardState,
      saveCard,
      isCreditCardRequired,
      creditCardFieldValue,
    ]
  );

  return {
    isSavingCard,
    handleCardSave,
  };
};
