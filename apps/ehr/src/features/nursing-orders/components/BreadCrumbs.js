"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BreadCrumbs = void 0;
var CustomBreadcrumbs_1 = require("src/components/CustomBreadcrumbs");
var telemed_1 = require("src/telemed");
var utils_1 = require("utils");
var BreadCrumbs = function () {
    var appointment = (0, utils_1.getSelectors)(telemed_1.useAppointmentStore, ['appointment']).appointment;
    return (<CustomBreadcrumbs_1.default chain={[
            { link: "/in-person/".concat(appointment === null || appointment === void 0 ? void 0 : appointment.id, "/nursing-orders"), children: 'Orders' },
            { link: '#', children: 'Nursing Order' },
        ]}/>);
};
exports.BreadCrumbs = BreadCrumbs;
//# sourceMappingURL=BreadCrumbs.js.map