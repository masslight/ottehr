"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdditionalQuestionsCard = void 0;
var react_1 = require("react");
var MedicalHistoryDoubleCard_1 = require("../MedicalHistoryDoubleCard");
var AdditionalQuestionsPatientColumn_1 = require("./AdditionalQuestionsPatientColumn");
var AdditionalQuestionsProviderColumn_1 = require("./AdditionalQuestionsProviderColumn");
var AdditionalQuestionsCard = function () {
    var _a = (0, react_1.useState)(false), isAdditionalQuestionsCollapsed = _a[0], setIsAdditionalQuestionsCollapsed = _a[1];
    return (<MedicalHistoryDoubleCard_1.MedicalHistoryDoubleCard label="Additional questions" collapsed={isAdditionalQuestionsCollapsed} onSwitch={function () { return setIsAdditionalQuestionsCollapsed(function (state) { return !state; }); }} patientSide={<AdditionalQuestionsPatientColumn_1.AdditionalQuestionsPatientColumn />} providerSide={<AdditionalQuestionsProviderColumn_1.AdditionalQuestionsProviderColumn />}/>);
};
exports.AdditionalQuestionsCard = AdditionalQuestionsCard;
//# sourceMappingURL=AdditionalQuestionsCard.js.map