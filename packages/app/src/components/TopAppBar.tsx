import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { FC, Fragment, MouseEvent, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { otherColors } from '../OttEHRThemeProvider';
import { dashboardLogo } from '../assets/icons';

const pages = ['Dashboard'];
const settings = [
  {
    name: 'Profile',
    route: '/ProviderProfile',
  },
  {
    name: 'Log out',
    route: '/Logout',
  },
];

export const TopAppBar: FC = () => {
  const location = useLocation();
  const isActive = (path: string): boolean => location.pathname === path;

  const [anchorElUser, setAnchorElUser] = useState<HTMLElement | null>(null);

  const handleOpenUserMenu = (event: MouseEvent<HTMLElement>): void => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = (): void => {
    setAnchorElUser(null);
  };

  return (
    <AppBar position="static" sx={{ backgroundColor: otherColors.footerBackground }}>
      <Container maxWidth={false}>
        <Toolbar disableGutters variant="dense">
          <Box component="img" src={dashboardLogo} mr={5} />
          <Box sx={{ flexGrow: 1, display: { xs: 'flex' } }}>
            {pages.map((page) => (
              <Button
                key={page}
                component={NavLink}
                to={`/${page.toLowerCase()}`}
                sx={{
                  my: 2,
                  // TODO move all colors to OttEHRThemeProvider
                  color: isActive(`/${page.toLowerCase()}`) ? 'primary.light' : 'rgba(255, 255, 255, 0.7)',
                  display: 'block',
                  textDecoration: 'none',
                  '&.active': { color: 'primary.light' },
                }}
              >
                {page}
              </Button>
            ))}
          </Box>
          <Box sx={{ flexGrow: 0 }}>
            <Tooltip title="Open settings">
              <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                <AccountCircleIcon sx={{ color: 'primary.light' }} />
              </IconButton>
            </Tooltip>
            <Menu
              sx={{ mt: '45px' }}
              id="menu-appbar"
              anchorEl={anchorElUser}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorElUser)}
              onClose={handleCloseUserMenu}
            >
              <MenuItem disabled>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="body1">Name Surname</Typography>
                  <Typography variant="body1">email@example.com</Typography>
                </Box>
              </MenuItem>
              <Divider />
              {settings.map((setting, index) => (
                <Fragment key={setting.name}>
                  <MenuItem onClick={handleCloseUserMenu} component={Link} to={setting.route}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {setting.name === 'Profile' && <AccountCircleIcon sx={{ mr: 4, color: 'text.light' }} />}
                      <Typography variant="body2" color="text.light">
                        {setting.name}
                      </Typography>
                    </Box>
                  </MenuItem>
                  {index < settings.length - 1 && <Divider />}
                </Fragment>
              ))}
            </Menu>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};
