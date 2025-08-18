"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InHouseLabsBreadcrumbs = void 0;
var react_1 = require("react");
var BaseBreadcrumbs_1 = require("src/components/BaseBreadcrumbs");
var helpers_1 = require("src/features/css-module/routing/helpers");
var telemed_1 = require("src/telemed");
var InHouseLabsBreadcrumbs = function (_a) {
    var children = _a.children, pageName = _a.pageName;
    var appointmentId = (0, telemed_1.useAppointmentStore)(function (state) { var _a; return (_a = state.appointment) === null || _a === void 0 ? void 0 : _a.id; });
    var baseCrumb = (0, react_1.useMemo)(function () {
        return {
            label: 'In-House Labs',
            path: appointmentId ? (0, helpers_1.getInHouseLabsUrl)(appointmentId) : null,
        };
    }, [appointmentId]);
    return (<BaseBreadcrumbs_1.BaseBreadcrumbs sectionName={pageName} baseCrumb={baseCrumb}>
      {children}
    </BaseBreadcrumbs_1.BaseBreadcrumbs>);
};
exports.InHouseLabsBreadcrumbs = InHouseLabsBreadcrumbs;
//# sourceMappingURL=InHouseLabsBreadcrumbs.js.map