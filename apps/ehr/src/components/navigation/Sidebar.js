"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sidebar = void 0;
var icons_material_1 = require("@mui/icons-material");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var CLOSED_DRAWER_WIDTH = 55;
var DRAWER_WIDTH = 250;
var Sidebar = function (_a) {
    var sidebarItems = _a.sidebarItems, sidebarOpen = _a.sidebarOpen, setSidebarOpen = _a.setSidebarOpen, children = _a.children;
    var theme = (0, material_1.useTheme)();
    var pathname = (0, react_router_dom_1.useLocation)().pathname;
    var selectedItem = (0, react_1.useMemo)(function () {
        // not sure why exactly this is a nested array but just going with it for now
        var outerIndex = 0;
        var innerIndex = 0;
        sidebarItems.forEach(function (list, oi) {
            list.forEach(function (item, ii) {
                var path = item.path;
                if (path === pathname) {
                    outerIndex = oi;
                    innerIndex = ii;
                }
            });
        });
        return [outerIndex, innerIndex];
    }, [pathname, sidebarItems]);
    var sideBarOpenLabel = "".concat(sidebarOpen ? 'Close' : 'Open', " sidebar");
    return (<material_1.Box>
      <material_1.Drawer variant="permanent" sx={{
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
        }}>
        <material_1.Box sx={{
            pl: 1,
        }}>
          <material_1.Tooltip title={sideBarOpenLabel} placement="right">
            <material_1.IconButton onClick={function () { return setSidebarOpen(!sidebarOpen); }} aria-label={sideBarOpenLabel}>
              <icons_material_1.KeyboardDoubleArrowRight sx={{
            transform: sidebarOpen ? 'rotate(180deg);' : 'rotate(360deg)',
            // transitionDuration: '500ms',
            transitionProperty: 'transform',
        }}/>
            </material_1.IconButton>
          </material_1.Tooltip>
        </material_1.Box>
        <material_1.Divider />
        <material_1.List>
          {sidebarItems.map(function (sidebarItemsSubList, outerIndex) {
            return (<react_1.Fragment key={outerIndex}>
                {sidebarItemsSubList.map(function (sidebarItem, innerIndex) {
                    var isSelected = selectedItem[0] === outerIndex && selectedItem[1] === innerIndex;
                    return (<material_1.ListItem sx={{ px: 0 }} key={sidebarItem.label}>
                      <react_router_dom_1.Link to={sidebarItem.path} style={{
                            width: '100%',
                            textDecoration: 'none',
                            color: theme.palette.primary.main,
                        }}>
                        <material_1.Tooltip title={sidebarItem.label} placement="right">
                          <material_1.ListItemButton selected={isSelected}>
                            <material_1.ListItemIcon sx={{ alignItems: 'center', minWidth: '40px' }}>
                              {sidebarItem.icon}
                            </material_1.ListItemIcon>
                            <material_1.ListItemText primary={sidebarItem.label} primaryTypographyProps={{
                            style: { fontWeight: 'bold' },
                        }}/>
                          </material_1.ListItemButton>
                        </material_1.Tooltip>
                      </react_router_dom_1.Link>
                    </material_1.ListItem>);
                })}
                {outerIndex !== sidebarItems.length - 1 && <material_1.Divider />}
              </react_1.Fragment>);
        })}
        </material_1.List>
      </material_1.Drawer>
      <material_1.Box sx={{
            ml: sidebarOpen ? "".concat(DRAWER_WIDTH, "px") : "".concat(CLOSED_DRAWER_WIDTH, "px"),
            pl: '20px',
            pr: '72px',
            transitionProperty: 'margin-left',
            transitionTimingFunction: sidebarOpen ? theme.transitions.easing.easeOut : theme.transitions.easing.sharp,
            transitionDuration: sidebarOpen // todo why is ms required here but not above
                ? "".concat(theme.transitions.duration.leavingScreen, "ms")
                : "".concat(theme.transitions.duration.enteringScreen, "ms"),
        }}>
        {children}
      </material_1.Box>
    </material_1.Box>);
};
exports.Sidebar = Sidebar;
//# sourceMappingURL=Sidebar.js.map