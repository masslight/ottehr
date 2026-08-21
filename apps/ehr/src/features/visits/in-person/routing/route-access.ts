// Role gating for an in-person chart tab.
//
// Most tabs are open to anyone who can open the visit, and a few are gated by a FEATURE FLAG — which is
// static, so those express it by handing `modes: []` and `element: null` straight to the route record.
// ROLES are not static: they come off the signed-in user, so they cannot be decided where the records are
// declared. Hence a predicate, applied at the two places a route record turns into something a user can
// reach: the registered <Route> set and the sidebar menu.
//
// BOTH are required. Gating only the route leaves a menu entry that bounces back to the first page; gating
// only the menu leaves the URL working for anyone who types it. The rule lives here, once, so the two
// cannot drift.

import { RoleType } from 'utils/lib/types/api/user.types';

/** Just the part of the route record this predicate reads, so callers need not pass the whole thing. */
export interface RoleGatedRoute {
  requiredRoles?: readonly RoleType[];
}

/** Just the part of the user this predicate reads — `useEvolveUser()`'s role check. */
export interface RoleBearer {
  hasRole: (roles: RoleType[]) => boolean;
}

/**
 * May this user reach this route?
 *
 * Ungated routes are reachable by anyone (the overwhelming majority). A gated route needs a LOADED user:
 * an absent one is refused rather than waved through, because the alternative is a tab that flashes into
 * the sidebar for a role that may not have it while the user query is still in flight.
 */
export const userHasRouteRoles = (route: RoleGatedRoute, user: RoleBearer | null | undefined): boolean =>
  !route.requiredRoles?.length || user?.hasRole([...route.requiredRoles]) === true;
