import React, { Dispatch, FC, Fragment, ReactElement, ReactNode, SetStateAction, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { KeyboardDoubleArrowRight } from '@mui/icons-material';
import {
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  useTheme,
} from '@mui/material';

export interface SidebarItem {
  label: string;
  icon: ReactElement;
  path: string;
}

interface SidebarProps {
  sidebarItems: SidebarItem[][];
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  children: ReactNode;
}

const CLOSED_DRAWER_WIDTH = 55;
const DRAWER_WIDTH = 250;

export const Sidebar: FC<SidebarProps> = ({ sidebarItems, sidebarOpen, setSidebarOpen, children }) => {
  const theme = useTheme();
  const { pathname } = useLocation();

  const selectedItem = useMemo(() => {
    // not sure why exactly this is a nested array but just going with it for now
    let outerIndex = 0;
    let innerIndex = 0;

    sidebarItems.forEach((list, oi) => {
      list.forEach((item, ii) => {
        const { path } = item;
        if (path === pathname) {
          outerIndex = oi;
          innerIndex = ii;
        }
      });
    });

    return [outerIndex, innerIndex];
  }, [pathname, sidebarItems]);

  const sideBarOpenLabel = `${sidebarOpen ? 'Close' : 'Open'} sidebar`;

  return (
    <Box>
      <Drawer
        variant="permanent"
        sx={{
          '& .MuiDrawer-paper': {
            position: 'absolute',
            width: sidebarOpen ? DRAWER_WIDTH : CLOSED_DRAWER_WIDTH,
            top: '81px',
            transitionProperty: 'width',
            transitionTimingFunction: sidebarOpen ? theme.transitions.easing.easeOut : theme.transitions.easing.sharp,
            transitionDuration: sidebarOpen
              ? theme.transitions.duration.leavingScreen
              : theme.transitions.duration.enteringScreen,
          },
        }}
      >
        <Box
          sx={{
            pl: 1,
          }}
        >
          <Tooltip title={sideBarOpenLabel} placement="right">
            <IconButton onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sideBarOpenLabel}>
              <KeyboardDoubleArrowRight
                sx={{
                  transform: sidebarOpen ? 'rotate(180deg);' : 'rotate(360deg)',
                  // transitionDuration: '500ms',
                  transitionProperty: 'transform',
                }}
              />
            </IconButton>
          </Tooltip>
        </Box>
        <Divider />
        <List>
          {sidebarItems.map((sidebarItemsSublist, outerIndex) => {
            return (
              <Fragment key={outerIndex}>
                {sidebarItemsSublist.map((sidebarItem: SidebarItem, innerIndex) => {
                  const isSelected = selectedItem[0] === outerIndex && selectedItem[1] === innerIndex;
                  return (
                    <ListItem sx={{ px: 0 }} key={sidebarItem.label}>
                      <Link
                        to={sidebarItem.path}
                        style={{
                          width: '100%',
                          textDecoration: 'none',
                          color: theme.palette.primary.main,
                        }}
                      >
                        <Tooltip title={sidebarItem.label} placement="right">
                          <ListItemButton selected={isSelected}>
                            <ListItemIcon sx={{ alignItems: 'center', minWidth: '40px' }}>
                              {sidebarItem.icon}
                            </ListItemIcon>
                            <ListItemText
                              primary={sidebarItem.label}
                              primaryTypographyProps={{
                                style: { fontWeight: 'bold' },
                              }}
                            />
                          </ListItemButton>
                        </Tooltip>
                      </Link>
                    </ListItem>
                  );
                })}
                {outerIndex !== sidebarItems.length - 1 && <Divider />}
              </Fragment>
            );
          })}
        </List>
      </Drawer>
      <Box
        sx={{
          ml: sidebarOpen ? `${DRAWER_WIDTH}px` : `${CLOSED_DRAWER_WIDTH}px`,
          pl: '20px',
          pr: '72px',
          transitionProperty: 'margin-left',
          transitionTimingFunction: sidebarOpen ? theme.transitions.easing.easeOut : theme.transitions.easing.sharp,
          transitionDuration: sidebarOpen // todo why is ms required here but not above
            ? `${theme.transitions.duration.leavingScreen}ms`
            : `${theme.transitions.duration.enteringScreen}ms`,
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
