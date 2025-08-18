"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLBProviderModal = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var state_1 = require("../../../state");
var utils_2 = require("../../../utils");
var components_1 = require("./components");
var getDefaultValues = function (claimData, facilities) { return ({
    location: facilities === null || facilities === void 0 ? void 0 : facilities.find(function (facility) { return facility.id === (claimData === null || claimData === void 0 ? void 0 : claimData.facilityId); }),
}); };
var SLBProviderModal = function () {
    var _a, _b;
    var _c = (0, getSelectors_1.getSelectors)(state_1.useClaimStore, [
        'organizations',
        'facilities',
        'claimData',
        'coverageData',
        'claim',
        'setClaimData',
    ]), organizations = _c.organizations, facilities = _c.facilities, claimData = _c.claimData, coverageData = _c.coverageData, claim = _c.claim, setClaimData = _c.setClaimData;
    var editClaim = (0, state_1.useEditClaimInformationMutation)();
    var methods = (0, react_hook_form_1.useForm)({
        defaultValues: getDefaultValues(claimData, facilities),
    });
    var handleSubmit = methods.handleSubmit, watch = methods.watch, reset = methods.reset;
    // TS2589: Type instantiation is excessively deep and possibly infinite.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    var currentFacility = watch('location');
    var organization = (0, react_1.useMemo)(function () {
        return organizations === null || organizations === void 0 ? void 0 : organizations.find(function (organization) { var _a, _b, _c; return organization.id === ((_c = (_b = (_a = currentFacility === null || currentFacility === void 0 ? void 0 : currentFacility.managingOrganization) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.split('/')) === null || _c === void 0 ? void 0 : _c[1]); });
    }, [(_a = currentFacility === null || currentFacility === void 0 ? void 0 : currentFacility.managingOrganization) === null || _a === void 0 ? void 0 : _a.reference, organizations]);
    var options = (0, react_1.useMemo)(function () {
        return (facilities || []).filter(function (facility) {
            var _a;
            return !!((_a = facility.extension) === null || _a === void 0 ? void 0 : _a.find(function (extension) {
                var _a;
                return extension.url === utils_1.FHIR_EXTENSION.Location.locationFormPreRelease.url &&
                    ((_a = extension.valueCoding) === null || _a === void 0 ? void 0 : _a.code) === 'vi';
            })) && facility.managingOrganization;
        });
    }, [facilities]);
    var onSave = function (values, hideDialog) {
        if (!claim) {
            throw Error('Claim not provided');
        }
        var updatedClaim = (0, utils_2.mapSLBProviderToClaimResource)(claim, values);
        var editClaimPromise = editClaim.mutateAsync({
            claimData: updatedClaim,
            previousClaimData: claim,
            fieldsToUpdate: ['facility', 'provider'],
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
      <components_1.EditModal title="Additional Insurance" onSave={function (hideDialog) { return handleSubmit(function (values) { return onSave(values, hideDialog); })(); }} onShow={function () { return reset(getDefaultValues(claimData, facilities)); }} isSaveLoading={editClaim.isLoading}>
        <material_1.Grid container spacing={2}>
          <material_1.Grid item xs={6}>
            <material_1.TextField label="31.Signature of Physician or Supplier" fullWidth size="small" disabled value={((_b = organizations === null || organizations === void 0 ? void 0 : organizations.find(function (organization) { return organization.id === (coverageData === null || coverageData === void 0 ? void 0 : coverageData.organizationId); })) === null || _b === void 0 ? void 0 : _b.name) || ''}/>
          </material_1.Grid>

          <material_1.Grid item xs={6}>
            <components_1.VirtualizedAutocompleteController name="location" label="32.Service Facility Location" rules={{ required: true }} options={options} renderRow={function (facility) { return facility.name || ''; }}/>
          </material_1.Grid>

          <material_1.Grid item xs={6}>
            <material_1.TextField label="33.Billing Provider" fullWidth size="small" disabled value={(organization === null || organization === void 0 ? void 0 : organization.name) || ''}/>
          </material_1.Grid>
        </material_1.Grid>
      </components_1.EditModal>
    </react_hook_form_1.FormProvider>);
};
exports.SLBProviderModal = SLBProviderModal;
//# sourceMappingURL=SLBProviderModal.js.map