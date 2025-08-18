"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InHouseOrderNewBreadcrumbs = void 0;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var helpers_1 = require("../../routing/helpers");
var BreadcrumbsView_1 = require("./BreadcrumbsView");
var InHouseOrderNewBreadcrumbs = function () {
    var appointmentId = (0, react_router_dom_1.useParams)().id;
    var breadcrumbItems = [
        {
            text: 'Medication',
            link: (0, helpers_1.getInHouseMedicationMARUrl)(appointmentId),
        },
        {
            text: 'Order medication',
            link: '#',
            isActive: true,
        },
    ];
    return <BreadcrumbsView_1.BreadcrumbsView items={breadcrumbItems}/>;
};
exports.InHouseOrderNewBreadcrumbs = InHouseOrderNewBreadcrumbs;
//# sourceMappingURL=InHouseOrderNewBreadcrumbs.js.map