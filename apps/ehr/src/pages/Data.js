"use strict";
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
exports.ChartType = void 0;
exports.default = Data;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var x_date_pickers_1 = require("@mui/x-date-pickers");
var AdapterLuxon_1 = require("@mui/x-date-pickers/AdapterLuxon");
var x_date_pickers_pro_1 = require("@mui/x-date-pickers-pro");
var chart_js_1 = require("chart.js");
var luxon_1 = require("luxon");
var react_1 = require("react");
var react_chartjs_2_1 = require("react-chartjs-2");
var utils_1 = require("utils");
var AppointmentTableRow_1 = require("../components/AppointmentTableRow");
var LocationSelect_1 = require("../components/LocationSelect");
var formatDateTime_1 = require("../helpers/formatDateTime");
var useAppClients_1 = require("../hooks/useAppClients");
var PageContainer_1 = require("../layout/PageContainer");
var ChartType;
(function (ChartType) {
    ChartType["table"] = "table";
    ChartType["chart"] = "chart";
})(ChartType || (exports.ChartType = ChartType = {}));
var VisitTypeAll;
(function (VisitTypeAll) {
    VisitTypeAll["All"] = "all";
})(VisitTypeAll || (VisitTypeAll = {}));
var TimeRange;
(function (TimeRange) {
    TimeRange["Today"] = "Today";
    TimeRange["Yesterday"] = "Yesterday";
    TimeRange["ThisWeek"] = "This Week";
    TimeRange["ThisMonth"] = "This Month";
    TimeRange["LastWeek"] = "Last Week";
    TimeRange["LastMonth"] = "Last Month";
    TimeRange["PastSeven"] = "Past Seven Days";
    TimeRange["PastThirty"] = "Past Thirty Days";
    TimeRange["Custom"] = "Custom";
})(TimeRange || (TimeRange = {}));
function Data() {
    var _a = react_1.default.useState(undefined), appointmentCountByDate = _a[0], setAppointmentCountByDate = _a[1];
    var _b = react_1.default.useState(undefined), appointmentStatuses = _b[0], setAppointmentStatuses = _b[1];
    var _c = react_1.default.useState(undefined), appointmentsSeenIn45Ratio = _c[0], setAppointmentsSeenIn45Ratio = _c[1];
    var _d = react_1.default.useState(undefined), avgMinutesToProvider = _d[0], setAvgMinutesToProvider = _d[1];
    var _e = react_1.default.useState(undefined), totalVisits = _e[0], setTotalVisits = _e[1];
    var _f = react_1.default.useState(TimeRange.Today), timeRange = _f[0], setTimeRange = _f[1];
    var _g = react_1.default.useState(undefined), locationSelected = _g[0], setLocationSelected = _g[1];
    var _h = react_1.default.useState(VisitTypeAll.All), visitType = _h[0], setVisitType = _h[1];
    var _j = react_1.default.useState(luxon_1.DateTime.now()), filterStartDate = _j[0], setStartFilterDate = _j[1];
    var _k = react_1.default.useState(luxon_1.DateTime.now()), filterEndDate = _k[0], setEndFilterDate = _k[1];
    var _l = react_1.default.useState(null), customFilterStartDate = _l[0], setCustomStartFilterDate = _l[1];
    var _m = react_1.default.useState(null), customFilterEndDate = _m[0], setCustomEndFilterDate = _m[1];
    var _o = react_1.default.useState(true), loading = _o[0], setLoading = _o[1];
    var _p = react_1.default.useState(null), error = _p[0], setError = _p[1];
    var now = react_1.default.useState(luxon_1.DateTime.now())[0];
    var _q = react_1.default.useState(ChartType.chart), type = _q[0], setType = _q[1];
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    chart_js_1.Chart.register(chart_js_1.CategoryScale, chart_js_1.LinearScale, chart_js_1.PointElement, chart_js_1.LineElement, chart_js_1.BarElement, chart_js_1.Legend, chart_js_1.Title, chart_js_1.Tooltip, chart_js_1.Colors);
    // todo clean up
    // passing in an empty query params obj to location select because its required atm
    // not touching any code outside the data page at this point in dev
    var queryParams = new URLSearchParams({});
    react_1.default.useEffect(function () {
        var locationStore = localStorage === null || localStorage === void 0 ? void 0 : localStorage.getItem('selectedLocation');
        if (locationStore && !locationSelected) {
            setLocationSelected(JSON.parse(locationStore));
        }
    }, [locationSelected]);
    react_1.default.useEffect(function () {
        function updateAppointments() {
            return __awaiter(this, void 0, void 0, function () {
                var timezone, totalVisits_1, visitCountByDay_1, daysDiff, temp, i, formattedDay, searchParams, appointmentEncounterSearch_1, appointmentEncounterMap_1, formattedAppointments_1, appointmentCountByDateTemp, statusesCount_1, patientToProviderIn45Count_1, minutesToProvider_1, percentSeen, avgMinutesToProviderTemp;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            setLoading(true);
                            setError(null);
                            if (!(locationSelected &&
                                filterStartDate &&
                                filterEndDate &&
                                filterEndDate.startOf('day') >= filterStartDate.startOf('day'))) return [3 /*break*/, 2];
                            timezone = (0, formatDateTime_1.getTimezone)(locationSelected);
                            totalVisits_1 = 0;
                            visitCountByDay_1 = {};
                            daysDiff = Math.floor(filterEndDate.startOf('day').diff(filterStartDate.startOf('day')).as('days'));
                            temp = filterStartDate;
                            for (i = 0; i <= daysDiff; i++) {
                                formattedDay = temp.toFormat('y-MM-dd');
                                if (formattedDay)
                                    visitCountByDay_1[formattedDay] = 0;
                                temp = temp.plus({ day: 1 });
                            }
                            if (!oystehr)
                                return [2 /*return*/];
                            searchParams = [
                                { name: 'date', value: "ge".concat(filterStartDate.setZone(timezone).startOf('day')) },
                                { name: 'date', value: "le".concat(filterEndDate.setZone(timezone).endOf('day')) },
                                {
                                    name: 'location',
                                    value: "Location/".concat(locationSelected === null || locationSelected === void 0 ? void 0 : locationSelected.id),
                                },
                                {
                                    name: '_revinclude:iterate',
                                    value: 'Encounter:appointment',
                                },
                                {
                                    name: '_tag',
                                    value: utils_1.OTTEHR_MODULE.IP,
                                },
                            ];
                            if (visitType !== VisitTypeAll.All)
                                searchParams.push({ name: 'appointment-type', value: visitType });
                            return [4 /*yield*/, oystehr.fhir.search({
                                    resourceType: 'Appointment',
                                    params: searchParams,
                                })];
                        case 1:
                            appointmentEncounterSearch_1 = (_a.sent()).unbundle();
                            console.log('appointmentEncounterSearch', appointmentEncounterSearch_1);
                            appointmentEncounterMap_1 = {};
                            formattedAppointments_1 = [];
                            appointmentEncounterSearch_1.forEach(function (resource) {
                                if (resource.resourceType === 'Appointment') {
                                    var fhirAppointment_1 = resource;
                                    if (fhirAppointment_1.status === 'fulfilled' && fhirAppointment_1.id) {
                                        var appointmentDate = fhirAppointment_1.start && luxon_1.DateTime.fromISO(fhirAppointment_1.start).toFormat('y-MM-dd');
                                        if (appointmentDate) {
                                            totalVisits_1++;
                                            visitCountByDay_1[appointmentDate]++;
                                        }
                                        var encounter = appointmentEncounterSearch_1.find(function (r) { var _a; return r.resourceType === 'Encounter' && ((_a = r.appointment) === null || _a === void 0 ? void 0 : _a[0].reference) === "Appointment/".concat(fhirAppointment_1.id); });
                                        if (encounter) {
                                            var fhirEncounter = encounter;
                                            appointmentEncounterMap_1[fhirAppointment_1.id] = fhirEncounter;
                                            var visitStatus = (0, utils_1.getVisitStatus)(fhirAppointment_1, fhirEncounter);
                                            var visitStatusHistory = (0, utils_1.getVisitStatusHistory)(fhirEncounter);
                                            formattedAppointments_1.push({ id: fhirAppointment_1.id, visitStatus: visitStatus, visitStatusHistory: visitStatusHistory });
                                        }
                                    }
                                }
                            });
                            appointmentCountByDateTemp = Object.keys(visitCountByDay_1).map(function (day) {
                                return { date: luxon_1.DateTime.fromISO(day), appointments: visitCountByDay_1[day] };
                            });
                            console.log('visitCountByDay', visitCountByDay_1);
                            statusesCount_1 = {
                                pending: { numAppointments: 0, averageTime: 0 },
                                arrived: { numAppointments: 0, averageTime: 0 },
                                intake: { numAppointments: 0, averageTime: 0 },
                                'ready for provider': { numAppointments: 0, averageTime: 0 },
                                provider: { numAppointments: 0, averageTime: 0 },
                                discharged: { numAppointments: 0, averageTime: 0 },
                                cancelled: { numAppointments: 0, averageTime: 0 },
                                'no show': { numAppointments: 0, averageTime: 0 },
                                completed: { numAppointments: 0, averageTime: 0 },
                            };
                            patientToProviderIn45Count_1 = 0;
                            minutesToProvider_1 = [];
                            formattedAppointments_1.forEach(function (appointment) {
                                var _a;
                                var timeArrived, timeSeenByProvider;
                                (_a = appointment.visitStatusHistory) === null || _a === void 0 ? void 0 : _a.forEach(function (statusTemp) {
                                    var statusName = statusTemp.status;
                                    var statusPeriod = statusTemp.period;
                                    if (statusName !== 'no show' && statusName !== 'completed' && statusName !== 'cancelled') {
                                        if (statusPeriod.end && statusPeriod.start) {
                                            var statusTime = luxon_1.DateTime.fromISO(statusPeriod.end)
                                                .diff(luxon_1.DateTime.fromISO(statusPeriod.start), 'minutes')
                                                .toObject().minutes;
                                            if (statusTime) {
                                                statusesCount_1[statusName].averageTime =
                                                    (statusesCount_1[statusName].numAppointments * statusesCount_1[statusName].averageTime + statusTime) /
                                                        (statusesCount_1[statusName].numAppointments + 1);
                                                statusesCount_1[statusName].numAppointments = statusesCount_1[statusName].numAppointments + 1;
                                            }
                                        }
                                        if (statusName === 'arrived') {
                                            timeArrived = statusPeriod.start;
                                        }
                                        if (statusName === 'provider') {
                                            timeSeenByProvider = statusPeriod.start;
                                        }
                                    }
                                });
                                if (timeArrived && timeSeenByProvider) {
                                    var minutesToProviderTemp = luxon_1.DateTime.fromISO(timeSeenByProvider).diff(luxon_1.DateTime.fromISO(timeArrived), 'minutes').minutes;
                                    if (minutesToProviderTemp <= 45)
                                        patientToProviderIn45Count_1 += 1;
                                    minutesToProvider_1.push(minutesToProviderTemp);
                                }
                                setAppointmentStatuses(statusesCount_1);
                            });
                            if (formattedAppointments_1.length) {
                                if (totalVisits_1 > 0) {
                                    percentSeen = Math.round((patientToProviderIn45Count_1 / totalVisits_1) * 1000) / 10;
                                    setAppointmentsSeenIn45Ratio(percentSeen);
                                }
                                if (minutesToProvider_1.length > 0) {
                                    avgMinutesToProviderTemp = minutesToProvider_1.reduce(function (acc, minutes) { return acc + minutes; }, 0) / minutesToProvider_1.length;
                                    setAvgMinutesToProvider(Math.round(avgMinutesToProviderTemp * 10) / 10);
                                }
                            }
                            else {
                                setAppointmentStatuses(statusesCount_1);
                            }
                            setLoading(false);
                            setTotalVisits(totalVisits_1);
                            setAppointmentCountByDate(appointmentCountByDateTemp);
                            if ((formattedAppointments_1 === null || formattedAppointments_1 === void 0 ? void 0 : formattedAppointments_1.length) === 0) {
                                setError('No completed (checked out) appointments for this time range');
                            }
                            return [3 /*break*/, 3];
                        case 2:
                            if (locationSelected)
                                setLoading(false);
                            if (filterStartDate && filterEndDate && filterStartDate.startOf('day') > filterEndDate.startOf('day')) {
                                setError('Please make sure start date is before end date');
                            }
                            else {
                                console.log('filterStartDate', filterStartDate === null || filterStartDate === void 0 ? void 0 : filterStartDate.toISO());
                                console.log('filterEndDate', filterEndDate === null || filterEndDate === void 0 ? void 0 : filterEndDate.toISO());
                                setError('Please make sure there is a start and end date for the filter');
                            }
                            _a.label = 3;
                        case 3: return [2 /*return*/];
                    }
                });
            });
        }
        updateAppointments().catch(function (error) { return console.log('error getting appointment update', error); });
    }, [oystehr, now, visitType, filterStartDate, filterEndDate, locationSelected]);
    var handleCustomTimeRange = function () {
        if (customFilterEndDate && customFilterStartDate) {
            setStartFilterDate(customFilterStartDate);
            setEndFilterDate(customFilterEndDate);
        }
    };
    var setFilterDates = function (range) {
        var startDate, endDate;
        if (range !== TimeRange.Custom && (customFilterEndDate || customFilterStartDate)) {
            setCustomStartFilterDate(null);
            setCustomEndFilterDate(null);
        }
        if (range === TimeRange.Today) {
            startDate = luxon_1.DateTime.now();
            endDate = luxon_1.DateTime.now();
        }
        if (range === TimeRange.Yesterday) {
            startDate = luxon_1.DateTime.now().minus({ day: 1 });
            endDate = luxon_1.DateTime.now().minus({ day: 1 });
        }
        if (range === TimeRange.ThisWeek) {
            startDate = luxon_1.DateTime.now().startOf('week');
            endDate = startDate.plus({ day: 6 });
        }
        if (range === TimeRange.ThisMonth) {
            startDate = luxon_1.DateTime.now().startOf('month');
            endDate = luxon_1.DateTime.now().minus({ days: 1 });
        }
        if (range === TimeRange.LastWeek) {
            var lastWeekNum = luxon_1.DateTime.now().startOf('week').minus({ day: 1 });
            startDate = lastWeekNum.startOf('week');
            endDate = startDate.plus({ day: 6 });
        }
        if (range === TimeRange.LastMonth) {
            var lastMonthNum = luxon_1.DateTime.now().startOf('month').minus({ day: 1 }).month;
            var lastYearNum = luxon_1.DateTime.now().startOf('month').minus({ day: 1 }).year;
            startDate = luxon_1.DateTime.local(lastYearNum, lastMonthNum, 1);
            endDate = startDate.endOf('month');
        }
        if (range === TimeRange.PastSeven) {
            startDate = luxon_1.DateTime.now().minus({ days: 7 });
            endDate = luxon_1.DateTime.now().minus({ days: 1 });
        }
        if (range === TimeRange.PastThirty) {
            startDate = luxon_1.DateTime.now().minus({ days: 30 });
            endDate = luxon_1.DateTime.now().minus({ days: 1 });
        }
        setStartFilterDate(startDate || null);
        setEndFilterDate(endDate || null);
    };
    var handleLocationChange = function (value) {
        console.log('changing selected location to ', value === null || value === void 0 ? void 0 : value.id);
    };
    var singleNumberMetrics = [
        {
            text: '% Time-to-Provider < 45 min',
            metric: "".concat(appointmentsSeenIn45Ratio !== undefined ? "".concat(appointmentsSeenIn45Ratio, "%") : 'no data'),
        },
        {
            text: 'Avg. Time-to-Provider',
            metric: "".concat(avgMinutesToProvider ? "".concat(avgMinutesToProvider, " minutes") : 'no data'),
        },
        { text: 'Visits (completed)', metric: totalVisits },
    ];
    return (<PageContainer_1.default>
      <material_1.Grid container spacing={6}>
        <material_1.Grid item md={12} xs={12}>
          <material_1.Grid container spacing={4}>
            <material_1.Grid item md={2.25} xs={8}>
              <material_1.FormControl sx={{ width: '100%' }}>
                <LocationSelect_1.default queryParams={queryParams} handleSubmit={handleLocationChange} location={locationSelected} updateURL={false} storeLocationInLocalStorage={false} setLocation={setLocationSelected}></LocationSelect_1.default>
              </material_1.FormControl>
            </material_1.Grid>
            <material_1.Grid item md={2} xs={8}>
              <material_1.FormControl sx={{ width: '100%' }}>
                <material_1.InputLabel id="visit-type">Visit Type</material_1.InputLabel>
                <material_1.Select labelId="visit-type" id="visit-type-select-input" value={visitType} onChange={function (event) { return setVisitType(event.target.value); }} label="Visit Type">
                  <material_1.MenuItem value={utils_1.FhirAppointmentType.prebook}>Booked</material_1.MenuItem>
                  <material_1.MenuItem value={utils_1.FhirAppointmentType.walkin}>Walk-in</material_1.MenuItem>
                  <material_1.MenuItem value={VisitTypeAll.All}>All</material_1.MenuItem>
                </material_1.Select>
              </material_1.FormControl>
            </material_1.Grid>
            <material_1.Grid item md={2} xs={8}>
              <material_1.FormControl sx={{ width: '100%' }}>
                <material_1.InputLabel id="time-range">Time range</material_1.InputLabel>
                <material_1.Select labelId="time-range" id="time-range-select-input" value={timeRange} onChange={function (event) {
            setTimeRange(event.target.value);
            setFilterDates(event.target.value);
        }} label="Time range">
                  {Object.values(TimeRange).map(function (range, idx) { return (<material_1.MenuItem key={idx} value={range}>
                      {range}
                    </material_1.MenuItem>); })}
                </material_1.Select>
              </material_1.FormControl>
            </material_1.Grid>
            {timeRange === TimeRange.Custom ? (<>
                <material_1.Grid item md={2} xs={8}>
                  <x_date_pickers_pro_1.LocalizationProvider dateAdapter={AdapterLuxon_1.AdapterLuxon}>
                    <x_date_pickers_1.DatePicker label="Start Date" format="MM/dd/yyyy" onChange={setCustomStartFilterDate} slotProps={{
                textField: {
                    style: { width: '100%' },
                    name: 'start-date',
                    id: 'start-date',
                    label: 'Start Date',
                },
            }} value={customFilterStartDate}/>
                  </x_date_pickers_pro_1.LocalizationProvider>
                </material_1.Grid>
                <material_1.Grid item md={2} xs={8}>
                  <x_date_pickers_pro_1.LocalizationProvider dateAdapter={AdapterLuxon_1.AdapterLuxon}>
                    <x_date_pickers_1.DatePicker label="End Date" format="MM/dd/yyyy" onChange={setCustomEndFilterDate} slotProps={{
                textField: {
                    style: { width: '100%' },
                    name: 'end-date',
                    id: 'end-date',
                    label: 'End Date',
                },
            }} value={customFilterEndDate}/>
                  </x_date_pickers_pro_1.LocalizationProvider>
                </material_1.Grid>
                <material_1.Grid item md={1.5} xs={8} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <lab_1.LoadingButton sx={{
                borderRadius: 100,
                textTransform: 'none',
                fontWeight: 600,
                width: '100%',
            }} color="primary" variant="contained" loading={loading} onClick={handleCustomTimeRange}>
                    <material_1.Typography fontWeight="bold" marginLeft={0.5} sx={{ fontSize: '14px' }}>
                      Confirm Range
                    </material_1.Typography>
                  </lab_1.LoadingButton>
                </material_1.Grid>
              </>) : (<></>)}
            <material_1.Grid item md={2} xs={8}>
              <material_1.ToggleButtonGroup aria-label="Type, chart or table" exclusive value={type} onChange={function (event, updatedValue) { return setType(updatedValue); }} sx={{ width: '100%' }}>
                <material_1.ToggleButton value="chart">chart</material_1.ToggleButton>
                <material_1.ToggleButton value="table">table</material_1.ToggleButton>
              </material_1.ToggleButtonGroup>
            </material_1.Grid>
          </material_1.Grid>
        </material_1.Grid>
        {loading && (<material_1.Grid item md={12} xs={12} sx={{ textAlign: 'center' }}>
            <material_1.CircularProgress />
          </material_1.Grid>)}
        {error && (<material_1.Grid item md={12} xs={12} sx={{ textAlign: 'center' }}>
            <material_1.Typography sx={{
                fontSize: '22px',
            }}>
              {error}
            </material_1.Typography>
          </material_1.Grid>)}
        {!loading && !error && appointmentStatuses && (<>
            {singleNumberMetrics.map(function (metric, index) { return (<material_1.Grid key={index} item md={4} xs={12} sx={{ width: '33%' }}>
                <material_1.Box sx={{
                    backgroundColor: '#0A2143',
                    color: '#FFFFFF',
                    padding: '20px',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    borderRadius: '15px',
                }}>
                  <material_1.Typography sx={{
                    fontSize: '20px',
                }}>
                    {metric.text}
                  </material_1.Typography>
                  <material_1.Typography sx={{
                    textAlign: 'center',
                    fontSize: '35px',
                    paddingTop: '10px',
                }}>
                    {metric.metric}
                  </material_1.Typography>
                </material_1.Box>
              </material_1.Grid>); })}
            <material_1.Grid item md={12} xs={12}>
              {type === ChartType.chart ? (<react_chartjs_2_1.Line aria-label={"Number of visits from ".concat(filterStartDate === null || filterStartDate === void 0 ? void 0 : filterStartDate.toLocaleString(luxon_1.DateTime.DATE_SHORT), " - ").concat(filterEndDate === null || filterEndDate === void 0 ? void 0 : filterEndDate.toLocaleString(luxon_1.DateTime.DATE_SHORT), ", select \"table\" in the button group above for a table version")} role="img" data={{
                    labels: appointmentCountByDate === null || appointmentCountByDate === void 0 ? void 0 : appointmentCountByDate.map(function (countByDay) {
                        return countByDay.date.toLocaleString(luxon_1.DateTime.DATE_SHORT);
                    }),
                    datasets: [
                        {
                            label: 'Appointments',
                            data: appointmentCountByDate === null || appointmentCountByDate === void 0 ? void 0 : appointmentCountByDate.map(function (countByDay) { return countByDay.appointments; }),
                        },
                    ],
                }} options={{
                    scales: {
                        y: {
                            beginAtZero: true,
                        },
                    },
                    plugins: {
                        title: {
                            text: "Number of visits from ".concat(filterStartDate === null || filterStartDate === void 0 ? void 0 : filterStartDate.toLocaleString(luxon_1.DateTime.DATE_SHORT), " - ").concat(filterEndDate === null || filterEndDate === void 0 ? void 0 : filterEndDate.toLocaleString(luxon_1.DateTime.DATE_SHORT)),
                            display: true,
                            font: {
                                size: 20,
                            },
                        },
                        legend: {
                            display: false,
                        },
                    },
                }}></react_chartjs_2_1.Line>) : (<material_1.TableContainer component={material_1.Paper}>
                  <material_1.Table aria-label={"Number of visits from ".concat(filterStartDate === null || filterStartDate === void 0 ? void 0 : filterStartDate.toLocaleString(luxon_1.DateTime.DATE_SHORT), " - ").concat(filterEndDate === null || filterEndDate === void 0 ? void 0 : filterEndDate.toLocaleString(luxon_1.DateTime.DATE_SHORT))}>
                    <material_1.TableHead>
                      <material_1.TableRow>
                        <material_1.TableCell sx={{ width: '40%' }}>Date</material_1.TableCell>
                        <material_1.TableCell># visits</material_1.TableCell>
                      </material_1.TableRow>
                    </material_1.TableHead>
                    <material_1.TableBody>
                      {appointmentCountByDate === null || appointmentCountByDate === void 0 ? void 0 : appointmentCountByDate.map(function (countByDay) { return (<material_1.TableRow>
                          <material_1.TableCell>{countByDay.date.toLocaleString(luxon_1.DateTime.DATE_SHORT)}</material_1.TableCell>
                          <material_1.TableCell>{countByDay.appointments}</material_1.TableCell>
                        </material_1.TableRow>); })}
                    </material_1.TableBody>
                  </material_1.Table>
                </material_1.TableContainer>)}
            </material_1.Grid>
            <br />
            <material_1.Grid item md={12} xs={12}>
              {type === ChartType.chart ? (<react_chartjs_2_1.Bar aria-label={"Minutes in each status ".concat(filterStartDate === null || filterStartDate === void 0 ? void 0 : filterStartDate.toLocaleString(luxon_1.DateTime.DATE_SHORT), " - ").concat(filterEndDate === null || filterEndDate === void 0 ? void 0 : filterEndDate.toLocaleString(luxon_1.DateTime.DATE_SHORT), ", select \"table\" in the button group above for a table version")} role="img" data={{
                    labels: Object.keys(appointmentStatuses).filter(function (keyTemp) {
                        return keyTemp !== 'no show' &&
                            keyTemp !== 'canceled' &&
                            keyTemp !== 'checked out' &&
                            keyTemp !== 'pending';
                    }),
                    datasets: [
                        {
                            label: 'Status',
                            data: Object.keys(appointmentStatuses)
                                .filter(function (keyTemp) {
                                return keyTemp !== 'no show' &&
                                    keyTemp !== 'canceled' &&
                                    keyTemp !== 'checked out' &&
                                    keyTemp !== 'pending';
                            })
                                .map(function (keyTemp) {
                                return Math.round(appointmentStatuses[keyTemp].averageTime);
                            }),
                            backgroundColor: Object.keys(appointmentStatuses).map(function (statusTemp) { return AppointmentTableRow_1.CHIP_STATUS_MAP[statusTemp].color.primary; }),
                        },
                    ],
                }} options={{
                    plugins: {
                        title: {
                            text: "Minutes in each status ".concat(filterStartDate === null || filterStartDate === void 0 ? void 0 : filterStartDate.toLocaleString(luxon_1.DateTime.DATE_SHORT), " - ").concat(filterEndDate === null || filterEndDate === void 0 ? void 0 : filterEndDate.toLocaleString(luxon_1.DateTime.DATE_SHORT)),
                            display: true,
                            font: {
                                size: 20,
                            },
                        },
                        legend: {
                            display: false,
                        },
                    },
                }}></react_chartjs_2_1.Bar>) : (<material_1.TableContainer component={material_1.Paper}>
                  <material_1.Table aria-label={"Minutes in each status ".concat(filterStartDate === null || filterStartDate === void 0 ? void 0 : filterStartDate.toLocaleString(luxon_1.DateTime.DATE_SHORT), " - ").concat(filterEndDate === null || filterEndDate === void 0 ? void 0 : filterEndDate.toLocaleString(luxon_1.DateTime.DATE_SHORT))}>
                    <material_1.TableHead>
                      <material_1.TableRow>
                        <material_1.TableCell sx={{ width: '40%' }}>Status</material_1.TableCell>
                        <material_1.TableCell>Average # of Minutes</material_1.TableCell>
                      </material_1.TableRow>
                    </material_1.TableHead>
                    <material_1.TableBody>
                      {Object.entries(appointmentStatuses).map(function (_a) {
                    var statusTemp = _a[0], averageTimeTemp = _a[1];
                    return (<material_1.TableRow>
                          <material_1.TableCell>{statusTemp}</material_1.TableCell>
                          <material_1.TableCell>{Math.floor(averageTimeTemp.averageTime)}</material_1.TableCell>
                        </material_1.TableRow>);
                })}
                    </material_1.TableBody>
                  </material_1.Table>
                </material_1.TableContainer>)}
            </material_1.Grid>
          </>)}
      </material_1.Grid>
    </PageContainer_1.default>);
}
//# sourceMappingURL=Data.js.map