"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PatientSearch;
var icons_material_1 = require("@mui/icons-material");
var material_1 = require("@mui/material");
function PatientSearch(_a) {
    var nameFilter = _a.nameFilter, setNameFilter = _a.setNameFilter, onClear = _a.onClear;
    return (<material_1.TextField id="patient-name" label="Name" placeholder="Search patients by name (Last, First)" InputProps={{
            endAdornment: (<material_1.InputAdornment position="end">
            {nameFilter && (nameFilter === null || nameFilter === void 0 ? void 0 : nameFilter.length) > 0 ? (<material_1.IconButton aria-label="clear patient search" onClick={function () {
                        if (onClear) {
                            onClear();
                        }
                        setNameFilter(null);
                    }} onMouseDown={function (event) { return event.preventDefault(); }} sx={{ p: 0 }}>
                <icons_material_1.Close />
              </material_1.IconButton>) : (<icons_material_1.Search />)}
          </material_1.InputAdornment>),
        }} InputLabelProps={{ shrink: true }} onChange={function (event) {
            setNameFilter(event.target.value);
        }} sx={{ mr: 2, mb: 2 }} fullWidth value={nameFilter !== null && nameFilter !== void 0 ? nameFilter : ''}/>);
}
//# sourceMappingURL=PatientSearch.js.map