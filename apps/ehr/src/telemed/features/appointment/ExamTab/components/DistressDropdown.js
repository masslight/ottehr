"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DistressDropdown = void 0;
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var ControlledExamCheckboxDropdown_1 = require("./ControlledExamCheckboxDropdown");
var options = utils_1.examObservationFieldsDetailsArray
    .filter(function (details) { return details.card === 'general' && details.group === 'dropdown'; })
    .map(function (details) { return ({ label: details.label, name: details.field }); });
var DistressDropdown = function () {
    return (<ControlledExamCheckboxDropdown_1.ControlledExamCheckboxDropdown abnormal checkboxLabel="Distress" dropdownLabel="Distress degree" options={options} dropdownTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabDistressDropdown} checkboxBlockTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabDistressCheckbox}/>);
};
exports.DistressDropdown = DistressDropdown;
//# sourceMappingURL=DistressDropdown.js.map