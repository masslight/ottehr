"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnownAllergiesCard = void 0;
var react_1 = require("react");
var MedicalHistoryDoubleCard_1 = require("../MedicalHistoryDoubleCard");
var KnownAllergiesPatientColumn_1 = require("./KnownAllergiesPatientColumn");
var KnownAllergiesProviderColumn_1 = require("./KnownAllergiesProviderColumn");
var KnownAllergiesCard = function () {
    var _a = (0, react_1.useState)(false), isAllergiesCollapsed = _a[0], setIsAllergiesCollapsed = _a[1];
    return (<MedicalHistoryDoubleCard_1.MedicalHistoryDoubleCard label="Known allergies" collapsed={isAllergiesCollapsed} onSwitch={function () { return setIsAllergiesCollapsed(function (state) { return !state; }); }} patientSide={<KnownAllergiesPatientColumn_1.KnownAllergiesPatientColumn />} providerSide={<KnownAllergiesProviderColumn_1.KnownAllergiesProviderColumn />}/>);
};
exports.KnownAllergiesCard = KnownAllergiesCard;
//# sourceMappingURL=KnownAllergiesCard.js.map