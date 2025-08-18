"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersIconsToolTip = void 0;
var material_1 = require("@mui/material");
var react_router_dom_1 = require("react-router-dom");
var OrdersToolTip_1 = require("src/features/common/OrdersToolTip");
var MedicationStatusChip_1 = require("src/features/css-module/components/medication-administration/statuses/MedicationStatusChip");
var Sidebar_1 = require("src/features/css-module/components/Sidebar");
var helpers_1 = require("src/features/css-module/routing/helpers");
var ExternalLabsStatusChip_1 = require("src/features/external-labs/components/ExternalLabsStatusChip");
var InHouseLabsStatusChip_1 = require("src/features/in-house-labs/components/InHouseLabsStatusChip");
var NursingOrdersStatusChip_1 = require("src/features/nursing-orders/components/NursingOrdersStatusChip");
var RadiologyTableStatusChip_1 = require("src/features/radiology/components/RadiologyTableStatusChip");
var helpers_2 = require("src/helpers");
var GenericToolTip_1 = require("./GenericToolTip");
var OrdersIconsToolTip = function (_a) {
    var appointment = _a.appointment, orders = _a.orders;
    var ordersExistForAppointment = (0, helpers_2.hasAtLeastOneOrder)(orders);
    if (!ordersExistForAppointment)
        return null;
    var externalLabOrders = orders.externalLabOrders, inHouseLabOrders = orders.inHouseLabOrders, nursingOrders = orders.nursingOrders, inHouseMedications = orders.inHouseMedications, radiologyOrders = orders.radiologyOrders;
    var orderConfigs = [];
    if (externalLabOrders === null || externalLabOrders === void 0 ? void 0 : externalLabOrders.length) {
        var externalLabOrderConfig = {
            icon: Sidebar_1.sidebarMenuIcons['External Labs'],
            title: 'External Labs',
            tableUrl: (0, helpers_1.getExternalLabOrdersUrl)(appointment.id),
            orders: externalLabOrders.map(function (order) { return ({
                fhirResourceId: order.serviceRequestId,
                itemDescription: order.testItem,
                detailPageUrl: (0, helpers_1.getExternalLabOrderEditUrl)(appointment.id, order.serviceRequestId),
                statusChip: <ExternalLabsStatusChip_1.LabsOrderStatusChip status={order.orderStatus}/>,
            }); }),
        };
        orderConfigs.push(externalLabOrderConfig);
    }
    if (inHouseLabOrders === null || inHouseLabOrders === void 0 ? void 0 : inHouseLabOrders.length) {
        var inHouseLabOrderConfig = {
            icon: Sidebar_1.sidebarMenuIcons['In-House Labs'],
            title: 'In-House Labs',
            tableUrl: (0, helpers_1.getInHouseLabsUrl)(appointment.id),
            orders: inHouseLabOrders.map(function (order) { return ({
                fhirResourceId: order.serviceRequestId,
                itemDescription: order.testItemName,
                detailPageUrl: (0, helpers_1.getInHouseLabOrderDetailsUrl)(appointment.id, order.serviceRequestId),
                statusChip: <InHouseLabsStatusChip_1.InHouseLabsStatusChip status={order.status}/>,
            }); }),
        };
        orderConfigs.push(inHouseLabOrderConfig);
    }
    if (nursingOrders === null || nursingOrders === void 0 ? void 0 : nursingOrders.length) {
        var nursingOrdersConfig = {
            icon: Sidebar_1.sidebarMenuIcons['Nursing Orders'],
            title: 'Nursing Orders',
            tableUrl: (0, helpers_1.getNursingOrdersUrl)(appointment.id),
            orders: nursingOrders.map(function (order) { return ({
                fhirResourceId: order.serviceRequestId,
                itemDescription: order.note,
                detailPageUrl: (0, helpers_1.getNursingOrderDetailsUrl)(appointment.id, order.serviceRequestId),
                statusChip: <NursingOrdersStatusChip_1.NursingOrdersStatusChip status={order.status}/>,
            }); }),
        };
        orderConfigs.push(nursingOrdersConfig);
    }
    if (inHouseMedications === null || inHouseMedications === void 0 ? void 0 : inHouseMedications.length) {
        var inHouseMedicationConfig = {
            icon: Sidebar_1.sidebarMenuIcons['Med. Administration'],
            title: 'In-House Medications',
            tableUrl: (0, helpers_1.getInHouseMedicationMARUrl)(appointment.id),
            orders: inHouseMedications.map(function (med) { return ({
                fhirResourceId: med.id,
                itemDescription: med.medicationName,
                detailPageUrl: "".concat((0, helpers_1.getInHouseMedicationDetailsUrl)(appointment.id), "?scrollTo=").concat(med.id),
                statusChip: <MedicationStatusChip_1.MedicationStatusChip medication={med}/>,
            }); }),
        };
        orderConfigs.push(inHouseMedicationConfig);
    }
    if (radiologyOrders === null || radiologyOrders === void 0 ? void 0 : radiologyOrders.length) {
        var radiologyOrdersConfig = {
            icon: Sidebar_1.sidebarMenuIcons['Radiology'],
            title: 'Radiology Orders',
            tableUrl: (0, helpers_1.getRadiologyUrl)(appointment.id),
            orders: radiologyOrders.map(function (order) { return ({
                fhirResourceId: order.serviceRequestId,
                itemDescription: order.studyType,
                detailPageUrl: (0, helpers_1.getRadiologyOrderEditUrl)(appointment.id, order.serviceRequestId),
                statusChip: <RadiologyTableStatusChip_1.RadiologyTableStatusChip status={order.status}/>,
            }); }),
        };
        orderConfigs.push(radiologyOrdersConfig);
    }
    return (<GenericToolTip_1.GenericToolTip title={<OrdersToolTip_1.OrdersToolTip orderConfigs={orderConfigs}/>} customWidth="none" placement="top">
      <material_1.Box sx={{ display: 'flex', width: '100%' }}>
        {orderConfigs.map(function (config) { return (<react_router_dom_1.Link to={config.tableUrl} style={{ textDecoration: 'none' }} key={"".concat(config.title, "-icon-indicator")}>
            <material_1.Box sx={{
                display: 'flex',
                gap: 0,
                color: '#0F347C',
                backgroundColor: '#2169F514',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '8px',
            }}>
              {config.icon}
            </material_1.Box>
          </react_router_dom_1.Link>); })}
      </material_1.Box>
    </GenericToolTip_1.GenericToolTip>);
};
exports.OrdersIconsToolTip = OrdersIconsToolTip;
//# sourceMappingURL=OrdersIconsToolTip.js.map