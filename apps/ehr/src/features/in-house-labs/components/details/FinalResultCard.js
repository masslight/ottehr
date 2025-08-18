"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinalResultCard = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var InHouseLabsStatusChip_1 = require("../InHouseLabsStatusChip");
var InHouseLabsDetailsCard_1 = require("./InHouseLabsDetailsCard");
var ResultEntryRadioButton_1 = require("./ResultEntryRadioButton");
var ResultsEntryTable_1 = require("./ResultsEntryTable");
var FinalResultCard = function (_a) {
    var testDetails = _a.testDetails;
    var _b = (0, react_1.useState)(false), showDetails = _b[0], setShowDetails = _b[1];
    var radioResultMap = testDetails.labDetails.components.radioComponents.reduce(function (acc, item) {
        var _a;
        if ((_a = item.result) === null || _a === void 0 ? void 0 : _a.entry)
            acc[item.observationDefinitionId] = item.result.entry;
        return acc;
    }, {});
    var tableResultMap = testDetails.labDetails.components.groupedComponents.reduce(function (acc, item) {
        var _a;
        if ((_a = item.result) === null || _a === void 0 ? void 0 : _a.entry)
            acc[item.observationDefinitionId] = item.result.entry;
        return acc;
    }, {});
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: __assign(__assign({}, radioResultMap), tableResultMap),
    });
    return (<material_1.Paper sx={{ mb: 2 }}>
      <material_1.Box sx={{ p: 3 }}>
        <material_1.Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <material_1.Typography variant="h5" color="primary.dark" fontWeight="bold">
            {testDetails.testItemName}
          </material_1.Typography>
          <material_1.Box display="flex" alignItems="center" gap="8px">
            <material_1.Typography variant="body2">
              {(0, utils_1.formatDateForLabs)(testDetails.orderAddedDate, testDetails.timezone)}
            </material_1.Typography>
            <InHouseLabsStatusChip_1.InHouseLabsStatusChip status={testDetails.status} additionalStyling={{ height: '24px' }}/>
          </material_1.Box>
        </material_1.Box>
        <react_hook_form_1.FormProvider {...methods}>
          {testDetails.labDetails.components.radioComponents.map(function (component, idx) {
            return (<ResultEntryRadioButton_1.ResultEntryRadioButton key={"radio-btn-result-".concat(idx, "-").concat(component.componentName)} testItemComponent={component} disabled={true}/>);
        })}

          {testDetails.labDetails.components.groupedComponents.length > 0 && (<ResultsEntryTable_1.ResultEntryTable testItemComponents={testDetails.labDetails.components.groupedComponents} disabled={true}/>)}
        </react_hook_form_1.FormProvider>
        <InHouseLabsDetailsCard_1.InHouseLabsDetailsCard testDetails={testDetails} page={utils_1.PageName.final} showDetails={showDetails} setShowDetails={setShowDetails}/>
      </material_1.Box>
    </material_1.Paper>);
};
exports.FinalResultCard = FinalResultCard;
//# sourceMappingURL=FinalResultCard.js.map