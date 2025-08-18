"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientsSearchFilters = void 0;
var KeyboardArrowDown_1 = require("@mui/icons-material/KeyboardArrowDown");
var KeyboardArrowUp_1 = require("@mui/icons-material/KeyboardArrowUp");
var Search_1 = require("@mui/icons-material/Search");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var react_1 = require("react");
var data_test_ids_1 = require("../../constants/data-test-ids");
var DateSearch_1 = require("../DateSearch");
var useLocationsOptions_1 = require("./useLocationsOptions");
var PatientsSearchFilters = function (_a) {
    var searchFilters = _a.searchFilters, setSearchField = _a.setSearchField, resetFilters = _a.resetFilters, search = _a.search;
    var _b = (0, react_1.useState)(true), showAdditionalSearch = _b[0], setShowAdditionalSearch = _b[1];
    var locationOptions = (0, useLocationsOptions_1.useLocationsOptions)().location;
    var handleSubmit = function (e) {
        e.preventDefault();
        search({ pagination: { offset: 0 } });
    };
    return (<material_1.FormControl component="form" onSubmit={handleSubmit} fullWidth>
      <material_1.Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <material_1.TextField data-testid={data_test_ids_1.dataTestIds.patients.searchByLastNameField} sx={{ flex: 1 }} label="Last Name" placeholder="Doe" value={searchFilters.lastName} onChange={function (e) { return setSearchField({ field: 'lastName', value: e.target.value }); }}/>
        <material_1.TextField data-testid={data_test_ids_1.dataTestIds.patients.searchByGivenNamesField} sx={{ flex: 1 }} label="Given Names" placeholder="John Henry" value={searchFilters.givenNames} onChange={function (e) { return setSearchField({ field: 'givenNames', value: e.target.value }); }}/>
        <material_1.Box sx={{ flex: 1 }}>
          <DateSearch_1.default date={searchFilters.dob ? luxon_1.DateTime.fromISO(searchFilters.dob) : null} setDate={function (date) {
            return setSearchField({ field: 'dob', value: date ? date.toISODate() || '' : '' });
        }} label="DOB" closeOnSelect data-testid={data_test_ids_1.dataTestIds.patients.searchByDateOfBirthField}/>
        </material_1.Box>
      </material_1.Box>
      <material_1.Box sx={{ mb: 2 }}>
        <material_1.Button type="button" onClick={function () { return setShowAdditionalSearch(!showAdditionalSearch); }} startIcon={showAdditionalSearch ? <KeyboardArrowUp_1.default /> : <KeyboardArrowDown_1.default />} color="primary">
          Additional search
        </material_1.Button>
      </material_1.Box>

      {showAdditionalSearch && (<material_1.Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, mb: 3 }}>
          <material_1.TextField label="Phone" data-testid={data_test_ids_1.dataTestIds.patients.searchByPhoneField} placeholder="(XXX) XX-XXXX" value={searchFilters.phone} onChange={function (e) { return setSearchField({ field: 'phone', value: e.target.value }); }}/>
          <material_1.TextField label="Address" data-testid={data_test_ids_1.dataTestIds.patients.searchByAddressField} value={searchFilters.address} onChange={function (e) { return setSearchField({ field: 'address', value: e.target.value }); }}/>
          <material_1.TextField label="Email" data-testid={data_test_ids_1.dataTestIds.patients.searchByEmailField} placeholder="example@mail.com" value={searchFilters.email} onChange={function (e) { return setSearchField({ field: 'email', value: e.target.value }); }}/>
          {/* <TextField
                  label="Subscriber Number (Insurance)"
                  value={searchFilters.subscriberNumber}
                  onChange={(e) => setSearchField({ field: 'subscriberNumber', value: e.target.value })}
                /> */}
          <material_1.FormControl fullWidth>
            <material_1.TextField data-testid={data_test_ids_1.dataTestIds.patients.searchByStatusName} select label="Status" value={searchFilters.status} onChange={function (e) { return setSearchField({ field: 'status', value: e.target.value }); }}>
              <material_1.MenuItem value="All">All</material_1.MenuItem>
              <material_1.MenuItem value="Active">Active</material_1.MenuItem>
              <material_1.MenuItem value="Deceased">Deceased</material_1.MenuItem>
              <material_1.MenuItem value="Inactive">Inactive</material_1.MenuItem>
            </material_1.TextField>
          </material_1.FormControl>
          <material_1.FormControl fullWidth>
            <material_1.TextField data-testid={data_test_ids_1.dataTestIds.patients.searchByLocationName} select label="Location" value={searchFilters.location} onChange={function (e) { return setSearchField({ field: 'location', value: e.target.value }); }}>
              <material_1.MenuItem value="All">All</material_1.MenuItem>
              {locationOptions.options.map(function (option) { return (<material_1.MenuItem key={option.value} value={option.value}>
                  {option.label}
                </material_1.MenuItem>); })}
            </material_1.TextField>
          </material_1.FormControl>
        </material_1.Box>)}

      <material_1.Box sx={{ mb: 2, display: 'flex', justifyContent: 'end', gap: 3 }}>
        <material_1.Button type="button" onClick={resetFilters} data-testid={data_test_ids_1.dataTestIds.patients.resetFiltersButton}>
          Reset filters
        </material_1.Button>
        <material_1.Button data-testid={data_test_ids_1.dataTestIds.patients.searchButton} variant="contained" color="primary" startIcon={<Search_1.default />} type="submit" sx={{ mr: 1, borderRadius: 28 }}>
          Search
        </material_1.Button>
      </material_1.Box>
    </material_1.FormControl>);
};
exports.PatientsSearchFilters = PatientsSearchFilters;
//# sourceMappingURL=PatientsSearchFilters.js.map