import React, { Dispatch, MouseEvent, ReactElement, SetStateAction, SyntheticEvent, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import {
  AccountCircle,
  KeyboardArrowDown,
  // Settings,
} from '@mui/icons-material';
import { TabList } from '@mui/lab';
import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  // IconButton,
  Menu,
  MenuItem,
  Skeleton,
  Tab,
  Toolbar,
  Typography,
  useTheme,
} from '@mui/material';
import logo from '../../assets/logo-4x.png';
import { useContext } from 'react';
import { IntakeDataContext } from '../../store/IntakeContext';
import { compareRoles } from '../../helpers/compareRoles';
import { RoleType } from '../../types/types';
import { otherColors } from '../../CustomThemeProvider';

const { VITE_APP_ORGANIZATION_NAME_SHORT: ORGANIZATION_NAME_SHORT } = import.meta.env;
if (ORGANIZATION_NAME_SHORT == null) {
  throw new Error('Could not load env variable');
}

interface NavbarItems {
  [key: string]: { urls: string[] };
}

const managerNavbarItems: NavbarItems = {
  'Tracking Board': { urls: ['/appointments', '/appointment'] },
  Offices: { urls: ['/offices', '/office'] },
  Employees: { urls: ['/employees', '/employee'] },
};

const frontDeskNavbarItems: NavbarItems = {
  'Tracking Board': { urls: ['/appointments', '/appointment'] },
  Offices: { urls: ['/offices', '/office'] },
  Employees: { urls: ['/employees', '/employee'] },
};

const staffNavbarItems: NavbarItems = {
  'Tracking Board': { urls: ['/appointments', '/appointment'] },
};

const providerNavbarItems: NavbarItems = {
  'Tracking Board': { urls: ['/appointments', '/appointment'] },
};

interface NavbarProps {
  setCurrentTab: Dispatch<SetStateAction<string>>;
}

export default function Navbar({ setCurrentTab }: NavbarProps): ReactElement {
  const theme = useTheme();
  const location = useLocation();
  const { getAccessTokenSilently } = useAuth0();
  const { state } = useContext(IntakeDataContext);
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const [navbarItems, setNavbarItems] = useState<NavbarItems>({});

  // on page load set the tab to the opened page
  useEffect(() => {
    const currentUrl = '/' + location.pathname.substring(1).split('/')[0];

    Object.keys(navbarItems).forEach((navbarItem) => {
      if (navbarItems[navbarItem].urls.includes(currentUrl)) {
        setCurrentTab(navbarItem);
      }
    });
  }, [location.pathname, navbarItems, setCurrentTab]);

  useEffect(() => {
    async function getNavbarFromAccessPolicy(): Promise<void> {
      if (compareRoles((state.user as any)?.roles[0]?.name, RoleType.Manager)) {
        setNavbarItems(managerNavbarItems);
      } else if (compareRoles((state.user as any)?.roles[0]?.name, RoleType.FrontDesk)) {
        setNavbarItems(frontDeskNavbarItems);
      } else if (compareRoles((state.user as any)?.roles[0]?.name, RoleType.Provider)) {
        setNavbarItems(providerNavbarItems);
      } else if (compareRoles((state.user as any)?.roles[0]?.name, RoleType.Staff)) {
        setNavbarItems(staffNavbarItems);
      }
    }

    getNavbarFromAccessPolicy().catch((error) => {
      console.log(error);
    });
  }, [getAccessTokenSilently, state.user]);

  return (
    <AppBar
      position="static"
      color="transparent"
      sx={{
        boxShadow: 'none',
        backgroundColor: otherColors.headerBackground,
      }}
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters variant="dense">
          <Link to="/">
            <img
              src={logo}
              alt={`${ORGANIZATION_NAME_SHORT} logo`}
              style={{
                marginRight: 20,
                marginTop: 10,
                width: 158,
              }}
            />
          </Link>
          <TabList
            onChange={(_: SyntheticEvent, value: string) => {
              setCurrentTab(value);
            }}
            sx={{
              mt: 2.5,
              minHeight: 60,
              flexGrow: 1,
            }}
          >
            {Object.keys(navbarItems).map((navbarItem, index) => (
              <Tab
                key={navbarItem}
                label={navbarItem}
                value={navbarItem}
                id={`navbar-tab-${index}`}
                aria-controls={`hello-${index}`} // `tabpanel-${index}`
                component={Link}
                to={navbarItems[navbarItem].urls[0]}
                sx={{
                  fontSize: 16,
                  textTransform: 'capitalize',
                  color: '#FFFFFF',
                }}
              />
            ))}
          </TabList>
          {/* <IconButton color="primary" sx={{ mr: 2 }}>
            <Settings />
          </IconButton> */}
          <Typography variant="body1" sx={{ mr: 2, color: '#FFFFFF' }}>
            {state.user?.name || <Skeleton width={100} aria-busy="true" />}
          </Typography>
          <Button
            color="primary"
            aria-label="open user account menu"
            aria-controls="user-menu"
            aria-haspopup="true"
            onClick={(event: MouseEvent<HTMLElement>) => setAnchorElement(event.currentTarget)}
            endIcon={<KeyboardArrowDown />}
          >
            <AccountCircle />
          </Button>
          <Menu
            id="user-menu"
            anchorEl={anchorElement}
            open={anchorElement !== null}
            onClose={() => setAnchorElement(null)}
          >
            <MenuItem>
              <Box>
                <Typography variant="body1">{ORGANIZATION_NAME_SHORT} Admin</Typography>
                <Typography variant="caption">{state.user?.email}</Typography>
              </Box>
            </MenuItem>
            <Divider />
            <Link to="/logout" style={{ textDecoration: 'none' }}>
              <MenuItem>
                <Typography variant="body1" color="primary" sx={{ fontWeight: 'bold' }}>
                  Log out
                </Typography>
              </MenuItem>
            </Link>
          </Menu>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
