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
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var utils_1 = require("utils");
var Slots_1 = require("./Slots");
var DATETIME_FULL_NO_YEAR = 'MMMM d, h:mm a ZZZZ';
var DATE_FULL_NO_YEAR = 'EEEE, MMMM d';
function createLocalDateTime(dateTime, timezone) {
    var localDateTime;
    if (dateTime !== undefined) {
        localDateTime = dateTime.setZone(timezone);
    }
    return localDateTime;
}
var TabPanel = function (props) {
    var children = props.children, value = props.value, index = props.index, other = __rest(props, ["children", "value", "index"]);
    return (<div role="tabpanel" hidden={value !== index} id={"appointment-picker-tabpanel-".concat(index)} aria-labelledby={"appointment-picker-tab-".concat(index)} {...other}>
      {value === index && <material_1.Box sx={{ pt: 3, pb: 3 }}>{children}</material_1.Box>}
    </div>);
};
var tabProps = function (index) {
    return {
        id: "appointment-picker-tab-".concat(index),
        'aria-controls': "appointment-picker-tabpanel-".concat(index),
    };
};
var SlotPicker = function (_a) {
    var _b;
    var slotData = _a.slotData, slotsLoading = _a.slotsLoading, timezone = _a.timezone, selectedSlot = _a.selectedSlot, setSelectedSlot = _a.setSelectedSlot;
    var theme = (0, material_1.useTheme)();
    var _c = (0, react_1.useState)(0), currentTab = _c[0], setCurrentTab = _c[1];
    var _d = (0, react_1.useState)(false), nextDay = _d[0], setNextDay = _d[1];
    var _e = (0, react_1.useMemo)(function () {
        if (slotData) {
            var slots = __spreadArray([], slotData, true);
            // This maps days to an array of slots
            var map = slots.reduce(function (accumulator, current) {
                var dateOfCurrent = luxon_1.DateTime.fromISO(current.start, { zone: timezone });
                var existing = accumulator[dateOfCurrent.ordinal];
                if (existing) {
                    existing.push(current);
                }
                else {
                    accumulator[dateOfCurrent.ordinal] = [current];
                }
                return accumulator;
            }, {});
            return [slots, map];
        }
        return [[], {}];
    }, [timezone, slotData]), slotsList = _e[0], daySlotsMap = _e[1];
    var _f = (0, react_1.useMemo)(function () {
        var _a, _b;
        var firstAvailableDay = undefined;
        var secondAvailableDay = undefined;
        var currentTime = luxon_1.DateTime.now().setZone(timezone);
        if (slotsList == null || slotsList.length === 0) {
            return { firstAvailableDay: firstAvailableDay, secondAvailableDay: secondAvailableDay, lastSlot: undefined };
        }
        firstAvailableDay = createLocalDateTime(luxon_1.DateTime.fromISO(slotsList[0].start), timezone);
        var firstSlot = slotsList[0];
        var firstTime = (_a = luxon_1.DateTime.fromISO(firstSlot.start)) === null || _a === void 0 ? void 0 : _a.setZone(timezone).toISODate();
        var currentExistingTime = (_b = currentTime === null || currentTime === void 0 ? void 0 : currentTime.setZone(timezone)) === null || _b === void 0 ? void 0 : _b.toISODate();
        if (!firstTime || !currentExistingTime) {
            return { firstAvailableDay: firstAvailableDay, secondAvailableDay: secondAvailableDay, lastSlot: undefined };
        }
        else if (firstTime > currentExistingTime) {
            setNextDay(true);
        }
        if (firstAvailableDay) {
            secondAvailableDay = (0, utils_1.nextAvailableFrom)(firstAvailableDay, slotsList, timezone);
            if (secondAvailableDay) {
                setNextDay(false);
            }
        }
        return { firstAvailableDay: firstAvailableDay, secondAvailableDay: secondAvailableDay };
    }, [slotsList, timezone]), firstAvailableDay = _f.firstAvailableDay, secondAvailableDay = _f.secondAvailableDay;
    var isFirstAppointment = (0, react_1.useMemo)(function () {
        return slotsList && slotsList[0] ? selectedSlot === slotsList[0] : false;
    }, [selectedSlot, slotsList]);
    var handleChange = function (_, newCurrentTab) {
        setCurrentTab(newCurrentTab);
    };
    var _g = (0, react_1.useState)(), selectedOtherDate = _g[0], setSelectedOtherDate = _g[1];
    (0, react_1.useEffect)(function () {
        if (selectedOtherDate === undefined && secondAvailableDay != undefined) {
            setSelectedOtherDate((0, utils_1.nextAvailableFrom)(secondAvailableDay, slotsList, timezone));
        }
    }, [secondAvailableDay, selectedOtherDate, slotsList, timezone]);
    var selectedDate = (0, react_1.useMemo)(function () {
        if (currentTab === 0) {
            return firstAvailableDay;
        }
        else if (currentTab === 1) {
            return secondAvailableDay;
        }
        else {
            return selectedOtherDate;
        }
    }, [currentTab, firstAvailableDay, secondAvailableDay, selectedOtherDate]);
    var getSlotsForDate = (0, react_1.useCallback)(function (date) {
        var _a;
        if (date === undefined) {
            return [];
        }
        return (_a = daySlotsMap[date.ordinal]) !== null && _a !== void 0 ? _a : [];
    }, [daySlotsMap]);
    var slotsExist = getSlotsForDate(firstAvailableDay).length > 0 || getSlotsForDate(secondAvailableDay).length > 0;
    return (<material_1.Box sx={{ backgroundColor: theme.palette.background.default, padding: 2, borderRadius: 2, marginTop: 2 }}>
      <material_1.Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
        }}>
        <material_1.Typography variant="h3" color="primary" fontSize="20px">
          Select check-in date and time
        </material_1.Typography>
        {(selectedDate === null || selectedDate === void 0 ? void 0 : selectedDate.offsetNameShort) && (<material_1.Typography color="theme.palette.text.secondary" sx={{ pt: { xs: 1.5, md: 0.5 } }}>
            Time Zone: {(_b = selectedDate.setLocale('en-us')) === null || _b === void 0 ? void 0 : _b.offsetNameShort}
          </material_1.Typography>)}
      </material_1.Box>
      {slotsList && selectedDate != undefined && slotsExist ? (<material_1.Button variant={isFirstAppointment ? 'contained' : 'outlined'} sx={{
                color: isFirstAppointment ? theme.palette.primary.contrastText : theme.palette.text.primary,
                border: isFirstAppointment
                    ? "1px solid ".concat(theme.palette.primary.main)
                    : "1px solid ".concat(theme.palette.divider),
                p: 1,
                borderRadius: '8px',
                textAlign: 'center',
                mt: 2.5,
                mb: 1.5,
                width: '100%',
                textTransform: 'none',
                fontWeight: 400,
                display: { xs: 'block', md: 'inline' },
            }} onClick={function () { return setSelectedSlot(slotsList[0]); }} type="button" className="first-button">
          <span style={{ fontWeight: 500 }}>First available time:&nbsp;</span>
          {firstAvailableDay === null || firstAvailableDay === void 0 ? void 0 : firstAvailableDay.toFormat(DATETIME_FULL_NO_YEAR)}
        </material_1.Button>) : (<material_1.Box sx={{
                border: "1px solid ".concat(theme.palette.divider),
                p: 1,
                borderRadius: '8px',
                textAlign: 'center',
                mt: 1,
                display: slotsExist ? 'inherit' : 'none',
            }}>
          <material_1.Typography variant="body2">Calculating...</material_1.Typography>
        </material_1.Box>)}
      {!slotsLoading ? (<>
          {firstAvailableDay ? (<material_1.Box>
              <material_1.Box sx={{ width: '100%' }}>
                <material_1.Tabs value={currentTab} onChange={handleChange} TabIndicatorProps={{
                    style: {
                        // background: otherColors.borderLightBlue,
                        background: theme.palette.secondary.main,
                        height: '5px',
                        borderRadius: '2.5px',
                    },
                }} variant="fullWidth" aria-label="Appointment tabs for switching between appointments slots for today and tomorrow">
                  <material_1.Tab label={nextDay ? 'Tomorrow' : 'Today'} {...tabProps(0)} sx={{
                    color: currentTab == 0 ? theme.palette.secondary.main : theme.palette.text.secondary,
                    opacity: 1,
                    textTransform: 'capitalize',
                    fontWeight: 500,
                }}/>
                  {secondAvailableDay && (<material_1.Tab label="Tomorrow" {...tabProps(1)} sx={{
                        color: currentTab == 1 ? theme.palette.secondary.main : theme.palette.text.secondary,
                        opacity: 1,
                        textTransform: 'capitalize',
                        fontWeight: 500,
                    }}/>)}
                </material_1.Tabs>
              </material_1.Box>
              <material_1.Box>
                <TabPanel value={currentTab} index={0} dir={theme.direction}>
                  <material_1.Typography variant="h3" color="#000000" sx={{ textAlign: 'center', fontSize: '20px', color: theme.palette.primary.main }}>
                    {firstAvailableDay === null || firstAvailableDay === void 0 ? void 0 : firstAvailableDay.toFormat(DATE_FULL_NO_YEAR)}
                  </material_1.Typography>
                  <Slots_1.Slots slots={getSlotsForDate(firstAvailableDay)} timezone={timezone} selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot}/>
                </TabPanel>
                <TabPanel value={currentTab} index={1} dir={theme.direction}>
                  <material_1.Typography variant="h3" color="#000000" sx={{ textAlign: 'center', fontSize: '20px', color: theme.palette.primary.main }}>
                    {secondAvailableDay === null || secondAvailableDay === void 0 ? void 0 : secondAvailableDay.toFormat(DATE_FULL_NO_YEAR)}
                  </material_1.Typography>
                  <Slots_1.Slots slots={getSlotsForDate(secondAvailableDay)} timezone={timezone} selectedSlot={selectedSlot} setSelectedSlot={setSelectedSlot}/>
                </TabPanel>
              </material_1.Box>
            </material_1.Box>) : (<material_1.Typography variant="body2" color="#000000" sx={{ textAlign: 'center', marginTop: '30px' }}>
              There are no slots available, please come in when we are open.
            </material_1.Typography>)}
        </>) : (<material_1.Typography variant="body2" m={1} textAlign={'center'}>
          Loading...
        </material_1.Typography>)}
    </material_1.Box>);
};
exports.default = SlotPicker;
//# sourceMappingURL=SlotPicker.js.map