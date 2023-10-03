import { FC } from 'react';
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
  const location = useLocation();
  const isActive = (path: string): boolean => location.pathname === path;

  const [anchorElUser, setAnchorElUser] = React.useState<null | HTMLElement>(null);

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>): void => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = (): void => {
    setAnchorElUser(null);
  };

  const theme = useTheme();

  return (
    <AppBar position="static" sx={{ backgroundColor: otherColors.footerBackground }}>
      <Container maxWidth={false}>
        <Toolbar disableGutters variant="dense">
          {/* placeholder logo */}
          <Typography
            variant="h6"
            noWrap
            component="a"
            href="/"
            sx={{
              mr: 2,
              display: { xs: 'flex' },
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '.3rem',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            NEW LOGO
          </Typography>
          <Box sx={{ flexGrow: 1, display: { xs: 'flex' } }}>
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
                <AccountCircleIcon sx={{ color: theme.palette.primary.light }} />
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
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};
export default TopAppBar;
