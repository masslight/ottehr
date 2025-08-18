"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MobileMenu;
var Menu_1 = require("@mui/icons-material/Menu");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var nav_store_1 = require("../../state/nav.store");
function MobileMenu(_a) {
    var navbarItems = _a.navbarItems;
    var _b = (0, react_1.useState)(null), anchorEl = _b[0], setAnchorEl = _b[1];
    var theme = (0, material_1.useTheme)();
    var navigate = (0, react_router_dom_1.useNavigate)();
    return (<material_1.Box sx={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
      <material_1.IconButton onClick={function (e) { return setAnchorEl(e.currentTarget); }}>
        <Menu_1.default fontSize="large" sx={{ color: theme.palette.primary.main }}></Menu_1.default>
      </material_1.IconButton>
      <material_1.Menu id="mobile-menu" anchorEl={anchorEl} open={!!anchorEl} onClose={function () { return setAnchorEl(null); }} MenuListProps={{
            'aria-labelledby': 'basic-button',
        }}>
        {Object.keys(navbarItems).map(function (navbarItem) { return (<material_1.MenuItem key={navbarItem} onClick={function () {
                var _a;
                nav_store_1.useNavStore.setState({ currentTab: navbarItem });
                navigate((_a = navbarItems[navbarItem].urls) === null || _a === void 0 ? void 0 : _a[0]);
                setAnchorEl(null);
            }}>
            {navbarItem}
          </material_1.MenuItem>); })}
      </material_1.Menu>
    </material_1.Box>);
}
//# sourceMappingURL=MobileMenu.js.map