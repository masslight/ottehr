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
exports.ProceduresForm = void 0;
var colors_1 = require("@ehrTheme/colors");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var RoundedButton_1 = require("src/components/RoundedButton");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var components_1 = require("../../../../components");
var hooks_1 = require("../../../../hooks");
var state_1 = require("../../../../state");
var ProviderSideListSkeleton_1 = require("../ProviderSideListSkeleton");
var surgicalHistoryOptions = [
    { display: 'Adenoidectomy', code: '42830' },
    { display: 'Appendectomy', code: '44950' },
    { display: 'C-section', code: '59510' },
    { display: 'Circumcision', code: '54150' },
    { display: 'Cleft Lip/Palate Repair', code: '42200' },
    { display: 'Cyst removed', code: '97139' },
    { display: 'Dental/Oral Surgery', code: '41899' },
    { display: 'Ear tube placement', code: '69436' },
    { display: 'Elbow/Hand/Arm Surgery', code: '24999' },
    { display: 'Feeding tube', code: '43246' },
    { display: 'Foot/Ankle Surgery', code: '27899' },
    { display: 'Frenotomy', code: '41010' },
    { display: 'Gallbladder removal', code: '47600' },
    { display: 'Heart/Cardiac surgery', code: '33999' },
    { display: 'Hemangioma', code: '17106' },
    { display: 'Hernia Repair', code: '49617' },
    { display: 'Hydrocele Repair', code: '55060' },
    { display: 'Hypospadias repair', code: '53450' },
    { display: 'Kidney surgery', code: '50540' },
    { display: 'Knee Surgery', code: '29850' },
    { display: 'Orchiectomy (Testicle Removal)', code: '54520' },
    { display: 'Other Eye surgery', code: '65799' },
    { display: 'Pyloromyotomy', code: '67599' },
    { display: 'Sinus surgery', code: '43520' },
    { display: 'Splenectomy', code: '31299' },
    { display: 'Tear Duct Eye surgery', code: '38100' },
    { display: 'Tonsillectomy and adenoidectomy', code: '68899' },
    { display: 'Undescended Testicle Repair', code: '42820' },
    { display: 'Ventriculoperitoneal shunt placement', code: '54640' },
    { display: 'Wisdom teeth removal', code: '75809' },
    { display: 'Other', code: '41899' },
];
var ProceduresForm = function () {
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: {
            selectedProcedure: null,
            otherProcedureName: '',
        },
    });
    var isChartDataLoading = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['isChartDataLoading']).isChartDataLoading;
    var _a = (0, react_1.useState)(false), isOtherOptionSelected = _a[0], setIsOtherOptionSelected = _a[1];
    var control = methods.control, reset = methods.reset, handleSubmit = methods.handleSubmit;
    var _b = (0, hooks_1.useChartDataArrayValue)('surgicalHistory', reset, {}), isLoading = _b.isLoading, onSubmit = _b.onSubmit, onRemove = _b.onRemove, procedures = _b.values;
    var handleSelectOption = function (data) {
        if (data) {
            void onSubmit(data);
            reset({ selectedProcedure: null, otherProcedureName: '' });
            setIsOtherOptionSelected(false);
        }
    };
    var onSubmitForm = function (data) {
        if (data.selectedProcedure) {
            handleSelectOption(__assign(__assign({}, data.selectedProcedure), { display: 'Other' + (data.otherProcedureName ? " (".concat(data.otherProcedureName, ")") : '') }));
        }
    };
    return (<form onSubmit={handleSubmit(onSubmitForm)}>
      <material_1.Box>
        <material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            mb: procedures.length || isChartDataLoading ? 2 : 0,
        }}>
          {isChartDataLoading ? (<ProviderSideListSkeleton_1.ProviderSideListSkeleton />) : (<material_1.Box data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryList}>
              <components_1.ActionsList data={procedures} itemDataTestId={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryListItem} getKey={function (value) { return value.resourceId; }} renderItem={function (value) { return (<material_1.Typography>
                    {value.code} {value.display}
                  </material_1.Typography>); }} renderActions={function (value) { return (<components_1.DeleteIconButton disabled={isLoading} onClick={function () { return onRemove(value.resourceId); }}/>); }} divider/>
            </material_1.Box>)}
        </material_1.Box>
        <material_1.Card elevation={0} sx={{
            p: 3,
            backgroundColor: colors_1.otherColors.formCardBg,
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
        }}>
          <react_hook_form_1.Controller name="selectedProcedure" control={control} rules={{ required: true }} render={function (_a) {
            var _b = _a.field, value = _b.value, onChange = _b.onChange;
            return (<material_1.Autocomplete value={value || null} onChange={function (_e, data) {
                    onChange(data);
                    if ((data === null || data === void 0 ? void 0 : data.display) === 'Other') {
                        setIsOtherOptionSelected(true);
                    }
                    else {
                        setIsOtherOptionSelected(false);
                        handleSelectOption(data);
                    }
                }} fullWidth size="small" disabled={isLoading || isChartDataLoading} options={surgicalHistoryOptions} noOptionsText="Nothing found for this search criteria" getOptionLabel={function (option) { return "".concat(option.code, " ").concat(option.display); }} renderOption={function (props, option) { return (<li {...props}>
                    <material_1.Typography component="span">
                      {option.code} {option.display}
                    </material_1.Typography>
                  </li>); }} isOptionEqualToValue={function (option, value) { return option.code === value.code; }} renderInput={function (params) { return (<material_1.TextField {...params} label="Surgery" placeholder="Search" InputLabelProps={{ shrink: true }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiSurgicalHistoryInput} sx={{
                        '& .MuiInputLabel-root': {
                            fontWeight: 'bold',
                        },
                    }}/>); }}/>);
        }}/>
          {isOtherOptionSelected && (<material_1.Stack direction="row" spacing={2} alignItems="center">
              <react_hook_form_1.Controller name="otherProcedureName" control={control} render={function (_a) {
                var _b = _a.field, value = _b.value, onChange = _b.onChange;
                return (<material_1.TextField value={value} onChange={function (e) { return onChange(e.target.value); }} label="Other surgery" placeholder="Please specify" fullWidth size="small"/>);
            }}/>
              <RoundedButton_1.RoundedButton type="submit">Add</RoundedButton_1.RoundedButton>
            </material_1.Stack>)}
        </material_1.Card>
      </material_1.Box>
    </form>);
};
exports.ProceduresForm = ProceduresForm;
//# sourceMappingURL=ProceduresForm.js.map