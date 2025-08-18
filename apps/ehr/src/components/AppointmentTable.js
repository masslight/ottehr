"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AppointmentTable;
var ArrowDropDownCircleOutlined_1 = require("@mui/icons-material/ArrowDropDownCircleOutlined");
var material_1 = require("@mui/material");
var react_1 = require("react");
var constants_1 = require("../constants");
var data_test_ids_1 = require("../constants/data-test-ids");
var AppointmentStatusChipsCount_1 = require("./AppointmentStatusChipsCount");
var AppointmentTableRow_1 = require("./AppointmentTableRow");
var AppointmentTabs_1 = require("./AppointmentTabs");
function AppointmentTable(_a) {
    var appointments = _a.appointments, location = _a.location, tab = _a.tab, now = _a.now, updateAppointments = _a.updateAppointments, setEditingComment = _a.setEditingComment, orders = _a.orders;
    var theme = (0, material_1.useTheme)();
    var actionButtons = tab === AppointmentTabs_1.ApptTab.prebooked ? true : false;
    var showTime = tab !== AppointmentTabs_1.ApptTab.prebooked ? true : false;
    var _b = (0, react_1.useState)(false), collapseWaiting = _b[0], setCollapseWaiting = _b[1];
    var _c = (0, react_1.useState)(false), collapseExam = _c[0], setCollapseExam = _c[1];
    var inHouseLabOrdersByAppointmentId = orders.inHouseLabOrdersByAppointmentId, externalLabOrdersByAppointmentId = orders.externalLabOrdersByAppointmentId, nursingOrdersByAppointmentId = orders.nursingOrdersByAppointmentId, inHouseMedicationsByEncounterId = orders.inHouseMedicationsByEncounterId, radiologyOrdersByAppointmentId = orders.radiologyOrdersByAppointmentId;
    var ordersForAppointment = function (appointmentId, encounterId) { return ({
        inHouseLabOrders: inHouseLabOrdersByAppointmentId[appointmentId],
        externalLabOrders: externalLabOrdersByAppointmentId[appointmentId],
        nursingOrders: nursingOrdersByAppointmentId[appointmentId],
        inHouseMedications: inHouseMedicationsByEncounterId[encounterId],
        radiologyOrders: radiologyOrdersByAppointmentId[appointmentId],
    }); };
    return (<>
      <AppointmentStatusChipsCount_1.AppointmentsStatusChipsCount appointments={appointments}/>
      <material_1.Paper>
        <material_1.TableContainer sx={{ overflow: 'auto' }} data-testid={data_test_ids_1.dataTestIds.dashboard.appointmentsTable(tab)}>
          <material_1.Table style={{ tableLayout: 'auto', width: '100%', maxWidth: '100%' }}>
            {/* column widths must add up to the table width ^ */}
            <material_1.TableHead>
              <material_1.TableRow sx={{ '& .MuiTableCell-root': { px: '8px' }, display: { xs: 'none', sm: 'none', md: 'table-row' } }}>
                <material_1.TableCell></material_1.TableCell>
                <material_1.TableCell style={{ minWidth: constants_1.TYPE_WIDTH_MIN }}>
                  <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    {tab !== AppointmentTabs_1.ApptTab.prebooked ? 'Type & Status' : 'Type'}
                  </material_1.Typography>
                </material_1.TableCell>
                {showTime && (<material_1.TableCell style={{ minWidth: constants_1.TIME_WIDTH_MIN }}>
                    <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                      Time
                    </material_1.Typography>
                  </material_1.TableCell>)}
                <material_1.TableCell style={{ minWidth: constants_1.PATIENT_AND_REASON_WIDTH_MIN }}>
                  <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Patient & Reason
                  </material_1.Typography>
                </material_1.TableCell>
                {(tab === AppointmentTabs_1.ApptTab['in-office'] || tab === AppointmentTabs_1.ApptTab.completed) && (<material_1.TableCell style={{ minWidth: constants_1.ROOM_WIDTH_MIN }}>
                    <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                      Room
                    </material_1.Typography>
                  </material_1.TableCell>)}
                <material_1.TableCell style={{ minWidth: constants_1.PROVIDER_WIDTH_MIN }}>
                  <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Provider
                  </material_1.Typography>
                </material_1.TableCell>
                <material_1.TableCell style={{ minWidth: constants_1.VISIT_ICONS_WIDTH_MIN }}>
                  <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    {tab === AppointmentTabs_1.ApptTab.completed ? 'Orders' : 'Visit Components'}
                  </material_1.Typography>
                </material_1.TableCell>
                <material_1.TableCell style={{ minWidth: constants_1.NOTES_WIDTH_MIN }}>
                  <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Notes
                  </material_1.Typography>
                </material_1.TableCell>
                <material_1.TableCell style={{ minWidth: constants_1.CHAT_WIDTH_MIN }}>
                  <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Chat
                  </material_1.Typography>
                </material_1.TableCell>
                <material_1.TableCell style={{
            minWidth: tab === AppointmentTabs_1.ApptTab.prebooked ? constants_1.GO_TO_ONE_BUTTON_WIDTH_MIN : constants_1.GO_TO_MANY_BUTTONS_WIDTH_MIN,
        }}>
                  <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                    Actions
                  </material_1.Typography>
                </material_1.TableCell>
                {tab === AppointmentTabs_1.ApptTab.prebooked && (<material_1.TableCell style={{ minWidth: constants_1.ACTION_WIDTH_MIN }}>
                    <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                      Arrived
                    </material_1.Typography>
                  </material_1.TableCell>)}
              </material_1.TableRow>
            </material_1.TableHead>
            <material_1.TableBody>
              {tab === AppointmentTabs_1.ApptTab['in-office'] ? (<>
                  <material_1.TableRow>
                    <material_1.TableCell sx={{ backgroundColor: (0, material_1.alpha)(theme.palette.secondary.main, 0.08) }} colSpan={10}>
                      <material_1.Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <material_1.IconButton onClick={function () { return setCollapseWaiting(!collapseWaiting); }} sx={{ mr: 0.75, p: 0 }}>
                          <ArrowDropDownCircleOutlined_1.default sx={{
                color: theme.palette.primary.main,
                rotate: collapseWaiting ? '' : '180deg',
            }}></ArrowDropDownCircleOutlined_1.default>
                        </material_1.IconButton>
                        {/* todo add a count to the this title */}
                        <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                          Waiting Room (
                          {appointments.filter(function (appointmentTemp) {
                return appointmentTemp.status === 'arrived' || appointmentTemp.status === 'ready';
            }).length}
                          )
                        </material_1.Typography>
                      </material_1.Box>
                    </material_1.TableCell>
                  </material_1.TableRow>
                  {!collapseWaiting &&
                // todo add logic to filter out appointments that are not waiting
                appointments
                    .filter(function (appointmentTemp) {
                    return appointmentTemp.status === 'arrived' || appointmentTemp.status === 'ready';
                })
                    .map(function (appointment) {
                    return (<AppointmentTableRow_1.default key={appointment.id} appointment={appointment} location={location} actionButtons={actionButtons} showTime={showTime} now={now} updateAppointments={updateAppointments} setEditingComment={setEditingComment} tab={tab} orders={ordersForAppointment(appointment.id, appointment.encounterId)}></AppointmentTableRow_1.default>);
                })}
                </>) : (appointments === null || appointments === void 0 ? void 0 : appointments.map(function (appointment) {
            return (<AppointmentTableRow_1.default key={appointment.id} appointment={appointment} location={location} actionButtons={actionButtons} showTime={showTime} now={now} updateAppointments={updateAppointments} setEditingComment={setEditingComment} tab={tab} orders={ordersForAppointment(appointment.id, appointment.encounterId)}></AppointmentTableRow_1.default>);
        }))}
            </material_1.TableBody>
          </material_1.Table>
        </material_1.TableContainer>
      </material_1.Paper>
      {tab === AppointmentTabs_1.ApptTab['in-office'] && (<material_1.Paper sx={{ marginTop: '16px' }}>
          <material_1.TableContainer sx={{ overflow: 'auto' }}>
            <material_1.Table style={{ tableLayout: 'auto', width: '100%', maxWidth: '100%' }}>
              <material_1.TableHead>
                <material_1.TableRow sx={{ '& .MuiTableCell-root': { px: '8px' }, display: { xs: 'none', sm: 'none', md: 'table-row' } }}>
                  <material_1.TableCell></material_1.TableCell>
                  <material_1.TableCell style={{ minWidth: constants_1.TYPE_WIDTH_MIN }}></material_1.TableCell>
                  {showTime && <material_1.TableCell style={{ minWidth: constants_1.TIME_WIDTH_MIN }}></material_1.TableCell>}
                  <material_1.TableCell style={{ minWidth: constants_1.PATIENT_AND_REASON_WIDTH_MIN }}></material_1.TableCell>
                  <material_1.TableCell style={{ minWidth: constants_1.ROOM_WIDTH_MIN }}></material_1.TableCell>
                  <material_1.TableCell style={{ minWidth: constants_1.PROVIDER_WIDTH_MIN }}></material_1.TableCell>
                  <material_1.TableCell style={{ minWidth: constants_1.VISIT_ICONS_WIDTH_MIN }}></material_1.TableCell>
                  <material_1.TableCell style={{ minWidth: constants_1.NOTES_WIDTH_MIN }}></material_1.TableCell>
                  <material_1.TableCell style={{ minWidth: constants_1.CHAT_WIDTH_MIN }}></material_1.TableCell>
                  <material_1.TableCell style={{ minWidth: constants_1.GO_TO_MANY_BUTTONS_WIDTH_MIN }}></material_1.TableCell>
                </material_1.TableRow>
              </material_1.TableHead>
              <material_1.TableBody>
                <material_1.TableRow>
                  <material_1.TableCell sx={{ backgroundColor: (0, material_1.alpha)(theme.palette.secondary.main, 0.08) }} colSpan={10}>
                    <material_1.Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <material_1.IconButton onClick={function () { return setCollapseExam(!collapseExam); }} sx={{ mr: 0.75, p: 0 }}>
                        <ArrowDropDownCircleOutlined_1.default sx={{
                color: theme.palette.primary.main,
                rotate: collapseExam ? '' : '180deg',
            }}></ArrowDropDownCircleOutlined_1.default>
                      </material_1.IconButton>
                      {/* todo add a count to the this title */}
                      <material_1.Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                        Exam Rooms (
                        {appointments.filter(function (appointmentTemp) {
                return appointmentTemp.status !== 'arrived' && appointmentTemp.status !== 'ready';
            }).length}
                        )
                      </material_1.Typography>
                    </material_1.Box>
                  </material_1.TableCell>
                </material_1.TableRow>
                {!collapseExam &&
                // todo add logic to filter out appointments that are not in exam
                appointments
                    .filter(function (appointmentTemp) {
                    return appointmentTemp.status !== 'arrived' && appointmentTemp.status !== 'ready';
                })
                    .map(function (appointment) {
                    return (<AppointmentTableRow_1.default key={appointment.id} appointment={appointment} location={location} actionButtons={actionButtons} showTime={showTime} now={now} updateAppointments={updateAppointments} setEditingComment={setEditingComment} tab={tab} orders={ordersForAppointment(appointment.id, appointment.encounterId)}></AppointmentTableRow_1.default>);
                })}
              </material_1.TableBody>
            </material_1.Table>
          </material_1.TableContainer>
        </material_1.Paper>)}
    </>);
}
//# sourceMappingURL=AppointmentTable.js.map