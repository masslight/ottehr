import { useCallback } from 'react';
import { getSelectors } from 'utils';
import { useIntakeCommonStore } from './common';

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
