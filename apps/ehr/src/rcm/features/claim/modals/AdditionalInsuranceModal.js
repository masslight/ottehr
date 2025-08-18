"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdditionalInsuranceModal = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var state_1 = require("../../../state");
var utils_1 = require("../../../utils");
var components_1 = require("./components");
var getDefaultValues = function (additionalCoverageData) { return ({
    firstName: (additionalCoverageData === null || additionalCoverageData === void 0 ? void 0 : additionalCoverageData.firstName) || '',
    middleName: (additionalCoverageData === null || additionalCoverageData === void 0 ? void 0 : additionalCoverageData.middleName) || '',
    lastName: (additionalCoverageData === null || additionalCoverageData === void 0 ? void 0 : additionalCoverageData.lastName) || '',
    policyGroup: (additionalCoverageData === null || additionalCoverageData === void 0 ? void 0 : additionalCoverageData.policyGroup) || '',
}); };
var AdditionalInsuranceModal = function () {
    var _a = (0, getSelectors_1.getSelectors)(state_1.useClaimStore, ['additionalCoverageData', 'additionalCoverage', 'additionalSubscriber', 'setAdditionalCoverageData']), additionalCoverageData = _a.additionalCoverageData, additionalCoverage = _a.additionalCoverage, additionalSubscriber = _a.additionalSubscriber, setAdditionalCoverageData = _a.setAdditionalCoverageData;
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: getDefaultValues(additionalCoverageData),
    });
    var handleSubmit = methods.handleSubmit, reset = methods.reset;
    var editCoverage = (0, state_1.useEditCoverageInformationMutation)();
    var editRelatedPerson = (0, state_1.useEditRelatedPersonInformationMutation)();
    var onSave = function (values, hideDialog) {
        if (!additionalCoverage) {
            throw Error('Coverage not provided');
        }
        if (!additionalSubscriber) {
            throw Error('Subscriber not provided');
        }
        var updatedCoverage = (0, utils_1.mapAdditionalInsuranceToCoverageResource)(additionalCoverage, values);
        var updatedSubscriber = (0, utils_1.mapAdditionalInsuranceToRelatedPersonResource)(additionalSubscriber, values);
        var editCoveragePromise = editCoverage.mutateAsync({
            coverageData: updatedCoverage,
            previousCoverageData: additionalCoverage,
            fieldsToUpdate: ['class'],
        });
        var editRelatedPersonPromise = editRelatedPerson.mutateAsync({
            relatedPersonData: updatedSubscriber,
            previousRelatedPersonData: additionalSubscriber,
            fieldsToUpdate: ['name'],
        });
        Promise.all([editCoveragePromise, editRelatedPersonPromise])
            .then(function () {
            setAdditionalCoverageData(updatedCoverage, updatedSubscriber);
        })
            .catch(function (e) {
            console.error(e);
        })
            .finally(function () {
            hideDialog();
        });
    };
    return (<react_hook_form_1.FormProvider {...methods}>
      <components_1.EditModal title="Additional Insurance" onSave={function (hideDialog) { return handleSubmit(function (values) { return onSave(values, hideDialog); })(); }} onShow={function () { return reset(getDefaultValues(additionalCoverageData)); }} isSaveLoading={editCoverage.isLoading || editRelatedPerson.isLoading}>
        <material_1.Grid container spacing={2}>
          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="firstName" label="9.Other insured’s first name"/>
          </material_1.Grid>
          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="middleName" label="9.Other insured’s middle name"/>
          </material_1.Grid>
          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="lastName" label="9.Other insured’s last name"/>
          </material_1.Grid>

          <material_1.Grid item xs={4}>
            <components_1.TextFieldController name="policyGroup" label="9a.Other insured’s policy or group number"/>
          </material_1.Grid>
        </material_1.Grid>
      </components_1.EditModal>
    </react_hook_form_1.FormProvider>);
};
exports.AdditionalInsuranceModal = AdditionalInsuranceModal;
//# sourceMappingURL=AdditionalInsuranceModal.js.map