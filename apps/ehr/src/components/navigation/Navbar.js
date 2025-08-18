"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Navbar;
var colors_1 = require("@ehrTheme/colors");
var icons_1 = require("@ehrTheme/icons");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var misc_helper_1 = require("src/helpers/misc.helper");
var utils_1 = require("utils");
var useEvolveUser_1 = require("../../hooks/useEvolveUser");
var nav_store_1 = require("../../state/nav.store");
var MobileMenu_1 = require("./MobileMenu");
var UserMenu_1 = require("./UserMenu");
var ORGANIZATION_NAME_SHORT = import.meta.env.VITE_APP_ORGANIZATION_NAME_SHORT;
if (ORGANIZATION_NAME_SHORT == null) {
    throw new Error('Could not load env variable');
}
var administratorNavbarItems = {
    'In Person': { urls: ['/visits', '/visit'] },
    Schedules: { urls: ['/schedules', '/schedule'] },
    Patients: { urls: ['/patients', '/patient'] },
    Employees: { urls: ['/employees', '/employee'] },
    'Telemedicine:Admin': { urls: ['/telemed-admin'] },
    Telemedicine: { urls: ['/telemed/appointments', '/telemed', '/video-call'] },
};
var managerNavbarItems = {
    'In Person': { urls: ['/visits', '/visit'] },
    Schedules: { urls: ['/schedules', '/schedule'] },
    Patients: { urls: ['/patients', '/patient'] },
    Employees: { urls: ['/employees', '/employee'] },
    'Telemedicine:Admin': { urls: ['/telemed-admin'] },
    Telemedicine: { urls: ['/telemed/appointments', '/telemed', '/video-call'] },
};
var staffNavbarItems = {
    'In Person': { urls: ['/visits', '/visit'] },
    Patients: { urls: ['/patients', '/patient'] },
};
var providerNavbarItems = {
    'In Person': { urls: ['/visits', '/visit'] },
    Patients: { urls: ['/patients', '/patient'] },
    Telemedicine: { urls: ['/telemed/appointments', '/telemed', '/video-call'] },
};
var hideNavbarPathPatterns = [/^\/telemed\/appointments\//, /^\/patient\/[^/]+\/info$/];
function Navbar() {
    var location = (0, react_router_dom_1.useLocation)();
    var currentTab = (0, nav_store_1.useNavStore)(function (state) { return state.currentTab; });
    var user = (0, useEvolveUser_1.default)();
    var theme = (0, material_1.useTheme)();
    var navbarItems = (0, react_1.useMemo)(function () {
        var navItems = {};
        if (user) {
            if (user.hasRole([utils_1.RoleType.Administrator])) {
                navItems = __assign(__assign({}, navItems), administratorNavbarItems);
            }
            if (user.hasRole([utils_1.RoleType.Manager])) {
                navItems = __assign(__assign({}, navItems), managerNavbarItems);
            }
            if (user.hasRole([utils_1.RoleType.Staff])) {
                navItems = __assign(__assign({}, navItems), staffNavbarItems);
            }
            if (user.hasRole([utils_1.RoleType.Provider])) {
                navItems = __assign(__assign({}, navItems), providerNavbarItems);
            }
        }
        return navItems;
    }, [user]);
    // on page load set the tab to the opened page
    var currentUrl = '/' + location.pathname.substring(1).split('/')[0];
    var isMobile = (0, material_1.useMediaQuery)(theme.breakpoints.down('sm'));
    (0, react_1.useEffect)(function () {
        if (!currentTab) {
            nav_store_1.useNavStore.setState({ currentTab: 'In Person' });
        }
        Object.keys(navbarItems).forEach(function (navbarItem) {
            if (navbarItems[navbarItem].urls.includes(currentUrl)) {
                nav_store_1.useNavStore.setState({ currentTab: navbarItem });
            }
        });
    }, [currentTab, currentUrl, location.pathname, navbarItems]);
    if (hideNavbarPathPatterns.some(function (pattern) { return pattern.test(location.pathname); })) {
        return null;
    }
    return (<material_1.AppBar position="sticky" color="transparent" sx={{
            boxShadow: 'none',
            borderBottom: "1px solid ".concat(colors_1.otherColors.lightDivider),
            backgroundColor: theme.palette.background.paper,
            top: (0, misc_helper_1.adjustTopForBannerHeight)(0),
        }}>
      <material_1.Container maxWidth="xl">
        <material_1.Toolbar disableGutters variant="dense">
          <react_router_dom_1.Link to="/">
            <img src={icons_1.logo} alt={"".concat(utils_1.PROJECT_NAME, " logo")} style={{
            marginRight: 20,
            marginTop: 10,
            width: 158,
        }}/>
          </react_router_dom_1.Link>
          {isMobile ? (<MobileMenu_1.default navbarItems={navbarItems}></MobileMenu_1.default>) : (<lab_1.TabList onChange={function (_, value) {
                nav_store_1.useNavStore.setState({ currentTab: value });
            }} sx={{
                mt: 2.5,
                minHeight: 60,
                flexGrow: 1,
            }}>
              {currentTab &&
                Object.keys(navbarItems).map(function (navbarItem, index) {
                    var _a;
                    return (<material_1.Tab key={navbarItem} label={navbarItem} value={navbarItem} id={"navbar-tab-".concat(index)} aria-controls={"hello-".concat(index)} // `tabpanel-${index}`
                     component={react_router_dom_1.Link} to={(_a = navbarItems[navbarItem].urls) === null || _a === void 0 ? void 0 : _a[0]} sx={{
                            fontSize: 16,
                            fontWeight: 500,
                            textTransform: 'capitalize',
                        }}/>);
                })}
            </lab_1.TabList>)}

          {/* <IconButton color="primary" sx={{ mr: 2 }}>
          <Settings />
        </IconButton> */}
          <UserMenu_1.UserMenu />
        </material_1.Toolbar>
      </material_1.Container>
    </material_1.AppBar>);
}
//# sourceMappingURL=Navbar.js.map