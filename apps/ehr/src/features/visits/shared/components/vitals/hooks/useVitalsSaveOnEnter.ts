import { useCallback } from 'react';

export interface UseVitalsSaveOnEnterParams {
  onSave: () => void | Promise<void>;
}

export interface UseVitalsSaveOnEnterReturn {
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

export function useVitalsSaveOnEnter({ onSave }: UseVitalsSaveOnEnterParams): UseVitalsSaveOnEnterReturn {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void onSave();
      }
    },
    [onSave]
  );

  return { handleKeyDown };
}
