"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePatientInstructionsVisibility = void 0;
var utils_1 = require("utils");
var getSelectors_1 = require("../../shared/store/getSelectors");
var state_1 = require("../state");
var _1 = require(".");
var usePatientInstructionsVisibility = function () {
    var chartData = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData']).chartData;
    var instructions = chartData === null || chartData === void 0 ? void 0 : chartData.instructions;
    var disposition = chartData === null || chartData === void 0 ? void 0 : chartData.disposition;
    var schoolWorkExcuses = (0, _1.useExcusePresignedFiles)(chartData === null || chartData === void 0 ? void 0 : chartData.schoolWorkNotes);
    var showInstructions = !!(instructions && instructions.length > 0);
    var showDischargeInstructions = !!(((disposition === null || disposition === void 0 ? void 0 : disposition.note) && (disposition === null || disposition === void 0 ? void 0 : disposition.note.length) > 0) ||
        (disposition === null || disposition === void 0 ? void 0 : disposition[utils_1.NOTHING_TO_EAT_OR_DRINK_FIELD]) ||
        ((disposition === null || disposition === void 0 ? void 0 : disposition.labService) && disposition.labService.length > 0) ||
        ((disposition === null || disposition === void 0 ? void 0 : disposition.virusTest) && disposition.virusTest.length > 0));
    var showFollowUp = !!((disposition === null || disposition === void 0 ? void 0 : disposition.followUp) && disposition.followUp.length > 0);
    var showSchoolWorkExcuse = !!(schoolWorkExcuses.length > 0);
    var showPatientInstructions = showInstructions || showDischargeInstructions || showFollowUp || showSchoolWorkExcuse;
    return {
        showInstructions: showInstructions,
        showDischargeInstructions: showDischargeInstructions,
        showFollowUp: showFollowUp,
        showSchoolWorkExcuse: showSchoolWorkExcuse,
        showPatientInstructions: showPatientInstructions,
    };
};
exports.usePatientInstructionsVisibility = usePatientInstructionsVisibility;
//# sourceMappingURL=usePatientInstructionsVisibility.js.map