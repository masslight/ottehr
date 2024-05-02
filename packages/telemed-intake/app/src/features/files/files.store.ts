import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FileURLs } from 'ottehr-utils';

interface FilesState {
  fileURLs?: FileURLs;
}

const FILES_STATE_INITIAL: FilesState = {};

interface FilesStateActions {
  patchFileURLs: (fileURLs: FileURLs) => void;
}

export const useFilesStore = create<FilesState & FilesStateActions>()(
  persist(
    (set) => ({
      ...FILES_STATE_INITIAL,
      patchFileURLs: (fileURLs: FileURLs) => {
        set((state) => ({
          fileURLs: { ...(state.fileURLs || {}), ...fileURLs },
        }));
      },
    }),
    {
      name: 'telemed-files-storage',
    },
  ),
);
