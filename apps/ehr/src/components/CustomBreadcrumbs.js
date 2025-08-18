"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CustomBreadcrumbs;
var material_1 = require("@mui/material");
var react_router_dom_1 = require("react-router-dom");
var data_test_ids_1 = require("src/constants/data-test-ids");
function CustomBreadcrumbs(_a) {
    var chain = _a.chain;
    var location = (0, react_router_dom_1.useLocation)();
    var theme = (0, material_1.useTheme)();
    return (<material_1.Breadcrumbs aria-label="breadcrumb" data-testid={data_test_ids_1.dataTestIds.patientInformationPage.breadcrumb}>
      {chain.map(function (child) {
            var _a;
            var link = child.link === '#' ? location.pathname + location.search : child.link;
            return (<react_router_dom_1.Link key={child.link} style={{
                    textDecoration: 'none',
                    color: child.link === '#' ? 'black' : theme.palette.secondary.light,
                }} to={link} state={{ defaultTab: (_a = child.state) === null || _a === void 0 ? void 0 : _a.defaultTab }}>
            {child.children}
          </react_router_dom_1.Link>);
        })}
    </material_1.Breadcrumbs>);
}
//# sourceMappingURL=CustomBreadcrumbs.js.map