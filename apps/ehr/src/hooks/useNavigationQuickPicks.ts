import AssignmentIcon from '@mui/icons-material/Assignment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import GroupIcon from '@mui/icons-material/Group';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import SettingsIcon from '@mui/icons-material/Settings';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
}

const ADMIN_ROLES = [RoleType.Administrator, RoleType.Manager, RoleType.CustomerSupport];

const NAVIGATION_DESTINATIONS: NavigationDestination[] = [
  {
    id: 'nav-in-person-visits',
    label: 'In-Person Visits',
    to: '/visits',
    icon: LocalHospitalIcon,
    keywords: ['tracking board', 'appointments', 'visits', 'walk-in'],
  },
  {
    id: 'nav-patient-search',
    label: 'Patient Search',
    to: '/patients',
    icon: PersonSearchIcon,
    keywords: ['patients', 'find patient', 'lookup patient'],
  },
  {
    id: 'nav-telemedicine',
    label: 'Telemedicine',
    to: '/visits?visitType=virtual-walk-in,virtual-pre-booked',
    icon: LocalHospitalIcon,
    keywords: ['telemed', 'virtual visits', 'virtual appointments'],
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
    id: 'nav-admin-insurance',
    label: 'Insurance Admin',
    to: '/admin/billing/insurance',
    icon: SettingsIcon,
    roles: ADMIN_ROLES,
    keywords: ['insurance', 'billing configuration', 'payers'],
  },
];

export function useNavigationQuickPicks(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useEvolveUser();

  const items = useMemo<CommandPaletteItem[]>(() => {
    const currentPath = `${location.pathname}${location.search}`;

    return NAVIGATION_DESTINATIONS.filter((destination) => {
      if (destination.roles && (!currentUser || !currentUser.hasRole(destination.roles))) {
        return false;
      }

      return currentPath !== destination.to;
    }).map((destination) => ({
      id: destination.id,
      label: destination.label,
      category: 'Go To',
      keywords: destination.keywords,
      onSelect: () => navigate(destination.to),
    }));
  }, [currentUser, location.pathname, location.search, navigate]);

  useCommandPaletteSource('navigation', items);
}
