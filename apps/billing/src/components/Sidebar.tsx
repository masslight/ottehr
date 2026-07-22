import { useAuth0 } from '@auth0/auth0-react';
import {
  Apartment as ApartmentIcon,
  Business as BusinessIcon,
  Description as DescriptionIcon,
  Home as HomeIcon,
  Label as LabelIcon,
  List as ListIcon,
  Logout as LogoutIcon,
  MedicalServices as MedicalServicesIcon,
  People as PeopleIcon,
  Receipt as ReceiptIcon,
  Rule as RuleIcon,
} from '@mui/icons-material';
import { Box, Divider, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { FC, ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RULES_ENGINE_TYPES, RULES_ENGINES } from 'utils';
import { ChargeItemDefinitionLabels } from '../constants/chargeItemDefinition';
import { otherColors } from '../themes/ottehr/colors';

const DRAWER_WIDTH = 220;

const navItems = [
  { label: 'Home', path: '/', icon: <HomeIcon sx={{ fontSize: 18 }} /> },
  { label: 'Claims', path: '/claims', icon: <DescriptionIcon sx={{ fontSize: 18 }} /> },
  { label: 'Patients', path: '/patients', icon: <PeopleIcon sx={{ fontSize: 18 }} /> },
  { label: 'Billing Providers', path: '/billing-providers', icon: <BusinessIcon sx={{ fontSize: 18 }} /> },
  { label: 'Rendering Providers', path: '/rendering-providers', icon: <MedicalServicesIcon sx={{ fontSize: 18 }} /> },
  { label: 'Service Facilities', path: '/service-facilities', icon: <ApartmentIcon sx={{ fontSize: 18 }} /> },
  {
    label: ChargeItemDefinitionLabels['charge-master'].listTitle,
    path: `/${ChargeItemDefinitionLabels['charge-master'].pathComponent}`,
    icon: <ListIcon sx={{ fontSize: 18 }} />,
  },
  { label: 'ERAs', path: '/eras', icon: <ReceiptIcon sx={{ fontSize: 18 }} /> },
  { label: 'Tags', path: '/tags', icon: <LabelIcon sx={{ fontSize: 18 }} /> },
];

// The rules engines get their own menu section, separated from the rest by a divider.
const rulesNavItems = RULES_ENGINE_TYPES.map((engine) => ({
  label: RULES_ENGINES[engine].label,
  path: `/rules/${engine}`,
  icon: <RuleIcon sx={{ fontSize: 18 }} />,
}));

export const Sidebar: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth0();

  const renderNavItem = ({ label, path, icon }: (typeof navItems)[number]): ReactElement => {
    const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
    return (
      <ListItemButton
        key={path}
        selected={isActive}
        onClick={() => navigate(path)}
        sx={{
          borderRadius: 1,
          mb: '1px',
          py: 0.75,
          px: 1.25,
          '&:hover': { bgcolor: otherColors.apptHover },
          '&.Mui-selected': {
            bgcolor: otherColors.apptHover,
            color: 'primary.dark',
            '& .MuiListItemIcon-root': { color: 'primary.dark' },
          },
          '&.Mui-selected:hover': { bgcolor: otherColors.formCardBg },
        }}
      >
        <ListItemIcon sx={{ minWidth: 28, color: isActive ? 'primary.dark' : 'action.disabled' }}>{icon}</ListItemIcon>
        <ListItemText
          primary={label}
          primaryTypographyProps={{
            fontSize: 13.5,
            fontWeight: isActive ? 500 : 450,
            color: isActive ? 'primary.dark' : 'text.primary',
          }}
        />
      </ListItemButton>
    );
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          borderRight: `1px solid ${otherColors.lightDivider}`,
          bgcolor: 'background.paper',
          position: 'relative',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2.25, py: 2.5 }}>
        <Box
          sx={{
            width: 26,
            height: 26,
            borderRadius: 1,
            bgcolor: 'primary.dark',
            display: 'grid',
            placeItems: 'center',
            color: 'primary.contrastText',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          O
        </Box>
        <Typography sx={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.015em', color: 'primary.dark' }}>
          Ottehr Billing
        </Typography>
      </Box>

      <List sx={{ px: 1.25, flex: 1, overflow: 'auto', minHeight: 0 }}>
        {navItems.map(renderNavItem)}
        <Divider sx={{ my: 1 }} />
        {rulesNavItems.map(renderNavItem)}
      </List>

      <List sx={{ px: 1.25 }}>
        <ListItemButton
          onClick={() => void logout({ logoutParams: { returnTo: window.location.origin, federated: true } })}
          sx={{
            borderRadius: 1,
            py: 0.75,
            px: 1.25,
            '&:hover': { bgcolor: otherColors.apptHover },
          }}
        >
          <ListItemIcon sx={{ minWidth: 28, color: 'action.disabled' }}>
            <LogoutIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText
            primary="Log out"
            primaryTypographyProps={{ fontSize: 13.5, fontWeight: 450, color: 'text.primary' }}
          />
        </ListItemButton>
      </List>
      <Box sx={{ px: 1 }}>
        <Typography variant="caption">Environment: {import.meta.env.VITE_APP_ENV}</Typography>
      </Box>
      <Box sx={{ px: 1, pb: 1 }}>
        <Typography variant="caption">Version: {import.meta.env.VITE_APP_VERSION}</Typography>
      </Box>
    </Drawer>
  );
};
