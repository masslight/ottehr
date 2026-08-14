import { useCallback } from 'react';
import { useIntakeCommonStore } from 'src/features/common/intake-common.store';
import { getSelectors } from 'utils/lib/store';

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
