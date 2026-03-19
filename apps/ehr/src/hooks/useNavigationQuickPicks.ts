import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import GroupIcon from '@mui/icons-material/Group';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PeopleIcon from '@mui/icons-material/People';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import SettingsIcon from '@mui/icons-material/Settings';
import VideocamIcon from '@mui/icons-material/Videocam';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RoleType } from 'utils';
import { CommandPaletteItem } from '../state/command-palette.store';
import { useCommandPaletteSource } from './useCommandPaletteSource';
import useEvolveUser from './useEvolveUser';

interface NavigationDestination {
  id: string;
  label: string;
  path: string;
  icon: typeof AssignmentIcon;
  /** Roles that can see this destination. If empty, all roles can see it. */
  roles?: RoleType[];
  /** Keywords for search matching beyond the label */
  keywords?: string[];
}

const ADMIN_ROLES = [RoleType.Administrator, RoleType.Manager, RoleType.CustomerSupport];

const NAVIGATION_DESTINATIONS: NavigationDestination[] = [
  {
    id: 'nav-visits',
    label: 'In Person Visits',
    path: '/visits',
    icon: LocalHospitalIcon,
    keywords: ['tracking board', 'appointments', 'in-person'],
  },
  {
    id: 'nav-add-visit',
    label: 'Add New Visit',
    path: '/visits/add',
    icon: LocalHospitalIcon,
    roles: ADMIN_ROLES,
    keywords: ['create appointment', 'new patient visit', 'walk-in'],
  },
  {
    id: 'nav-patients',
    label: 'Patient Search',
    path: '/patients',
    icon: PersonSearchIcon,
    keywords: ['find patient', 'look up', 'search'],
  },
  {
    id: 'nav-telemedicine',
    label: 'Telemedicine',
    path: '/telemed/appointments',
    icon: VideocamIcon,
    keywords: ['telemed', 'video', 'virtual visit'],
  },
  {
    id: 'nav-schedules',
    label: 'Schedules',
    path: '/schedules',
    icon: CalendarMonthIcon,
    roles: ADMIN_ROLES,
    keywords: ['calendar', 'availability', 'slots'],
  },
  {
    id: 'nav-employees',
    label: 'Employees',
    path: '/employees',
    icon: GroupIcon,
    roles: ADMIN_ROLES,
    keywords: ['staff', 'providers', 'team', 'users'],
  },
  {
    id: 'nav-tasks',
    label: 'Tasks',
    path: '/tasks',
    icon: AssignmentIcon,
    keywords: ['to-do', 'work items'],
  },
  {
    id: 'nav-admin',
    label: 'Admin Settings',
    path: '/telemed-admin',
    icon: SettingsIcon,
    roles: ADMIN_ROLES,
    keywords: ['insurance', 'virtual locations', 'quick picks', 'templates', 'configuration'],
  },
  {
    id: 'nav-admin-quick-picks',
    label: 'Quick Picks Admin',
    path: '/telemed-admin/quick-picks',
    icon: SettingsIcon,
    roles: ADMIN_ROLES,
    keywords: ['manage quick picks', 'configure'],
  },
  {
    id: 'nav-admin-templates',
    label: 'Global Templates Admin',
    path: '/telemed-admin/global-templates',
    icon: SettingsIcon,
    roles: ADMIN_ROLES,
    keywords: ['manage templates', 'configure'],
  },
  {
    id: 'nav-admin-insurance',
    label: 'Insurance Admin',
    path: '/telemed-admin/insurances',
    icon: SettingsIcon,
    roles: ADMIN_ROLES,
    keywords: ['payers', 'coverage'],
  },
  {
    id: 'nav-profile',
    label: 'My Profile',
    path: '/profile',
    icon: PeopleIcon,
    keywords: ['account', 'settings', 'my account'],
  },
];

/**
 * Registers navigation destinations in the command palette. These appear
 * on all pages (not just in-person visits) so users can quickly jump to
 * any module. Items are filtered by the current user's role.
 *
 * When the user types something that doesn't match any navigation item,
 * the command palette shows a "Search patients for ..." fallback option
 * that navigates to the patient search page with the query pre-filled.
 */
export function useNavigationQuickPicks(): void {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useEvolveUser();

  const navItems = useMemo((): CommandPaletteItem[] => {
    return NAVIGATION_DESTINATIONS.filter((dest) => {
      // Filter by role
      if (dest.roles && currentUser) {
        if (!currentUser.hasRole?.(dest.roles)) return false;
      }
      // Don't show the current page
      if (location.pathname === dest.path) return false;
      return true;
    }).map((dest) => ({
      id: dest.id,
      label: dest.label,
      category: 'Go to',
      keywords: dest.keywords,
      onSelect: () => navigate(dest.path),
    }));
  }, [currentUser, location.pathname, navigate]);

  useCommandPaletteSource('navigation', navItems);
}
