"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExamFieldsFactory = void 0;
var material_1 = require("@mui/material");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var featureFlags_1 = require("../../../../../features/css-module/context/featureFlags");
var ControlledExamCheckbox_1 = require("./ControlledExamCheckbox");
var ControlledExamRadioGroup_1 = require("./ControlledExamRadioGroup");
var ExamFieldsFactory = function (props) {
    var fields = props.fields, card = props.card, group = props.group, radio = props.radio;
    var css = (0, featureFlags_1.useFeatureFlags)().css;
    var values;
    if (card && group) {
        if (css) {
            values = utils_1.inPersonExamObservationFieldsDetailsArray.filter(function (details) { return details.group === group && details.card === card; });
        }
        else {
            values = utils_1.examObservationFieldsDetailsArray.filter(function (details) { return details.group === group && details.card === card; });
        }
    }
    else {
        values = fields.map(function (field) { return utils_1.ExamObservationFieldsDetails[field]; });
    }
    var array = values.map(function (details) { return (<material_1.Box data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.examTabField(details.field)}>
      {radio ? (<ControlledExamRadioGroup_1.ControlledExamRadioGroup key={details.field} name={details.field} label={details.label} abnormal={details.abnormal}/>) : (<ControlledExamCheckbox_1.ControlledExamCheckbox key={details.field} name={details.field} label={details.label} abnormal={details.abnormal}/>)}
    </material_1.Box>); });
    return <>{array}</>;
};
exports.ExamFieldsFactory = ExamFieldsFactory;
//# sourceMappingURL=ExamFieldsFactory.js.map