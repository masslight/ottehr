import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import GroupIcon from '@mui/icons-material/Group';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PersonIcon from '@mui/icons-material/Person';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import SettingsIcon from '@mui/icons-material/Settings';
import { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { RoleType } from 'utils';
import { CommandPaletteItem } from '../state/command-palette.store';
import { useCommandPaletteSource } from './useCommandPaletteSource';
import useEvolveUser from './useEvolveUser';

interface NavigationDestination {
  id: string;
  label: string;
  to: string;
  icon: typeof AssignmentIcon;
  keywords?: string[];
  roles?: RoleType[];
  /** When set, the item is rendered as a child of the destination with the
   *  matching id. The hook lists parents before their children so order is
   *  preserved through the palette's grouping. */
  parentId?: string;
  /** When set, the destination is `to` plus this querystring at navigation
   *  time. If the user is already on `to`, only the querystring is updated
   *  (replace) — no full navigation. Used for the tracking-board sub-tabs. */
  query?: Record<string, string>;
}

const ADMIN_ROLES = [RoleType.Administrator, RoleType.Manager, RoleType.CustomerSupport];

const NAVIGATION_DESTINATIONS: NavigationDestination[] = [
  {
    id: 'nav-tracking-board',
    label: 'Tracking Board',
    to: '/visits',
    icon: LocalHospitalIcon,
    query: { tab: 'in-office' },
    keywords: ['visits', 'appointments', 'in-person', 'walk-in'],
  },
  {
    id: 'nav-tracking-prebooked',
    label: 'Pre-booked',
    to: '/visits',
    icon: LocalHospitalIcon,
    parentId: 'nav-tracking-board',
    query: { tab: 'prebooked' },
    keywords: ['scheduled', 'upcoming', 'booked'],
  },
  {
    id: 'nav-tracking-active',
    label: 'Active',
    to: '/visits',
    icon: LocalHospitalIcon,
    parentId: 'nav-tracking-board',
    query: { tab: 'in-office' },
    keywords: ['in office', 'current', 'waiting'],
  },
  {
    id: 'nav-tracking-discharged',
    label: 'Discharged',
    to: '/visits',
    icon: LocalHospitalIcon,
    parentId: 'nav-tracking-board',
    query: { tab: 'completed' },
    keywords: ['completed', 'done', 'finished'],
  },
  {
    id: 'nav-tracking-cancelled',
    label: 'Cancelled',
    to: '/visits',
    icon: LocalHospitalIcon,
    parentId: 'nav-tracking-board',
    query: { tab: 'cancelled' },
    keywords: ['canceled', 'no show'],
  },
  {
    id: 'nav-add-visit',
    label: 'Add New Visit',
    to: '/visits/add',
    icon: LocalHospitalIcon,
    roles: ADMIN_ROLES,
    keywords: ['create appointment', 'new patient visit', 'walk-in'],
  },
  {
    id: 'nav-patient-search',
    label: 'Patient Search',
    to: '/patients',
    icon: PersonSearchIcon,
    keywords: ['patients', 'find patient', 'lookup patient'],
  },
  {
    id: 'nav-schedules',
    label: 'Schedules',
    to: '/admin/schedules',
    icon: CalendarMonthIcon,
    roles: ADMIN_ROLES,
    keywords: ['calendar', 'availability'],
  },
  {
    id: 'nav-employees',
    label: 'Employees',
    to: '/admin/employees',
    icon: GroupIcon,
    roles: ADMIN_ROLES,
    keywords: ['staff', 'providers', 'team'],
  },
  {
    id: 'nav-tasks',
    label: 'Tasks',
    to: '/tasks',
    icon: AssignmentIcon,
    keywords: ['work items', 'to do'],
  },
  {
    id: 'nav-admin-settings',
    label: 'Admin Settings',
    to: '/admin',
    icon: SettingsIcon,
    roles: ADMIN_ROLES,
    keywords: ['configuration', 'settings'],
  },
  {
    id: 'nav-admin-quick-picks',
    label: 'Quick Picks Admin',
    to: '/admin/quick-picks',
    icon: SettingsIcon,
    roles: ADMIN_ROLES,
    keywords: ['quick picks', 'manage quick picks'],
  },
  {
    id: 'nav-admin-global-templates',
    label: 'Global Templates Admin',
    to: '/admin/global-templates',
    icon: SettingsIcon,
    roles: ADMIN_ROLES,
    keywords: ['templates', 'global templates'],
  },
  {
    id: 'nav-admin-billing',
    label: 'Billing Configuration',
    to: '/admin/billing',
    icon: SettingsIcon,
    roles: ADMIN_ROLES,
    keywords: ['payers', 'coverage', 'insurance', 'fee schedule', 'charge master'],
  },
  {
    id: 'nav-profile',
    label: 'My Profile',
    to: '/profile',
    icon: PersonIcon,
    keywords: ['account', 'settings', 'my account'],
  },
];

/**
 * Registers global navigation destinations as command-palette items. Items
 * appear under the "Go To" category. Tracking-board sub-tabs render indented
 * under their parent via `parentId`. Items with a `query` field navigate to
 * `to?<query>`; if the user is already on `to`, only the search params are
 * updated in place (so flipping between sub-tabs doesn't push history).
 */
export function useNavigationQuickPicks(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const currentUser = useEvolveUser();

  const items = useMemo<CommandPaletteItem[]>(() => {
    return NAVIGATION_DESTINATIONS.filter((destination) => {
      if (destination.roles && (!currentUser || !currentUser.hasRole(destination.roles))) {
        return false;
      }
      // Hide items pointing at the current page UNLESS they carry a query
      // (e.g. tracking-board sub-tabs are still useful on /visits — they let
      // the user switch tab from the palette).
      if (location.pathname === destination.to && !destination.query) {
        return false;
      }
      return true;
    }).map((destination) => ({
      id: destination.id,
      label: destination.label,
      category: 'Go To',
      keywords: destination.keywords,
      parentId: destination.parentId,
      onSelect: () => {
        if (destination.query && location.pathname === destination.to) {
          // Same path — just update the query in place so the page reacts
          // (e.g. AppointmentTabs's useSearchParams syncs to the new tab).
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              for (const [k, v] of Object.entries(destination.query!)) next.set(k, v);
              return next;
            },
            { replace: true }
          );
        } else {
          const qs = destination.query ? '?' + new URLSearchParams(destination.query).toString() : '';
          navigate(`${destination.to}${qs}`);
        }
      },
    }));
  }, [currentUser, location.pathname, navigate, setSearchParams]);

  useCommandPaletteSource('navigation', items);
}
