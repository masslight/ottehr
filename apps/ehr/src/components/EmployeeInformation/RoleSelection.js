"use strict";
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
exports.RoleSelection = RoleSelection;
var material_1 = require("@mui/material");
var utils_1 = require("utils");
var data_test_ids_1 = require("../../constants/data-test-ids");
var useEvolveUser_1 = require("../../hooks/useEvolveUser");
function RoleSelection(_a) {
    var errors = _a.errors, isActive = _a.isActive, getValues = _a.getValues, setValue = _a.setValue;
    var currentUser = (0, useEvolveUser_1.default)();
    return (<material_1.FormControl sx={{ width: '100%' }} error={errors.roles} data-testid={data_test_ids_1.dataTestIds.employeesPage.rolesSection}>
      <material_1.FormLabel sx={{ mb: 1, mt: 2, fontWeight: '600 !important' }}>Role</material_1.FormLabel>
      <material_1.FormLabel sx={{ fontWeight: 500, fontSize: '12px' }}>Select role *</material_1.FormLabel>
      <material_1.FormGroup>
        {utils_1.AVAILABLE_EMPLOYEE_ROLES.map(function (roleEntry, index) {
            var _a;
            var roles = (_a = getValues('roles')) !== null && _a !== void 0 ? _a : [];
            var isChecked = roles.includes(roleEntry.value);
            return (<material_1.Box key={index}>
              <material_1.FormControlLabel value={roleEntry.value} name="roles" data-testid={data_test_ids_1.dataTestIds.employeesPage.roleRow(roleEntry.value)} checked={isChecked} onChange={function (e, checked) {
                    var currentRoles = getValues('roles');
                    var newRoles = checked
                        ? __spreadArray(__spreadArray([], currentRoles, true), [roleEntry.value], false) : currentRoles.filter(function (role) { return role !== roleEntry.value; });
                    setValue('roles', newRoles);
                }} control={<material_1.Checkbox />} disabled={!isActive || !(currentUser === null || currentUser === void 0 ? void 0 : currentUser.hasRole([utils_1.RoleType.Administrator]))} label={roleEntry.label} sx={{ '.MuiFormControlLabel-asterisk': { display: 'none' } }}/>
              <material_1.Box ml={4} sx={{ marginTop: '-10px', marginBottom: '5px' }}>
                <material_1.Typography sx={{ color: 'text.secondary' }} variant="body2">
                  {roleEntry.hint}
                </material_1.Typography>
              </material_1.Box>
            </material_1.Box>);
        })}
      </material_1.FormGroup>
    </material_1.FormControl>);
}
//# sourceMappingURL=RoleSelection.js.map