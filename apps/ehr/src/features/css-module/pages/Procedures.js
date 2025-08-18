"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Procedures;
var Add_1 = require("@mui/icons-material/Add");
var material_1 = require("@mui/material");
var system_1 = require("@mui/system");
var luxon_1 = require("luxon");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var RoundedButton_1 = require("src/components/RoundedButton");
var telemed_1 = require("src/telemed");
var PageTitle_1 = require("src/telemed/components/PageTitle");
var utils_1 = require("utils");
var CSSLoader_1 = require("../components/CSSLoader");
var featureFlags_1 = require("../context/featureFlags");
var routesCSS_1 = require("../routing/routesCSS");
function Procedures() {
    var _a;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var appointmentId = (0, react_router_dom_1.useParams)().id;
    var _b = (0, utils_1.getSelectors)(telemed_1.useAppointmentStore, [
        'chartData',
        'isChartDataLoading',
        'appointment',
        'encounter',
    ]), chartData = _b.chartData, isChartDataLoading = _b.isChartDataLoading, appointment = _b.appointment, encounter = _b.encounter;
    var inPersonStatus = (0, react_1.useMemo)(function () { return appointment && (0, utils_1.getVisitStatus)(appointment, encounter); }, [appointment, encounter]);
    var appointmentAccessibility = (0, telemed_1.useGetAppointmentAccessibility)();
    var css = (0, featureFlags_1.useFeatureFlags)().css;
    var isReadOnly = (0, react_1.useMemo)(function () {
        if (css) {
            return inPersonStatus === 'completed';
        }
        return appointmentAccessibility.status === utils_1.TelemedAppointmentStatusEnum.complete;
    }, [css, inPersonStatus, appointmentAccessibility.status]);
    var onNewProcedureClick = function () {
        navigate("/in-person/".concat(appointmentId, "/").concat(routesCSS_1.ROUTER_PATH.PROCEDURES_NEW));
    };
    var onProcedureClick = function (procedureId) {
        navigate("/in-person/".concat(appointmentId, "/procedures/").concat(procedureId));
    };
    if (isChartDataLoading)
        return <CSSLoader_1.CSSLoader />;
    return (<>
      <system_1.Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <PageTitle_1.PageTitle label="Procedures" showIntakeNotesButton={false}/>
        <RoundedButton_1.RoundedButton variant="contained" onClick={onNewProcedureClick} startIcon={<Add_1.default />} disabled={isReadOnly}>
          Procedure
        </RoundedButton_1.RoundedButton>
      </system_1.Box>
      <telemed_1.AccordionCard>
        <material_1.Table sx={{ width: '100%' }}>
          <material_1.TableHead>
            <material_1.TableRow>
              <material_1.TableCell sx={{ width: '55%' }}>
                <material_1.Typography sx={{ fontSize: '14px', fontWeight: '500' }}>Procedure</material_1.Typography>
              </material_1.TableCell>
              <material_1.TableCell sx={{ width: '25%' }}>
                <material_1.Typography sx={{ fontSize: '14px', fontWeight: '500' }}>Dx</material_1.Typography>
              </material_1.TableCell>
              <material_1.TableCell sx={{ width: '20%' }}>
                <material_1.Typography sx={{ fontSize: '14px', fontWeight: '500' }}>Documented by</material_1.Typography>
              </material_1.TableCell>
            </material_1.TableRow>
          </material_1.TableHead>
          <material_1.TableBody>
            {(_a = chartData === null || chartData === void 0 ? void 0 : chartData.procedures) === null || _a === void 0 ? void 0 : _a.map(function (procedure) {
            var _a, _b;
            var documentedDateTime = procedure.documentedDateTime != null ? luxon_1.DateTime.fromISO(procedure.documentedDateTime) : undefined;
            return (<material_1.TableRow sx={{ '&:last-child td': { borderBottom: 0 }, cursor: 'pointer' }} onClick={function () { return onProcedureClick(procedure.resourceId); }} key={procedure.resourceId}>
                  <material_1.TableCell>
                    <system_1.Stack>
                      {(_a = procedure.cptCodes) === null || _a === void 0 ? void 0 : _a.map(function (cptCode) {
                    return (<material_1.Typography sx={{ fontSize: '14px' }} key={cptCode.code}>
                            {cptCode.code}-{cptCode.display}
                          </material_1.Typography>);
                })}
                      <material_1.Typography sx={{ fontSize: '14px', color: '#00000099' }}>{procedure.procedureType}</material_1.Typography>
                    </system_1.Stack>
                  </material_1.TableCell>
                  <material_1.TableCell>
                    <system_1.Stack>
                      {(_b = procedure.diagnoses) === null || _b === void 0 ? void 0 : _b.map(function (diagnosis) {
                    return (<material_1.Typography sx={{ fontSize: '14px' }} key={diagnosis.code}>
                            {diagnosis.code}-{diagnosis.display}
                          </material_1.Typography>);
                })}
                    </system_1.Stack>
                  </material_1.TableCell>
                  <material_1.TableCell>
                    <system_1.Stack>
                      <material_1.Typography sx={{ fontSize: '14px' }}>
                        {documentedDateTime != null ? documentedDateTime.toFormat('MM/dd/yyyy HH:mm a') : undefined}
                      </material_1.Typography>
                      <material_1.Typography sx={{ fontSize: '14px', color: '#00000099' }}>{procedure.documentedBy}</material_1.Typography>
                    </system_1.Stack>
                  </material_1.TableCell>
                </material_1.TableRow>);
        })}
            {(chartData === null || chartData === void 0 ? void 0 : chartData.procedures) == null || (chartData === null || chartData === void 0 ? void 0 : chartData.procedures.length) === 0 ? (<material_1.TableRow sx={{ '&:last-child td': { borderBottom: 0 } }}>
                <material_1.TableCell colSpan={3} align="center">
                  <material_1.Typography sx={{ fontSize: '14px', color: '#00000099' }}>No procedures</material_1.Typography>
                </material_1.TableCell>
              </material_1.TableRow>) : undefined}
          </material_1.TableBody>
        </material_1.Table>
      </telemed_1.AccordionCard>
    </>);
}
//# sourceMappingURL=Procedures.js.map