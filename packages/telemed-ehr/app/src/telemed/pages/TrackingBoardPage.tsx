import { ReactElement } from 'react';
import { ChatProvider } from '../../contexts/ChatContext';
import { TrackingBoardBody } from '../components';
import { useTrackingBoardStore, useGetUser } from '../state';
import { useZapEHRTelemedAPIClient } from '../hooks/useZapEHRAPIClient';
import { useCommonStore } from '../../state/common.store';

export function TrackingBoardPage(): ReactElement {
  const commonStore = useCommonStore.getState();
  const apiClient = useZapEHRTelemedAPIClient();
  useGetUser({ apiClient, userId: commonStore.user?.id }, (data) => {
    useTrackingBoardStore.setState((prevState) => ({
      ...prevState,
      availableStates: data.user.licenses.map((license) => license.state),
    }));
  });

  return (
    <ChatProvider appointments={[]}>
      <TrackingBoardBody />
    </ChatProvider>
  );
}
