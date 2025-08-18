"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ProvidersSelect;
var material_1 = require("@mui/material");
var useAppClients_1 = require("../hooks/useAppClients");
function ProvidersSelect(_a) {
    var providers = _a.providers, practitioners = _a.practitioners, handleSubmit = _a.handleSubmit;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var practitionerIDToName = {};
    practitioners === null || practitioners === void 0 ? void 0 : practitioners.map(function (practitioner) {
        if (practitioner.id && practitioner.name != undefined) {
            practitionerIDToName[practitioner.id] = (oystehr === null || oystehr === void 0 ? void 0 : oystehr.fhir.formatHumanName(practitioner.name[0])) || 'Unknown provider';
        }
    });
    return (<material_1.Autocomplete id="providers" value={providers.map(function (provider) { return ({
            value: provider,
            label: practitionerIDToName[provider] == undefined ? 'Loading...' : practitionerIDToName[provider],
        }); })} isOptionEqualToValue={function (option, tempValue) { return option.value === tempValue.value; }} options={practitioners
            ? practitioners
                // .filter((practitioner) => practitioner.name != undefined)
                .map(function (practitioner) { return ({
                value: practitioner.id,
                label: practitioner.name != undefined ? oystehr === null || oystehr === void 0 ? void 0 : oystehr.fhir.formatHumanName(practitioner.name[0]) : 'Unknown',
            }); })
            : []} renderOption={function (props, option) {
            return (<li {...props} key={option.value}>
            {option.label}
          </li>);
        }} 
    // getOptionLabel={(option) => option.label}
    onChange={function (event, providers) {
            var providerIDs = providers.map(function (provider) { return provider.value; });
            if (providerIDs) {
                localStorage.setItem('selectedProviders', JSON.stringify(providerIDs));
            }
            else {
                localStorage.removeItem('selectedProviders');
            }
            if (handleSubmit) {
                handleSubmit(event, providerIDs, 'providers');
            }
        }} multiple renderInput={function (params) { return <material_1.TextField name="providers" {...params} label="Providers" required={false}/>; }}/>);
}
//# sourceMappingURL=ProvidersSelect.js.map