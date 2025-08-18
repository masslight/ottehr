"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var CSSLoader_1 = require("../components/CSSLoader");
var featureFlags_1 = require("../context/featureFlags");
var NavigationContext_1 = require("../context/NavigationContext");
var useCSSPermissions_1 = require("../hooks/useCSSPermissions");
var CSSLayout_1 = require("../layout/CSSLayout");
var CSSRouting = function () {
    var permissions = (0, useCSSPermissions_1.useCSSPermissions)();
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _a = (0, NavigationContext_1.useNavigationContext)() || {}, _b = _a.availableRoutes, availableRoutes = _b === void 0 ? [] : _b, _c = _a.isLoading, isLoading = _c === void 0 ? true : _c;
    if (permissions.isPending || isLoading) {
        return <CSSLoader_1.CSSLoader />;
    }
    if (!permissions.view) {
        navigate('/visits');
        return null;
    }
    return (<featureFlags_1.FeatureFlagsProvider flagsToSet={{ css: true }}>
      <react_router_dom_1.Routes>
        <react_router_dom_1.Route element={<CSSLayout_1.CSSLayout />}>
          <react_router_dom_1.Route index element={<react_router_dom_1.Navigate to={availableRoutes[0].path} replace/>}/>
          {availableRoutes.map(function (route) { return (<react_router_dom_1.Route key={route.path} path={route.path} element={route.element}/>); })}
          {/* redirect unavailable page to the first available page, use-case - intake mode trying to open provider page */}
          <react_router_dom_1.Route path="*" element={<react_router_dom_1.Navigate to={availableRoutes[0].path} replace/>}/>
        </react_router_dom_1.Route>
      </react_router_dom_1.Routes>
    </featureFlags_1.FeatureFlagsProvider>);
};
var CSSRoutingWithNavigationContext = function () {
    return (<NavigationContext_1.NavigationProvider>
      <CSSRouting />
    </NavigationContext_1.NavigationProvider>);
};
exports.default = CSSRoutingWithNavigationContext;
//# sourceMappingURL=CSSRouting.js.map