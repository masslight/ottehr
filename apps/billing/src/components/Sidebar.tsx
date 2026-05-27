import {
  Business as BusinessIcon,
  Description as DescriptionIcon,
  Home as HomeIcon,
  Label as LabelIcon,
  MedicalServices as MedicalServicesIcon,
  People as PeopleIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { Drawer, List, ListItemButton, ListItemIcon, ListItemText, Toolbar } from '@mui/material';
import { FC } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { otherColors } from '../themes/ottehr/colors';

const DRAWER_WIDTH = 220;

const navItems = [
  { label: 'Home', path: '/', icon: <HomeIcon fontSize="small" /> },
  { label: 'Claims', path: '/claims', icon: <DescriptionIcon fontSize="small" /> },
  { label: 'Patients', path: '/patients', icon: <PeopleIcon fontSize="small" /> },
  { label: 'Billing Providers', path: '/billing-providers', icon: <BusinessIcon fontSize="small" /> },
  { label: 'Rendering Providers', path: '/rendering-providers', icon: <MedicalServicesIcon fontSize="small" /> },
  { label: 'ERAs', path: '/eras', icon: <ReceiptIcon fontSize="small" /> },
  { label: 'Tags', path: '/tags', icon: <LabelIcon fontSize="small" /> },
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
          position: 'relative',
        },
      }}
    >
      <Toolbar variant="dense" />
      <List sx={{ px: 1, pt: 1 }}>
        {navItems.map(({ label, path, icon }) => {
          const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
          return (
            <ListItemButton
              key={path}
              selected={isActive}
              onClick={() => navigate(path)}
              sx={{
                borderRadius: 1,
                mb: 0.25,
                py: 0.75,
                '&:hover': { bgcolor: otherColors.sidebarItemHover },
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                },
                '&.Mui-selected:hover': { bgcolor: 'primary.dark' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>{icon}</ListItemIcon>
              <ListItemText primary={label} primaryTypographyProps={{ fontSize: 14 }} />
            </ListItemButton>
          );
        })}
      </List>
    </Drawer>
  );
};
