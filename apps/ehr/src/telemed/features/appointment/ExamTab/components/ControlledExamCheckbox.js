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
exports.ControlledExamCheckbox = void 0;
var useExamObservations_1 = require("../../../../hooks/useExamObservations");
var StatelessExamCheckbox_1 = require("./StatelessExamCheckbox");
var ControlledExamCheckbox = function (props) {
    var label = props.label, name = props.name, abnormal = props.abnormal;
    var _a = (0, useExamObservations_1.useExamObservations)(name), field = _a.value, update = _a.update, isLoading = _a.isLoading;
    var onChange = function (value) {
        update(__assign(__assign({}, field), { value: value }));
    };
    return (<StatelessExamCheckbox_1.StatelessExamCheckbox label={label} abnormal={abnormal} checked={field.value} onChange={onChange} disabled={isLoading}/>);
};
exports.ControlledExamCheckbox = ControlledExamCheckbox;
//# sourceMappingURL=ControlledExamCheckbox.js.map