"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenderDropdown = void 0;
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var ControlledExamCheckboxDropdown_1 = require("./ControlledExamCheckboxDropdown");
var options = utils_1.examObservationFieldsDetailsArray
    .filter(function (details) { return details.card === 'abdomen' && details.group === 'dropdown'; })
    .map(function (details) { return ({ label: details.label, name: details.field }); });
var TenderDropdown = function () {
    return (<ControlledExamCheckboxDropdown_1.ControlledExamCheckboxDropdown abnormal checkboxLabel="Tender" dropdownLabel="Tender Location" options={options} dropdownTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabTenderDropdown} checkboxBlockTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabTenderCheckbox}/>);
};
exports.TenderDropdown = TenderDropdown;
//# sourceMappingURL=TenderDropdown.js.map