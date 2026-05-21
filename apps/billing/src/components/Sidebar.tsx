import { Description as DescriptionIcon, Home as HomeIcon, People as PeopleIcon } from '@mui/icons-material';
import { Drawer, List, ListItemButton, ListItemIcon, ListItemText, Toolbar } from '@mui/material';
import { FC } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { otherColors } from '../themes/ottehr/colors';

const DRAWER_WIDTH = 220;

const navItems = [
  { label: 'Home', path: '/', icon: <HomeIcon fontSize="small" /> },
  { label: 'Claims', path: '/claims', icon: <DescriptionIcon fontSize="small" /> },
  { label: 'Patients', path: '/patients', icon: <PeopleIcon fontSize="small" /> },
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
