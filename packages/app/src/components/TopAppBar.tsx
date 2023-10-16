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
  useTheme,
} from '@mui/material';
import { FC, MouseEvent, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { otherColors } from '../OttEHRThemeProvider';
import { dashboardLogo } from '../assets/icons';
import MenuIcon from '@mui/icons-material/Menu';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

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
  const { logout } = useAuth0();
  const location = useLocation();
  const isActive = (path: string): boolean => location.pathname === path;

  const theme = useTheme();

  const [anchorElUser, setAnchorElUser] = useState<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const handleOpenUserMenu = (event: MouseEvent<HTMLElement>): void => {
    setAnchorElUser(event.currentTarget);
    setMenuOpen(true);
  };

  const handleCloseUserMenu = (): void => {
    setAnchorElUser(null);
    setMenuOpen(false);
  };

  return (
    <AppBar position="static" sx={{ backgroundColor: otherColors.footerBackground, width: '100vw' }}>
      <Container maxWidth={false}>
        <Toolbar
          disableGutters
          variant="dense"
          sx={{
            [theme.breakpoints.down('md')]: {
              display: 'flex',
              justifyContent: 'space-between',
            },
          }}
        >
          <Box component="img" src={dashboardLogo} mr={5} />
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
            {pages.map((page) => (
              <Button
                component={NavLink}
                key={page}
                to={`/${page.toLowerCase()}`}
                sx={{
                  // TODO move all colors to OttEHRThemeProvider
                  color: isActive(`/${page.toLowerCase()}`) ? 'primary.light' : 'rgba(255, 255, 255, 0.7)',
                  display: 'block',
                  my: 2,
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
                <AccountCircleIcon sx={{ color: theme.palette.primary.light, display: { xs: 'none', md: 'block' } }} />
                <MenuIcon sx={{ color: 'white', display: { md: 'none' } }} />
              </IconButton>
            </Tooltip>
            <Menu
              id="menu-appbar"
              anchorEl={anchorElUser}
              anchorOrigin={{
                horizontal: 'right',
                vertical: 'top',
              }}
              keepMounted
              onClose={handleCloseUserMenu}
              open={Boolean(anchorElUser)}
              transformOrigin={{
                horizontal: 'right',
                vertical: 'top',
              }}
              sx={{ mt: '45px', display: { xs: 'none', md: 'block' } }}
            >
              <MenuItem disabled>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="body1">Name Surname</Typography>
                  <Typography variant="body1">email@example.com</Typography>
                </Box>
              </MenuItem>
              <Divider />
              <MenuItem component={Link} onClick={handleCloseUserMenu} to="/provider-profile">
                <Box sx={{ alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
                  <AccountCircleIcon sx={{ color: 'text.light', mr: 4 }} />
                  <Typography color="text.light" variant="body2">
                    Profile
                  </Typography>
                </Box>
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  handleCloseUserMenu();
                  logout({ returnTo: window.location.origin });
                }}
              >
                <Box sx={{ alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
                  <Typography color="text.light" variant="body2">
                    Logout
                  </Typography>
                </Box>
              </MenuItem>
            </Menu>

            {/* TO DO menu integration */}
            <Box
              sx={{
                position: 'fixed',
                top: 0,
                right: menuOpen ? 0 : '-100%',
                width: 'auto',
                height: '100vh',
                backgroundColor: '#263954',
                zIndex: 2,
                transition: 'right 0.3s ease-in-out',
                p: 2,
                textAlign: 'left',
                display: { xs: 'block', md: 'none' },
              }}
            >
              <Box
                sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', gap: 2 }}
              >
                <Button disabled>
                  <Box sx={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                    <Typography variant="body1" color="white">
                      Name Surname
                    </Typography>
                    <Typography variant="body1" color="white">
                      email@example.com
                    </Typography>
                  </Box>
                </Button>
                <Divider sx={{ color: 'primary.contrast' }} />
                {settings.map((setting, index) => (
                  <React.Fragment key={setting.name}>
                    <Button onClick={handleCloseUserMenu} component={Link} to={setting.route}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'flex-start',
                          textAlign: 'left',
                        }}
                      >
                        {setting.name === 'Profile' && <AccountCircleIcon sx={{ mr: 4, color: 'white' }} />}
                        <Typography variant="body2" color="white" sx={{ textAlign: 'left' }}>
                          {setting.name}
                        </Typography>
                      </Box>
                    </Button>
                    {index < settings.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </Box>
              <Button onClick={handleCloseUserMenu} sx={{ position: 'absolute', top: 0, left: 0 }}>
                <ArrowForwardIcon sx={{ color: 'white' }} />
              </Button>
            </Box>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};
