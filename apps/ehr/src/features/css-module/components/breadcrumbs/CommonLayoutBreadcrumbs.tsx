import React from 'react';
import { useNavigationContext } from '../../context/NavigationContext';
import { usePageIntakeStatus } from '../../hooks/usePageIntakeStatus';
import { routesCSS } from '../../routing/routesCSS';
import { BreadcrumbsView } from './BreadcrumbsView';

export const CommonLayoutBreadcrumbs = (): React.ReactElement => {
  // TODO replace mock
  const { filledPages, currentPage } = usePageIntakeStatus();
  const { interactionMode } = useNavigationContext();

  const routes = Object.values(routesCSS);

  const routesForCurrentMode = routes.filter((route) => route.modes.includes(interactionMode));

  const getIsRouteWithoutBreadcrumbs = (): boolean =>
    !routes.find((route) => location.pathname.includes(route.path))?.modes.includes(interactionMode);

  if (interactionMode !== 'intake' || !routesForCurrentMode.length || getIsRouteWithoutBreadcrumbs()) {
    return <></>;
  }

  const breadcrumbs = routesForCurrentMode.map((route) => ({
    text: route.text,
    link: route.path,
    isHighlighted: filledPages.includes(route.path),
    isActive: route.path === currentPage,
  }));

  return <BreadcrumbsView items={breadcrumbs} />;
};
