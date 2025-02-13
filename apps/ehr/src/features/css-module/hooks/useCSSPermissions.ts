import { useMemo } from 'react';
import useEvolveUser from '../../../hooks/useEvolveUser';

export const useCSSPermissions = (): { view: boolean; isPending: boolean } => {
  const currentUser = useEvolveUser();

  const config = useMemo(
    () => ({
      isPending: !currentUser, // TODO suggested undefined will be for pending user, check if this is correct or unauthorized user is also undefined
      view: true, // restrict who has access to clinical support service features: Boolean(currentUser?.hasRole([RoleType.YourRole]))
    }),
    [currentUser]
  );

  return config;
};
