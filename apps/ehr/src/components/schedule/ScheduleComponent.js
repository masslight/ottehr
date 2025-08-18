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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.allWorkingDays = exports.dayToDayCode = exports.DEFAULT_CAPACITY = void 0;
exports.getTimeFromString = getTimeFromString;
exports.default = ScheduleComponent;
var colors_1 = require("@ehrTheme/colors");
var InfoOutlined_1 = require("@mui/icons-material/InfoOutlined");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var Alert_1 = require("@mui/material/Alert");
var Snackbar_1 = require("@mui/material/Snackbar");
var luxon_1 = require("luxon");
var react_1 = require("react");
var ScheduleCapacity_1 = require("./ScheduleCapacity");
var ScheduleOverridesComponent_1 = require("./ScheduleOverridesComponent");
var WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
exports.DEFAULT_CAPACITY = 20; // default capacity
exports.dayToDayCode = {
    Monday: 'mon',
    Tuesday: 'tue',
    Wednesday: 'wed',
    Thursday: 'thu',
    Friday: 'fri',
    Saturday: 'sat',
    Sunday: 'sun',
};
exports.allWorkingDays = ['sun', 'sat', 'fri', 'mon', 'tue', 'wed', 'thu'];
function getTimeFromString(time) {
    var timeHour = time.substring(0, 2);
    return Number(timeHour);
}
function InfoForDay(_a) {
    var _b;
    var day = _a.day, setDay = _a.setDay, updateItem = _a.updateItem, loading = _a.loading;
    var _c = react_1.default.useState(day.open), open = _c[0], setOpen = _c[1];
    var _d = react_1.default.useState(day.openingBuffer), openingBuffer = _d[0], setOpeningBuffer = _d[1];
    var _e = react_1.default.useState((_b = day.close) !== null && _b !== void 0 ? _b : 24), close = _e[0], setClose = _e[1];
    var _f = react_1.default.useState(day.closingBuffer), closingBuffer = _f[0], setClosingBuffer = _f[1];
    var _g = react_1.default.useState(day.workingDay), workingDay = _g[0], setWorkingDay = _g[1];
    var timeMenuItems = (0, react_1.useMemo)(function () {
        return Array.from({ length: 24 }, function (_, i) { return (<material_1.MenuItem key={i} value={i}>
          {i % 12 || 12} {i < 12 ? 'AM' : 'PM'}
        </material_1.MenuItem>); });
    }, []);
    function createOpenCloseSelectField(type, day) {
        var typeLowercase = type.toLocaleLowerCase();
        return (<material_1.FormControl sx={{ marginRight: 2 }}>
        <material_1.InputLabel id={"".concat(typeLowercase, "-label")}>{type}</material_1.InputLabel>
        <material_1.Select labelId={"".concat(typeLowercase, "-label")} id={typeLowercase} value={type === 'Open' ? open : close} label={type} disabled={!workingDay} onChange={function (newTime) {
                var updatedTime = Number(newTime.target.value);
                var dayTemp = day;
                if (type === 'Open') {
                    setOpen(updatedTime);
                    dayTemp.open = updatedTime;
                    setDay(dayTemp);
                }
                else if (type === 'Close') {
                    setClose(updatedTime);
                    dayTemp.close = updatedTime;
                    setDay(dayTemp);
                }
            }} sx={{
                width: 200,
                maxWidth: '100%',
                flexShrink: 1,
            }} MenuProps={{
                PaperProps: {
                    sx: {
                        '& .MuiMenuItem-root:hover': {
                            backgroundColor: colors_1.otherColors.selectMenuHover,
                        },
                    },
                },
            }}>
          {type === 'Open' && <material_1.MenuItem value={0}>12 AM</material_1.MenuItem>}
          {timeMenuItems}
          {type === 'Close' && <material_1.MenuItem value={24}>12 AM</material_1.MenuItem>}
        </material_1.Select>
      </material_1.FormControl>);
    }
    function createOpenCloseBufferSelectField(type, day) {
        var typeVerb = type === 'Close' ? 'Closing' : 'Opening';
        var typeLowercase = typeVerb.toLocaleLowerCase();
        var bufferValue = type === 'Open' ? openingBuffer !== null && openingBuffer !== void 0 ? openingBuffer : '' : closingBuffer !== null && closingBuffer !== void 0 ? closingBuffer : '';
        return (<material_1.FormControl sx={{ marginRight: 2 }}>
        <material_1.InputLabel id={"".concat(typeLowercase, "-buffer-label")}>{typeVerb} Buffer</material_1.InputLabel>
        <material_1.Select labelId={"".concat(typeLowercase, "-buffer-label")} id={"".concat(typeLowercase, "-buffer")} value={bufferValue} defaultValue={bufferValue} label={"".concat(typeVerb, " Buffer")} disabled={!workingDay} onChange={function (newNumber) {
                var updatedNumber = Number(newNumber.target.value);
                var dayTemp = day;
                if (type === 'Open') {
                    setOpeningBuffer(updatedNumber);
                    dayTemp.openingBuffer = updatedNumber;
                    setDay(dayTemp);
                }
                else if (type === 'Close') {
                    setClosingBuffer(updatedNumber);
                    dayTemp.closingBuffer = updatedNumber;
                    setDay(dayTemp);
                }
            }} sx={{
                width: 200,
                maxWidth: '100%',
                flexShrink: 1,
            }} MenuProps={{
                PaperProps: {
                    sx: {
                        '& .MuiMenuItem-root:hover': {
                            backgroundColor: colors_1.otherColors.selectMenuHover,
                        },
                    },
                },
            }}>
          <material_1.MenuItem value={0}>0 mins</material_1.MenuItem>
          <material_1.MenuItem value={15}>15 mins</material_1.MenuItem>
          <material_1.MenuItem value={30}>30 mins</material_1.MenuItem>
          <material_1.MenuItem value={60}>60 mins</material_1.MenuItem>
          <material_1.MenuItem value={90}>90 mins</material_1.MenuItem>
        </material_1.Select>
      </material_1.FormControl>);
    }
    return (<material_1.Box>
      <>
        {/* Working Hours */}
        <material_1.Typography variant="h4" color="primary.dark" marginBottom={3} marginTop={-1}>
          Working Hours
        </material_1.Typography>

        {/* Working Hours Form */}

        <material_1.Box sx={{ display: 'flex', flexDirection: 'row' }} alignItems="center">
          {/* Checkbox */}
          <material_1.FormControlLabel control={<material_1.Checkbox checked={workingDay} onChange={function (event) {
                var dayTemp = day;
                dayTemp.workingDay = event.target.checked;
                setDay(dayTemp);
                setWorkingDay(event.target.checked);
            }}/>} label="Working Day"/>

          {createOpenCloseSelectField('Open', day)}
          {createOpenCloseBufferSelectField('Open', day)}

          {createOpenCloseSelectField('Close', day)}
          {createOpenCloseBufferSelectField('Close', day)}
        </material_1.Box>

        {/* Capacity */}
        <form onSubmit={updateItem}>
          {workingDay && (<material_1.Box>
              <material_1.Box sx={{ display: 'inline-flex', alignItems: 'center' }} marginBottom={3} marginTop={6}>
                <material_1.Typography variant="h4" color="primary.dark">
                  Capacity
                </material_1.Typography>

                {/* Visit duration */}
                <material_1.Box sx={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
            }}>
                  <InfoOutlined_1.default sx={{
                marginRight: 1,
                marginLeft: 3,
                width: 18,
                height: 18,
            }} color="secondary"/>
                  <material_1.Typography variant="body1">
                    <material_1.Box component="span" fontWeight="bold" display="inline">
                      Visit Duration:
                    </material_1.Box>{' '}
                    15 minutes
                  </material_1.Typography>
                </material_1.Box>
              </material_1.Box>

              <ScheduleCapacity_1.ScheduleCapacity day={day} setDay={setDay} openingHour={open} closingHour={close} openingBuffer={openingBuffer} closingBuffer={closingBuffer}/>
            </material_1.Box>)}
          {/* save changes and cancel buttons */}
          <material_1.Box marginTop={3} display="flex" flexDirection="row">
            <lab_1.LoadingButton variant="contained" sx={{
            borderRadius: '50px',
            textTransform: 'none',
            height: 36,
            fontWeight: 'bold',
        }} type="submit" loading={loading}>
              Save Changes
            </lab_1.LoadingButton>
          </material_1.Box>
        </form>
      </>
    </material_1.Box>);
}
function ScheduleComponent(_a) {
    var _this = this;
    var item = _a.item, update = _a.update, loading = _a.loading, _b = _a.hideOverrides, hideOverrides = _b === void 0 ? false : _b;
    var today = luxon_1.DateTime.now().toLocaleString({ weekday: 'long' }).toLowerCase();
    var _c = react_1.default.useState(today), dayOfWeek = _c[0], setDayOfWeek = _c[1];
    var _d = react_1.default.useState(item.schema.schedule), days = _d[0], setDays = _d[1];
    var _e = react_1.default.useState(undefined), toastMessage = _e[0], setToastMessage = _e[1];
    var _f = react_1.default.useState(undefined), toastType = _f[0], setToastType = _f[1];
    var _g = react_1.default.useState(false), snackbarOpen = _g[0], setSnackbarOpen = _g[1];
    var _h = react_1.default.useState(false), savingOverrides = _h[0], setSavingOverrides = _h[1];
    var handleTabChange = function (event, newDayOfWeek) {
        setDayOfWeek(newDayOfWeek);
    };
    var handleScheduleUpdate = function (event) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    event.preventDefault();
                    //console.log('handling update', event.target, new FormData(event.target), days);
                    return [4 /*yield*/, update({ scheduleId: item.id, schedule: days })];
                case 1:
                    //console.log('handling update', event.target, new FormData(event.target), days);
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
    var saveOverrides = function (overrides) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setSavingOverrides(true);
                    console.log('handling overrides', overrides);
                    return [4 /*yield*/, update(__assign({ scheduleId: item.id }, overrides))];
                case 1:
                    _a.sent();
                    setSavingOverrides(false);
                    return [2 /*return*/];
            }
        });
    }); };
    var handleSnackBarClose = function () {
        setSnackbarOpen(false);
    };
    react_1.default.useEffect(function () {
        setDays(item.schema.schedule);
    }, [item]);
    return (<>
      <lab_1.TabContext value={dayOfWeek}>
        {/* seven buttons, one for each day of the week */}
        <material_1.Paper>
          <material_1.Box paddingTop={1}>
            <material_1.Box marginX={3} marginTop={2}>
              <lab_1.TabList TabIndicatorProps={{ style: { backgroundColor: 'transparent' } }} sx={{
            '& .MuiButtonBase-root': {
                '&:first-of-type': {
                    borderTopLeftRadius: '8px',
                    borderBottomLeftRadius: '8px',
                    borderLeft: '1px solid #2169F5',
                },
                '&:last-child': {
                    borderTopRightRadius: '8px',
                    borderBottomRightRadius: '8px',
                },
            },
        }} onChange={handleTabChange} aria-label="Weekdays for the schedule">
                {WEEKDAYS.map(function (day) { return (<material_1.Tab sx={{
                textTransform: 'none',
                borderRight: '1px solid #2169F5',
                borderTop: '1px solid #2169F5',
                borderBottom: '1px solid #2169F5',
                color: '#2169F5',
                width: 'fit-content',
                height: '36px',
                minHeight: '36px',
                fontWeight: 500,
                '&.Mui-selected': {
                    color: '#FFFFFF',
                    background: '#2169F5',
                },
            }} label={(0, material_1.capitalize)(day)} value={day} key={day}></material_1.Tab>); })}
              </lab_1.TabList>
            </material_1.Box>
            {days &&
            Object.keys(days).map(function (day) { return (<lab_1.TabPanel value={day} key={day}>
                  <InfoForDay day={days[day]} setDay={function (dayTemp) {
                    var daysTemp = days;
                    daysTemp[day] = __assign(__assign({}, dayTemp), { open: dayTemp.open, close: dayTemp.close, workingDay: days[day].workingDay });
                    setDays(daysTemp);
                }} dayOfWeek={dayOfWeek} updateItem={handleScheduleUpdate} loading={loading}></InfoForDay>
                </lab_1.TabPanel>); })}
          </material_1.Box>
        </material_1.Paper>
        <Snackbar_1.default 
    // anchorOrigin={{ vertical: snackbarOpen.vertical, horizontal: snackbarOpen.horizontal }}
    open={snackbarOpen} 
    // autoHideDuration={6000}
    onClose={handleSnackBarClose} message={toastMessage}>
          <Alert_1.default onClose={handleSnackBarClose} severity={toastType} sx={{ width: '100%' }}>
            {toastMessage}
          </Alert_1.default>
        </Snackbar_1.default>
      </lab_1.TabContext>
      {!hideOverrides && (<ScheduleOverridesComponent_1.ScheduleOverridesComponent loading={savingOverrides} model={item.schema} dayOfWeek={dayOfWeek} update={saveOverrides} setToastMessage={setToastMessage} setToastType={setToastType} setSnackbarOpen={setSnackbarOpen}/>)}
    </>);
}
//# sourceMappingURL=ScheduleComponent.js.map