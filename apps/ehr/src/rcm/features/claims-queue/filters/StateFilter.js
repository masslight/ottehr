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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateFilter = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var EMPTY_STATE = { label: 'All states', value: '' };
var stateOptions = __spreadArray([EMPTY_STATE.value], utils_1.AllStatesValues, true);
var stateOptionToLabel = __assign(__assign({}, utils_1.AllStatesToVirtualLocationsData), (_a = {}, _a[EMPTY_STATE.value] = EMPTY_STATE.label, _a));
var StateFilter = function (props) {
    var value = props.value, onChange = props.onChange;
    return (<material_1.Autocomplete value={value} size="small" disableClearable onChange={function (_, value) { return onChange(value || undefined); }} getOptionLabel={function (option) { return stateOptionToLabel[option] || 'Unknown'; }} options={stateOptions} renderOption={function (props, option) { return (<li {...props} key={option}>
          {stateOptionToLabel[option] || 'Unknown'}
        </li>); }} fullWidth renderInput={function (params) { return <material_1.TextField name="state" {...params} label="State"/>; }}/>);
};
exports.StateFilter = StateFilter;
//# sourceMappingURL=StateFilter.js.map