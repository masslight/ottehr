"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BreadCrumbs = void 0;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var getSelectors_1 = require("../../shared/store/getSelectors");
var telemed_1 = require("../../telemed");
var CustomBreadcrumbs_1 = require("../CustomBreadcrumbs");
var BreadCrumbs = function () {
    var location = (0, react_router_dom_1.useLocation)();
    var queryParams = new URLSearchParams(location.search);
    var appointmentId = queryParams.get('appointment') || undefined;
    var patient = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, ['patient']).patient;
    var fullName = (0, react_1.useMemo)(function () {
        if (patient) {
            return (0, utils_1.getFullName)(patient);
        }
        return '';
    }, [patient]);
    return (<CustomBreadcrumbs_1.default chain={[
            { link: '/patients', children: 'Patients' },
            {
                link: "/patient/".concat(patient === null || patient === void 0 ? void 0 : patient.id),
                children: fullName,
            },
            {
                link: '#',
                children: "Visit ID: ".concat(appointmentId),
            },
        ]}/>);
};
exports.BreadCrumbs = BreadCrumbs;
//# sourceMappingURL=BreadCrumbs.js.map