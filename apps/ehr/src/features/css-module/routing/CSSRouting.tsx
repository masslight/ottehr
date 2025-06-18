import React from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { CSSLoader } from '../components/CSSLoader';
import { FeatureFlagsProvider } from '../context/featureFlags';
import { NavigationProvider, useNavigationContext } from '../context/NavigationContext';
import { useCSSPermissions } from '../hooks/useCSSPermissions';
import { CSSLayout } from '../layout/CSSLayout';

const CSSRouting: React.FC = () => {
  const permissions = useCSSPermissions();
  const navigate = useNavigate();
  const { availableRoutes, isLoading } = useNavigationContext();

  if (permissions.isPending || isLoading) {
    return <CSSLoader />;
  }

  if (!permissions.view) {
    navigate('/visits');
    return null;
  }

  return (
    <FeatureFlagsProvider flagsToSet={{ css: true }}>
      <Routes>
        <Route element={<CSSLayout />}>
          <Route index element={<Navigate to={availableRoutes[0].path} replace />} />
          {availableRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
          {/* redirect unavailable page to the first available page, use-case - intake mode trying to open provider page */}
          <Route path="*" element={<Navigate to={availableRoutes[0].path} replace />} />
        </Route>
      </Routes>
    </FeatureFlagsProvider>
  );
};

const CSSRoutingWithNavigationContext = (): React.ReactElement => {
  return (
    <NavigationProvider>
      <CSSRouting />
    </NavigationProvider>
  );
};

export default CSSRoutingWithNavigationContext;
