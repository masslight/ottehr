"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdditionalInformationModal = void 0;
var material_1 = require("@mui/material");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var state_1 = require("../../../state");
var utils_2 = require("../../../utils");
var components_1 = require("./components");
var getDefaultValues = function (claimData) { return ({
    relatedToEmployment: !!(claimData === null || claimData === void 0 ? void 0 : claimData.conditionRelatedToEmployment),
    relatedToAutoAccident: (claimData === null || claimData === void 0 ? void 0 : claimData.autoAccidentState) || '',
    relatedToOtherAccident: !!(claimData === null || claimData === void 0 ? void 0 : claimData.conditionRelatedToOtherAccident),
    claimCodes: [claimData === null || claimData === void 0 ? void 0 : claimData.claimCode1, claimData === null || claimData === void 0 ? void 0 : claimData.claimCode2, claimData === null || claimData === void 0 ? void 0 : claimData.claimCode3].filter(function (c) { return c; }).join('   '),
    illness: (claimData === null || claimData === void 0 ? void 0 : claimData.dateOfIllness) || null,
    unableToWork: [(claimData === null || claimData === void 0 ? void 0 : claimData.unableToWork.start) || null, (claimData === null || claimData === void 0 ? void 0 : claimData.unableToWork.end) || null],
    hospitalization: [(claimData === null || claimData === void 0 ? void 0 : claimData.hospitalizationDates.start) || null, (claimData === null || claimData === void 0 ? void 0 : claimData.hospitalizationDates.end) || null],
    resubmissionCode: (claimData === null || claimData === void 0 ? void 0 : claimData.resubmissionCode) || '',
    authorizationNumber: (claimData === null || claimData === void 0 ? void 0 : claimData.priorAuthNumber) || '',
}); };
var AdditionalInformationModal = function () {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useClaimStore, ['claimData', 'claim', 'setClaimData']), claimData = _a.claimData, claim = _a.claim, setClaimData = _a.setClaimData;
    var editClaim = (0, state_1.useEditClaimInformationMutation)();
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: getDefaultValues(claimData),
    });
    var control = methods.control, handleSubmit = methods.handleSubmit, reset = methods.reset;
    var onSave = function (values, hideDialog) {
        if (!claim) {
            throw Error('Claim not provided');
        }
        var updatedClaim = (0, utils_2.mapAdditionalInformationToClaimResource)(claim, values);
        var editClaimPromise = editClaim.mutateAsync({
            claimData: updatedClaim,
            previousClaimData: claim,
        });
        Promise.resolve(editClaimPromise)
            .then(function (responseClaim) {
            setClaimData(responseClaim);
        })
            .catch(function (e) {
            console.error(e);
        })
            .finally(function () {
            hideDialog();
        });
    };
    return (<react_hook_form_1.FormProvider {...methods}>
      <components_1.EditModal title="Additional Information" onSave={function (hideDialog) { return handleSubmit(function (values) { return onSave(values, hideDialog); })(); }} isSaveLoading={editClaim.isLoading} onShow={function () { return reset(getDefaultValues(claimData)); }}>
        <material_1.Grid container spacing={2}>
          <material_1.Grid item xs={4}>
            <material_1.FormControl fullWidth>
              <material_1.FormLabel sx={{ fontSize: '12px' }}>10.Is patient condition related to:</material_1.FormLabel>
              <material_1.FormGroup>
                <components_1.CheckboxController name="relatedToEmployment" label="a. Employment (Current or Previous)"/>
                <react_hook_form_1.Controller name="relatedToAutoAccident" control={control} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value, error = _a.fieldState.error;
            return (<material_1.Box sx={{ display: 'flex', flex: 1 }}>
                      <material_1.FormControlLabel control={<material_1.Checkbox checked={!!value} onChange={function (e) { return (e.target.checked ? onChange(utils_1.AllStates[0].value) : onChange('')); }}/>} label={<material_1.Typography noWrap>b. Auto accident</material_1.Typography>}/>
                      <material_1.TextField helperText={error ? error.message : null} error={!!error} size="small" label="State *" value={value} onChange={onChange} fullWidth select>
                        {utils_1.AllStates.map(function (state) { return (<material_1.MenuItem key={state.value} value={state.value}>
                            {state.label}
                          </material_1.MenuItem>); })}
                      </material_1.TextField>
                    </material_1.Box>);
        }}/>
                <components_1.CheckboxController name="relatedToOtherAccident" label="c. Other accident"/>
              </material_1.FormGroup>
            </material_1.FormControl>
          </material_1.Grid>
          <material_1.Grid item xs={8}/>

          <material_1.Grid item xs={4} sx={{ alignSelf: 'flex-end' }}>
            <components_1.TextFieldController name="claimCodes" label="10d.Claim codes (Designated to NUCC) *"/>
          </material_1.Grid>
          <material_1.Grid item xs={4} sx={{ alignSelf: 'flex-end' }}>
            <components_1.DatePickerController name="illness" label="14.Date of current illness, injury, or pregnancy (LMP)" format="MM.dd.yyyy" placeholder="MM.DD.YYYY"/>
          </material_1.Grid>
          <material_1.Grid item xs={4}>
            <components_1.DateRangePickerController name="unableToWork" label="16.Dates patient is unable to work in current occupation"/>
          </material_1.Grid>

          <material_1.Grid item xs={4}>
            <components_1.DateRangePickerController name="hospitalization" label="18.Hospitalization dates related to current services"/>
          </material_1.Grid>
          <material_1.Grid item xs={4} sx={{ alignSelf: 'flex-end' }}>
            <components_1.TextFieldController name="resubmissionCode" label="22.Resubmission code" select>
              {['1', '7', '8'].map(function (code) { return (<material_1.MenuItem key={code} value={code}>
                  {code}
                </material_1.MenuItem>); })}
            </components_1.TextFieldController>
          </material_1.Grid>
          <material_1.Grid item xs={4} sx={{ alignSelf: 'flex-end' }}>
            <components_1.TextFieldController name="authorizationNumber" label="23.Prior authorization number"/>
          </material_1.Grid>
        </material_1.Grid>
      </components_1.EditModal>
    </react_hook_form_1.FormProvider>);
};
exports.AdditionalInformationModal = AdditionalInformationModal;
//# sourceMappingURL=AdditionalInformationModal.js.map