import { ReactElement, useEffect } from 'react';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { allLicensesForPractitioner } from 'utils';
import { TrackingBoardBody } from '../components/tracking-board/TrackingBoardBody';
import { useTrackingBoardStore } from '../state/tracking-board/tracking-board.store';

export function TrackingBoardPage(): ReactElement {
  const user = useEvolveUser();

  useEffect(() => {
    const availableStates =
      user?.profileResource && allLicensesForPractitioner(user.profileResource).map((item) => item.state);

    if (availableStates) {
      useTrackingBoardStore.setState({ availableStates });
    }
  }, [user]);

  return <TrackingBoardBody />;
}
