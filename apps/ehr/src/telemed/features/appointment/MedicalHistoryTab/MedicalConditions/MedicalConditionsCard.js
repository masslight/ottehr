"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicalConditionsCard = void 0;
var react_1 = require("react");
var MedicalHistoryDoubleCard_1 = require("../MedicalHistoryDoubleCard");
var MedicalConditionsPatientColumn_1 = require("./MedicalConditionsPatientColumn");
var MedicalConditionsProviderColumn_1 = require("./MedicalConditionsProviderColumn");
var MedicalConditionsCard = function () {
    var _a = (0, react_1.useState)(false), isConditionsCollapsed = _a[0], setIsConditionsCollapsed = _a[1];
    return (<MedicalHistoryDoubleCard_1.MedicalHistoryDoubleCard label="Medical conditions" collapsed={isConditionsCollapsed} onSwitch={function () { return setIsConditionsCollapsed(function (state) { return !state; }); }} patientSide={<MedicalConditionsPatientColumn_1.MedicalConditionsPatientColumn />} providerSide={<MedicalConditionsProviderColumn_1.MedicalConditionsProviderColumn />}/>);
};
exports.MedicalConditionsCard = MedicalConditionsCard;
//# sourceMappingURL=MedicalConditionsCard.js.map