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
exports.ResultEntryTableRow = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var ResultEntrySelect_1 = require("./ResultEntrySelect");
var ResultsEntryNumericInput_1 = require("./ResultsEntryNumericInput");
var ROW_STYLING = { paddingLeft: 0 };
var ResultEntryTableRow = function (_a) {
    var _b, _c, _d;
    var component = _a.component, disabled = _a.disabled, isLastRow = _a.isLastRow;
    var _e = (0, react_1.useState)(false), isAbnormal = _e[0], setIsAbnormal = _e[1];
    console.log('component', component.result);
    (0, react_1.useEffect)(function () {
        var _a, _b;
        if ((_a = component.result) === null || _a === void 0 ? void 0 : _a.interpretationCode) {
            var code = (_b = component.result) === null || _b === void 0 ? void 0 : _b.interpretationCode;
            if (code === utils_1.OBSERVATION_CODES.ABNORMAL) {
                setIsAbnormal(true);
            }
        }
    }, [component.result]);
    var units = '';
    var referenceRange = '';
    var valueElement = <div>Could not parse input type</div>;
    if (component.dataType === 'Quantity') {
        units = component.unit;
        referenceRange = (0, utils_1.quantityRangeFormat)(component);
    }
    if (component.dataType === 'CodeableConcept') {
        units = (_b = component.unit) !== null && _b !== void 0 ? _b : '';
        referenceRange =
            (_d = (_c = component.referenceRangeValues) === null || _c === void 0 ? void 0 : _c.map(function (refRange) {
                return refRange.display.charAt(0).toUpperCase() + refRange.display.slice(1);
            }).join(', ')) !== null && _d !== void 0 ? _d : '';
    }
    if (component.displayType === 'Numeric') {
        valueElement = (<ResultsEntryNumericInput_1.ResultEntryNumericInput testItemComponent={component} isAbnormal={isAbnormal} setIsAbnormal={setIsAbnormal} disabled={disabled}/>);
    }
    if (component.displayType === 'Select') {
        valueElement = (<ResultEntrySelect_1.ResultEntrySelect testItemComponent={component} isAbnormal={isAbnormal} setIsAbnormal={setIsAbnormal} disabled={disabled}/>);
    }
    var rowStyling = isLastRow
        ? __assign(__assign({}, ROW_STYLING), { borderBottom: 'none', paddingBottom: 0 }) : ROW_STYLING;
    return (<material_1.TableRow>
      <material_1.TableCell sx={rowStyling}>
        <material_1.Typography variant="body1" sx={{ color: "".concat(isAbnormal ? 'error.dark' : '') }}>
          {component.componentName}
        </material_1.Typography>
      </material_1.TableCell>
      <material_1.TableCell sx={rowStyling}>{valueElement}</material_1.TableCell>
      <material_1.TableCell sx={rowStyling}>
        <material_1.Typography variant="body1">{units}</material_1.Typography>
      </material_1.TableCell>
      <material_1.TableCell sx={rowStyling}>
        <material_1.Typography variant="body1">{referenceRange}</material_1.Typography>
      </material_1.TableCell>
    </material_1.TableRow>);
};
exports.ResultEntryTableRow = ResultEntryTableRow;
//# sourceMappingURL=ResultsEntryTableRow.js.map