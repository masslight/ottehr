"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsuredInformationModal = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var utils_2 = require("utils");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var state_1 = require("../../../state");
var utils_3 = require("../../../utils");
var components_1 = require("./components");
var getDefaultValues = function (coverageData, plan) { return ({
    planAndPayor: plan,
    insuredID: (coverageData === null || coverageData === void 0 ? void 0 : coverageData.subscriberId) || '',
    firstName: (coverageData === null || coverageData === void 0 ? void 0 : coverageData.firstName) || '',
    middleName: (coverageData === null || coverageData === void 0 ? void 0 : coverageData.middleName) || '',
    lastName: (coverageData === null || coverageData === void 0 ? void 0 : coverageData.lastName) || '',
    phone: (coverageData === null || coverageData === void 0 ? void 0 : coverageData.phone) || '',
    address: (coverageData === null || coverageData === void 0 ? void 0 : coverageData.addressLine) || '',
    city: (coverageData === null || coverageData === void 0 ? void 0 : coverageData.city) || '',
    state: (coverageData === null || coverageData === void 0 ? void 0 : coverageData.state) || '',
    zip: (coverageData === null || coverageData === void 0 ? void 0 : coverageData.postalCode) || '',
    policyGroup: (coverageData === null || coverageData === void 0 ? void 0 : coverageData.policyGroup) || '',
    dob: (coverageData === null || coverageData === void 0 ? void 0 : coverageData.dob) || null,
    sex: (coverageData === null || coverageData === void 0 ? void 0 : coverageData.gender) || '',
}); };
var InsuredInformationModal = function () {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useClaimStore, [
        'coverageData',
        'plansOwnedBy',
        'coverage',
        'subscriber',
        'setCoverageData',
    ]), coverageData = _a.coverageData, plansOwnedBy = _a.plansOwnedBy, coverage = _a.coverage, subscriber = _a.subscriber, setCoverageData = _a.setCoverageData;
    var plan = (0, react_1.useMemo)(function () {
        if (!plansOwnedBy || !(coverageData === null || coverageData === void 0 ? void 0 : coverageData.organizationId) || !(coverageData === null || coverageData === void 0 ? void 0 : coverageData.planName)) {
            return;
        }
        return plansOwnedBy === null || plansOwnedBy === void 0 ? void 0 : plansOwnedBy.find(function (item) { var _a; return ((_a = item.ownedBy) === null || _a === void 0 ? void 0 : _a.id) === coverageData.organizationId && item.name === coverageData.planName; });
    }, [plansOwnedBy, coverageData === null || coverageData === void 0 ? void 0 : coverageData.planName, coverageData === null || coverageData === void 0 ? void 0 : coverageData.organizationId]);
    var editCoverage = (0, state_1.useEditCoverageInformationMutation)();
    var editRelatedPerson = (0, state_1.useEditRelatedPersonInformationMutation)();
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: getDefaultValues(coverageData, plan),
    });
    var handleSubmit = methods.handleSubmit, reset = methods.reset;
    var onSave = function (values, hideDialog) {
        if (!coverage) {
            throw Error('Coverage not provided');
        }
        if (!subscriber) {
            throw Error('Subscriber not provided');
        }
        var updatedCoverage = (0, utils_3.mapInsuredInformationToCoverageResource)(coverage, values);
        var updatedSubscriber = (0, utils_3.mapInsuredInformationToRelatedPersonResource)(subscriber, values);
        var editCoveragePromise = editCoverage.mutateAsync({
            coverageData: updatedCoverage,
            previousCoverageData: coverage,
            fieldsToUpdate: ['class', 'payor', 'subscriberId'],
        });
        var editRelatedPersonPromise = editRelatedPerson.mutateAsync({
            relatedPersonData: updatedSubscriber,
            previousRelatedPersonData: subscriber,
        });
        Promise.all([editCoveragePromise, editRelatedPersonPromise])
            .then(function () {
            setCoverageData(updatedCoverage, updatedSubscriber);
        })
            .catch(function (e) {
            console.error(e);
        })
            .finally(function () {
            hideDialog();
        });
    };
    return (<react_hook_form_1.FormProvider {...methods}>
      <components_1.EditModal title="Insured Information" onSave={function (hideDialog) { return handleSubmit(function (values) { return onSave(values, hideDialog); })(); }} onShow={function () { return reset(getDefaultValues(coverageData, plan)); }} isSaveLoading={editCoverage.isLoading || editRelatedPerson.isLoading}>
        <material_1.Grid container spacing={2}>
          <material_1.Grid item xs={4}>
            <components_1.VirtualizedAutocompleteController name="planAndPayor" label="Plan Name and Payer ID *" rules={utils_3.mapFieldToRules.planAndPayor} options={plansOwnedBy || []} renderRow={function (plan) {
            var _a, _b, _c;
            var payerId = (_c = (_b = (_a = plan.ownedBy) === null || _a === void 0 ? void 0 : _a.identifier) === null || _b === void 0 ? void 0 : _b.find(function (identifier) {
                var _a, _b;
                return !!((_b = (_a = identifier.type) === null || _a === void 0 ? void 0 : _a.coding) === null || _b === void 0 ? void 0 : _b.find(function (coding) { return coding.code === 'XX' && coding.system === utils_2.FHIR_EXTENSION.Organization.v2_0203.url; }));
            })) === null || _c === void 0 ? void 0 : _c.value;
            return "".concat(plan.name, " ").concat(payerId);
        }}/>
          </material_1.Grid>
          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="insuredID" rules={utils_3.mapFieldToRules.insuredID} label="1a.Insured’s ID number *"/>
          </material_1.Grid>
          <material_1.Grid item xs={4}/>

          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="firstName" label="4.First name"/>
          </material_1.Grid>
          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="middleName" label="4.Middle name"/>
          </material_1.Grid>
          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="lastName" label="4.Last name"/>
          </material_1.Grid>

          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="phone" label="7.Phone" placeholder="(XXX) XXX-XXXX" InputProps={{ inputComponent: components_1.NumberMaskCustom }}/>
          </material_1.Grid>
          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="address" label="7.Address" placeholder="No., Street"/>
          </material_1.Grid>
          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="city" label="7.City"/>
          </material_1.Grid>
          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="state" label="7.State" select>
              {utils_1.AllStates.map(function (state) { return (<material_1.MenuItem key={state.value} value={state.value}>
                  {state.label}
                </material_1.MenuItem>); })}
            </components_1.TextFieldController>
          </material_1.Grid>

          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="zip" label="7.ZIP"/>
          </material_1.Grid>
          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="policyGroup" label="11.Insured’s policy group or FECA number"/>
          </material_1.Grid>

          <material_1.Grid item xs={4}>
            <components_1.DatePickerController name="dob" label="11a.Date of birth" format="MM.dd.yyyy" placeholder="MM.DD.YYYY"/>
          </material_1.Grid>
          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="sex" label="11a.Birth sex" select>
              {utils_3.genderOptions.map(function (option) { return (<material_1.MenuItem key={option.value} value={option.value}>
                  {option.label}
                </material_1.MenuItem>); })}
            </components_1.TextFieldController>
          </material_1.Grid>
        </material_1.Grid>
      </components_1.EditModal>
    </react_hook_form_1.FormProvider>);
};
exports.InsuredInformationModal = InsuredInformationModal;
//# sourceMappingURL=InsuredInformationModal.js.map