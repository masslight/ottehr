import { useAuth0 } from '@auth0/auth0-react';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import MenuIcon from '@mui/icons-material/Menu';
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
  alpha,
  useTheme,
} from '@mui/material';
import { FC, MouseEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { otherColors } from '../OttehrThemeProvider';
import { dashboardLogo } from '../assets/icons';
import { usePractitioner } from '../store';

const pages = ['Dashboard'];

export const TopAppBar: FC = () => {
  const { logout } = useAuth0();
  const location = useLocation();
  const theme = useTheme();
  const { t } = useTranslation();
  const { provider } = usePractitioner();
  const [anchorElUser, setAnchorElUser] = useState<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const isActive = (path: string): boolean => location.pathname === path;

  const handleOpenUserMenu = (event: MouseEvent<HTMLElement>): void => {
    setAnchorElUser(event.currentTarget);
    setMenuOpen(true);
  };

  const handleCloseUserMenu = (): void => {
    setAnchorElUser(null);
    setMenuOpen(false);
    console.log('close');
  };

  return (
    <AppBar position="static" sx={{ backgroundColor: otherColors.footerBackground }}>
      <Container maxWidth={false}>
        <Toolbar
          disableGutters
          sx={{
            [theme.breakpoints.down('md')]: {
              display: 'flex',
              justifyContent: 'space-between',
            },
          }}
          variant="dense"
        >
          <Box component="img" mr={5} src={dashboardLogo} />
          <Box sx={{ display: { md: 'flex', xs: 'none' }, flexGrow: 1 }}>
            {pages.map((page) => (
              <Button
                key={page}
                component={NavLink}
                sx={{
                  '&.active': { color: theme.palette.primary.light },
                  color: isActive(`/${page.toLowerCase()}`)
                    ? theme.palette.primary.light
                    : alpha(theme.palette.background.default, 0.7),
                  display: 'block',
                  my: 2,
                  textDecoration: 'none',
                }}
                to={`/${page.toLowerCase()}`}
              >
                {page}
              </Button>
            ))}
          </Box>
          <Box sx={{ flexGrow: 0 }}>
            <Tooltip title={t('general.openSettings')}>
              <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                <AccountCircleIcon sx={{ color: theme.palette.primary.light, display: { md: 'block', xs: 'none' } }} />
                <MenuIcon sx={{ color: theme.palette.primary.light, display: { md: 'none' } }} />
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
              sx={{ display: { md: 'block', xs: 'none' }, mt: '45px' }}
              transformOrigin={{
                horizontal: 'right',
                vertical: 'top',
              }}
            >
              <MenuItem disabled>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="body1">
                    {provider?.firstName} {provider?.lastName}
                  </Typography>
                  <Typography variant="body1">{provider?.email}</Typography>
                </Box>
              </MenuItem>
              <Divider />
              <MenuItem component={Link} onClick={handleCloseUserMenu} to="/profile">
                <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'center' }}>
                  <AccountCircleIcon sx={{ color: 'text.light', mr: 4 }} />
                  <Typography color="text.light" variant="body2">
                    {t('general.profile')}
                  </Typography>
                </Box>
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  handleCloseUserMenu();
                  logout();
                }}
              >
                <Box sx={{ alignItems: 'center', display: 'flex', justifyContent: 'center' }}>
                  <Typography color="text.light" variant="body2">
                    {t('general.logOut')}
                  </Typography>
                </Box>
              </MenuItem>
            </Menu>

            {/* {menuOpen && ( */}
            <Box
              sx={{
                backgroundColor: otherColors.darkBackgroundPaper,
                display: {
                  md: 'none',
                  xs: 'block',
                },
                height: '100vh',
                p: 2,
                position: 'fixed',
                right: menuOpen ? 0 : '-100%',
                textAlign: 'left',
                top: 0,
                transition: 'right 0.3s ease-in-out',
                width: '60%',
                zIndex: 2,
              }}
            >
              <Box
                sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%', justifyContent: 'flex-end' }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', px: 2, py: 1, textAlign: 'left' }}>
                  <Typography color="white" variant="body1">
                    {provider?.firstName} {provider?.lastName}
                  </Typography>
                  <Typography color="white" sx={{ wordWrap: 'break-word' }} variant="subtitle2">
                    {provider?.email}
                  </Typography>
                </Box>
                <Divider sx={{ color: 'primary.contrast' }} />
                <MenuItem component={Link} onClick={handleCloseUserMenu} to="/profile">
                  <Box
                    sx={{
                      alignItems: 'center',
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <AccountCircleIcon sx={{ color: theme.palette.background.default, mr: 2 }} />
                    <Typography color={theme.palette.background.default} variant="body2">
                      {t('general.profile')}
                    </Typography>
                  </Box>
                </MenuItem>
                <Divider />
                <MenuItem
                  onClick={() => {
                    handleCloseUserMenu();
                    logout();
                  }}
                >
                  <Box
                    sx={{
                      alignItems: 'center',
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography color={theme.palette.background.default} variant="body2">
                      {t('general.logOut')}
                    </Typography>
                  </Box>
                </MenuItem>
              </Box>
              <Button onClick={handleCloseUserMenu} sx={{ left: 0, position: 'absolute', top: 0 }}>
                <ArrowForwardIcon sx={{ color: 'white' }} />
              </Button>
            </Box>
            {/* )} */}
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};
