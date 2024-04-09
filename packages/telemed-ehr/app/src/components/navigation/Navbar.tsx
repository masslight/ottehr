import { AccountCircle, KeyboardArrowDown } from '@mui/icons-material';
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
import { MouseEvent, ReactElement, SyntheticEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../../assets/logo-4x.png';
import { useUserRole } from '../../hooks/useUserRole';
import { useCommonStore } from '../../state/common.store';
import { AppTab, useNavStore } from '../../state/nav.store';
import { RoleType } from '../../types/types';
import { otherColors } from '../../CustomThemeProvider';

const { VITE_APP_ORGANIZATION_NAME_SHORT: ORGANIZATION_NAME_SHORT } = import.meta.env;
if (ORGANIZATION_NAME_SHORT == null) {
  throw new Error('Could not load env variable');
}

type NavbarItems = {
  [key in AppTab]?: { urls: string[] };
};

const administratorNavbarItems: NavbarItems = {
  'Urgent Care': { urls: ['/visits', '/visit'] },
  Offices: { urls: ['/offices', '/office'] },
  Patients: { urls: ['/patients', '/patient'] },
  Employees: { urls: ['/employees', '/employee'] },
  Telemed: { urls: ['/telemed/appointments', '/telemed', '/video-call'] },
};

const managerNavbarItems: NavbarItems = {
  'Urgent Care': { urls: ['/visits', '/visit'] },
  Offices: { urls: ['/offices', '/office'] },
  Patients: { urls: ['/patients', '/patient'] },
  Employees: { urls: ['/employees', '/employee'] },
  Telemed: { urls: ['/telemed/appointments', '/telemed', '/video-call'] },
};

const staffNavbarItems: NavbarItems = {
  'Urgent Care': { urls: ['/visits', '/visit'] },
  Patients: { urls: ['/patients', '/patient'] },
};

const providerNavbarItems: NavbarItems = {
  Telemed: { urls: ['/telemed/appointments', '/telemed'] },
  'Urgent Care': { urls: ['/visits', '/visit'] },
  Patients: { urls: ['/patients', '/patient'] },
};

export default function Navbar(): ReactElement {
  const theme = useTheme();
  const location = useLocation();
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const user = useCommonStore((state) => state.user);
  const role = useUserRole();
  const currentTab = useNavStore((state) => state.currentTab);

  const navbarItems: NavbarItems = useMemo(() => {
    let navItems = {};

    if (role === RoleType.Administrator) {
      navItems = administratorNavbarItems;
    } else if (role === RoleType.Manager) {
      navItems = managerNavbarItems;
    } else if (role === RoleType.Staff) {
      navItems = staffNavbarItems;
    } else if (role === RoleType.Provider) {
      navItems = providerNavbarItems;
    }

    return navItems;
  }, [role]);

  // on page load set the tab to the opened page
  const currentUrl = '/' + location.pathname.substring(1).split('/')[0];

  useEffect(() => {
    if (!currentTab) {
      useNavStore.setState({ currentTab: 'Urgent Care' });
    }

    (Object.keys(navbarItems) as AppTab[]).forEach((navbarItem) => {
      if (navbarItems[navbarItem]!.urls.includes(currentUrl)) {
        useNavStore.setState({ currentTab: navbarItem });
      }
    });
  }, [currentTab, currentUrl, location.pathname, navbarItems]);

  if (location.pathname.match(/^\/telemed\/appointments\//)) {
    return <></>;
  }

  return (
    <AppBar
      position="sticky"
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
              useNavStore.setState({ currentTab: value });
            }}
            sx={{
              mt: 2.5,
              minHeight: 60,
              flexGrow: 1,
            }}
          >
            {currentTab &&
              (Object.keys(navbarItems) as AppTab[]).map((navbarItem, index) => (
                <Tab
                  key={navbarItem}
                  label={navbarItem}
                  value={navbarItem}
                  id={`navbar-tab-${index}`}
                  aria-controls={`hello-${index}`} // `tabpanel-${index}`
                  component={Link}
                  to={navbarItems[navbarItem]!.urls?.[0]}
                  sx={{
                    fontSize: 16,
                    fontWeight: 700,
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
            {user?.name || <Skeleton width={100} aria-busy="true" />}
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
                <Typography variant="caption">{user?.email}</Typography>
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
