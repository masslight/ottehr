"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReasonSelect = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var medicationTypes_1 = require("../medicationTypes");
var ReasonSelect = function (_a) {
    var updateRequestInputRef = _a.updateRequestInputRef, setIsReasonSelected = _a.setIsReasonSelected;
    var _b = (0, react_1.useState)(''), selectedReason = _b[0], setSelectedReason = _b[1];
    var _c = (0, react_1.useState)(''), otherReason = _c[0], setOtherReason = _c[1];
    (0, react_1.useEffect)(function () {
        setIsReasonSelected(!selectedReason || (selectedReason === medicationTypes_1.ReasonListCodes.OTHER && !otherReason.trim()));
    }, [selectedReason, otherReason, setIsReasonSelected]);
    var handleReasonChange = function (value) {
        var _a;
        setSelectedReason(value);
        if ((_a = updateRequestInputRef.current) === null || _a === void 0 ? void 0 : _a.orderData) {
            updateRequestInputRef.current.orderData.reason = value;
            if (value !== medicationTypes_1.ReasonListCodes.OTHER) {
                updateRequestInputRef.current.orderData.otherReason = '';
                setOtherReason('');
            }
        }
    };
    var handleOtherReasonChange = function (value) {
        var _a;
        setOtherReason(value);
        if ((_a = updateRequestInputRef.current) === null || _a === void 0 ? void 0 : _a.orderData) {
            updateRequestInputRef.current.orderData.otherReason = value;
        }
    };
    return (<material_1.Stack spacing={2} sx={{ mt: 2 }}>
      <material_1.FormControl fullWidth>
        <material_1.InputLabel>Reason</material_1.InputLabel>
        <material_1.Select value={selectedReason} onChange={function (e) { return handleReasonChange(e.target.value); }} label="Reason">
          {Object.entries(medicationTypes_1.reasonListValues).map(function (_a) {
            var code = _a[0], label = _a[1];
            return (<material_1.MenuItem key={code} value={code}>
              {label}
            </material_1.MenuItem>);
        })}
        </material_1.Select>
      </material_1.FormControl>

      {selectedReason === medicationTypes_1.ReasonListCodes.OTHER && (<material_1.TextField fullWidth label="Specify reason" value={otherReason} onChange={function (e) { return handleOtherReasonChange(e.target.value); }}/>)}
    </material_1.Stack>);
};
exports.ReasonSelect = ReasonSelect;
//# sourceMappingURL=ReasonSelect.js.map