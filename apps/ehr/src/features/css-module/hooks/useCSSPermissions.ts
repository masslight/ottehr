import { useMemo } from 'react';
import { RoleType } from 'utils';
import useEvolveUser from '../../../hooks/useEvolveUser';

export const useCSSPermissions = (): { view: boolean; isPending: boolean } => {
  //GetAppointmentAccessibilityDataResult

  const currentUser = useEvolveUser();

  const config = useMemo(
    () => ({
      isPending: !currentUser, // TODO suggested undefined will be for pending user, check if this is correct or unauthorized user is also undefined
      view: Boolean(currentUser?.hasRole([RoleType.Manager])), // TODO use related role
    }),
    [currentUser]
  );

  return config;
};
