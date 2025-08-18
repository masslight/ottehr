"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AppointmentTableRowMobile;
var colors_1 = require("@ehrTheme/colors");
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var constants_1 = require("../constants");
var PatientDateOfBirth_1 = require("./PatientDateOfBirth");
var ReasonForVisit_1 = require("./ReasonForVisit");
function AppointmentTableRowMobile(_a) {
    var appointment = _a.appointment, patientName = _a.patientName, start = _a.start, tab = _a.tab, formattedPriorityHighIcon = _a.formattedPriorityHighIcon, statusChip = _a.statusChip, patientDateOfBirth = _a.patientDateOfBirth, statusTimeEl = _a.statusTimeEl, linkStyle = _a.linkStyle, timeToolTip = _a.timeToolTip;
    var _b = (0, react_1.useState)(false), timeModalOpen = _b[0], setTimeModalOpen = _b[1];
    return (<material_1.TableRow sx={{
            '&:last-child td, &:last-child th': { border: 0 },
            '&:hover': {
                backgroundColor: colors_1.otherColors.apptHover,
            },
            '& .MuiTableCell-root': { p: '8px' },
            position: 'relative',
        }}>
      <material_1.TableCell colSpan={9}>
        <react_router_dom_1.Link to={"/visit/".concat(appointment.id)} style={linkStyle}>
          <material_1.Grid container spacing={1}>
            <material_1.Grid item xs={12} justifyContent="space-between">
              <material_1.Grid container justifyContent="space-between" alignItems="center" wrap="nowrap" sx={{ overflow: 'hidden' }}>
                <material_1.Box display="flex" gap={1} flex="1 1 auto" flexWrap="nowrap" marginRight={2}>
                  <material_1.Typography variant="body1" sx={{ textWrap: 'nowrap' }}>
                    {material_1.capitalize === null || material_1.capitalize === void 0 ? void 0 : (0, material_1.capitalize)(appointment.appointmentType === 'post-telemed'
            ? 'Post Telemed'
            : (appointment.appointmentType || '').toString())}
                  </material_1.Typography>
                  <material_1.Typography variant="body1" sx={{ textWrap: 'nowrap' }}>
                    <strong>{start}</strong>
                  </material_1.Typography>
                </material_1.Box>
                <material_1.Box onClick={function (e) {
            e.preventDefault();
            e.stopPropagation();
        }}>
                  <ReasonForVisit_1.default reasonsForVisit={appointment.reasonForVisit} tab={tab} formattedPriorityHighIcon={formattedPriorityHighIcon} lineMax={1} isMobile={true}></ReasonForVisit_1.default>
                </material_1.Box>
              </material_1.Grid>
            </material_1.Grid>
            <material_1.Grid item xs={12} justifyContent="space-between">
              <material_1.Grid container justifyContent="space-between" alignItems="flex-start">
                <material_1.Grid item xs={11}>
                  <material_1.Box sx={{ marginBottom: 1, display: 'flex' }} gap={1}>
                    {statusChip}
                    {statusTimeEl && (<material_1.Grid sx={{ display: 'flex', alignItems: 'center' }} gap={1} onClick={function (e) {
                console.log('i work');
                e.preventDefault();
                e.stopPropagation();
                setTimeModalOpen(true);
            }}>
                        {statusTimeEl}
                      </material_1.Grid>)}
                  </material_1.Box>
                  <material_1.Box sx={{ display: 'flex', alignItems: 'center' }} gap={1}>
                    <material_1.Typography variant="body1" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                      {patientName}
                    </material_1.Typography>{' '}
                    <PatientDateOfBirth_1.PatientDateOfBirth dateOfBirth={patientDateOfBirth}/>
                  </material_1.Box>
                </material_1.Grid>
              </material_1.Grid>
            </material_1.Grid>
          </material_1.Grid>
        </react_router_dom_1.Link>
        <material_1.Modal open={timeModalOpen} onClose={function () { return setTimeModalOpen(false); }}>
          <material_1.Box sx={constants_1.MOBILE_MODAL_STYLE}>{timeToolTip}</material_1.Box>
        </material_1.Modal>
      </material_1.TableCell>
    </material_1.TableRow>);
}
//# sourceMappingURL=AppointmentTableRowMobile.js.map