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
exports.ScheduleOverridesComponent = ScheduleOverridesComponent;
var Delete_1 = require("@mui/icons-material/Delete");
var ExpandMore_1 = require("@mui/icons-material/ExpandMore");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var formatDateTime_1 = require("../../helpers/formatDateTime");
var types_1 = require("../../types/types");
var DateSearch_1 = require("../DateSearch");
var OfficeClosures_1 = require("./OfficeClosures");
var ScheduleCapacity_1 = require("./ScheduleCapacity");
var ScheduleOverridesDialog_1 = require("./ScheduleOverridesDialog");
function ScheduleOverridesComponent(_a) {
    var _b;
    var model = _a.model, loading = _a.loading, update = _a.update, setToastMessage = _a.setToastMessage, setToastType = _a.setToastType, setSnackbarOpen = _a.setSnackbarOpen;
    var _c = (0, react_1.useState)(false), isScheduleOverridesDialogOpen = _c[0], setIsScheduleOverridesDialogOpen = _c[1];
    var _d = react_1.default.useState({}), overridesOpen = _d[0], setOverridesOpen = _d[1];
    var _e = react_1.default.useState(model.scheduleOverrides), overrides = _e[0], setOverrides = _e[1];
    var _f = react_1.default.useState((_b = model.closures) !== null && _b !== void 0 ? _b : []), closures = _f[0], setClosures = _f[1];
    (0, react_1.useEffect)(function () {
        var _a;
        setOverrides(model.scheduleOverrides);
        setClosures((_a = model.closures) !== null && _a !== void 0 ? _a : []);
    }, [model]);
    var setToastWarning = function (message) {
        setToastMessage(message);
        setToastType('warning');
        setSnackbarOpen(true);
    };
    var timeMenuItems = (0, react_1.useMemo)(function () {
        return Array.from({ length: 24 }, function (_, i) { return (<material_1.MenuItem key={i} value={i}>
          {i % 12 || 12} {i < 12 ? 'AM' : 'PM'}
        </material_1.MenuItem>); });
    }, []);
    var handleOverridesSave = function (event) {
        event.preventDefault();
        // validate closures
        if (closures) {
            var startDates = closures.map(function (closure) { return closure.start; });
            var startDatesSet = new Set(startDates);
            if (startDates.length !== startDatesSet.size) {
                setToastWarning('Closed times cannot start on the same day');
                return;
            }
            for (var _i = 0, closures_1 = closures; _i < closures_1.length; _i++) {
                var closure = closures_1[_i];
                if (closure.type === types_1.ClosureType.Period &&
                    luxon_1.DateTime.fromFormat(closure.end, formatDateTime_1.OVERRIDE_DATE_FORMAT) <
                        luxon_1.DateTime.fromFormat(closure.start, formatDateTime_1.OVERRIDE_DATE_FORMAT)) {
                    setToastWarning('Closed time end date must be after start date');
                    return;
                }
            }
        }
        // confirm schedule changes before saving
        setIsScheduleOverridesDialogOpen(true);
    };
    var createOpenCloseSelectField = function (type, override) {
        return (<material_1.FormControl sx={{ width: '100%' }}>
        {type === 'Open' ? (<material_1.InputLabel id="open-label">Open</material_1.InputLabel>) : (<material_1.InputLabel id="close-label">Close</material_1.InputLabel>)}
        <material_1.Select id={type === 'Open' ? 'open' : 'close'} labelId={type === 'Open' ? 'open-label' : 'close-label'} label={type === 'Open' ? 'Open' : 'Close'} required value={type === 'Open' ? overrides === null || overrides === void 0 ? void 0 : overrides[override].open : overrides === null || overrides === void 0 ? void 0 : overrides[override].close} onChange={function (updatedFrom) {
                var overridesTemp = __assign({}, overrides);
                if (type === 'Open') {
                    overridesTemp[override].open = Number(updatedFrom.target.value);
                }
                else if (type === 'Close') {
                    overridesTemp[override].close = Number(updatedFrom.target.value);
                }
                setOverrides(overridesTemp);
            }} size="small">
          {type === 'Open' && <material_1.MenuItem value={0}>12 AM</material_1.MenuItem>}
          {timeMenuItems}
          {type === 'Close' && <material_1.MenuItem value={24}>12 AM</material_1.MenuItem>}
        </material_1.Select>
      </material_1.FormControl>);
    };
    return (<>
      <material_1.Paper>
        <form onSubmit={handleOverridesSave}>
          <material_1.Box paddingY={2} paddingX={3} marginTop={4}>
            {/* Schedule overrides title */}
            <material_1.Typography variant="h4" color="primary.dark">
              Schedule Overrides
            </material_1.Typography>

            {/* Schedule overrides subtext */}
            <material_1.Typography variant="body1" color="black" marginTop={2}>
              One-time deviations from standing working hours. Any changes made will override the standard working hours
              set above for the date(s) selected.
            </material_1.Typography>
            {/* Schedule overrides table */}
            {/* Headers: Date, From, Opening buffer, To, Closing Buffer, Capacity, Trash */}

            <material_1.Table sx={{ marginTop: 3, tableLayout: 'fixed' }}>
              <material_1.TableHead>
                <material_1.TableRow key="headRow" sx={{ height: '40px' }}>
                  <material_1.TableCell sx={{ fontWeight: 'bold', width: '19%' }}>Date</material_1.TableCell>
                  <material_1.TableCell sx={{ fontWeight: 'bold', width: '14%' }}>Open</material_1.TableCell>
                  <material_1.TableCell sx={{ fontWeight: 'bold', width: '14%' }}>Opening buffer</material_1.TableCell>
                  <material_1.TableCell sx={{ fontWeight: 'bold', width: '14%' }}>Close</material_1.TableCell>
                  <material_1.TableCell sx={{ fontWeight: 'bold', width: '14%' }}>Closing buffer</material_1.TableCell>
                  <material_1.TableCell sx={{ fontWeight: 'bold', width: '17%' }}>Capacity</material_1.TableCell>
                  <material_1.TableCell sx={{ fontWeight: 'bold', width: '6%' }}>Delete</material_1.TableCell>
                </material_1.TableRow>
              </material_1.TableHead>
              <material_1.TableBody>
                {overrides &&
            Object.keys(overrides)
                .sort((0, formatDateTime_1.datesCompareFn)(formatDateTime_1.OVERRIDE_DATE_FORMAT))
                .map(function (dateString) { return (<react_1.Fragment key={"override-".concat(dateString)}>
                        <material_1.TableRow>
                          <material_1.TableCell>
                            {/* Date Select */}
                            <DateSearch_1.default date={luxon_1.DateTime.fromFormat(dateString, 'D')} setDate={function (date) {
                    // get default override values from schedule for selected day
                    var overridesTemp = __assign({}, overrides);
                    var dateFormatted = date === null || date === void 0 ? void 0 : date.toLocaleString(luxon_1.DateTime.DATE_SHORT);
                    if (dateFormatted) {
                        var schedule = model.schedule;
                        var currentDayOfWeek = date === null || date === void 0 ? void 0 : date.toFormat('cccc').toLowerCase();
                        var currentDayInfo = currentDayOfWeek && (schedule === null || schedule === void 0 ? void 0 : schedule[currentDayOfWeek]);
                        if (currentDayInfo) {
                            overridesTemp[dateFormatted] = {
                                open: currentDayInfo.open,
                                close: currentDayInfo.close,
                                openingBuffer: currentDayInfo.openingBuffer,
                                closingBuffer: currentDayInfo.closingBuffer,
                                hours: currentDayInfo.hours || [],
                            };
                        }
                        else {
                            overridesTemp[dateFormatted] = overridesTemp[dateString];
                        }
                        delete overridesTemp[dateString];
                    }
                    setOverrides(overridesTemp);
                }} required closeOnSelect small></DateSearch_1.default>
                          </material_1.TableCell>
                          <material_1.TableCell>
                            {/* Open Select */}
                            {createOpenCloseSelectField('Open', dateString)}
                          </material_1.TableCell>
                          <material_1.TableCell>
                            {/* Opening Buffer Select */}
                            <material_1.FormControl sx={{ width: '100%' }}>
                              <material_1.InputLabel id="opening-buffer-label">Opening buffer</material_1.InputLabel>
                              <material_1.Select labelId="opening-buffer-label" label="Opening buffer" id="opening-buffer" value={overrides[dateString].openingBuffer} onChange={function (updatedFrom) {
                    var overridesTemp = __assign({}, overrides);
                    overridesTemp[dateString].openingBuffer = Number(updatedFrom.target.value);
                    setOverrides(overridesTemp);
                }} sx={{
                    display: 'flex',
                    height: '40px',
                    flexShrink: 1,
                }} size="small">
                                <material_1.MenuItem value={0}>0 mins</material_1.MenuItem>
                                <material_1.MenuItem value={15}>15 mins</material_1.MenuItem>
                                <material_1.MenuItem value={30}>30 mins</material_1.MenuItem>
                                <material_1.MenuItem value={60}>60 mins</material_1.MenuItem>
                                <material_1.MenuItem value={90}>90 mins</material_1.MenuItem>
                              </material_1.Select>
                            </material_1.FormControl>
                          </material_1.TableCell>
                          <material_1.TableCell>
                            {/* Close Select */}
                            {createOpenCloseSelectField('Close', dateString)}
                          </material_1.TableCell>
                          <material_1.TableCell>
                            {/* closing buffer select */}
                            <material_1.FormControl sx={{ width: '100%' }}>
                              <material_1.InputLabel id="closing-buffer-label">Closing buffer</material_1.InputLabel>
                              <material_1.Select labelId="closing-buffer-label" label="Closing buffer" id="closing-buffer" value={overrides[dateString].closingBuffer} onChange={function (updatedClosing) {
                    var overridesTemp = __assign({}, overrides);
                    overridesTemp[dateString].closingBuffer = Number(updatedClosing.target.value);
                    setOverrides(overridesTemp);
                }} size="small">
                                <material_1.MenuItem value={0}>0 mins</material_1.MenuItem>
                                <material_1.MenuItem value={15}>15 mins</material_1.MenuItem>
                                <material_1.MenuItem value={30}>30 mins</material_1.MenuItem>
                                <material_1.MenuItem value={60}>60 mins</material_1.MenuItem>
                                <material_1.MenuItem value={90}>90 mins</material_1.MenuItem>
                              </material_1.Select>
                            </material_1.FormControl>
                          </material_1.TableCell>
                          <material_1.TableCell>
                            {/* button that opens the override capacity section */}
                            <material_1.Button variant="text" color="primary" endIcon={<ExpandMore_1.default />} sx={{
                    borderRadius: '50px',
                    textTransform: 'none',
                    height: 36,
                    fontWeight: 'bold',
                    display: 'inline-flex',
                }} onClick={function () {
                    var overridesOpenTemp = __assign({}, overridesOpen);
                    overridesOpenTemp[dateString] = !overridesOpenTemp[dateString];
                    setOverridesOpen(overridesOpenTemp);
                }}>
                              Override capacity
                            </material_1.Button>
                          </material_1.TableCell>
                          <material_1.TableCell>
                            <material_1.IconButton color="error" onClick={function () {
                    var overridesTemp = __assign({}, overrides);
                    delete overridesTemp[dateString];
                    setOverrides(overridesTemp);
                }}>
                              <Delete_1.default />
                            </material_1.IconButton>
                          </material_1.TableCell>
                        </material_1.TableRow>

                        {overridesOpen[dateString] && (<material_1.TableRow>
                            <material_1.TableCell colSpan={7}>
                              <ScheduleCapacity_1.ScheduleCapacity day={overrides[dateString]} setDay={function (dayTemp) {
                        overrides[dateString] = __assign(__assign({}, dayTemp), { open: dayTemp.open, close: dayTemp.close });
                    }} openingHour={overrides[dateString].open} closingHour={overrides[dateString].close} openingBuffer={overrides[dateString].openingBuffer} closingBuffer={overrides[dateString].closingBuffer}/>
                            </material_1.TableCell>
                          </material_1.TableRow>)}
                      </react_1.Fragment>); })}
              </material_1.TableBody>
            </material_1.Table>

            {/* Add new override button */}
            <material_1.Button variant="outlined" color="primary" sx={{
            borderRadius: '50px',
            textTransform: 'none',
            height: 36,
            fontWeight: 'bold',
            marginTop: 3,
        }} onClick={function () {
            var overridesTemp = __assign({}, overrides);
            if (overridesTemp['override-new']) {
                setToastWarning('Cannot have two overrides for the same day');
            }
            else {
                overridesTemp['override-new'] = {
                    open: 8,
                    close: 17,
                    openingBuffer: 0,
                    closingBuffer: 0,
                    hours: [],
                };
            }
            setOverrides(overridesTemp);
        }}>
              Add override rule
            </material_1.Button>

            <OfficeClosures_1.default closures={closures} setClosures={setClosures}/>

            {/* save changes and cancel buttons */}
            <material_1.Box marginTop={5}>
              <material_1.Button variant="contained" type="submit" sx={{
            borderRadius: '50px',
            textTransform: 'none',
            height: 36,
            fontWeight: 'bold',
        }}>
                Save Changes
              </material_1.Button>
            </material_1.Box>
          </material_1.Box>
        </form>
        <ScheduleOverridesDialog_1.default loading={loading} handleClose={function () { return setIsScheduleOverridesDialogOpen(false); }} open={isScheduleOverridesDialogOpen} handleConfirm={function () {
            void update({ scheduleOverrides: overrides !== null && overrides !== void 0 ? overrides : {}, closures: closures !== null && closures !== void 0 ? closures : [] });
            setIsScheduleOverridesDialogOpen(false);
        }}/>
      </material_1.Paper>
    </>);
}
//# sourceMappingURL=ScheduleOverridesComponent.js.map