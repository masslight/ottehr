import { matchPath, useLocation } from 'react-router-dom';

/**
 * Resolves the visit/patient context from the current route for command-palette
 * actions. Visit pages (in-person progress note and visit details) win;
 * patientId is set only when there is no visit match.
 */
export function useCommandPaletteRouteContext(): { visitId: string | undefined; patientId: string | undefined } {
  const { pathname } = useLocation();

  const visitId = (matchPath('/in-person/:id/*', pathname) ?? matchPath('/visit/:id', pathname))?.params.id;
  const patientId = visitId
    ? undefined
    : (matchPath('/patient/:id/*', pathname) ?? matchPath('/patient/:id', pathname))?.params.id;

  return { visitId, patientId };
}
