"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AppointmentStatusDropdown;
var material_1 = require("@mui/material");
var react_1 = require("react");
var ITEM_HEIGHT = 48;
var ITEM_PADDING_TOP = 8;
var MenuProps = {
    PaperProps: {
        style: {
            maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
            width: 250,
        },
    },
};
var statuses = ['Pending', 'Booked', 'Arrived', 'Cancelled'];
function AppointmentStatusDropdown(_a) {
    var appointmentStatus = _a.appointmentStatus, setAppointmentStatus = _a.setAppointmentStatus;
    var handleChange = function (event) {
        var value = event.target.value;
        if (value && setAppointmentStatus) {
            setAppointmentStatus(
            // On autofill we get a stringified value.
            typeof value === 'string' ? value.split(',') : value);
        }
    };
    return (<div>
      <material_1.FormControl sx={{ mt: 2, width: 300 }}>
        <material_1.InputLabel id="multiple-checkbox-label">Status</material_1.InputLabel>
        <material_1.Select labelId="multiple-checkbox-label" id="multiple-checkbox" multiple value={appointmentStatus} onChange={handleChange} input={<material_1.OutlinedInput label="Status"/>} renderValue={function (selected) { return selected.join(', '); }} MenuProps={MenuProps}>
          {statuses.map(function (status) { return (<material_1.MenuItem key={status} value={status}>
              <material_1.Checkbox checked={appointmentStatus && appointmentStatus.includes(status)}/>
              <material_1.ListItemText primary={status}/>
            </material_1.MenuItem>); })}
        </material_1.Select>
      </material_1.FormControl>
    </div>);
}
//# sourceMappingURL=AppointmentStatusDropdown.js.map