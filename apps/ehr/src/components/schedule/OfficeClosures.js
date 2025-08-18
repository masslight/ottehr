"use strict";
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
exports.default = OfficeClosures;
var Delete_1 = require("@mui/icons-material/Delete");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var formatDateTime_1 = require("../../helpers/formatDateTime");
var types_1 = require("../../types/types");
var DateSearch_1 = require("../DateSearch");
function OfficeClosures(_a) {
    var closures = _a.closures, setClosures = _a.setClosures;
    function handleUpdateClosures(index, newClosure) {
        var newClosures = closures === null || closures === void 0 ? void 0 : closures.map(function (closureTemp, indexTemp) {
            if (index === indexTemp) {
                return newClosure;
            }
            else {
                return closureTemp;
            }
        });
        setClosures(newClosures);
    }
    return (<material_1.Box marginTop={5}>
      <material_1.Typography variant="h4" color="primary.dark">
        Closed Dates
      </material_1.Typography>
      <material_1.Typography variant="body1" color="black" marginTop={2}>
        This override should be utilized when the facility is closed for the whole day and will not be opening at all.
      </material_1.Typography>
      <material_1.Table sx={{ marginTop: 3, tableLayout: 'fixed' }}>
        <material_1.TableHead>
          <material_1.TableRow key="closures-table-headers" sx={{ height: '40px' }}>
            <material_1.TableCell sx={{ fontWeight: 'bold' }}>Type</material_1.TableCell>
            <material_1.TableCell sx={{ fontWeight: 'bold' }}>Start Date</material_1.TableCell>
            <material_1.TableCell sx={{ fontWeight: 'bold' }}>End Date</material_1.TableCell>
            {/* empty header for delete icon */}
            <material_1.TableCell sx={{ width: '10%' }}></material_1.TableCell>
          </material_1.TableRow>
        </material_1.TableHead>
        <material_1.TableBody>
          {closures &&
            closures
                .sort(function (d1, d2) {
                return (luxon_1.DateTime.fromFormat(d1.start, formatDateTime_1.OVERRIDE_DATE_FORMAT).toSeconds() -
                    luxon_1.DateTime.fromFormat(d2.start, formatDateTime_1.OVERRIDE_DATE_FORMAT).toSeconds());
            })
                .map(function (closure, index) {
                return (<material_1.TableRow key={"closure-".concat(index)}>
                    <material_1.TableCell>
                      <material_1.FormControl required>
                        <material_1.RadioGroup value={closure.type || undefined} row name="closureType" onChange={function (e) {
                        handleUpdateClosures(index, {
                            start: closure.start,
                            end: e.target.value === types_1.ClosureType.OneDay ? '' : closure.end,
                            type: e.target.value,
                        });
                    }}>
                          <material_1.FormControlLabel value={types_1.ClosureType.OneDay} control={<material_1.Radio />} label="One day" required sx={{ '.MuiFormControlLabel-asterisk': { display: 'none' } }}/>
                          <material_1.FormControlLabel value={types_1.ClosureType.Period} control={<material_1.Radio />} label="Period" required sx={{ '.MuiFormControlLabel-asterisk': { display: 'none' } }}/>
                        </material_1.RadioGroup>
                      </material_1.FormControl>
                    </material_1.TableCell>
                    <material_1.TableCell>
                      <DateSearch_1.default date={luxon_1.DateTime.fromFormat(closure.start, formatDateTime_1.OVERRIDE_DATE_FORMAT)} setDate={function (date) {
                        var _a;
                        handleUpdateClosures(index, {
                            start: (_a = date === null || date === void 0 ? void 0 : date.toFormat(formatDateTime_1.OVERRIDE_DATE_FORMAT)) !== null && _a !== void 0 ? _a : '',
                            end: closure.end,
                            type: closure.type,
                        });
                    }} required closeOnSelect small></DateSearch_1.default>
                    </material_1.TableCell>
                    <material_1.TableCell>
                      <DateSearch_1.default date={closure.end ? luxon_1.DateTime.fromFormat(closure.end, formatDateTime_1.OVERRIDE_DATE_FORMAT) : null} required={closure.type === types_1.ClosureType.Period} disabled={closure.type === types_1.ClosureType.OneDay} disableDates={function (day) {
                        return day <= luxon_1.DateTime.fromFormat(closure.start, formatDateTime_1.OVERRIDE_DATE_FORMAT);
                    }} setDate={function (date) {
                        var _a;
                        handleUpdateClosures(index, {
                            start: closure.start,
                            end: (_a = date === null || date === void 0 ? void 0 : date.toFormat(formatDateTime_1.OVERRIDE_DATE_FORMAT)) !== null && _a !== void 0 ? _a : '',
                            type: closure.type,
                        });
                    }} closeOnSelect small></DateSearch_1.default>
                    </material_1.TableCell>
                    <material_1.TableCell>
                      <material_1.IconButton color="error" onClick={function () {
                        var deleteIndex = closures.indexOf(closure);
                        var closuresDeepClone = JSON.parse(JSON.stringify(closures));
                        closuresDeepClone.splice(deleteIndex, 1);
                        setClosures(closuresDeepClone);
                    }}>
                        <Delete_1.default />
                      </material_1.IconButton>
                    </material_1.TableCell>
                  </material_1.TableRow>);
            })}
        </material_1.TableBody>
      </material_1.Table>

      <material_1.Button variant="outlined" color="primary" sx={{
            borderRadius: '50px',
            textTransform: 'none',
            height: 36,
            fontWeight: 'bold',
            marginTop: 3,
        }} onClick={function () {
            var defaultClosure = { start: '', end: '', type: types_1.ClosureType.OneDay };
            setClosures(__spreadArray(__spreadArray([], (closures !== null && closures !== void 0 ? closures : []), true), [defaultClosure], false));
        }}>
        Add closed date
      </material_1.Button>
    </material_1.Box>);
}
//# sourceMappingURL=OfficeClosures.js.map