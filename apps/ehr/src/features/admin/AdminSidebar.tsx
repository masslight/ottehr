import { otherColors } from '@ehrTheme/colors';
import ArrowDropDownCircleOutlinedIcon from '@mui/icons-material/ArrowDropDownCircleOutlined';
import {
  Box,
  Collapse,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { FC, Fragment, ReactElement, ReactNode, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { adjustTopForBannerHeight } from 'src/helpers/misc.helper';
import { ArrowIcon } from '../visits/shared/components/Sidebar';
import { adminNavGroups } from './adminNav';
import { isItemActive } from './adminRoutes';

const CLOSED_DRAWER_WIDTH = 56;
const OPEN_DRAWER_WIDTH = 250;
// The sticky Navbar occupies this height; the sidebar starts just below it. In non-production the
// environment banner sits above the Navbar, so we offset by the banner height too (matching Navbar's
// own `top`) — otherwise the fixed sidebar slides up underneath the banner and Navbar.
const NAVBAR_OFFSET = adjustTopForBannerHeight(81);

interface AdminSidebarProps {
  children: ReactNode;
}

export const AdminSidebar: FC<AdminSidebarProps> = ({ children }) => {
  const theme = useTheme();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const drawerWidth = open ? OPEN_DRAWER_WIDTH : CLOSED_DRAWER_WIDTH;
  const sidebarToggleLabel = `${open ? 'Collapse' : 'Expand'} sidebar`;

  const toggleGroup = (groupLabel: string): void => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupLabel)) {
        next.delete(groupLabel);
      } else {
        next.add(groupLabel);
      }
      return next;
    });
  };

  const renderItem = (itemPath: string, label: string, icon: ReactNode): ReactNode => {
    const active = isItemActive(pathname, itemPath);
    return (
      <ListItem key={itemPath} disablePadding sx={{ display: 'block' }}>
        <Link to={itemPath} style={{ textDecoration: 'none', color: 'inherit' }}>
          <Tooltip title={open ? '' : label} placement="right">
            <ListItemButton
              selected={active}
              sx={{
                minHeight: 44,
                justifyContent: open ? 'initial' : 'center',
                px: 2,
                '&.Mui-selected': {
                  backgroundColor: theme.palette.action.hover,
                  borderRight: `2px solid ${theme.palette.primary.main}`,
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: open ? 2 : 'auto',
                  justifyContent: 'center',
                  color: active ? theme.palette.primary.main : theme.palette.text.secondary,
                }}
              >
                {icon}
              </ListItemIcon>
              <ListItemText
                primary={label}
                sx={{ opacity: open ? 1 : 0, m: 0 }}
                primaryTypographyProps={{
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  color: active ? theme.palette.primary.main : theme.palette.text.primary,
                  noWrap: true,
                }}
              />
            </ListItemButton>
          </Tooltip>
        </Link>
      </ListItem>
    );
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            position: 'fixed',
            top: `${NAVBAR_OFFSET}px`,
            height: `calc(100% - ${NAVBAR_OFFSET}px)`,
            width: drawerWidth,
            boxSizing: 'border-box',
            overflowX: 'hidden',
            borderRight: `1px solid ${theme.palette.divider}`,
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: open ? theme.transitions.duration.enteringScreen : theme.transitions.duration.leavingScreen,
            }),
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            minHeight: 48,
            px: open ? '10px' : 0,
            justifyContent: open ? 'flex-end' : 'center',
          }}
        >
          <Tooltip title={sidebarToggleLabel} placement="right">
            <IconButton
              onClick={() => setOpen((prev) => !prev)}
              aria-label={sidebarToggleLabel}
              sx={{
                width: 40,
                height: 40,
                padding: 0,
                '&:hover': {
                  backgroundColor: otherColors.sidebarItemHover,
                },
              }}
            >
              <ArrowIcon direction={open ? 'left' : 'right'} />
            </IconButton>
          </Tooltip>
        </Box>

        <List sx={{ py: 0 }}>
          {adminNavGroups.map((group) => {
            const groupCollapsed = collapsedGroups.has(group.label);
            return (
              <Fragment key={group.label}>
                <Tooltip title={open ? '' : group.label} placement="right">
                  <ListItemButton
                    onClick={() => toggleGroup(group.label)}
                    sx={{
                      padding: open ? '8px 16px 6px 16px' : '8px 0',
                      justifyContent: open ? 'space-between' : 'center',
                    }}
                    aria-label={`Toggle ${group.label} section`}
                  >
                    {open && (
                      <Typography
                        sx={{
                          flexGrow: 1,
                          fontSize: '14px',
                          fontWeight: 500,
                          letterSpacing: '0px',
                          textTransform: 'uppercase',
                          color: theme.palette.primary.dark,
                        }}
                      >
                        {group.label}
                      </Typography>
                    )}
                    <ArrowDropDownCircleOutlinedIcon
                      fontSize="small"
                      sx={{ color: theme.palette.primary.main, rotate: groupCollapsed ? '' : '180deg' }}
                    />
                  </ListItemButton>
                </Tooltip>
                <Collapse in={!groupCollapsed} timeout="auto" unmountOnExit>
                  {group.items.map((item) => renderItem(item.path, item.label, item.icon))}
                </Collapse>
              </Fragment>
            );
          })}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        {children}
      </Box>
    </Box>
  );
};

/**
 * Route layout that keeps the admin sidebar mounted across every `/admin/*` route — including the
 * detail/add pages (e.g. `/admin/employees/add`) that render their own components rather than going
 * through {@link AdminPage}. Nest admin routes under a `<Route element={<AdminLayout />}>`.
 */
export const AdminLayout: FC = (): ReactElement => (
  <AdminSidebar>
    <Outlet />
  </AdminSidebar>
);
