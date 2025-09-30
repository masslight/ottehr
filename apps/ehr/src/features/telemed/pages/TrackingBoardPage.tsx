import { ReactElement, useEffect } from 'react';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { allLicensesForPractitioner } from 'utils';
import { TrackingBoardBody } from '../features';
import { useTrackingBoardStore } from '../state';

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
