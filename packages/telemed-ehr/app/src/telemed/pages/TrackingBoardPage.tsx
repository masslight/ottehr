import { ReactElement, useEffect } from 'react';
import useOttehrUser from '../../hooks/useOttehrUser';
import { TrackingBoardBody } from '../features';
import { useTrackingBoardStore } from '../state';
import { allLicensesForPractitioner } from 'ehr-utils';

export function TrackingBoardPage(): ReactElement {
  const user = useOttehrUser();

  useEffect(() => {
    const availableStates =
      user?.profileResource && allLicensesForPractitioner(user.profileResource).map((item) => item.state);

    if (availableStates) {
      useTrackingBoardStore.setState({ availableStates });
    }
  }, [user]);

  return <TrackingBoardBody />;
}
