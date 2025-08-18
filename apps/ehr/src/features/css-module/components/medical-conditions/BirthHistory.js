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
exports.BirthHistory = void 0;
var colors_1 = require("@ehrTheme/colors");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var notistack_1 = require("notistack");
var react_1 = require("react");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var telemed_1 = require("../../../../telemed");
var useAppointment_1 = require("../../hooks/useAppointment");
var useChartData_1 = require("../../hooks/useChartData");
var BirthHistory = function (_a) {
    var _b, _c, _d, _e, _f;
    var appointmentID = _a.appointmentID;
    var mappedData = (0, useAppointment_1.useAppointment)(appointmentID).mappedData;
    var _g = (0, react_1.useState)(-luxon_1.DateTime.fromFormat(mappedData.DOB || '', 'yyyy-dd-MM').diff(luxon_1.DateTime.now(), 'days').days > 90), isCollapsed = _g[0], setIsCollapsed = _g[1];
    var _h = (0, getSelectors_1.getSelectors)(telemed_1.useAppointmentStore, ['encounter', 'chartData']), encounter = _h.encounter, chartData = _h.chartData;
    var isReadOnly = (0, telemed_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var isChartDataLoading = (0, useChartData_1.useChartData)({
        encounterId: encounter.id || '',
        requestedFields: {
            birthHistory: {
                _search_by: 'patient',
                _sort: '-_lastUpdated',
            },
        },
        onSuccess: function (data) {
            telemed_1.useAppointmentStore.setState(function (prevState) {
                var _a;
                return (__assign(__assign({}, prevState), { chartData: __assign(__assign({}, prevState.chartData), { patientId: ((_a = prevState.chartData) === null || _a === void 0 ? void 0 : _a.patientId) || '', birthHistory: data.birthHistory }) }));
            });
        },
    }).isLoading;
    var age = (_b = chartData === null || chartData === void 0 ? void 0 : chartData.birthHistory) === null || _b === void 0 ? void 0 : _b.find(function (item) { return item.field === 'age'; });
    var weight = (_c = chartData === null || chartData === void 0 ? void 0 : chartData.birthHistory) === null || _c === void 0 ? void 0 : _c.find(function (item) { return item.field === 'weight'; });
    var length = (_d = chartData === null || chartData === void 0 ? void 0 : chartData.birthHistory) === null || _d === void 0 ? void 0 : _d.find(function (item) { return item.field === 'length'; });
    var pregCompl = (_e = chartData === null || chartData === void 0 ? void 0 : chartData.birthHistory) === null || _e === void 0 ? void 0 : _e.find(function (item) { return item.field === 'preg-compl'; });
    var delCompl = (_f = chartData === null || chartData === void 0 ? void 0 : chartData.birthHistory) === null || _f === void 0 ? void 0 : _f.find(function (item) { return item.field === 'del-compl'; });
    return (<telemed_1.AccordionCard label={<material_1.Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <material_1.Typography variant="h6" color="primary.dark">
            Birth history
          </material_1.Typography>
          {(typeof (age === null || age === void 0 ? void 0 : age.value) === 'number' ||
                typeof (weight === null || weight === void 0 ? void 0 : weight.value) === 'number' ||
                typeof (length === null || length === void 0 ? void 0 : length.value) === 'number') && (<material_1.Box sx={{ display: 'flex', gap: 2 }}>
              {typeof (age === null || age === void 0 ? void 0 : age.value) === 'number' && <material_1.Typography>Gestational age at birth: {age === null || age === void 0 ? void 0 : age.value} weeks</material_1.Typography>}
              {typeof (weight === null || weight === void 0 ? void 0 : weight.value) === 'number' && <material_1.Typography>Weight: {weight === null || weight === void 0 ? void 0 : weight.value} kg</material_1.Typography>}
              {typeof (length === null || length === void 0 ? void 0 : length.value) === 'number' && <material_1.Typography>Length: {length === null || length === void 0 ? void 0 : length.value} cm</material_1.Typography>}
            </material_1.Box>)}
        </material_1.Box>} collapsed={isCollapsed} onSwitch={function () { return setIsCollapsed(function (state) { return !state; }); }}>
      {isChartDataLoading ? (<material_1.Box sx={{ p: 2 }}>
          <material_1.Skeleton variant="rounded" width="100%" height={200}/>
        </material_1.Box>) : (<material_1.Card elevation={0} sx={{
                p: 2,
                m: 2,
                backgroundColor: colors_1.otherColors.formCardBg,
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
            }}>
          <material_1.Box sx={{ display: 'flex', gap: 1 }}>
            <NumberDebounceField field={age} disabled={isReadOnly} fieldName="age" label="Gestational age at birth (weeks)"/>
            <NumberDebounceField field={weight} disabled={isReadOnly} fieldName="weight" label="Wt (kg)" convertProps={{
                label: 'Wt (lbs)',
                convertFunc: function (value) {
                    var num = toNumber(value);
                    if (typeof num === 'number') {
                        return (Math.round(num * 2.205 * 100) / 100).toString();
                    }
                    else {
                        return '';
                    }
                },
            }}/>
            <NumberDebounceField field={length} disabled={isReadOnly} fieldName="length" label="Length (cm)" convertProps={{
                label: 'Length (inch)',
                convertFunc: function (value) {
                    var num = toNumber(value);
                    if (typeof num === 'number') {
                        return (Math.round((num / 2.54) * 100) / 100).toString();
                    }
                    else {
                        return '';
                    }
                },
            }}/>
          </material_1.Box>

          <CheckboxWithNotesField field={pregCompl} fieldName="preg-compl" disabled={isReadOnly} label="Any complications during pregnancy?"/>
          <CheckboxWithNotesField field={delCompl} fieldName="del-compl" disabled={isReadOnly} label="Any complications during delivery??"/>
        </material_1.Card>)}
    </telemed_1.AccordionCard>);
};
exports.BirthHistory = BirthHistory;
var showErrorSnackbar = function (field) {
    var mapFieldToName = {
        age: 'gestational age',
        weight: 'weight',
        length: 'length',
        'preg-compl': 'pregnancy complications',
        'del-compl': 'delivery complications',
    };
    (0, notistack_1.enqueueSnackbar)("An error has occurred while updating ".concat(mapFieldToName[field], ". Please try again."), {
        variant: 'error',
    });
};
var setUpdatedField = function (updated) {
    if (updated) {
        telemed_1.useAppointmentStore.setState(function (prevState) {
            var _a, _b, _c, _d, _e;
            return ({
                chartData: __assign(__assign({}, prevState.chartData), { birthHistory: ((_b = (_a = prevState.chartData) === null || _a === void 0 ? void 0 : _a.birthHistory) === null || _b === void 0 ? void 0 : _b.find(function (item) { return item.resourceId === updated.resourceId; }))
                        ? (_d = (_c = prevState.chartData) === null || _c === void 0 ? void 0 : _c.birthHistory) === null || _d === void 0 ? void 0 : _d.map(function (item) { return (item.resourceId === updated.resourceId ? updated : item); })
                        : __spreadArray(__spreadArray([], (((_e = prevState.chartData) === null || _e === void 0 ? void 0 : _e.birthHistory) || []), true), [updated], false) }),
            });
        });
    }
};
var toNumber = function (value) { return (value ? (isNaN(+value) ? undefined : +value) : undefined); };
var NumberDebounceField = function (props) {
    var _a;
    var field = props.field, disabled = props.disabled, fieldName = props.fieldName, label = props.label, convertProps = props.convertProps;
    var _b = (0, react_1.useState)(typeof (field === null || field === void 0 ? void 0 : field.value) === 'number' ? field.value.toString() : ''), value = _b[0], setValue = _b[1];
    var _c = (0, telemed_1.useSaveChartData)(), updateChartData = _c.mutate, isUpdateLoading = _c.isLoading;
    var areEqual = value === "".concat(((_a = field === null || field === void 0 ? void 0 : field.value) === null || _a === void 0 ? void 0 : _a.toString()) || '');
    var debouncedHandleInputChange = (0, react_1.useMemo)(function () {
        return (0, material_1.debounce)(function (value) {
            updateChartData({
                birthHistory: [__assign(__assign({}, (field || { field: fieldName })), { value: value })],
            }, {
                onSuccess: function (data) {
                    var _a;
                    var updated = (_a = data.chartData.birthHistory) === null || _a === void 0 ? void 0 : _a[0];
                    setUpdatedField(updated);
                },
                onError: function () {
                    showErrorSnackbar(fieldName);
                },
            });
        }, 1500);
    }, [field, fieldName, updateChartData]);
    return (<>
      <material_1.TextField disabled={disabled} value={value} onChange={function (e) {
            setValue(e.target.value);
            debouncedHandleInputChange(toNumber(e.target.value));
        }} fullWidth size="small" label={label} type="number" InputProps={{
            endAdornment: (!areEqual || isUpdateLoading) && (<material_1.Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <material_1.CircularProgress size="20px"/>
            </material_1.Box>),
        }}/>
      {convertProps && (<>
          <material_1.Typography alignSelf="center" fontSize={20}>
            /
          </material_1.Typography>
          <material_1.TextField fullWidth size="small" label={convertProps.label} sx={{
                '& fieldset': { border: 'none' },
                maxWidth: '110px',
            }} disabled InputLabelProps={{ shrink: true }} value={convertProps.convertFunc(value)}/>
        </>)}
    </>);
};
var CheckboxWithNotesField = function (props) {
    var _a;
    var fieldName = props.fieldName, field = props.field, disabled = props.disabled, label = props.label;
    var _b = (0, react_1.useState)((field === null || field === void 0 ? void 0 : field.note) || ''), value = _b[0], setValue = _b[1];
    var _c = (0, telemed_1.useSaveChartData)(), updateChartData = _c.mutate, isUpdateLoading = _c.isLoading;
    var areEqual = value === "".concat(((_a = field === null || field === void 0 ? void 0 : field.note) === null || _a === void 0 ? void 0 : _a.toString()) || '');
    var handleRadioChange = function (newValue) {
        updateChartData({
            birthHistory: [__assign(__assign({}, (field || { field: fieldName })), { flag: newValue === 'yes', note: undefined })],
        }, {
            onSuccess: function (data) {
                var _a;
                var updated = (_a = data.chartData.birthHistory) === null || _a === void 0 ? void 0 : _a[0];
                setValue('');
                setUpdatedField(updated);
            },
            onError: function () {
                showErrorSnackbar(fieldName);
            },
        });
    };
    var debouncedHandleInputChange = (0, react_1.useMemo)(function () {
        return (0, material_1.debounce)(function (value) {
            updateChartData({
                birthHistory: [__assign(__assign({}, (field || { field: fieldName })), { note: value })],
            }, {
                onSuccess: function (data) {
                    var _a;
                    var updated = (_a = data.chartData.birthHistory) === null || _a === void 0 ? void 0 : _a[0];
                    setUpdatedField(updated);
                },
                onError: function () {
                    showErrorSnackbar(fieldName);
                },
            });
        }, 1500);
    }, [field, fieldName, updateChartData]);
    return (<material_1.Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
      <material_1.FormControl disabled={disabled || !areEqual || isUpdateLoading} sx={{
            minWidth: 'auto',
        }}>
        <material_1.FormLabel sx={{
            fontWeight: 500,
            color: 'primary.dark',
            whiteSpace: 'nowrap',
        }}>
          {label}
        </material_1.FormLabel>
        <material_1.RadioGroup row value={typeof (field === null || field === void 0 ? void 0 : field.flag) === 'boolean' ? (field.flag ? 'yes' : 'no') : null} onChange={function (e) { return handleRadioChange(e.target.value); }}>
          <material_1.FormControlLabel value="yes" control={<material_1.Radio />} label="Yes"/>
          <material_1.FormControlLabel value="no" control={<material_1.Radio />} label="No"/>
        </material_1.RadioGroup>
      </material_1.FormControl>
      {(field === null || field === void 0 ? void 0 : field.flag) && (<material_1.TextField value={value} onChange={function (e) {
                setValue(e.target.value);
                debouncedHandleInputChange(e.target.value || undefined);
            }} fullWidth size="small" label="Please describe" disabled={disabled || (areEqual && isUpdateLoading)} InputProps={{
                endAdornment: (!areEqual || (!areEqual && isUpdateLoading)) && (<material_1.Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <material_1.CircularProgress size="20px"/>
              </material_1.Box>),
            }}/>)}
    </material_1.Box>);
};
//# sourceMappingURL=BirthHistory.js.map