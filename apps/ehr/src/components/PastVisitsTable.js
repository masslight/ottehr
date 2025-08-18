"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PastVisitsTable = void 0;
var material_1 = require("@mui/material");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var formatDateTime_1 = require("../helpers/formatDateTime");
var PastVisitsTable = function (props) {
    var appointments = props.appointments, stickyHeader = props.stickyHeader;
    return (<material_1.Table sx={{ minWidth: 650 }} aria-label="locationsTable" stickyHeader={stickyHeader}>
      <material_1.TableHead>
        <material_1.TableRow>
          <material_1.TableCell sx={{ fontWeight: 'bold' }} align="left">
            Date & Time
          </material_1.TableCell>
          <material_1.TableCell sx={{ fontWeight: 'bold' }} align="left">
            Visit ID
          </material_1.TableCell>
          <material_1.TableCell sx={{ fontWeight: 'bold' }} align="left">
            Type
          </material_1.TableCell>
          <material_1.TableCell sx={{ fontWeight: 'bold' }} align="left">
            Office
          </material_1.TableCell>
          <material_1.TableCell sx={{ fontWeight: 'bold' }} align="left">
            Length
          </material_1.TableCell>
        </material_1.TableRow>
      </material_1.TableHead>
      <material_1.TableBody>
        {appointments === null || appointments === void 0 ? void 0 : appointments.map(function (appointment, idx) { return (<material_1.TableRow key={idx}>
            <material_1.TableCell align="left">
              {appointment.dateTime
                ? (0, formatDateTime_1.formatISOStringToDateAndTime)(appointment.dateTime, appointment.officeTimeZone)
                : '-'}
            </material_1.TableCell>
            <material_1.TableCell>
              <react_router_dom_1.Link to={appointment.serviceMode === utils_1.ServiceMode.virtual
                ? "/telemed/appointments/".concat(appointment.id)
                : "/visit/".concat(appointment.id)} target="_blank">
                {appointment.id || '-'}
              </react_router_dom_1.Link>
            </material_1.TableCell>
            <material_1.TableCell align="left">{appointment.typeLabel || '-'}</material_1.TableCell>
            <material_1.TableCell align="left">{appointment.office || '-'}</material_1.TableCell>
            <material_1.TableCell align="left">
              {appointment.length !== undefined
                ? "".concat((0, utils_1.formatMinutes)(appointment.length), " ").concat(appointment.length === 1 ? 'min' : 'mins')
                : '-'}
            </material_1.TableCell>
          </material_1.TableRow>); })}
      </material_1.TableBody>
    </material_1.Table>);
};
exports.PastVisitsTable = PastVisitsTable;
//# sourceMappingURL=PastVisitsTable.js.map