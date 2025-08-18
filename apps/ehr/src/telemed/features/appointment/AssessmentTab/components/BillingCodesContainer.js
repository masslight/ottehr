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
exports.BillingCodesContainer = void 0;
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var WithTooltip_1 = require("src/components/WithTooltip");
var WithTooltip_2 = require("src/components/WithTooltip");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var components_1 = require("../../../../components");
var hooks_1 = require("../../../../hooks");
var state_1 = require("../../../../state");
var AssessmentTitle_1 = require("./AssessmentTitle");
var EMCodeField_1 = require("./EMCodeField");
var BillingCodesContainer = function () {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData', 'setPartialChartData']), chartData = _a.chartData, setPartialChartData = _a.setPartialChartData;
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var cptCodes = (chartData === null || chartData === void 0 ? void 0 : chartData.cptCodes) || [];
    var emCode = chartData === null || chartData === void 0 ? void 0 : chartData.emCode;
    var _b = (0, react_1.useState)(''), debouncedSearchTerm = _b[0], setDebouncedSearchTerm = _b[1];
    var _c = (0, state_1.useGetIcd10Search)({ search: debouncedSearchTerm, sabs: 'CPT' }), isSearching = _c.isFetching, data = _c.data;
    var cptSearchOptions = (data === null || data === void 0 ? void 0 : data.codes) || [];
    var _d = (0, state_1.useSaveChartData)(), saveEMChartData = _d.mutate, isSaveEMLoading = _d.isLoading;
    var _f = (0, state_1.useSaveChartData)(), saveCPTChartData = _f.mutate, isSaveCPTLoading = _f.isLoading;
    var _g = (0, state_1.useDeleteChartData)(), deleteEMChartData = _g.mutate, isDeleteEMLoading = _g.isLoading;
    var _h = (0, state_1.useDeleteChartData)(), deleteCPTChartData = _h.mutate, isDeleteCPTLoading = _h.isLoading;
    var disabledEM = isSaveEMLoading || isDeleteEMLoading || (emCode && !emCode.resourceId);
    var disabledCPT = isSaveCPTLoading || isDeleteCPTLoading;
    var debounce = (0, hooks_1.useDebounce)(800).debounce;
    var debouncedHandleInputChange = function (data) {
        debounce(function () {
            setDebouncedSearchTerm(data);
        });
    };
    var onInternalChange = function (_e, data) {
        if (data) {
            onAdd(data);
        }
    };
    var onAdd = function (value) {
        saveCPTChartData({
            cptCodes: [value],
        }, {
            onSuccess: function (data) {
                var _a, _b;
                var cptCode = (_b = (_a = data.chartData) === null || _a === void 0 ? void 0 : _a.cptCodes) === null || _b === void 0 ? void 0 : _b[0];
                if (cptCode) {
                    setPartialChartData({
                        cptCodes: __spreadArray(__spreadArray([], cptCodes, true), [cptCode], false),
                    });
                }
            },
            onError: function () {
                (0, notistack_1.enqueueSnackbar)('An error has occurred while adding CPT code. Please try again.', { variant: 'error' });
                setPartialChartData({
                    cptCodes: cptCodes,
                });
            },
        });
        setPartialChartData({ cptCodes: __spreadArray(__spreadArray([], cptCodes, true), [value], false) });
    };
    var onDelete = function (resourceId) {
        var localCodes = cptCodes;
        var preparedValue = localCodes.find(function (item) { return item.resourceId === resourceId; });
        deleteCPTChartData({
            cptCodes: [preparedValue],
        }, {
            onSuccess: function () {
                localCodes = localCodes.filter(function (item) { return item.resourceId !== resourceId; });
                setPartialChartData({ cptCodes: localCodes });
            },
            onError: function () {
                (0, notistack_1.enqueueSnackbar)('An error has occurred while deleting CPT code. Please try again.', { variant: 'error' });
            },
        });
    };
    var onEMCodeChange = function (value) {
        if (value) {
            var prevValue_1 = emCode;
            saveEMChartData({ emCode: __assign(__assign({}, emCode), value) }, {
                onSuccess: function (data) {
                    var _a;
                    var saved = (_a = data.chartData) === null || _a === void 0 ? void 0 : _a.emCode;
                    console.log(data);
                    if (saved) {
                        setPartialChartData({ emCode: saved });
                    }
                },
                onError: function () {
                    (0, notistack_1.enqueueSnackbar)('An error has occurred while saving E&M code. Please try again.', { variant: 'error' });
                    setPartialChartData({ emCode: prevValue_1 });
                },
            });
            setPartialChartData({ emCode: value });
        }
        else {
            deleteEMChartData({ emCode: emCode });
            setPartialChartData({ emCode: undefined });
        }
    };
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <material_1.Box sx={{ color: '#0F347C' }}>
          <WithTooltip_1.TooltipWrapper tooltipProps={WithTooltip_2.CPT_TOOLTIP_PROPS}>
            <AssessmentTitle_1.AssessmentTitle>Billing</AssessmentTitle_1.AssessmentTitle>
          </WithTooltip_1.TooltipWrapper>
        </material_1.Box>
        <material_1.Autocomplete options={EMCodeField_1.emCodeOptions} disabled={disabledEM} isOptionEqualToValue={function (option, value) { return option.code === value.code; }} value={emCode ? { display: emCode.display, code: emCode.code } : null} getOptionLabel={function (option) { return option.display; }} onChange={function (_e, value) { return onEMCodeChange(value); }} renderInput={function (params) { return (<material_1.TextField {...params} size="small" label="E&M code" placeholder="Search E&M code" data-testid={data_test_ids_1.dataTestIds.assessmentCard.emCodeDropdown}/>); }}/>
        <material_1.Autocomplete fullWidth blurOnSelect disabled={disabledCPT} options={cptSearchOptions} noOptionsText={debouncedSearchTerm && cptSearchOptions.length === 0
            ? 'Nothing found for this search criteria'
            : 'Start typing to load results'} autoComplete includeInputInList disableClearable filterOptions={function (x) { return x; }} value={null} isOptionEqualToValue={function (option, value) { return value.code === option.code; }} loading={isSearching} onChange={onInternalChange} getOptionLabel={function (option) { return (typeof option === 'string' ? option : "".concat(option.code, " ").concat(option.display)); }} renderInput={function (params) { return (<material_1.TextField {...params} size="small" label="Additional CPT codes" placeholder="Search CPT code" onChange={function (e) { return debouncedHandleInputChange(e.target.value); }} data-testid={data_test_ids_1.dataTestIds.assessmentCard.cptCodeField}/>); }}/>
      </material_1.Box>

      {emCode && (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} data-testid={data_test_ids_1.dataTestIds.billingContainer.container}>
          <AssessmentTitle_1.AssessmentTitle>E&M code</AssessmentTitle_1.AssessmentTitle>
          <components_1.ActionsList data={[emCode]} getKey={function (value, index) { return value.resourceId || index; }} renderItem={function (value) { return (<material_1.Typography>
                {value.display} {value.code}
              </material_1.Typography>); }} renderActions={isReadOnly
                ? undefined
                : function () { return (<components_1.DeleteIconButton dataTestId={data_test_ids_1.dataTestIds.billingContainer.deleteButton} disabled={disabledEM} onClick={function () { return onEMCodeChange(null); }}/>); }}/>
        </material_1.Box>)}

      {cptCodes.length > 0 && (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <AssessmentTitle_1.AssessmentTitle>Additional CPT codes</AssessmentTitle_1.AssessmentTitle>
          <components_1.ActionsList data={cptCodes} getKey={function (value, index) { return value.resourceId || index; }} renderItem={function (value) { return (<material_1.Typography data-testid={data_test_ids_1.dataTestIds.billingContainer.cptCodeEntry(value.code)}>
                {value.code} {value.display}
              </material_1.Typography>); }} renderActions={isReadOnly
                ? undefined
                : function (value) { return (<components_1.DeleteIconButton dataTestId={data_test_ids_1.dataTestIds.billingContainer.deleteCptCodeButton(value.code)} disabled={!value.resourceId || disabledCPT} onClick={function () { return onDelete(value.resourceId); }}/>); }}/>
        </material_1.Box>)}
    </material_1.Box>);
};
exports.BillingCodesContainer = BillingCodesContainer;
//# sourceMappingURL=BillingCodesContainer.js.map