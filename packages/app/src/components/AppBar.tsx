import { FC, useState } from 'react';
import {
  Typography,
  Box,
  AppBar,
  Container,
  Toolbar,
  MenuItem,
  Menu,
  Button,
  Tooltip,
  IconButton,
  useTheme,
  Divider,
} from '@mui/material';
import { otherColors } from '../IntakeThemeProvider';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import DashboardLogo from '../assets/icons/dashboardLogo.svg';
import MenuIcon from '@mui/icons-material/Menu';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

const pages = ['Dashboard'];
const settings = [
  {
    name: 'Profile',
    route: '/ProviderProfile',
  },
  {
    name: 'LOG OUT',
    route: '/Logout',
  },
];

const TopAppBar: FC = () => {
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const location = useLocation();
  const isActive = (path: string): boolean => location.pathname === path;

  const [anchorElUser, setAnchorElUser] = React.useState<null | HTMLElement>(null);

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>): void => {
    setAnchorElUser(event.currentTarget);
    setMenuOpen(true);
  };

  const handleCloseUserMenu = (): void => {
    setAnchorElUser(null);
    setMenuOpen(false);
  };

  const theme = useTheme();

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
          <Box component="img" src={DashboardLogo} mr={5} />
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
            {pages.map((page) => (
              <Button
                key={page}
                component={NavLink}
                to={`/${page.toLowerCase()}`}
                sx={{
                  my: 2,
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
                <AccountCircleIcon sx={{ color: theme.palette.primary.light, display: { xs: 'none', md: 'block' } }} />
                <MenuIcon sx={{ color: 'white', display: { md: 'none' } }} />
              </IconButton>
            </Tooltip>
            <Menu
              sx={{ mt: '45px', display: { xs: 'none', md: 'block' } }}
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
                <React.Fragment key={setting.name}>
                  <MenuItem onClick={handleCloseUserMenu} component={Link} to={setting.route}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {setting.name === 'Profile' && <AccountCircleIcon sx={{ mr: 4, color: 'text.light' }} />}
                      <Typography variant="body2" color="text.light">
                        {setting.name}
                      </Typography>
                    </Box>
                  </MenuItem>
                  {index < settings.length - 1 && <Divider />}
                </React.Fragment>
              ))}
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
export default TopAppBar;
