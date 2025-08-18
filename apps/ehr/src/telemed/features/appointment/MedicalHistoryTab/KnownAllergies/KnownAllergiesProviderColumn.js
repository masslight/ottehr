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
exports.KnownAllergiesProviderColumn = void 0;
var colors_1 = require("@ehrTheme/colors");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var RoundedButton_1 = require("src/components/RoundedButton");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var featureFlags_1 = require("../../../../../features/css-module/context/featureFlags");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var components_1 = require("../../../../components");
var hooks_1 = require("../../../../hooks");
var state_1 = require("../../../../state");
var ProviderSideListSkeleton_1 = require("../ProviderSideListSkeleton");
var KnownAllergiesProviderColumn = function () {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData', 'isChartDataLoading']), chartData = _a.chartData, isChartDataLoading = _a.isChartDataLoading;
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var featureFlags = (0, featureFlags_1.useFeatureFlags)();
    var allergies = (chartData === null || chartData === void 0 ? void 0 : chartData.allergies) || [];
    var length = allergies.length;
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiKnownAllergiesColumn}>
      {isChartDataLoading && <ProviderSideListSkeleton_1.ProviderSideListSkeleton />}

      {length > 0 && !isChartDataLoading && (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiKnownAllergiesList}>
          {allergies.map(function (value, index) { return (<AllergyListItem key={value.resourceId || "new".concat(index)} value={value} index={index} length={length}/>); })}
        </material_1.Box>)}

      {allergies.length === 0 && isReadOnly && !isChartDataLoading && !featureFlags.css && (<material_1.Typography color="secondary.light">Missing. Patient input must be reconciled by provider</material_1.Typography>)}

      {!isReadOnly && <AddAllergyField />}
    </material_1.Box>);
};
exports.KnownAllergiesProviderColumn = KnownAllergiesProviderColumn;
var setUpdatedAllergy = function (updatedAllergy) {
    if (updatedAllergy) {
        state_1.useAppointmentStore.setState(function (prevState) {
            var _a, _b;
            return ({
                chartData: __assign(__assign({}, prevState.chartData), { allergies: (_b = (_a = prevState.chartData) === null || _a === void 0 ? void 0 : _a.allergies) === null || _b === void 0 ? void 0 : _b.map(function (allergy) {
                        return allergy.resourceId === updatedAllergy.resourceId ? updatedAllergy : allergy;
                    }) }),
            });
        });
    }
};
var AllergyListItem = function (_a) {
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
                allergies: [__assign(__assign({}, value), { note: input.trim() || undefined })],
            }, {
                onSuccess: function (data) {
                    var _a;
                    var updatedAllergy = (_a = data.chartData.allergies) === null || _a === void 0 ? void 0 : _a[0];
                    setUpdatedAllergy(updatedAllergy);
                },
                onError: function () {
                    (0, notistack_1.enqueueSnackbar)('An error has occurred while updating allergy note. Please try again.', {
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
            allergies: [__assign(__assign({}, value), { current: newCurrentValue, note: newCurrentValue ? undefined : value.note })],
        }, {
            onSuccess: function (data) {
                var _a;
                if (newCurrentValue) {
                    setNote('');
                }
                var updatedAllergy = (_a = data.chartData.allergies) === null || _a === void 0 ? void 0 : _a[0];
                setUpdatedAllergy(updatedAllergy);
            },
            onError: function () {
                (0, notistack_1.enqueueSnackbar)('An error has occurred while updating allergy status. Please try again.', {
                    variant: 'error',
                });
            },
        });
    };
    var deleteAllergy = function () {
        deleteChartData({
            allergies: [value],
        }, {
            onSuccess: function () {
                state_1.useAppointmentStore.setState(function (prevState) {
                    var _a, _b;
                    return ({
                        chartData: __assign(__assign({}, prevState.chartData), { allergies: (_b = (_a = prevState.chartData) === null || _a === void 0 ? void 0 : _a.allergies) === null || _b === void 0 ? void 0 : _b.filter(function (allergy) { return allergy.resourceId !== value.resourceId; }) }),
                    });
                });
            },
            onError: function () {
                (0, notistack_1.enqueueSnackbar)('An error has occurred while deleting allergy. Please try again.', {
                    variant: 'error',
                });
            },
        });
    };
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiKnownAllergiesListItem}>
      <material_1.Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <material_1.Typography sx={{
            color: function (theme) { return (!value.current && featureFlags.css ? theme.palette.text.secondary : undefined); },
        }}>
          {value.name}
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
            <components_1.DeleteIconButton disabled={isLoadingOrAwaiting || !isAlreadySaved} onClick={deleteAllergy}/>
          </material_1.Box>)}
      </material_1.Box>

      {!value.current && !isReadOnly && featureFlags.css && (<material_1.TextField value={note} onChange={function (e) {
                setNote(e.target.value);
                updateNote(e.target.value);
            }} disabled={(isLoading && areNotesEqual) || !isAlreadySaved} size="small" fullWidth label="Notes for inactive allergy" InputProps={{
                endAdornment: !areNotesEqual && (<material_1.Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <material_1.CircularProgress size="20px"/>
              </material_1.Box>),
            }}/>)}

      {index + 1 !== length && <material_1.Divider />}
    </material_1.Box>);
};
var AddAllergyField = function () {
    var isChartDataLoading = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['isChartDataLoading']).isChartDataLoading;
    var _a = (0, state_1.useSaveChartData)(), updateChartData = _a.mutate, isUpdateLoading = _a.isLoading;
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: { value: null, otherAllergyName: '' },
    });
    var control = methods.control, reset = methods.reset, handleSubmit = methods.handleSubmit;
    var _b = (0, react_1.useState)(''), debouncedSearchTerm = _b[0], setDebouncedSearchTerm = _b[1];
    var _c = (0, react_1.useState)(false), isOtherOptionSelected = _c[0], setIsOtherOptionSelected = _c[1];
    var _d = (0, state_1.useGetAllergiesSearch)(debouncedSearchTerm), isSearching = _d.isFetching, data = _d.data;
    var allergiesSearchOptions = (0, react_1.useMemo)(function () {
        return data && !isSearching
            ? __spreadArray(__spreadArray([], (data || []), true), [{ name: 'Other' }], false) : [];
    }, [data, isSearching]);
    var debouncedHandleInputChange = (0, react_1.useMemo)(function () {
        return (0, material_1.debounce)(function (data) {
            if (data.length > 2) {
                setDebouncedSearchTerm(data);
            }
        }, 800);
    }, []);
    var handleSelectOption = function (data) {
        var _a;
        if (data) {
            var newValue_1 = {
                name: data.name,
                id: (_a = data.id) === null || _a === void 0 ? void 0 : _a.toString(),
                current: true,
            };
            state_1.useAppointmentStore.setState(function (prevState) {
                var _a;
                return ({
                    chartData: __assign(__assign({}, prevState.chartData), { allergies: __spreadArray(__spreadArray([], (((_a = prevState.chartData) === null || _a === void 0 ? void 0 : _a.allergies) || []), true), [newValue_1], false) }),
                });
            });
            reset({ value: null, otherAllergyName: '' });
            setIsOtherOptionSelected(false);
            updateChartData({ allergies: [newValue_1] }, {
                onSuccess: function (data) {
                    var _a;
                    var updatedAllergy = (_a = data.chartData.allergies) === null || _a === void 0 ? void 0 : _a[0];
                    if (updatedAllergy) {
                        state_1.useAppointmentStore.setState(function (prevState) {
                            var _a, _b;
                            return ({
                                chartData: __assign(__assign({}, prevState.chartData), { allergies: (_b = (_a = prevState.chartData) === null || _a === void 0 ? void 0 : _a.allergies) === null || _b === void 0 ? void 0 : _b.map(function (allergy) {
                                        return allergy.id === updatedAllergy.id && !allergy.resourceId ? updatedAllergy : allergy;
                                    }) }),
                            });
                        });
                    }
                },
                onError: function () {
                    state_1.useAppointmentStore.setState(function (prevState) {
                        var _a, _b;
                        return ({
                            chartData: __assign(__assign({}, prevState.chartData), { allergies: (_b = (_a = prevState.chartData) === null || _a === void 0 ? void 0 : _a.allergies) === null || _b === void 0 ? void 0 : _b.filter(function (allergy) { return allergy.resourceId; }) }),
                        });
                    });
                    (0, notistack_1.enqueueSnackbar)('An error has occurred while adding allergy. Please try again.', {
                        variant: 'error',
                    });
                },
            });
        }
    };
    var onSubmit = function (data) {
        if (data.value) {
            handleSelectOption(__assign(__assign({}, data.value), { name: 'Other' + (data.otherAllergyName ? " (".concat(data.otherAllergyName, ")") : '') }));
        }
    };
    return (<form onSubmit={handleSubmit(onSubmit)}>
      <material_1.Card elevation={0} sx={{
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
                    if ((data === null || data === void 0 ? void 0 : data.name) === 'Other') {
                        setIsOtherOptionSelected(true);
                    }
                    else {
                        setIsOtherOptionSelected(false);
                        handleSelectOption(data);
                    }
                }} getOptionLabel={function (option) { return (typeof option === 'string' ? option : option.name || ''); }} fullWidth size="small" loading={isSearching} filterOptions={function (options) { return options; }} isOptionEqualToValue={function (option, value) { return option.name === value.name; }} disablePortal blurOnSelect disabled={isChartDataLoading || isUpdateLoading} options={allergiesSearchOptions} noOptionsText={debouncedSearchTerm && debouncedSearchTerm.length > 2 && allergiesSearchOptions.length === 0
                    ? 'Nothing found for this search criteria'
                    : 'Start typing to load results'} renderInput={function (params) { return (<material_1.TextField {...params} onChange={function (e) { return debouncedHandleInputChange(e.target.value); }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput} label="Agent/Substance" placeholder="Search" InputLabelProps={{ shrink: true }} sx={{
                        '& .MuiInputLabel-root': {
                            fontWeight: 'bold',
                        },
                    }}/>); }}/>);
        }}/>
        {isOtherOptionSelected && (<material_1.Stack direction="row" spacing={2} alignItems="center">
            <react_hook_form_1.Controller name="otherAllergyName" control={control} render={function (_a) {
                var _b = _a.field, value = _b.value, onChange = _b.onChange;
                return (<material_1.TextField value={value || ''} onChange={function (e) { return onChange(e.target.value); }} label="Other allergy" placeholder="Please specify" fullWidth size="small"/>);
            }}/>
            <RoundedButton_1.RoundedButton type="submit">Add</RoundedButton_1.RoundedButton>
          </material_1.Stack>)}
      </material_1.Card>
    </form>);
};
//# sourceMappingURL=KnownAllergiesProviderColumn.js.map