"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PatientFollowup;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var useAppClients_1 = require("../../hooks/useAppClients");
var useGetPatient_1 = require("../../hooks/useGetPatient");
var PageContainer_1 = require("../../layout/PageContainer");
var CustomBreadcrumbs_1 = require("../CustomBreadcrumbs");
var PatientFollowupEncountersGrid_1 = require("./PatientFollowupEncountersGrid");
var PatientFollowupForm_1 = require("./PatientFollowupForm");
function PatientFollowup() {
    var _this = this;
    var _a = (0, react_router_dom_1.useParams)(), id = _a.id, encounterId = _a.encounterId;
    var patient = (0, useGetPatient_1.useGetPatient)(id).patient;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var _b = (0, react_1.useState)(undefined), followupDetails = _b[0], setFollowupDetails = _b[1];
    var _c = (0, react_1.useState)(undefined), followupStatus = _c[0], setFollowupStatus = _c[1];
    var fullName = patient ? (0, utils_1.getFullName)(patient) : '';
    (0, react_1.useEffect)(function () {
        var getAndSetEncounterDetails = function (oystehr, encounterId, patientId) { return __awaiter(_this, void 0, void 0, function () {
            var fhirResources, fhirEncounter, fhirLocation, formatted;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, oystehr.fhir.search({
                            resourceType: 'Encounter',
                            params: [
                                {
                                    name: '_id',
                                    value: encounterId,
                                },
                                {
                                    name: '_include',
                                    value: 'Encounter:location',
                                },
                            ],
                        })];
                    case 1:
                        fhirResources = (_a.sent()).unbundle();
                        fhirEncounter = fhirResources.find(function (resource) { return resource.resourceType === 'Encounter'; });
                        fhirLocation = fhirResources.find(function (resource) { return resource.resourceType === 'Location'; });
                        formatted = (0, utils_1.formatFhirEncounterToPatientFollowupDetails)(fhirEncounter, patientId, fhirLocation);
                        setFollowupDetails(formatted);
                        setFollowupStatus((formatted === null || formatted === void 0 ? void 0 : formatted.resolved) ? 'RESOLVED' : 'OPEN');
                        return [2 /*return*/];
                }
            });
        }); };
        if (encounterId && oystehr && (patient === null || patient === void 0 ? void 0 : patient.id)) {
            void getAndSetEncounterDetails(oystehr, encounterId, patient.id);
        }
    }, [encounterId, oystehr, patient === null || patient === void 0 ? void 0 : patient.id]);
    return (<PageContainer_1.default>
      <material_1.Grid container direction="row">
        <material_1.Grid item xs={3.5}/>
        <material_1.Grid item xs={5}>
          {!followupStatus || !followupDetails || !patient ? (<material_1.Box sx={{ justifyContent: 'left' }}>
              <material_1.CircularProgress />
            </material_1.Box>) : (<>
              <CustomBreadcrumbs_1.default chain={[
                { link: '/patients', children: 'Patients' },
                {
                    link: "/patient/".concat(id),
                    children: fullName,
                },
                {
                    link: '#',
                    children: 'Patient Follow-up',
                },
            ]}/>
              <material_1.Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 2,
                marginBottom: 2,
            }}>
                <material_1.Typography variant="h3" marginTop={1} color={'primary.dark'}>
                  Patient Follow-up
                </material_1.Typography>
                {(0, PatientFollowupEncountersGrid_1.getFollowupStatusChip)(followupStatus)}
              </material_1.Box>
              <PatientFollowupForm_1.default patient={patient} followupDetails={followupDetails} followupStatus={followupStatus} setFollowupStatus={setFollowupStatus}></PatientFollowupForm_1.default>
            </>)}
        </material_1.Grid>
        <material_1.Grid item xs={3.5}/>
      </material_1.Grid>
    </PageContainer_1.default>);
}
//# sourceMappingURL=PatientFollowup.js.map