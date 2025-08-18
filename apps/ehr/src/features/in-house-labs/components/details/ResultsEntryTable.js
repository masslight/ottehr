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
exports.ResultEntryTable = void 0;
var material_1 = require("@mui/material");
var ResultsEntryTableRow_1 = require("./ResultsEntryTableRow");
var HEADER_ROW_STYLING = { borderBottom: 'none', padding: '0 8px 6px 0' };
var ResultEntryTable = function (_a) {
    var testItemComponents = _a.testItemComponents, disabled = _a.disabled;
    return (<material_1.TableContainer>
      <material_1.Table aria-label="lab results table" sx={{ backgroundColor: 'rgba(217, 217, 217, 0.2)', padding: 2, borderCollapse: 'separate' }}>
        <material_1.TableHead>
          <material_1.TableRow>
            <material_1.TableCell sx={__assign({ width: '23%' }, HEADER_ROW_STYLING)}>
              <material_1.Typography variant="body2" fontSize="12px">
                NAME
              </material_1.Typography>
            </material_1.TableCell>
            <material_1.TableCell sx={__assign({ width: '28%' }, HEADER_ROW_STYLING)}>
              <material_1.Typography variant="body2" fontSize="12px">
                VALUE
              </material_1.Typography>
            </material_1.TableCell>
            <material_1.TableCell sx={__assign({ width: '15%' }, HEADER_ROW_STYLING)}>
              <material_1.Typography variant="body2" fontSize="12px">
                UNITS
              </material_1.Typography>
            </material_1.TableCell>
            <material_1.TableCell sx={__assign({ width: '25%' }, HEADER_ROW_STYLING)}>
              <material_1.Typography variant="body2" fontSize="12px">
                REFERENCE RANGE
              </material_1.Typography>
            </material_1.TableCell>
          </material_1.TableRow>
        </material_1.TableHead>
        <material_1.TableBody>
          {testItemComponents.map(function (component, index) { return (<ResultsEntryTableRow_1.ResultEntryTableRow component={component} disabled={disabled} key={"row-".concat(index, "-").concat(component.observationDefinitionId)} isLastRow={index === testItemComponents.length - 1}/>); })}
        </material_1.TableBody>
      </material_1.Table>
    </material_1.TableContainer>);
};
exports.ResultEntryTable = ResultEntryTable;
//# sourceMappingURL=ResultsEntryTable.js.map