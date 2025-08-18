"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SurgicalHistoryCard = void 0;
var react_1 = require("react");
var MedicalHistoryDoubleCard_1 = require("../MedicalHistoryDoubleCard");
var SurgicalHistoryPatientColumn_1 = require("./SurgicalHistoryPatientColumn");
var SurgicalHistoryProviderColumn_1 = require("./SurgicalHistoryProviderColumn");
var SurgicalHistoryCard = function () {
    var _a = (0, react_1.useState)(false), isSurgicalHistoryCollapsed = _a[0], setIsSurgicalHistoryCollapsed = _a[1];
    return (<MedicalHistoryDoubleCard_1.MedicalHistoryDoubleCard label="Surgical history" collapsed={isSurgicalHistoryCollapsed} onSwitch={function () { return setIsSurgicalHistoryCollapsed(function (state) { return !state; }); }} patientSide={<SurgicalHistoryPatientColumn_1.SurgicalHistoryPatientColumn />} providerSide={<SurgicalHistoryProviderColumn_1.SurgicalHistoryProviderColumn />}/>);
};
exports.SurgicalHistoryCard = SurgicalHistoryCard;
//# sourceMappingURL=SurgicalHistoryCard.js.map