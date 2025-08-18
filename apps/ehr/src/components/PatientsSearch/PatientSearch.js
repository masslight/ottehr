"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientSearch = void 0;
var material_1 = require("@mui/material");
var PatientsSearchFilters_1 = require("./PatientsSearchFilters");
var PatientsSearchTable_1 = require("./PatientsSearchTable");
var usePatientsSearch_1 = require("./usePatientsSearch");
var PatientSearch = function () {
    var _a = (0, usePatientsSearch_1.usePatientsSearch)(), searchResult = _a.searchResult, arePatientsLoading = _a.arePatientsLoading, searchOptions = _a.searchOptions, setSearchField = _a.setSearchField, resetFilters = _a.resetFilters, search = _a.search;
    return (<>
      <material_1.Paper sx={{ p: 2, mb: 2 }}>
        <PatientsSearchFilters_1.PatientsSearchFilters searchFilters={searchOptions.filters} setSearchField={setSearchField} resetFilters={resetFilters} search={search}/>
      </material_1.Paper>
      <material_1.Paper>
        <PatientsSearchTable_1.PatientsSearchTable searchResult={searchResult} arePatientsLoading={arePatientsLoading} searchOptions={searchOptions} search={search}/>
      </material_1.Paper>
    </>);
};
exports.PatientSearch = PatientSearch;
//# sourceMappingURL=PatientSearch.js.map