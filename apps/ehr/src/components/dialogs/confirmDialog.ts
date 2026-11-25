import { ReactNode } from 'react';
import { create } from 'zustand';

export interface ConfirmDialogOptions {
  /** The question, in Title Case: "Delete This Note?" */
  title: string;
  /** Names the exact object and the consequence. */
  body?: ReactNode;
  /** A verb, in Title Case: "Send by Mail", "Delete Note". */
  confirmLabel: string;
  cancelLabel?: string;
}

export interface ConfirmDialogRequest extends ConfirmDialogOptions {
  variant: 'confirm' | 'destructive';
  resolve: (confirmed: boolean) => void;
}

interface ConfirmDialogState {
  request?: ConfirmDialogRequest;
}

export const useConfirmDialogStore = create<ConfirmDialogState>()(() => ({}));

const ask = (variant: ConfirmDialogRequest['variant'], options: ConfirmDialogOptions): Promise<boolean> =>
  new Promise((resolve) => {
    // A second question while one is open replaces it; the first is answered "no".
    useConfirmDialogStore.getState().request?.resolve(false);
    useConfirmDialogStore.setState({ request: { ...options, variant, resolve } });
  });

/**
 * Asks a yes/no question in an XS confirm dialog and resolves to the answer. Needs
 * `<ConfirmDialogHost />` mounted once at the app root.
 *
 * Named `confirmDialog`, not `confirm`, so that a forgotten import is a compile error instead of a
 * silent call to the browser's `window.confirm`.
 */
export const confirmDialog = (options: ConfirmDialogOptions): Promise<boolean> => ask('confirm', options);

/** Same, for anything the user cannot take back. This is the replacement for `window.confirm()`. */
export const confirmDestructive = (options: ConfirmDialogOptions): Promise<boolean> => ask('destructive', options);
