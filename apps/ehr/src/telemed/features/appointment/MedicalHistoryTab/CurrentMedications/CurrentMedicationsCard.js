"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentMedicationsCard = void 0;
var react_1 = require("react");
var MedicalHistoryDoubleCard_1 = require("../MedicalHistoryDoubleCard");
var CurrentMedicationsPatientColumn_1 = require("./CurrentMedicationsPatientColumn");
var CurrentMedicationsProviderColumn_1 = require("./CurrentMedicationsProviderColumn");
var CurrentMedicationsCard = function () {
    var _a = (0, react_1.useState)(false), isMedicationsCollapsed = _a[0], setIsMedicationsCollapsed = _a[1];
    return (<MedicalHistoryDoubleCard_1.MedicalHistoryDoubleCard label="Current medications" collapsed={isMedicationsCollapsed} onSwitch={function () { return setIsMedicationsCollapsed(function (state) { return !state; }); }} patientSide={<CurrentMedicationsPatientColumn_1.CurrentMedicationsPatientColumn />} providerSide={<CurrentMedicationsProviderColumn_1.CurrentMedicationsProviderColumn />}/>);
};
exports.CurrentMedicationsCard = CurrentMedicationsCard;
//# sourceMappingURL=CurrentMedicationsCard.js.map