import React from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { CSSLayout } from '../layout/CSSLayout';
import { useCSSPermissions } from '../hooks/useCSSPermissions';
import { FeatureFlagsProvider } from '../context/featureFlags';
import { CSSLoader } from '../components/CSSLoader';
import { NavigationProvider, useNavigationContext } from '../context/NavigationContext';
import { routesCSS } from './routesCSS';

const allRoutes = Object.values(routesCSS);
const providerRoutes = allRoutes.filter((route) => route.modes.includes('provider'));
const intakeRoutes = allRoutes.filter((route) => route.modes.includes('intake'));
// const readonlyRoutes = allRoutes.filter((route) => route.modes.includes('readonly'));

const CSSRouting: React.FC = () => {
  const permissions = useCSSPermissions();
  const navigate = useNavigate();
  const { interactionMode } = useNavigationContext();
  if (permissions.isPending) {
    return <CSSLoader />;
  }

  if (!permissions.view) {
    navigate('/visits');
    return null;
  }

  const availableRoutes = interactionMode === 'provider' ? providerRoutes : intakeRoutes;

  return (
    <FeatureFlagsProvider flagsToSet={{ css: true }}>
      <Routes>
        <Route element={<CSSLayout />}>
          <Route index element={<Navigate to={availableRoutes[0].path} replace />} />
          {availableRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
          {/* redirect unavailable page to the first available page, usecase - intake mode trying to open provider page */}
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
