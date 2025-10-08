import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { Loader } from '../../shared/components/Loader';
import { AppFlagsProvider } from '../../shared/stores/contexts/useAppFlags';
import { InPersonNavigationProvider, useInPersonNavigationContext } from '../context/InPersonNavigationContext';
import { InPersonLayout } from '../layout/InPersonLayout';

const InPersonRouting: React.FC = () => {
  const currentUser = useEvolveUser();
  const { availableRoutes = [], isLoading = true } = useInPersonNavigationContext() || {};

  if (!currentUser || isLoading) {
    return <Loader />;
  }

  // todo: 'permissions.view' was hardcoded to 'true' previously, should we use useAppointmentAccessibility to check if the user has access to the appointment?
  // if (!permissions.view) {
  //   navigate('/visits');
  //   return null;
  // }

  return (
    <AppFlagsProvider flagsToSet={{ isInPerson: true }}>
      <Routes>
        <Route element={<InPersonLayout />}>
          <Route index element={<Navigate to={availableRoutes[0].path} replace />} />
          {availableRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
          {/* redirect unavailable page to the first available page, use-case - intake mode trying to open provider page */}
          <Route path="*" element={<Navigate to={availableRoutes[0].path} replace />} />
        </Route>
      </Routes>
    </AppFlagsProvider>
  );
};

const InPersonRoutingWithNavigationContext = (): React.ReactElement => {
  return (
    <InPersonNavigationProvider>
      <InPersonRouting />
    </InPersonNavigationProvider>
  );
};

export default InPersonRoutingWithNavigationContext;
