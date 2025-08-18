"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabBreadcrumbs = void 0;
var react_1 = require("react");
var BaseBreadcrumbs_1 = require("src/components/BaseBreadcrumbs");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var telemed_1 = require("../../../../telemed");
var LabBreadcrumbs = function (_a) {
    var sectionName = _a.sectionName, children = _a.children;
    var appointment = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, ['appointment']).appointment;
    var baseCrumb = (0, react_1.useMemo)(function () { return ({
        label: 'External Labs',
        path: (appointment === null || appointment === void 0 ? void 0 : appointment.id) ? "/in-person/".concat(appointment.id, "/external-lab-orders") : null,
    }); }, [appointment === null || appointment === void 0 ? void 0 : appointment.id]);
    return (<BaseBreadcrumbs_1.BaseBreadcrumbs sectionName={sectionName} baseCrumb={baseCrumb}>
      {children}
    </BaseBreadcrumbs_1.BaseBreadcrumbs>);
};
exports.LabBreadcrumbs = LabBreadcrumbs;
//# sourceMappingURL=LabBreadcrumbs.js.map