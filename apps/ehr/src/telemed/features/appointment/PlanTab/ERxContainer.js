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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERxContainer = void 0;
var Add_1 = require("@mui/icons-material/Add");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var system_1 = require("@mui/system");
var notistack_1 = require("notistack");
var react_1 = require("react");
var utils_1 = require("utils");
var RoundedButton_1 = require("../../../../components/RoundedButton");
var useChartData_1 = require("../../../../features/css-module/hooks/useChartData");
var useAppClients_1 = require("../../../../hooks/useAppClients");
var useEvolveUser_1 = require("../../../../hooks/useEvolveUser");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var PageTitle_1 = require("../../../components/PageTitle");
var hooks_1 = require("../../../hooks");
var state_1 = require("../../../state");
var utils_2 = require("../../../utils");
var ERX_1 = require("../ERX");
var getPractitionerName = function (practitioner) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!practitioner) {
        return;
    }
    var givenName = (_d = (_c = (_b = (_a = practitioner === null || practitioner === void 0 ? void 0 : practitioner.name) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.given) === null || _c === void 0 ? void 0 : _c.at(0)) !== null && _d !== void 0 ? _d : '';
    var familyName = (_g = (_f = (_e = practitioner === null || practitioner === void 0 ? void 0 : practitioner.name) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.family) !== null && _g !== void 0 ? _g : '';
    return "".concat(familyName, ", ").concat(givenName).trim();
};
var medicationStatusMapper = {
    loading: {
        background: {
            primary: '#B3E5FC',
        },
        color: {
            primary: '#01579B',
        },
    },
    active: {
        background: {
            primary: '#B3E5FC',
        },
        color: {
            primary: '#01579B',
        },
    },
    'on-hold': {
        background: {
            primary: '#D1C4E9',
        },
        color: {
            primary: '#311B92',
        },
    },
    cancelled: {
        background: {
            primary: '#FFFFFF',
        },
        color: {
            primary: '#616161',
        },
    },
    completed: {
        background: {
            primary: '#C8E6C9',
        },
        color: {
            primary: '#1B5E20',
        },
    },
    'entered-in-error': {
        background: {
            primary: '#FFE0B2',
        },
        color: {
            primary: '#E65100',
        },
    },
    stopped: {
        background: {
            primary: '#FFCCBC',
        },
        color: {
            primary: '#BF360C',
        },
    },
    draft: {
        background: {
            primary: '#FFFFFF',
        },
        color: {
            primary: '#616161',
        },
    },
    unknown: {
        background: {
            primary: '#FFFFFF',
        },
        color: {
            primary: '#616161',
        },
    },
};
var ERxContainer = function (_a) {
    var _b = _a.showHeader, showHeader = _b === void 0 ? true : _b;
    var _c = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'encounter',
        'appointment',
        'setPartialChartData',
        'chartData',
        'patient',
    ]), encounter = _c.encounter, appointment = _c.appointment, setPartialChartData = _c.setPartialChartData, chartData = _c.chartData, patient = _c.patient;
    var isReadOnly = (0, hooks_1.useGetAppointmentAccessibility)().isAppointmentReadOnly;
    var _d = (0, useChartData_1.useChartData)({
        encounterId: encounter.id || '',
        requestedFields: {
            prescribedMedications: {
                _include: 'MedicationRequest:requester',
                _tag: utils_1.ERX_MEDICATION_META_TAG_CODE,
            },
        },
        refetchInterval: 10000,
        onSuccess: function (data) {
            console.log('data', data);
            var prescribedMedications = data.prescribedMedications;
            setPartialChartData({
                prescribedMedications: prescribedMedications,
                practitioners: (data.practitioners || []).reduce(function (prev, curr) {
                    var index = prev.findIndex(function (practitioner) { return practitioner.id === curr.id; });
                    if (index === -1) {
                        prev.push(curr);
                    }
                    else {
                        prev[index] = curr;
                    }
                    return prev;
                }, (chartData === null || chartData === void 0 ? void 0 : chartData.practitioners) || []),
            });
        },
    }), isLoading = _d.isLoading, isFetching = _d.isFetching, refetch = _d.refetch;
    var _e = (0, react_1.useState)(false), isERXOpen = _e[0], setIsERXOpen = _e[1];
    var _f = (0, react_1.useState)(ERX_1.ERXStatus.INITIAL), erxStatus = _f[0], setERXStatus = _f[1];
    var _g = (0, react_1.useState)(false), openTooltip = _g[0], setOpenTooltip = _g[1];
    var _h = (0, react_1.useState)([]), cancellationLoading = _h[0], setCancellationLoading = _h[1];
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var user = (0, useEvolveUser_1.default)();
    var cancelPrescription = function (medRequestId, patientId) { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!oystehr) {
                        (0, notistack_1.enqueueSnackbar)('An error occurred. Please try again.', { variant: 'error' });
                        return [2 /*return*/];
                    }
                    setCancellationLoading(function (prevState) { return __spreadArray(__spreadArray([], prevState, true), [medRequestId], false); });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 6]);
                    return [4 /*yield*/, oystehr.erx.cancelPrescription({ medicationRequestId: medRequestId, patientId: patientId })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 3:
                    error_1 = _a.sent();
                    (0, notistack_1.enqueueSnackbar)('An error occurred while cancelling prescription. Please try again.', { variant: 'error' });
                    console.error("Error cancelling prescription: ".concat(error_1));
                    return [3 /*break*/, 6];
                case 4: return [4 /*yield*/, refetch()];
                case 5:
                    _a.sent();
                    setCancellationLoading(function (prevState) { return prevState.filter(function (item) { return item !== medRequestId; }); });
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var handleCloseTooltip = function () {
        setOpenTooltip(false);
    };
    var handleOpenTooltip = function () {
        setOpenTooltip(true);
    };
    // const handleSetup = (): void => {
    //   window.open('https://docs.oystehr.com/ottehr/setup/prescriptions/', '_blank');
    // };
    var onNewOrderClick = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // await oystehr?.erx.unenrollPractitioner({ practitionerId: user!.profileResource!.id! });
            setIsERXOpen(true);
            return [2 /*return*/];
        });
    }); };
    return (<>
      <system_1.Stack gap={1}>
        <system_1.Stack direction="row" justifyContent="space-between">
          <system_1.Stack direction="row" gap={1} alignItems="center">
            {showHeader && <PageTitle_1.PageTitle label="eRX" showIntakeNotesButton={false}/>}
            {(isLoading || isFetching || cancellationLoading.length > 0) && <material_1.CircularProgress size={16}/>}
          </system_1.Stack>
          <material_1.Tooltip placement="top" title="You don't have the necessary role to access ERX. Please contact your administrator." open={openTooltip && !isReadOnly && !(user === null || user === void 0 ? void 0 : user.hasRole([utils_1.RoleType.Provider]))} onClose={handleCloseTooltip} onOpen={handleOpenTooltip}>
            <system_1.Stack>
              {isERXOpen && erxStatus !== ERX_1.ERXStatus.LOADING ? (<RoundedButton_1.RoundedButton disabled={isReadOnly || !(user === null || user === void 0 ? void 0 : user.hasRole([utils_1.RoleType.Provider]))} variant="contained" onClick={function () {
                setIsERXOpen(false);
            }}>
                  Close eRX
                </RoundedButton_1.RoundedButton>) : (<RoundedButton_1.RoundedButton disabled={isReadOnly || erxStatus === ERX_1.ERXStatus.LOADING || !(user === null || user === void 0 ? void 0 : user.hasRole([utils_1.RoleType.Provider]))} variant="contained" onClick={function () { return onNewOrderClick(); }} startIcon={erxStatus === ERX_1.ERXStatus.LOADING ? <material_1.CircularProgress size={16}/> : <Add_1.default />}>
                  {erxStatus === ERX_1.ERXStatus.LOADING ? 'Loading eRx' : 'Open eRx'}
                </RoundedButton_1.RoundedButton>)}
            </system_1.Stack>
          </material_1.Tooltip>
        </system_1.Stack>
        {/* {!erxEnvVariable && <CompleteConfiguration handleSetup={handleSetup} />} */}
        {isERXOpen && (<ERX_1.ERX onStatusChanged={function (status) {
                if (status === ERX_1.ERXStatus.ERROR) {
                    setIsERXOpen(false);
                }
                setERXStatus(status);
            }} showDefaultAlert={true}/>)}
        <div id="prescribe-dialog" style={{ flex: '1 0 auto', display: 'flex' }}/>

        {(chartData === null || chartData === void 0 ? void 0 : chartData.prescribedMedications) && chartData.prescribedMedications.length > 0 && (<material_1.TableContainer component={material_1.Paper}>
            <material_1.Table>
              <material_1.TableHead sx={{
                '& .MuiTableCell-head': {
                    fontWeight: 700,
                },
            }}>
                <material_1.TableRow>
                  <material_1.TableCell>Medication</material_1.TableCell>
                  <material_1.TableCell>Patient instructions (SIG)</material_1.TableCell>
                  {/*<TableCell>Dx</TableCell>*/}
                  <material_1.TableCell>Visit</material_1.TableCell>
                  <material_1.TableCell>Provider</material_1.TableCell>
                  <material_1.TableCell>Order added</material_1.TableCell>
                  {/*<TableCell>Pharmacy</TableCell>*/}
                  <material_1.TableCell>Status</material_1.TableCell>
                  {!isReadOnly && <material_1.TableCell>Action</material_1.TableCell>}
                </material_1.TableRow>
              </material_1.TableHead>
              <material_1.TableBody>
                {chartData.prescribedMedications.map(function (row) {
                var _a, _b, _c, _d, _e;
                return (<material_1.TableRow key={row.resourceId}>
                    <material_1.TableCell>{row.name}</material_1.TableCell>
                    <material_1.TableCell>{row.instructions}</material_1.TableCell>
                    {/*<TableCell>Dx</TableCell>*/}
                    <material_1.TableCell>
                      {(_b = (_a = (0, utils_1.formatDateToMDYWithTime)(appointment === null || appointment === void 0 ? void 0 : appointment.start)) === null || _a === void 0 ? void 0 : _a.split(' at ')) === null || _b === void 0 ? void 0 : _b.map(function (item) { return (<material_1.Typography variant="body2" key={item}>
                            {item}
                          </material_1.Typography>); })}
                    </material_1.TableCell>
                    <material_1.TableCell>
                      {getPractitionerName((_c = chartData.practitioners) === null || _c === void 0 ? void 0 : _c.find(function (practitioner) { return practitioner.id === row.provider; }))}
                    </material_1.TableCell>
                    <material_1.TableCell>
                      {(_e = (_d = (0, utils_1.formatDateToMDYWithTime)(row.added)) === null || _d === void 0 ? void 0 : _d.split(' at ')) === null || _e === void 0 ? void 0 : _e.map(function (item) { return (<material_1.Typography variant="body2" key={item}>
                            {item}
                          </material_1.Typography>); })}
                    </material_1.TableCell>
                    {/*<TableCell>Pharmacy</TableCell>*/}
                    <material_1.TableCell>{(0, utils_2.getAppointmentStatusChip)(row.status, medicationStatusMapper)}</material_1.TableCell>
                    {!isReadOnly && (patient === null || patient === void 0 ? void 0 : patient.id) && (<material_1.TableCell>
                        <lab_1.LoadingButton loading={cancellationLoading.includes(row.resourceId)} variant="text" color="error" onClick={function () { return cancelPrescription(row.resourceId, patient.id); }} disabled={row.status === 'loading' ||
                            row.status === 'completed' ||
                            row.status === 'cancelled' ||
                            cancellationLoading.includes(row.resourceId)}>
                          Cancel
                        </lab_1.LoadingButton>
                      </material_1.TableCell>)}
                  </material_1.TableRow>);
            })}
              </material_1.TableBody>
            </material_1.Table>
          </material_1.TableContainer>)}
      </system_1.Stack>
    </>);
};
exports.ERxContainer = ERxContainer;
//# sourceMappingURL=ERxContainer.js.map