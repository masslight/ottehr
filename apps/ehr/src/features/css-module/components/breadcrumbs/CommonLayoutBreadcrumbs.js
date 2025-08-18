"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonLayoutBreadcrumbs = void 0;
var react_1 = require("react");
var NavigationContext_1 = require("../../context/NavigationContext");
var usePageIntakeStatus_1 = require("../../hooks/usePageIntakeStatus");
var routesCSS_1 = require("../../routing/routesCSS");
var BreadcrumbsView_1 = require("./BreadcrumbsView");
var CommonLayoutBreadcrumbs = function () {
    // TODO replace mock
    var _a = (0, usePageIntakeStatus_1.usePageIntakeStatus)(), filledPages = _a.filledPages, currentPage = _a.currentPage;
    var interactionMode = (0, NavigationContext_1.useNavigationContext)().interactionMode;
    var routes = Object.values(routesCSS_1.routesCSS);
    var routesForCurrentMode = routes.filter(function (route) { return route.modes.includes(interactionMode); });
    var getIsRouteWithoutBreadcrumbs = function () { var _a; return !((_a = routes.find(function (route) { return location.pathname.includes(route.path); })) === null || _a === void 0 ? void 0 : _a.modes.includes(interactionMode)); };
    if (interactionMode !== 'intake' || !routesForCurrentMode.length || getIsRouteWithoutBreadcrumbs()) {
        return <></>;
    }
    var breadcrumbs = routesForCurrentMode.map(function (route) { return ({
        text: route.text,
        link: route.path,
        isHighlighted: filledPages.includes(route.path),
        isActive: route.path === currentPage,
    }); });
    return <BreadcrumbsView_1.BreadcrumbsView items={breadcrumbs}/>;
};
exports.CommonLayoutBreadcrumbs = CommonLayoutBreadcrumbs;
//# sourceMappingURL=CommonLayoutBreadcrumbs.js.map