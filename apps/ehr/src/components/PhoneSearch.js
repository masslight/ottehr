"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PhoneSearch;
var icons_material_1 = require("@mui/icons-material");
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var InputMask_1 = require("./InputMask");
function PhoneSearch(_a) {
    var phoneFilter = _a.phoneFilter, setPhoneFilter = _a.setPhoneFilter, onClear = _a.onClear;
    var _b = (0, react_1.useState)(false), error = _b[0], setError = _b[1];
    return (<material_1.FormControl variant="outlined" fullWidth>
      <material_1.InputLabel shrink error={error}>
        Phone
      </material_1.InputLabel>
      <material_1.OutlinedInput id="phone" label="Phone" type="tel" placeholder="Search patients by phone" value={phoneFilter !== null && phoneFilter !== void 0 ? phoneFilter : ''} inputMode="numeric" inputComponent={InputMask_1.default} inputProps={{
            mask: '(000) 000-0000',
        }} endAdornment={<material_1.InputAdornment position="end">
            {phoneFilter && (phoneFilter === null || phoneFilter === void 0 ? void 0 : phoneFilter.length) > 0 ? (<material_1.IconButton aria-label="clear phone search" onClick={function () {
                    if (onClear) {
                        onClear();
                    }
                    setPhoneFilter(null);
                }} onMouseDown={function (event) { return event.preventDefault(); }} sx={{ p: 0 }}>
                <icons_material_1.Close />
              </material_1.IconButton>) : (<icons_material_1.Search />)}
          </material_1.InputAdornment>} onChange={function (e) {
            var phone = e.target.value.replace(/\D/g, '');
            setPhoneFilter(phone);
            if ((0, utils_1.isPhoneNumberValid)(phone)) {
                setError(true);
            }
            else {
                setError(false);
            }
        }} error={error} notched/>
      <material_1.FormHelperText error sx={{ visibility: error ? 'visible' : 'hidden' }}>
        Phone number must be 10 digits in the format (xxx) xxx-xxxx and a valid number
      </material_1.FormHelperText>
    </material_1.FormControl>);
}
//# sourceMappingURL=PhoneSearch.js.map