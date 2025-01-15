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
import useOttehrUser from '../../hooks/useOttehrUser';
import { AppTab, useNavStore } from '../../state/nav.store';
import { isLocalOrDevOrTestingOrTrainingEnv } from '../../telemed/utils/env.helper';
import { RoleType } from '../../types/types';
import { otherColors } from '../../CustomThemeProvider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Calendar, UserSquare2, Building2, Video, Settings } from 'lucide-react';
import { getInitials } from '@/lib/utils';

const { VITE_APP_ORGANIZATION_NAME_SHORT: ORGANIZATION_NAME_SHORT } = import.meta.env;
if (ORGANIZATION_NAME_SHORT == null) {
  throw new Error('Could not load env variable');
}

type NavbarItems = {
  [key in AppTab]?: {
    urls: string[];
    icon: React.ReactNode;
  };
};

const administratorNavbarItems: NavbarItems = {
  'In Person': {
    urls: ['/visits', '/visit'],
    icon: <Building2 className="h-4 w-4" />,
  },
  Schedules: {
    urls: ['/schedules', '/schedule'],
    icon: <Calendar className="h-4 w-4" />,
  },
  Patients: {
    urls: ['/patients', '/patient'],
    icon: <Users className="h-4 w-4" />,
  },
  Employees: {
    urls: ['/employees', '/employee'],
    icon: <UserSquare2 className="h-4 w-4" />,
  },
};

const managerNavbarItems: NavbarItems = {
  'In Person': { urls: ['/visits', '/visit'] },
  Schedules: { urls: ['/schedules', '/schedule'] },
  Patients: { urls: ['/patients', '/patient'] },
  Employees: { urls: ['/employees', '/employee'] },
};

const staffNavbarItems: NavbarItems = {
  'In Person': { urls: ['/visits', '/visit'] },
  Patients: { urls: ['/patients', '/patient'] },
};

const providerNavbarItems: NavbarItems = {
  'In Person': { urls: ['/visits', '/visit'] },
  Patients: { urls: ['/patients', '/patient'] },
};

administratorNavbarItems['Admin'] = {
  urls: ['/telemed-admin'],
  icon: <Settings className="h-4 w-4" />,
};
administratorNavbarItems['Telemedicine'] = {
  urls: ['/telemed/appointments', '/telemed', '/video-call'],
  icon: <Video className="h-4 w-4" />,
};
managerNavbarItems['Admin'] = { urls: ['/telemed-admin'] };
providerNavbarItems['Telemedicine'] = { urls: ['/telemed/appointments', '/telemed', '/video-call'] };
providerNavbarItems['Employees'] = { urls: ['/employees', '/employee'] };

export default function Navbar(): ReactElement {
  const theme = useTheme();
  const location = useLocation();
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const currentTab = useNavStore((state) => state.currentTab);
  const user = useOttehrUser();

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

  if (location.pathname.match(/^\/telemed\/appointments\//) || location.pathname.match(/^\/visit\//)) {
    return <></>;
  }

  return (
    <div className="sticky top-0 z-50 bg-white border-b border-gray-200 flex flex-col">
      <Container maxWidth="xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Link to="/">
              {/* <img
                src={logo}
                alt={`${ORGANIZATION_NAME_SHORT} logo`}
                style={{
                  marginRight: 20,
                  marginTop: 10,
                  width: 158,
                  height: 40,
                }}
              /> */}
              <h1 className="text-3xl font-bold text-black">
                Conjure<span className="text-red-500">EHR</span>
              </h1>
            </Link>
          </div>
          <div>
            <TabList
              onChange={(_: SyntheticEvent, value: string) => {
                useNavStore.setState({ currentTab: value });
              }}
              sx={{
                mt: 2.5,
                minHeight: 60,
                flexGrow: 1,
                '& .MuiTabs-indicator': {
                  backgroundColor: '#ED1B24', // or any yellow color you prefer
                },
                '& .Mui-selected': {
                  color: '#ED1B24 !important', // active tab text color
                },
              }}
              // textColor="primary"
              // indicatorColor="primary"
            >
              {currentTab &&
                (Object.keys(navbarItems) as AppTab[]).map((navbarItem, index) => (
                  <Tab
                    key={navbarItem}
                    label={
                      <div className="flex flex-col items-center gap-1 rounded-md">
                        {/* {navbarItems[navbarItem.toString()].icon} */}
                        <Users className="h-4 w-4" />
                        {navbarItem}
                      </div>
                    }
                    value={navbarItem}
                    id={`navbar-tab-${index}`}
                    aria-controls={`hello-${index}`} // `tabpanel-${index}`
                    component={Link}
                    to={navbarItems[navbarItem]!.urls?.[0]}
                    sx={{
                      fontSize: 16,
                      fontWeight: 700,
                      textTransform: 'capitalize',
                      color: '#000000',
                    }}
                  />
                ))}
            </TabList>
          </div>

          <div className="flex items-center justify-between">
            {/* <Typography variant="body1" sx={{ mr: 2, color: '#000000' }}>
              {user?.name || <Skeleton width={100} aria-busy="true" />}
            </Typography> */}
            <Button
              sx={{ color: '#ef4444' }} // Tailwind red-500 color
              aria-label="open user account menu"
              aria-controls="user-menu"
              aria-haspopup="true"
              onClick={(event: MouseEvent<HTMLElement>) => setAnchorElement(event.currentTarget)}
              endIcon={<KeyboardArrowDown />}
            >
              <Avatar className="w-8 h-8">
                <AvatarImage src={`https://randomuser.me/api/portraits/med/men/${100}.jpg`} />
                <AvatarFallback className="bg-blue-50 text-black">
                  {getInitials(user?.name)}
                  {/* CV */}
                </AvatarFallback>
              </Avatar>
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
                  <Typography variant="body1" color="#ef4444" sx={{ fontWeight: 'bold' }}>
                    Log out
                  </Typography>
                </MenuItem>
              </Link>
            </Menu>
          </div>
        </div>
      </Container>
    </div>
  );
}
