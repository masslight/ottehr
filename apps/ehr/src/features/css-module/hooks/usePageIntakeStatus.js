"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePageIntakeStatus = void 0;
var react_router_dom_1 = require("react-router-dom");
var usePageIntakeStatus = function () {
    var location = (0, react_router_dom_1.useLocation)();
    // TODO now mock data for filled pages (replace with actual state management later)
    var filledPages = [];
    var getCurrentPage = function (path) {
        var segments = path.split('/');
        return segments[segments.length - 1];
    };
    var currentPage = getCurrentPage(location.pathname);
    return { filledPages: filledPages, currentPage: currentPage };
};
exports.usePageIntakeStatus = usePageIntakeStatus;
//# sourceMappingURL=usePageIntakeStatus.js.map