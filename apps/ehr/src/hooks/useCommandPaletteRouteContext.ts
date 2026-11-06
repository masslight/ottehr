import { matchPath, useLocation } from 'react-router-dom';

/**
 * Resolves the visit/patient context from the current route for command-palette
 * actions. Visit pages (in-person progress note and visit details) win;
 * patientId is set only when there is no visit match.
 */
export function useCommandPaletteRouteContext(): {
  visitId: string | undefined;
  patientId: string | undefined;
  isVisitDetails: boolean;
} {
  const { pathname } = useLocation();

  const visitDetailsMatch = matchPath('/visit/:id', pathname);
  const visitId = (matchPath('/in-person/:id/*', pathname) ?? visitDetailsMatch)?.params.id;
  const patientId = visitId ? undefined : matchPath('/patient/:id/*', pathname)?.params.id;

  return { visitId, patientId, isVisitDetails: !!visitDetailsMatch };
}
