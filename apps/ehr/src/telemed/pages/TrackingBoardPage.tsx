import { ReactElement, useEffect } from 'react';
import useEvolveUser from '../../hooks/useEvolveUser';
import { TrackingBoardBody } from '../features';
import { useTrackingBoardStore } from '../state';
import { allLicensesForPractitioner } from 'utils';

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
