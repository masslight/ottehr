import { PaperworkPage } from 'ottehr-utils';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PaperworkState {
  paperworkQuestions?: PaperworkPage[];
  completedPaperwork?: any;
}

interface PaperworkStoreActions {
  setQuestions: (questions: PaperworkPage[]) => void;
  setResponses: (responses: any) => void;
  patchCompletedPaperwork: (responses: any) => void;
}

const PAPERWORK_STATE_INITIAL: PaperworkState = {};

export const usePaperworkStore = create<PaperworkState & PaperworkStoreActions>()(
  persist(
    (set) => ({
      ...PAPERWORK_STATE_INITIAL,
      setQuestions: (questions: PaperworkPage[]) => {
        set(() => ({
          paperworkQuestions: questions,
        }));
      },
      setResponses: (responses: any) => {
        set(() => ({
          completedPaperwork: responses,
        }));
      },
      patchCompletedPaperwork: (responses: any) => {
        set((state) => ({
          completedPaperwork: { ...(state.completedPaperwork || {}), ...responses },
        }));
      },
    }),
    { name: 'telemed-paperwork-storage' },
  ),
);
