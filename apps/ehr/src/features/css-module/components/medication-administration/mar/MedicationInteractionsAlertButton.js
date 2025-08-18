"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicationInteractionsAlertButton = void 0;
var colors_1 = require("@ehrTheme/colors");
var PriorityHighOutlined_1 = require("@mui/icons-material/PriorityHighOutlined");
var material_1 = require("@mui/material");
var react_1 = require("react");
var GenericToolTip_1 = require("src/components/GenericToolTip");
var InteractionAlertsDialog_1 = require("../InteractionAlertsDialog");
var util_1 = require("../util");
var MedicationInteractionsAlertButton = function (_a) {
    var medication = _a.medication;
    var _b = (0, react_1.useState)(false), showInteractionAlerts = _b[0], setShowInteractionAlerts = _b[1];
    return (<material_1.Box onClick={function (e) { return e.stopPropagation(); }}>
      {medication.interactions &&
            (medication.interactions.allergyInteractions.length > 0 ||
                medication.interactions.drugInteractions.length > 0) ? (<GenericToolTip_1.GenericToolTip title={'Interactions: ' + (0, util_1.interactionsSummary)(medication.interactions) + '. Click on alert icon to see details'} customWidth="500px" placement="top">
          <material_1.IconButton onClick={function () { return setShowInteractionAlerts(true); }}>
            <PriorityHighOutlined_1.default style={{
                width: '15px',
                height: '15px',
                color: '#FFF',
                background: colors_1.otherColors.priorityHighIcon,
                borderRadius: '4px',
                padding: '1px 2px 1px 2px',
            }}/>
          </material_1.IconButton>
        </GenericToolTip_1.GenericToolTip>) : null}
      {showInteractionAlerts && medication.interactions ? (<InteractionAlertsDialog_1.InteractionAlertsDialog medicationName={medication.medicationName} interactions={medication.interactions} readonly={true} onCancel={function () { return setShowInteractionAlerts(false); }}/>) : null}
    </material_1.Box>);
};
exports.MedicationInteractionsAlertButton = MedicationInteractionsAlertButton;
//# sourceMappingURL=MedicationInteractionsAlertButton.js.map