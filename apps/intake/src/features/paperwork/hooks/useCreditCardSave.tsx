import { useCallback } from 'react';
import { useCreditCardStore } from '../stores/useCreditCardStore';

interface UseCreditCardSaveReturn {
  isSavingCard: boolean;
  handleCardSave: (options?: { skipValidation?: boolean }) => Promise<{ shouldContinue: boolean }>;
}

export const useCreditCardSave = (): UseCreditCardSaveReturn => {
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
          const { onCreditCardFieldChange } = useCreditCardStore.getState();

          if (onCreditCardFieldChange) {
            const cardValidEvent = { target: { value: true } };
            onCreditCardFieldChange(cardValidEvent);
          }
        }
      }

      if (!cardState?.complete && isCreditCardRequired && creditCardFieldValue !== true) {
        const { creditCardFieldId, setFieldError } = useCreditCardStore.getState();
        if (creditCardFieldId && setFieldError) {
          setFieldError(creditCardFieldId, 'Please select or add a payment method to proceed.');
        }
        return { shouldContinue: false };
      }

      return { shouldContinue: true };
    },
    [
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
