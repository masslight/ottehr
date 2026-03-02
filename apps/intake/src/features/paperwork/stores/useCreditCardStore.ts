import type { RefObject } from 'react';
import { AddCreditCardFormHandle } from 'ui-components';
import { create } from 'zustand';

interface CardState {
  complete: boolean;
  error?: { message: string };
}

interface CreditCardState {
  cardFormRef: RefObject<AddCreditCardFormHandle> | null;
  isSavingCard: boolean;
  cardSaveError: string | undefined;
  showCardErrorDialog: boolean;
  creditCardFieldId: string | null;
  onCreditCardFieldChange: ((event: { target: { value: boolean } }) => void) | null;
  isCreditCardRequired: boolean;
  creditCardFieldValue: boolean | undefined;
  clearFieldErrors: ((fieldId: string) => void) | null;
  hasSavedCards: boolean;

  initializeContext: (params: {
    cardFormRef: RefObject<AddCreditCardFormHandle>;
    fieldId: string;
    onChange: (event: { target: { value: boolean } }) => void;
    required: boolean;
    value: boolean | undefined;
    clearErrors: (fieldId: string) => void;
    hasSavedCards: boolean;
  }) => void;
  handleCardChange: () => void;
  setCardFormRef: (ref: RefObject<AddCreditCardFormHandle>) => void;
  setIsSavingCard: (isSaving: boolean) => void;
  setCardSaveError: (error: string | undefined) => void;
  setShowCardErrorDialog: (show: boolean) => void;
  closeCardErrorDialog: () => void;
  getCardState: () => CardState | null;
  saveCard: () => Promise<{ success: boolean; error?: string }>;
  isCreditCardFieldRequired: () => boolean;
}

export const useCreditCardStore = create<CreditCardState>((set, get) => ({
  cardFormRef: null,
  isSavingCard: false,
  cardSaveError: undefined,
  showCardErrorDialog: false,
  creditCardFieldId: null,
  onCreditCardFieldChange: null,
  isCreditCardRequired: false,
  creditCardFieldValue: undefined,
  clearFieldErrors: null,
  hasSavedCards: false,

  initializeContext: ({ cardFormRef, fieldId, onChange, required, value, clearErrors, hasSavedCards }) => {
    set({
      cardFormRef,
      creditCardFieldId: fieldId,
      onCreditCardFieldChange: onChange,
      isCreditCardRequired: required,
      creditCardFieldValue: value,
      clearFieldErrors: clearErrors,
      hasSavedCards,
    });
  },

  handleCardChange: () => {
    const { creditCardFieldId, clearFieldErrors, getCardState } = get();
    if (!creditCardFieldId || !clearFieldErrors) return;

    const cardState = getCardState();
    if (cardState?.complete && !cardState?.error) {
      clearFieldErrors(creditCardFieldId);
    }
  },

  setCardFormRef: (ref) => set({ cardFormRef: ref }),
  setIsSavingCard: (isSaving) => set({ isSavingCard: isSaving }),
  setCardSaveError: (error) => set({ cardSaveError: error }),
  setShowCardErrorDialog: (show) => set({ showCardErrorDialog: show }),
  closeCardErrorDialog: () => set({ showCardErrorDialog: false, cardSaveError: undefined }),

  getCardState: () => {
    const { cardFormRef } = get();
    return cardFormRef?.current?.getCardState() ?? null;
  },

  saveCard: async () => {
    const { cardFormRef } = get();
    if (!cardFormRef?.current) {
      return { success: false, error: 'Card form not ready' };
    }
    const result = await cardFormRef.current.saveCard();
    return result;
  },

  isCreditCardFieldRequired: () => {
    const { isCreditCardRequired } = get();
    return isCreditCardRequired;
  },
}));
