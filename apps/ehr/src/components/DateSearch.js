"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DateSearch;
var x_date_pickers_1 = require("@mui/x-date-pickers");
var AdapterLuxon_1 = require("@mui/x-date-pickers/AdapterLuxon");
var x_date_pickers_pro_1 = require("@mui/x-date-pickers-pro");
var luxon_1 = require("luxon");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var data_test_ids_1 = require("../constants/data-test-ids");
function DateSearch(_a) {
    var date = _a.date, setDate = _a.setDate, defaultValue = _a.defaultValue, updateURL = _a.updateURL, storeDateInLocalStorage = _a.storeDateInLocalStorage, label = _a.label, queryParams = _a.queryParams, required = _a.required, disabled = _a.disabled, disableDates = _a.disableDates, closeOnSelect = _a.closeOnSelect, handleSubmit = _a.handleSubmit, small = _a.small, setValidDate = _a.setIsValidDate, dataTestId = _a["data-testid"];
    var _b = (0, react_1.useState)(false), error = _b[0], setError = _b[1];
    var _c = (0, react_1.useState)(''), errorMessage = _c[0], setErrorMessage = _c[1];
    var formatDate = typeof date === 'object' ? date === null || date === void 0 ? void 0 : date.toISODate() : date;
    var searchDate = (queryParams === null || queryParams === void 0 ? void 0 : queryParams.get('searchDate')) || formatDate;
    var navigate = (0, react_router_dom_1.useNavigate)();
    (0, react_1.useEffect)(function () {
        var _a, _b;
        if (updateURL && localStorage.getItem('selectedDate')) {
            queryParams === null || queryParams === void 0 ? void 0 : queryParams.set('searchDate', (_b = JSON.parse((_a = localStorage.getItem('selectedDate')) !== null && _a !== void 0 ? _a : '')) !== null && _b !== void 0 ? _b : '');
            navigate("?".concat(queryParams === null || queryParams === void 0 ? void 0 : queryParams.toString()));
        }
    }, [navigate, queryParams, updateURL]);
    var handleDatePickerChange = function (date, event) {
        if (typeof date === 'object' && (date === null || date === void 0 ? void 0 : date.toISODate())) {
            setError(false);
            setErrorMessage('');
            setDate(date);
            if (setValidDate) {
                setValidDate(true);
            }
            if (storeDateInLocalStorage) {
                if (date) {
                    localStorage.setItem('selectedDate', JSON.stringify(date.toISODate()));
                }
                else {
                    localStorage.removeItem('selectedDate');
                }
            }
            if (handleSubmit) {
                handleSubmit(event, date, 'date');
            }
        }
        else {
            setErrorMessage('please enter date in format MM/DD/YYYY');
            setError(true);
            setDate(date);
            if (setValidDate) {
                setValidDate(false);
            }
        }
    };
    return (<x_date_pickers_pro_1.LocalizationProvider dateAdapter={AdapterLuxon_1.AdapterLuxon}>
      <x_date_pickers_1.DatePicker label={label !== null && label !== void 0 ? label : 'Date'} onChange={handleDatePickerChange} format={'MM/dd/yyyy'} slotProps={{
            textField: {
                style: { width: '100%' },
                required: required,
                error: error,
                helperText: errorMessage,
                name: 'date',
                id: 'appointment-date',
                label: label !== null && label !== void 0 ? label : 'Date',
                size: small ? 'small' : 'medium',
                'data-testid': dataTestId,
            },
            actionBar: {
                actions: ['today'],
                // @ts-expect-error - that's valid field
                'data-testid': data_test_ids_1.dataTestIds.dashboard.datePickerTodayButton,
            },
        }} closeOnSelect={closeOnSelect} disabled={disabled} shouldDisableDate={disableDates} value={storeDateInLocalStorage ? (searchDate ? luxon_1.DateTime.fromISO(searchDate) : defaultValue) : date}/>
    </x_date_pickers_pro_1.LocalizationProvider>);
}
//# sourceMappingURL=DateSearch.js.map