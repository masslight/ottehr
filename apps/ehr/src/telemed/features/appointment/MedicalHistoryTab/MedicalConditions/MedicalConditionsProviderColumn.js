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
exports.MedicalConditionsProviderColumn = void 0;
var colors_1 = require("@ehrTheme/colors");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var CompleteConfiguration_1 = require("src/components/CompleteConfiguration");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var featureFlags_1 = require("../../../../../features/css-module/context/featureFlags");
var useChartData_1 = require("../../../../../features/css-module/hooks/useChartData");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var components_1 = require("../../../../components");
var hooks_1 = require("../../../../hooks");
var state_1 = require("../../../../state");
var ProviderSideListSkeleton_1 = require("../ProviderSideListSkeleton");
var MedicalConditionsProviderColumn = function () {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['encounter', 'chartData']), encounter = _a.encounter, chartData = _a.chartData;
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var featureFlags = (0, featureFlags_1.useFeatureFlags)();
    var isChartDataLoading = (0, useChartData_1.useChartData)({
        encounterId: encounter.id || '',
        requestedFields: {
            conditions: {},
        },
        onSuccess: function (data) {
            state_1.useAppointmentStore.setState(function (prevState) {
                var _a;
                return (__assign(__assign({}, prevState), { chartData: __assign(__assign({}, prevState.chartData), { patientId: ((_a = prevState.chartData) === null || _a === void 0 ? void 0 : _a.patientId) || '', conditions: data.conditions }) }));
            });
        },
    }).isLoading;
    var conditions = (chartData === null || chartData === void 0 ? void 0 : chartData.conditions) || [];
    var length = conditions.length;
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn}>
      {isChartDataLoading && <ProviderSideListSkeleton_1.ProviderSideListSkeleton />}

      {length > 0 && !isChartDataLoading && (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionsList}>
          {conditions.map(function (value, index) { return (<MedicalConditionListItem key={value.resourceId || "new".concat(index)} value={value} index={index} length={length}/>); })}
        </material_1.Box>)}

      {conditions.length === 0 && isReadOnly && !isChartDataLoading && !featureFlags.css && (<material_1.Typography color="secondary.light">Missing. Patient input must be reconciled by provider</material_1.Typography>)}

      {!isReadOnly && <AddMedicalConditionField />}
    </material_1.Box>);
};
exports.MedicalConditionsProviderColumn = MedicalConditionsProviderColumn;
var setUpdatedCondition = function (updatedCondition) {
    if (updatedCondition) {
        state_1.useAppointmentStore.setState(function (prevState) {
            var _a, _b;
            return ({
                chartData: __assign(__assign({}, prevState.chartData), { conditions: (_b = (_a = prevState.chartData) === null || _a === void 0 ? void 0 : _a.conditions) === null || _b === void 0 ? void 0 : _b.map(function (condition) {
                        return condition.resourceId === updatedCondition.resourceId ? updatedCondition : condition;
                    }) }),
            });
        });
    }
};
var MedicalConditionListItem = function (_a) {
    var value = _a.value, index = _a.index, length = _a.length;
    var _b = (0, react_1.useState)(value.note || ''), note = _b[0], setNote = _b[1];
    var areNotesEqual = note.trim() === (value.note || '');
    var featureFlags = (0, featureFlags_1.useFeatureFlags)();
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var _c = (0, state_1.useSaveChartData)(), updateChartData = _c.mutate, isUpdateLoading = _c.isLoading;
    var _d = (0, state_1.useDeleteChartData)(), deleteChartData = _d.mutate, isDeleteLoading = _d.isLoading;
    var isLoading = isUpdateLoading || isDeleteLoading;
    var isLoadingOrAwaiting = isLoading || !areNotesEqual;
    var isAlreadySaved = !!value.resourceId;
    var updateNote = (0, react_1.useMemo)(function () {
        return (0, material_1.debounce)(function (input) {
            updateChartData({
                conditions: [__assign(__assign({}, value), { note: input.trim() || undefined })],
            }, {
                onSuccess: function (data) {
                    var _a;
                    var updatedCondition = (_a = data.chartData.conditions) === null || _a === void 0 ? void 0 : _a[0];
                    setUpdatedCondition(updatedCondition);
                },
                onError: function () {
                    (0, notistack_1.enqueueSnackbar)('An error has occurred while updating medical condition note. Please try again.', {
                        variant: 'error',
                    });
                },
            });
        }, 1500);
    }, 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value.current]);
    var updateCurrent = function (newCurrentValue) {
        updateChartData({
            conditions: [__assign(__assign({}, value), { current: newCurrentValue, note: newCurrentValue ? undefined : value.note })],
        }, {
            onSuccess: function (data) {
                var _a;
                if (newCurrentValue) {
                    setNote('');
                }
                var updatedCondition = (_a = data.chartData.conditions) === null || _a === void 0 ? void 0 : _a[0];
                setUpdatedCondition(updatedCondition);
            },
            onError: function () {
                (0, notistack_1.enqueueSnackbar)('An error has occurred while updating medical condition status. Please try again.', {
                    variant: 'error',
                });
            },
        });
    };
    var deleteCondition = function () {
        deleteChartData({
            conditions: [value],
        }, {
            onSuccess: function () {
                state_1.useAppointmentStore.setState(function (prevState) {
                    var _a, _b;
                    return ({
                        chartData: __assign(__assign({}, prevState.chartData), { conditions: (_b = (_a = prevState.chartData) === null || _a === void 0 ? void 0 : _a.conditions) === null || _b === void 0 ? void 0 : _b.filter(function (condition) { return condition.resourceId !== value.resourceId; }) }),
                    });
                });
            },
            onError: function () {
                (0, notistack_1.enqueueSnackbar)('An error has occurred while deleting medical condition. Please try again.', {
                    variant: 'error',
                });
            },
        });
    };
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionListItem}>
      <material_1.Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <material_1.Typography sx={{
            color: function (theme) { return (!value.current && featureFlags.css ? theme.palette.text.secondary : undefined); },
        }}>
          {value.code} {value.display}
          {featureFlags.css &&
            isReadOnly &&
            " | ".concat(value.current ? 'Current' : 'Inactive now').concat(value.note ? ' | Note: ' + value.note : '')}
        </material_1.Typography>

        {!isReadOnly && (<material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {featureFlags.css && (<material_1.FormControlLabel control={<material_1.Switch checked={value.current} onChange={function (e) { return updateCurrent(e.target.checked); }}/>} label={value.current ? 'Current' : 'Inactive now'} disabled={isLoadingOrAwaiting || !isAlreadySaved} labelPlacement="start" sx={{
                    '& .MuiFormControlLabel-label': {
                        marginRight: 1,
                        textAlign: 'right',
                        color: function (theme) { return (!value.current ? theme.palette.text.secondary : undefined); },
                    },
                }}/>)}
            <components_1.DeleteIconButton disabled={isLoadingOrAwaiting || !isAlreadySaved} onClick={deleteCondition}/>
          </material_1.Box>)}
      </material_1.Box>

      {!value.current && !isReadOnly && featureFlags.css && (<material_1.TextField value={note} onChange={function (e) {
                setNote(e.target.value);
                updateNote(e.target.value);
            }} disabled={(isLoading && areNotesEqual) || !isAlreadySaved} size="small" fullWidth label="Notes for inactive condition" InputProps={{
                endAdornment: !areNotesEqual && (<material_1.Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <material_1.CircularProgress size="20px"/>
              </material_1.Box>),
            }}/>)}

      {index + 1 !== length && <material_1.Divider />}
    </material_1.Box>);
};
var AddMedicalConditionField = function () {
    var isChartDataLoading = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['isChartDataLoading']).isChartDataLoading;
    var _a = (0, state_1.useSaveChartData)(), updateChartData = _a.mutate, isUpdateLoading = _a.isLoading;
    var icdSearchError = (0, state_1.useGetIcd10Search)({ search: 'E11', sabs: 'ICD10CM' }).error;
    var nlmApiKeyMissing = (icdSearchError === null || icdSearchError === void 0 ? void 0 : icdSearchError.code) === utils_1.APIErrorCode.MISSING_NLM_API_KEY_ERROR;
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: { value: null },
    });
    var control = methods.control, reset = methods.reset;
    var _b = (0, react_1.useState)(''), debouncedSearchTerm = _b[0], setDebouncedSearchTerm = _b[1];
    var _c = (0, state_1.useGetIcd10Search)({ search: debouncedSearchTerm, sabs: 'ICD10CM' }), isSearching = _c.isFetching, data = _c.data;
    var icdSearchOptions = (data === null || data === void 0 ? void 0 : data.codes) || [];
    var debouncedHandleInputChange = (0, react_1.useMemo)(function () {
        return (0, material_1.debounce)(function (data) {
            console.log(data);
            setDebouncedSearchTerm(data);
        }, 800);
    }, []);
    var handleSelectOption = function (data) {
        if (data) {
            var newValue_1 = {
                code: data.code,
                display: data.display,
                current: true,
            };
            state_1.useAppointmentStore.setState(function (prevState) {
                var _a;
                return ({
                    chartData: __assign(__assign({}, prevState.chartData), { conditions: __spreadArray(__spreadArray([], (((_a = prevState.chartData) === null || _a === void 0 ? void 0 : _a.conditions) || []), true), [newValue_1], false) }),
                });
            });
            reset({ value: null });
            updateChartData({ conditions: [newValue_1] }, {
                onSuccess: function (data) {
                    var _a;
                    var updatedCondition = (_a = data.chartData.conditions) === null || _a === void 0 ? void 0 : _a[0];
                    if (updatedCondition) {
                        state_1.useAppointmentStore.setState(function (prevState) {
                            var _a, _b;
                            return ({
                                chartData: __assign(__assign({}, prevState.chartData), { conditions: (_b = (_a = prevState.chartData) === null || _a === void 0 ? void 0 : _a.conditions) === null || _b === void 0 ? void 0 : _b.map(function (conditions) {
                                        return conditions.code === updatedCondition.code && !conditions.resourceId ? updatedCondition : conditions;
                                    }) }),
                            });
                        });
                    }
                },
                onError: function () {
                    state_1.useAppointmentStore.setState(function (prevState) {
                        var _a, _b;
                        return ({
                            chartData: __assign(__assign({}, prevState.chartData), { conditions: (_b = (_a = prevState.chartData) === null || _a === void 0 ? void 0 : _a.conditions) === null || _b === void 0 ? void 0 : _b.filter(function (condition) { return condition.resourceId; }) }),
                        });
                    });
                    (0, notistack_1.enqueueSnackbar)('An error has occurred while adding medical condition. Please try again.', {
                        variant: 'error',
                    });
                },
            });
        }
    };
    var handleSetup = function () {
        window.open('https://docs.oystehr.com/ottehr/setup/terminology/', '_blank');
    };
    return (<material_1.Card elevation={0} sx={{
            p: 3,
            backgroundColor: colors_1.otherColors.formCardBg,
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
        }}>
      <react_hook_form_1.Controller name="value" control={control} rules={{ required: true }} render={function (_a) {
            var _b = _a.field, value = _b.value, onChange = _b.onChange;
            return (<material_1.Autocomplete value={value || null} onChange={function (_e, data) {
                    onChange((data || ''));
                    handleSelectOption(data);
                }} getOptionLabel={function (option) { return (typeof option === 'string' ? option : "".concat(option.code, " ").concat(option.display)); }} isOptionEqualToValue={function (option, value) { return value.code === option.code; }} fullWidth size="small" loading={isSearching} blurOnSelect disabled={isChartDataLoading || isUpdateLoading} options={icdSearchOptions} noOptionsText={debouncedSearchTerm && icdSearchOptions.length === 0
                    ? 'Nothing found for this search criteria'
                    : 'Start typing to load results'} filterOptions={function (x) { return x; }} renderInput={function (params) { return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <material_1.TextField {...params} onChange={function (e) { return debouncedHandleInputChange(e.target.value); }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput} label="Medical condition" placeholder="Search" InputLabelProps={{ shrink: true }} sx={{
                        '& .MuiInputLabel-root': {
                            fontWeight: 'bold',
                        },
                    }}/>
                {nlmApiKeyMissing && <CompleteConfiguration_1.CompleteConfiguration handleSetup={handleSetup}/>}
              </material_1.Box>); }}/>);
        }}/>
    </material_1.Card>);
};
//# sourceMappingURL=MedicalConditionsProviderColumn.js.map