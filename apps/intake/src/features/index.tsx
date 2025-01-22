import { useCallback } from 'react';
import { useIntakeCommonStore } from './common';
import { getSelectors } from 'utils';

export const useClearStores = (): ((redirectPath?: string) => void) => {
  const { clear: clearCommon } = getSelectors(useIntakeCommonStore, ['clear']);
  return useCallback(
    (redirectPath?: string) => {
      useIntakeCommonStore.persist.clearStorage();
      clearCommon(redirectPath);
    },
    [clearCommon]
  );
};
