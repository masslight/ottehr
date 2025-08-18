"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = GroupSelect;
var material_1 = require("@mui/material");
var data_test_ids_1 = require("../constants/data-test-ids");
function GroupSelect(_a) {
    var groups = _a.groups, healthcareServices = _a.healthcareServices, handleSubmit = _a.handleSubmit;
    var healthcareServiceIDToName = {};
    healthcareServices === null || healthcareServices === void 0 ? void 0 : healthcareServices.map(function (healthcareService) {
        if (healthcareService.id && healthcareService.name != undefined) {
            healthcareServiceIDToName[healthcareService.id] = healthcareService.name;
        }
    });
    return (<material_1.Autocomplete id="groups" data-testid={data_test_ids_1.dataTestIds.dashboard.groupSelect} value={groups.map(function (group) { return ({
            value: group,
            label: healthcareServiceIDToName[group] == undefined ? 'Loading...' : healthcareServiceIDToName[group],
        }); })} isOptionEqualToValue={function (option, tempValue) { return option.value === tempValue.value; }} options={healthcareServices
            ? healthcareServices
                // .filter((healthcareService) => healthcareService.name != undefined)
                .map(function (healthcareService) { return ({
                value: healthcareService.id,
                label: healthcareService.name != undefined ? healthcareService.name : 'Unknown',
            }); })
            : []} renderOption={function (props, option) {
            return (<li {...props} key={option.value}>
            {option.label}
          </li>);
        }} 
    // getOptionLabel={(option) => option.label}
    onChange={function (event, groups) {
            var groupIDs = groups.map(function (group) { return group.value; });
            if (groupIDs) {
                localStorage.setItem('selectedGroups', JSON.stringify(groupIDs));
            }
            else {
                localStorage.removeItem('selectedGroups');
            }
            if (handleSubmit) {
                handleSubmit(event, groupIDs, 'groups');
            }
        }} multiple renderInput={function (params) { return <material_1.TextField name="groups" {...params} label="Groups" required={false}/>; }}/>);
}
//# sourceMappingURL=GroupSelect.js.map