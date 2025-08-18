"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleCapacity = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var formatDateTime_1 = require("../../helpers/formatDateTime");
var ScheduleCapacity = function (_a) {
    var day = _a.day, setDay = _a.setDay, openingHour = _a.openingHour, closingHour = _a.closingHour, openingBuffer = _a.openingBuffer, closingBuffer = _a.closingBuffer;
    var open = openingHour || day.open;
    var close = closingHour || day.close;
    close = close === 0 && open !== 0 ? 24 : close;
    // create a list of all times in 1 hour increments between open and close
    var openHours = react_1.default.useMemo(function () {
        var times = [];
        for (var i = open; i < close; i++) {
            times.push(i);
        }
        return times;
    }, [open, close]);
    return (<>
      <material_1.Box>
        <material_1.Table>
          <material_1.TableHead>
            <material_1.TableRow key="headRow">
              <material_1.TableCell sx={{ fontWeight: 'bold' }}>Hour</material_1.TableCell>
              <material_1.TableCell sx={{ fontWeight: 'bold', width: '70%' }}># of prebooked slots</material_1.TableCell>
            </material_1.TableRow>
          </material_1.TableHead>
          <material_1.TableBody>
            {openHours.map(function (hour, index) {
            var _a, _b, _c;
            return (<material_1.TableRow key={hour}>
                <material_1.TableCell sx={{ fontSize: '16px' }}>
                  {"".concat((0, formatDateTime_1.formatHourNumber)(hour), " - ").concat((0, formatDateTime_1.formatHourNumber)(hour + 1))}
                  {index === 0 && (<material_1.Typography variant="body2">{"Opening buffer ".concat((_a = openingBuffer !== null && openingBuffer !== void 0 ? openingBuffer : day.openingBuffer) !== null && _a !== void 0 ? _a : '-', " minutes")}</material_1.Typography>)}
                  {index === openHours.length - 1 && (<material_1.Typography variant="body2">{"Closing buffer ".concat((_b = closingBuffer !== null && closingBuffer !== void 0 ? closingBuffer : day.closingBuffer) !== null && _b !== void 0 ? _b : '-', " minutes")}</material_1.Typography>)}
                </material_1.TableCell>
                <material_1.TableCell>
                  <material_1.TextField type="number" required defaultValue={((_c = day.hours.find(function (capacityTemp) { return capacityTemp.hour === hour; })) === null || _c === void 0 ? void 0 : _c.capacity) || 0} onChange={function (newCapacity) {
                    var _a;
                    var dayTemp = day;
                    var tempHours = [];
                    var _loop_1 = function (i) {
                        var updatedHour = undefined;
                        if (hour === i) {
                            updatedHour = Number(newCapacity.target.value);
                        }
                        else {
                            updatedHour = (_a = day.hours.find(function (hourTemp) { return hourTemp.hour === i; })) === null || _a === void 0 ? void 0 : _a.capacity;
                        }
                        tempHours.push({
                            hour: i,
                            capacity: updatedHour || 0,
                        });
                    };
                    for (var i = openingHour; i < close; i++) {
                        _loop_1(i);
                    }
                    dayTemp.hours = tempHours;
                    setDay(dayTemp);
                }} sx={{
                    width: '100px',
                }} InputProps={{
                    inputProps: {
                        min: 0,
                    },
                }} size="small"/>
                </material_1.TableCell>
              </material_1.TableRow>);
        })}
          </material_1.TableBody>
        </material_1.Table>
      </material_1.Box>
      {/* )} */}
    </>);
};
exports.ScheduleCapacity = ScheduleCapacity;
//# sourceMappingURL=ScheduleCapacity.js.map