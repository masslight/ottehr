"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InHouseOrderEditBreadcrumbs = void 0;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var helpers_1 = require("../../routing/helpers");
var BreadcrumbsView_1 = require("./BreadcrumbsView");
var InHouseOrderEditBreadcrumbs = function () {
    var appointmentId = (0, react_router_dom_1.useParams)().id;
    var breadcrumbItems = [
        {
            text: 'Medication',
            link: (0, helpers_1.getInHouseMedicationMARUrl)(appointmentId),
        },
        {
            text: "Edit Order",
            link: '#',
            isActive: true,
        },
    ];
    return <BreadcrumbsView_1.BreadcrumbsView items={breadcrumbItems}/>;
};
exports.InHouseOrderEditBreadcrumbs = InHouseOrderEditBreadcrumbs;
//# sourceMappingURL=InHouseOrderEditBreadcrumbs.js.map