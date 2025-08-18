"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthwiseDocumentsCard = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var RoundedButton_1 = require("../../../../components/RoundedButton");
var components_1 = require("../../../components");
var hooks_1 = require("../../../hooks");
var HealthwiseDocumentsCard = function () {
    var _a = (0, react_1.useState)(false), collapsed = _a[0], setCollapsed = _a[1];
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    return (<components_1.AccordionCard label="Healthwise education documents" collapsed={collapsed} onSwitch={function () { return setCollapsed(function (prevState) { return !prevState; }); }}>
      <material_1.Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'start' }}>
        <RoundedButton_1.RoundedButton disabled={isReadOnly}>Find Healthwise education documents</RoundedButton_1.RoundedButton>
      </material_1.Box>
    </components_1.AccordionCard>);
};
exports.HealthwiseDocumentsCard = HealthwiseDocumentsCard;
//# sourceMappingURL=HealthwiseDocumentsCard.js.map