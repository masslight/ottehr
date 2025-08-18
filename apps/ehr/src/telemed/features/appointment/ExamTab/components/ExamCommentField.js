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
exports.ExamCommentField = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var hooks_1 = require("../../../../hooks");
var useExamObservations_1 = require("../../../../hooks/useExamObservations");
var ExamCommentField = function (props) {
    var name = props.name, dataTestId = props.dataTestId;
    var _a = (0, useExamObservations_1.useExamObservations)(name), field = _a.value, update = _a.update, deleteField = _a.delete, isLoading = _a.isLoading;
    var debounce = (0, hooks_1.useDebounce)(700).debounce;
    var onChange = function (value) {
        value = value.trim();
        if (!field.resourceId && !value) {
            return;
        }
        debounce(function () {
            if (value) {
                update(__assign(__assign({}, field), { note: value }));
            }
            else {
                deleteField(field);
            }
        });
    };
    var _b = (0, react_1.useState)(field.note || ''), value = _b[0], setValue = _b[1];
    (0, react_1.useEffect)(function () {
        var _a;
        if (((_a = field.note) === null || _a === void 0 ? void 0 : _a.trim()) !== value.trim()) {
            // update UI value only if it's different from the field value
            setValue(field.note || '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [field.note]);
    return (<material_1.TextField value={value} onChange={function (e) {
            console.log('e.target.value', e.target.value);
            setValue(e.target.value);
            onChange(e.target.value);
        }} size="small" label="Provider comment" data-testid={dataTestId} fullWidth InputProps={{
            endAdornment: isLoading && (<material_1.Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <material_1.CircularProgress size="20px"/>
          </material_1.Box>),
        }}/>);
};
exports.ExamCommentField = ExamCommentField;
//# sourceMappingURL=ExamCommentField.js.map