"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderDetails = ProviderDetails;
var material_1 = require("@mui/material");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../constants/data-test-ids");
function ProviderDetails(_a) {
    var control = _a.control, photoSrc = _a.photoSrc, roles = _a.roles;
    return (<material_1.FormControl sx={{ width: '100%' }}>
      <material_1.FormLabel sx={{ mt: 3, fontWeight: '600 !important' }}>Provider details</material_1.FormLabel>
      {photoSrc && <img src={photoSrc} width="110" height="110" style={{ borderRadius: '50%' }}/>}
      <react_hook_form_1.Controller name="nameSuffix" control={control} render={function (_a) {
            var _b = _a.field, onChange = _b.onChange, value = _b.value;
            return (<material_1.TextField label="Credentials" data-testid={data_test_ids_1.dataTestIds.employeesPage.providerDetailsCredentials} value={value || ''} onChange={onChange} sx={{ marginTop: 3, width: '100%' }} margin="dense"/>);
        }}/>
      <react_hook_form_1.Controller name="npi" control={control} rules={{
            validate: function (value) {
                if (value) {
                    return (0, utils_1.isNPIValid)(value) ? true : 'NPI must be 10 digits';
                }
                return true;
            },
        }} render={function (_a) {
            var _b;
            var _c = _a.field, onChange = _c.onChange, value = _c.value, error = _a.fieldState.error;
            return (<material_1.TextField label="NPI" data-testid={data_test_ids_1.dataTestIds.employeesPage.providerDetailsNPI} required={roles.includes(utils_1.RoleType.Provider)} value={value || ''} onChange={onChange} error={(error === null || error === void 0 ? void 0 : error.message) !== undefined} helperText={(_b = error === null || error === void 0 ? void 0 : error.message) !== null && _b !== void 0 ? _b : ''} FormHelperTextProps={{
                    sx: { ml: 0, mt: 1 },
                }} sx={{ marginTop: 2, marginBottom: 2, width: '100%' }} margin="dense"/>);
        }}/>
    </material_1.FormControl>);
}
//# sourceMappingURL=ProviderDetails.js.map