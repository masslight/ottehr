import { useAuth0 } from '@auth0/auth0-react';
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
import { FC, MouseEvent, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { otherColors } from '../OttEHRThemeProvider';
import { dashboardLogo } from '../assets/icons';

const pages = ['Dashboard'];

export const TopAppBar: FC = () => {
  const { logout } = useAuth0();
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
          <Box component="img" mr={5} src={dashboardLogo} />
          <Box sx={{ display: { xs: 'flex' }, flexGrow: 1 }}>
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
                <AccountCircleIcon sx={{ color: 'primary.light' }} />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={anchorElUser}
              anchorOrigin={{
                horizontal: 'right',
                vertical: 'top',
              }}
              id="menu-appbar"
              keepMounted
              onClose={handleCloseUserMenu}
              open={Boolean(anchorElUser)}
              transformOrigin={{
                horizontal: 'right',
                vertical: 'top',
              }}
              sx={{ mt: '45px' }}
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
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};
