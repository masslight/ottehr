"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateSelect = StateSelect;
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var state_1 = require("../../state");
var ALL_STATES_LABEL = 'All states';
var ALL_STATES_OPTION = { label: ALL_STATES_LABEL, value: null };
var intersectArrays = function (arr1, arr2) {
    var buffer = new Set(arr2);
    return arr1.filter(function (element) { return buffer.has(element); });
};
var areArraysEqual = function (arr1, arr2) {
    if (arr1.length !== arr2.length) {
        return false;
    }
    for (var i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) {
            return false;
        }
    }
    return true;
};
function StateSelect() {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useTrackingBoardStore, ['availableStates', 'selectedStates', 'alignment']), providerLicensedStates = _a.availableStates, selectedStates = _a.selectedStates, alignment = _a.alignment;
    var isMyPatientsFilterActivated = alignment === 'my-patients';
    var possibleUsStates = isMyPatientsFilterActivated
        ? providerLicensedStates
        : Object.keys(utils_1.AllStatesToVirtualLocationsData);
    (0, react_1.useEffect)(function () {
        if (!isMyPatientsFilterActivated) {
            return;
        }
        if (!selectedStates) {
            return;
        }
        var statesAfterAlignmentToggle = intersectArrays(selectedStates !== null && selectedStates !== void 0 ? selectedStates : [], providerLicensedStates);
        if (areArraysEqual(selectedStates, statesAfterAlignmentToggle)) {
            return;
        }
        state_1.useTrackingBoardStore.setState({ selectedStates: statesAfterAlignmentToggle });
    }, [alignment, isMyPatientsFilterActivated, selectedStates, providerLicensedStates]);
    var dropdownOptions = __spreadArray([
        ALL_STATES_OPTION
    ], possibleUsStates.map(function (usState) { return ({ label: usState, value: usState }); }), true);
    var currentDropdownValues = (0, react_1.useMemo)(function () {
        if (possibleUsStates.length === 0) {
            return [];
        }
        var actualSelectedStates = isMyPatientsFilterActivated
            ? intersectArrays(selectedStates !== null && selectedStates !== void 0 ? selectedStates : [], providerLicensedStates)
            : selectedStates;
        var actualSelectedStatesOptions = (actualSelectedStates || []).map(function (usState) { return ({
            label: usState,
            value: usState,
        }); });
        if (!actualSelectedStatesOptions || actualSelectedStatesOptions.length === 0) {
            return [ALL_STATES_OPTION];
        }
        return actualSelectedStatesOptions;
    }, [possibleUsStates, selectedStates, providerLicensedStates, isMyPatientsFilterActivated]);
    var isOnlyAllStatesOptionSelected = (0, react_1.useMemo)(function () {
        var _a;
        var firstOption = currentDropdownValues.at(0);
        return (_a = (firstOption && firstOption.label === ALL_STATES_LABEL)) !== null && _a !== void 0 ? _a : false;
    }, [currentDropdownValues]);
    var handleStateChange = (0, react_1.useCallback)(function (event, selectedOptions) {
        var _a;
        var hadSelectedStates = (_a = (selectedStates && selectedStates.length > 0)) !== null && _a !== void 0 ? _a : false;
        var hasSelectedAllStatesOption = selectedOptions.some(function (option) { return option.label === ALL_STATES_LABEL; });
        if (hadSelectedStates && hasSelectedAllStatesOption) {
            // if at least one US state has been previously selected and the user chooses "All States" option
            // from the dropdown then clear all previous US states selection
            state_1.useTrackingBoardStore.setState({ selectedStates: null });
            return;
        }
        var statesNames = selectedOptions
            .filter(function (usStateOption) { return usStateOption.label !== ALL_STATES_LABEL; })
            .filter(function (usStateOption) { return !!usStateOption.value; })
            .map(function (usStateOption) { return usStateOption.value; });
        var statesNamesOrNull = statesNames.length !== 0 ? statesNames : null;
        state_1.useTrackingBoardStore.setState({ selectedStates: statesNamesOrNull });
    }, [selectedStates]);
    return (<material_1.Autocomplete value={currentDropdownValues} onChange={handleStateChange} getOptionLabel={function (state) { return state.label || 'Unknown'; }} isOptionEqualToValue={function (option, tempValue) { return option.value === tempValue.value; }} options={dropdownOptions} renderOption={function (props, option) {
            return (<li {...props} key={option.value}>
            {option.label}
          </li>);
        }} fullWidth multiple disableClearable={isOnlyAllStatesOptionSelected} renderInput={function (params) { return <material_1.TextField name="state" {...params} label="State"/>; }} renderTags={function (options, getTagProps) {
            return options.map(function (option, index) {
                var _a = getTagProps({ index: index }), key = _a.key, onDelete = _a.onDelete, tagProps = __rest(_a, ["key", "onDelete"]);
                var onDeleteHandler = option.label !== ALL_STATES_LABEL ? onDelete : undefined;
                return <material_1.Chip variant="filled" label={option.label} key={key} onDelete={onDeleteHandler} {...tagProps}/>;
            });
        }}/>);
}
//# sourceMappingURL=StateSelect.js.map