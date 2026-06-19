import {
  Apartment as ApartmentIcon,
  Business as BusinessIcon,
  Description as DescriptionIcon,
  Home as HomeIcon,
  Label as LabelIcon,
  MedicalServices as MedicalServicesIcon,
  People as PeopleIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { FC } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { otherColors } from '../themes/ottehr/colors';

const DRAWER_WIDTH = 220;

const navItems = [
  { label: 'Home', path: '/', icon: <HomeIcon sx={{ fontSize: 18 }} /> },
  { label: 'Claims', path: '/claims', icon: <DescriptionIcon sx={{ fontSize: 18 }} /> },
  { label: 'Patients', path: '/patients', icon: <PeopleIcon sx={{ fontSize: 18 }} /> },
  { label: 'Billing Providers', path: '/billing-providers', icon: <BusinessIcon sx={{ fontSize: 18 }} /> },
  { label: 'Rendering Providers', path: '/rendering-providers', icon: <MedicalServicesIcon sx={{ fontSize: 18 }} /> },
  { label: 'Service Facilities', path: '/service-facilities', icon: <ApartmentIcon sx={{ fontSize: 18 }} /> },
  { label: 'ERAs', path: '/eras', icon: <ReceiptIcon sx={{ fontSize: 18 }} /> },
  { label: 'Tags', path: '/tags', icon: <LabelIcon sx={{ fontSize: 18 }} /> },
];

export const Sidebar: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

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

      <List sx={{ px: 1.25, flex: 1 }}>
        {navItems.map(({ label, path, icon }) => {
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
              <ListItemIcon sx={{ minWidth: 28, color: isActive ? 'primary.dark' : 'action.disabled' }}>
                {icon}
              </ListItemIcon>
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
        })}
      </List>
    </Drawer>
  );
};
