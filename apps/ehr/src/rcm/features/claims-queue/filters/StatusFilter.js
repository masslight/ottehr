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
exports.StatusFilter = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("../../../utils");
var statusOptions = __assign({ '': 'All statuses' }, utils_1.claimStatusOptions);
var StatusFilter = function (props) {
    var value = props.value, onChange = props.onChange;
    return (<material_1.FormControl size="small" fullWidth>
      <material_1.InputLabel>Status</material_1.InputLabel>
      <material_1.Select value={value || 'all'} onChange={function (e) {
            return onChange(e.target.value === 'all' ? undefined : e.target.value);
        }} label="Status">
        {Object.keys(statusOptions).map(function (option) { return (<material_1.MenuItem key={option || 'all'} value={option || 'all'}>
            {statusOptions[option]}
          </material_1.MenuItem>); })}
      </material_1.Select>
    </material_1.FormControl>);
};
exports.StatusFilter = StatusFilter;
//# sourceMappingURL=StatusFilter.js.map