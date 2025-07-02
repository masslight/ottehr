import { FileUpload, FileURLs } from 'utils';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandDevtools } from '../../utils';

interface FilesState {
  fileURLs?: FileURLs;
  fileUploads: FileUpload;
}

const FILES_STATE_INITIAL: FilesState = {
  fileUploads: {},
};

type SetStateAction<S> = S | ((prevState: S) => S);

interface FilesStateActions {
  patchFileURLs: (fileURLs: FileURLs) => void;
  setFileUploads: (fileUploads: SetStateAction<FileUpload>) => void;
}

export const useFilesStore = create<FilesState & FilesStateActions>()(
  persist(
    (set) => ({
      ...FILES_STATE_INITIAL,
      patchFileURLs: (fileURLs) => {
        set((state) => ({
          fileURLs: { ...(state.fileURLs || {}), ...fileURLs },
        }));
      },
      setFileUploads: (fileUploads) => {
        if (typeof fileUploads === 'function') {
          set((prevState) => ({
            fileUploads: fileUploads(prevState.fileUploads),
          }));
        } else {
          set({ fileUploads });
        }
      },
    }),
    {
      name: 'telemed-files-storage',
    }
  )
);

zustandDevtools('Telemed files', useFilesStore);
