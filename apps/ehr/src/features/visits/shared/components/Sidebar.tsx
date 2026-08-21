import { otherColors } from '@ehrTheme/colors';
import {
  alpha,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  styled,
  useTheme,
} from '@mui/material';
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { getInPersonVisitStatus } from 'utils/lib/utils/visitUtils';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { CompleteIntakeButton } from '../../in-person/components/CompleteIntakeButton';
import { EncounterSwitcher } from '../../in-person/components/EncounterSwitcher';
import { RouteInPerson, useInPersonNavigationContext } from '../../in-person/context/InPersonNavigationContext';
import { useCompleteIntake } from '../../in-person/hooks/useCompleteIntake';
import { userHasRouteRoles } from '../../in-person/routing/route-access';
import { ROUTER_PATH, routesInPerson } from '../../in-person/routing/routesInPerson';
import { useGetAppointmentAccessibility } from '../hooks/useGetAppointmentAccessibility';
import { useAppointmentData, useChartData } from '../stores/appointment/appointment.store';
import { sidebarMenuIcons } from './sidebarMenuIcons';

export const ArrowIcon = ({
  direction,
  color,
}: {
  direction: 'left' | 'right';
  color?: string;
}): React.ReactElement => {
  const theme = useTheme();
  return (
    <svg width="9" height="18" viewBox="0 0 9 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d={direction === 'right' ? 'M0 18V0H2V18H0ZM4 14V4L9 9L4 14Z' : 'M5 14V4L0 9L5 14ZM7 18H9V0H7V18Z'}
        fill={color ?? theme.palette.primary.main}
      />
    </svg>
  );
};

export { sidebarMenuIcons };

const drawerWidth = 244;

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

const StyledButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'isActive',
})<{ isActive: string }>(({ theme, isActive }) => ({
  display: 'flex',
  width: '100%',
  height: '42px',
  borderRadius: 0,
  borderBottom: '1px solid #e0e0e0',
  alignItems: 'center',
  textDecoration: 'none',
  color: 'inherit',
  padding: '0',
  margin: '0',
  transition: 'background-color 0.3s',
  textTransform: 'none',
  '& .MuiListItemText-primary': {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  '& .MuiListItem-root:hover': {
    backgroundColor: otherColors.sidebarItemHover,
  },
  '&.Mui-disabled': {
    color: theme.palette.text.primary,
  },
  ...(isActive === 'true' && {
    color: theme.palette.primary.main,
    borderRight: `2px solid ${theme.palette.primary.main}`,
    backgroundColor: alpha(theme.palette.primary.main, 0.05),
    '& .MuiListItemIcon-root': {
      color: theme.palette.primary.main,
    },
    '& .MuiListItemText-primary': {
      fontWeight: 'bold',
    },
  }),
}));

export const Sidebar = (): JSX.Element => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const currentUser = useEvolveUser();
  const { interactionMode } = useInPersonNavigationContext();
  const { id: appointmentID } = useParams();
  const { visitState } = useAppointmentData();
  const { chartData } = useChartData();
  const { appointment, encounter } = visitState;
  const status = appointment && encounter ? getInPersonVisitStatus(appointment, encounter) : undefined;
  const { visitType } = useGetAppointmentAccessibility();
  const isFollowup = visitType === 'follow-up';

  const { handleCompleteIntake, isEncounterUpdatePending } = useCompleteIntake();

  const handleDrawerToggle = (): void => {
    setOpen(!open);
  };

  const GroupLabel = styled(Box)(({ theme }) => ({
    padding: '8px 16px 6px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: theme.palette.primary.dark,
    textTransform: 'uppercase',
    letterSpacing: '0px',
  }));

  type MenuItem = {
    text: string;
    icon: React.ReactNode;
    to: string;
    visibility: Set<string>;
    activeCheckPath?: string;
    groupLabel?: string;
  };

  const generateMenuItems = (routes: RouteInPerson[]): MenuItem[] => {
    return routes
      .map((route) => ({
        text: route.text,
        icon: sidebarMenuIcons[route.iconKey],
        to: route.sidebarPath || route.path, // Use sidebarPath if available, otherwise use path
        activeCheckPath: route.activeCheckPath,
        visibility: new Set(route.modes),
        groupLabel: route.groupLabel,
      }))
      .filter((item) => item.visibility.has(interactionMode));
  };

  const menuItems = generateMenuItems(
    Object.values(routesInPerson)
      .filter((route) => !route.isSkippedInNavigation)
      .filter(
        (route) =>
          route.path !== ROUTER_PATH.OTTEHR_AI ||
          chartData?.aiChat?.documents?.[0] ||
          chartData?.aiChat?.hasPendingRecording
      )
      // Role-gated tabs. This menu is built from the route RECORDS rather than from the navigation
      // context's `availableRoutes` (which would make the whole sidebar disappear while the chart loads),
      // so a role gate is not applied for it by anything upstream. No route currently needs this — the
      // one that declares `requiredRoles` is also skipped in navigation — but the next role-gated tab
      // would otherwise appear here for everyone, silently and in the permissive direction.
      .filter((route) => userHasRouteRoles(route, currentUser))
  );

  return (
    <Drawer
      variant="permanent"
      open={open}
      sx={{
        position: 'relative',
        width: open ? drawerWidth : (theme) => theme.spacing(7),
        flexShrink: 0,
        zIndex: 50,
        '& .MuiDrawer-paper': {
          position: 'relative',
          width: open ? drawerWidth : (theme) => theme.spacing(7),
          boxSizing: 'border-box',
          overflowX: 'hidden',
          transition: 'width 0.1s',
          zIndex: 50,
        },
      }}
    >
      <DrawerHeader
        sx={{
          display: 'flex',
          padding: '0px',
          ...(open
            ? { justifyContent: 'end', paddingRight: '10px' }
            : { justifyContent: 'center', paddingRight: '0px' }),
        }}
        style={{ minHeight: '48px' }}
      >
        <IconButton
          sx={{
            width: 40,
            height: 40,
            padding: 0,
            '&:hover': {
              backgroundColor: otherColors.sidebarItemHover,
            },
          }}
          onClick={handleDrawerToggle}
        >
          <ArrowIcon direction={open ? 'left' : 'right'} />
        </IconButton>
      </DrawerHeader>

      <EncounterSwitcher open={open} />

      <List sx={{ padding: '0px' }}>
        {menuItems.map((item, index) => {
          const comparedPath = item?.activeCheckPath || item.to;
          const showGroupLabel =
            item.groupLabel && (index === 0 || menuItems[index - 1].groupLabel !== item.groupLabel);

          return (
            <React.Fragment key={item.text}>
              {showGroupLabel && open && <GroupLabel>{item.groupLabel}</GroupLabel>}
              <StyledButton
                isActive={location.pathname.includes(comparedPath).toString()}
                onClick={() => {
                  requestAnimationFrame(() => {
                    navigate(item.to);
                  });
                }}
              >
                <ListItem
                  data-testid={dataTestIds.sideMenu.sideMenuItem(item.to)}
                  sx={{ width: '100%', height: 'inherit' }}
                >
                  <ListItemIcon sx={{ minWidth: 30 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} sx={{ opacity: open ? 1 : 0 }} />
                </ListItem>
              </StyledButton>
            </React.Fragment>
          );
        })}
      </List>
      <br />
      {!isFollowup && (
        <CompleteIntakeButton
          isDisabled={!appointmentID || isEncounterUpdatePending || status !== 'intake'}
          handleCompleteIntake={handleCompleteIntake}
          status={status}
        />
      )}
    </Drawer>
  );
};
