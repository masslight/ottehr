"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = GroupMembers;
var material_1 = require("@mui/material");
{
    /* <Autocomplete
        disabled={renderInputProps?.disabled}
        value={
          location ? { label: `${location.address?.state?.toUpperCase()} - ${location.name}`, value: location?.id } : null
        }
        onChange={handleLocationChange}
        isOptionEqualToValue={(option, tempValue) => option.value === tempValue.value}
        options={options}
        renderOption={(props, option) => {
          return (
            <li {...props} key={option.value}>
              {option.label}
            </li>
          );
        }}
        fullWidth
        renderInput={(params) => (
          <TextField placeholder="Search office" name="location" {...params} label="Office" required={required} />
        )}
      />
    ); */
}
function GroupMembers(_a) {
    var option = _a.option, options = _a.options, values = _a.values, onChange = _a.onChange;
    return (<material_1.Autocomplete options={options} renderInput={function (params) { return (<material_1.TextField placeholder={(0, material_1.capitalize)(option)} name={option} {...params} label={(0, material_1.capitalize)(option)}/>); }} isOptionEqualToValue={function (option, tempValue) { return option.value === tempValue.value; }} value={values} onChange={onChange} multiple renderOption={function (props, option) { return (<li {...props} key={option.value}>
          {option.label}
        </li>); }}/>);
}
//# sourceMappingURL=GroupMembers.js.map