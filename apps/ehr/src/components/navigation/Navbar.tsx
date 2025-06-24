import { otherColors } from '@ehrTheme/colors';
import { logo } from '@ehrTheme/icons';
import { TabList } from '@mui/lab';
import { AppBar, Container, Tab, Toolbar, useMediaQuery, useTheme } from '@mui/material';
import { ReactElement, SyntheticEvent, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { adjustTopForBannerHeight } from 'src/helpers/misc.helper';
import { PROJECT_NAME, RoleType } from 'utils';
import useEvolveUser from '../../hooks/useEvolveUser';
import { AppTab, useNavStore } from '../../state/nav.store';
import MobileMenu from './MobileMenu';
import { UserMenu } from './UserMenu';

const { VITE_APP_ORGANIZATION_NAME_SHORT: ORGANIZATION_NAME_SHORT } = import.meta.env;
if (ORGANIZATION_NAME_SHORT == null) {
  throw new Error('Could not load env variable');
}

export type NavbarItems = {
  [key in AppTab]?: { urls: string[] };
};

const administratorNavbarItems: NavbarItems = {
  'In Person': { urls: ['/visits', '/visit'] },
  Schedules: { urls: ['/schedules', '/schedule'] },
  Patients: { urls: ['/patients', '/patient'] },
  Employees: { urls: ['/employees', '/employee'] },
  'Telemedicine:Admin': { urls: ['/telemed-admin'] },
  Telemedicine: { urls: ['/telemed/appointments', '/telemed', '/video-call'] },
};

const managerNavbarItems: NavbarItems = {
  'In Person': { urls: ['/visits', '/visit'] },
  Schedules: { urls: ['/schedules', '/schedule'] },
  Patients: { urls: ['/patients', '/patient'] },
  Employees: { urls: ['/employees', '/employee'] },
  'Telemedicine:Admin': { urls: ['/telemed-admin'] },
  Telemedicine: { urls: ['/telemed/appointments', '/telemed', '/video-call'] },
};

const staffNavbarItems: NavbarItems = {
  'In Person': { urls: ['/visits', '/visit'] },
  Patients: { urls: ['/patients', '/patient'] },
};

const providerNavbarItems: NavbarItems = {
  'In Person': { urls: ['/visits', '/visit'] },
  Patients: { urls: ['/patients', '/patient'] },
  Telemedicine: { urls: ['/telemed/appointments', '/telemed', '/video-call'] },
};

const hideNavbarPathPatterns = [/^\/telemed\/appointments\//, /^\/patient\/[^/]+\/info$/];

export default function Navbar(): ReactElement | null {
  const location = useLocation();
  const currentTab = useNavStore((state) => state.currentTab);
  const user = useEvolveUser();
  const theme = useTheme();

  const navbarItems: NavbarItems = useMemo(() => {
    let navItems = {};

    if (user) {
      if (user.hasRole([RoleType.Administrator])) {
        navItems = { ...navItems, ...administratorNavbarItems };
      }
      if (user.hasRole([RoleType.Manager])) {
        navItems = { ...navItems, ...managerNavbarItems };
      }
      if (user.hasRole([RoleType.Staff])) {
        navItems = { ...navItems, ...staffNavbarItems };
      }
      if (user.hasRole([RoleType.Provider])) {
        navItems = { ...navItems, ...providerNavbarItems };
      }
    }
    return navItems;
  }, [user]);

  // on page load set the tab to the opened page
  const currentUrl = '/' + location.pathname.substring(1).split('/')[0];

  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    if (!currentTab) {
      useNavStore.setState({ currentTab: 'In Person' });
    }

    (Object.keys(navbarItems) as AppTab[]).forEach((navbarItem) => {
      if (navbarItems[navbarItem]!.urls.includes(currentUrl)) {
        useNavStore.setState({ currentTab: navbarItem });
      }
    });
  }, [currentTab, currentUrl, location.pathname, navbarItems]);

  if (hideNavbarPathPatterns.some((pattern) => pattern.test(location.pathname))) {
    return null;
  }

  return (
    <AppBar
      position="sticky"
      color="transparent"
      sx={{
        boxShadow: 'none',
        borderBottom: `1px solid ${otherColors.lightDivider}`,
        backgroundColor: theme.palette.background.paper,
        top: adjustTopForBannerHeight(0),
      }}
    >
      <Container maxWidth="xl">
        <Toolbar disableGutters variant="dense">
          <Link to="/">
            <img
              src={logo}
              alt={`${PROJECT_NAME} logo`}
              style={{
                marginRight: 20,
                marginTop: 10,
                width: 158,
              }}
            />
          </Link>
          {isMobile ? (
            <MobileMenu navbarItems={navbarItems}></MobileMenu>
          ) : (
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
                      fontWeight: 500,
                      textTransform: 'capitalize',
                    }}
                  />
                ))}
            </TabList>
          )}

          {/* <IconButton color="primary" sx={{ mr: 2 }}>
            <Settings />
          </IconButton> */}
          <UserMenu />
        </Toolbar>
      </Container>
    </AppBar>
  );
}
