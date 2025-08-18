"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfoIconsToolTip = void 0;
var AccountCircleOutlined_1 = require("@mui/icons-material/AccountCircleOutlined");
var AssignmentTurnedInOutlined_1 = require("@mui/icons-material/AssignmentTurnedInOutlined");
var BadgeOutlined_1 = require("@mui/icons-material/BadgeOutlined");
var HealthAndSafetyOutlined_1 = require("@mui/icons-material/HealthAndSafetyOutlined");
var material_1 = require("@mui/material");
var helpers_1 = require("src/helpers");
var colors_1 = require("src/themes/ottehr/colors");
var GenericToolTip_1 = require("./GenericToolTip");
var OrdersIconsToolTip_1 = require("./OrdersIconsToolTip");
var InfoIconsToolTip = function (_a) {
    var appointment = _a.appointment, tab = _a.tab, orders = _a.orders;
    var ordersToolTip = (0, helpers_1.displayOrdersToolTip)(appointment, tab);
    return (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'left', height: '100%' }}>
      {ordersToolTip ? (<OrdersIconsToolTip_1.OrdersIconsToolTip appointment={appointment} orders={orders}/>) : (
        // Visit Components
        <GenericToolTip_1.GenericToolTip title={<GenericToolTip_1.PaperworkToolTipContent appointment={appointment}/>} customWidth="none">
          <material_1.Box sx={{ display: 'flex', gap: 0 }}>
            <AccountCircleOutlined_1.default sx={{ ml: 0, mr: 0.5, color: appointment.paperwork.demographics ? '#43A047' : '#BFC2C6' }} fill={colors_1.otherColors.cardChip}></AccountCircleOutlined_1.default>

            <HealthAndSafetyOutlined_1.default sx={{ mx: 0.5, color: appointment.paperwork.insuranceCard ? '#43A047' : '#BFC2C6' }} fill={colors_1.otherColors.cardChip}></HealthAndSafetyOutlined_1.default>

            <BadgeOutlined_1.default sx={{ mx: 0.5, color: appointment.paperwork.photoID ? '#43A047' : '#BFC2C6' }} fill={colors_1.otherColors.cardChip}></BadgeOutlined_1.default>

            <AssignmentTurnedInOutlined_1.default sx={{ mx: 0.5, color: appointment.paperwork.consent ? '#43A047' : '#BFC2C6' }} fill={colors_1.otherColors.cardChip}></AssignmentTurnedInOutlined_1.default>
          </material_1.Box>
        </GenericToolTip_1.GenericToolTip>)}
    </div>);
};
exports.InfoIconsToolTip = InfoIconsToolTip;
//# sourceMappingURL=InfoIconsToolTip.js.map