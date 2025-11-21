import React from 'react';
import { useInPersonNavigationContext } from '../../context/InPersonNavigationContext';
import { usePageIntakeStatus } from '../../hooks/usePageIntakeStatus';
import { routesInPerson } from '../../routing/routesInPerson';
import { BreadcrumbsView } from './BreadcrumbsView';

export const CommonLayoutBreadcrumbs = (): React.ReactElement => {
  // TODO replace mock
  const { filledPages, currentPage } = usePageIntakeStatus();
  const { interactionMode } = useInPersonNavigationContext();

  const routes = Object.values(routesInPerson);

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
