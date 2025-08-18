"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.default = EditEmployeePage;
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var api_1 = require("../api/api");
var CustomBreadcrumbs_1 = require("../components/CustomBreadcrumbs");
var EmployeeInformation_1 = require("../components/EmployeeInformation");
var data_test_ids_1 = require("../constants/data-test-ids");
var checkUserIsActive_1 = require("../helpers/checkUserIsActive");
var useAppClients_1 = require("../hooks/useAppClients");
var PageContainer_1 = require("../layout/PageContainer");
function EditEmployeePage() {
    var _this = this;
    var _a;
    var _b = (0, useAppClients_1.useApiClients)(), oystehr = _b.oystehr, oystehrZambda = _b.oystehrZambda;
    var _c = (0, react_1.useState)(), isActive = _c[0], setIsActive = _c[1];
    var _d = (0, react_1.useState)(), user = _d[0], setUser = _d[1];
    var _e = (0, react_1.useState)(undefined), scheduleId = _e[0], setScheduleId = _e[1];
    var _f = (0, react_1.useState)(false), loading = _f[0], setLoading = _f[1];
    var _g = (0, react_1.useState)({ submit: '' }), errors = _g[0], setErrors = _g[1];
    var userLicenses = (0, react_1.useMemo)(function () {
        var _a;
        if ((_a = user === null || user === void 0 ? void 0 : user.profileResource) === null || _a === void 0 ? void 0 : _a.qualification) {
            return (0, utils_1.allLicensesForPractitioner)(user.profileResource);
        }
        return [];
    }, [user]);
    // get the user id from the url
    var id = (0, react_router_dom_1.useParams)().id;
    // get the user from the database, wait for the response before continuing
    (0, react_1.useEffect)(function () {
        var loading = false;
        function getUser() {
            return __awaiter(this, void 0, void 0, function () {
                var res, appUser, userScheduleId;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!oystehr) {
                                throw new Error('Oystehr client is undefined');
                            }
                            if (!oystehrZambda) {
                                throw new Error('Zambda Client not found');
                            }
                            if (!(id && !loading)) return [3 /*break*/, 2];
                            loading = true;
                            return [4 /*yield*/, (0, api_1.getUserDetails)(oystehrZambda, {
                                    userId: id,
                                })];
                        case 1:
                            res = _a.sent();
                            if (loading) {
                                appUser = res.user, userScheduleId = res.userScheduleId;
                                setScheduleId(userScheduleId);
                                setUser(appUser);
                                setIsActive((0, checkUserIsActive_1.checkUserIsActive)(appUser));
                                loading = false;
                            }
                            _a.label = 2;
                        case 2: return [2 /*return*/];
                    }
                });
            });
        }
        if (!loading) {
            getUser().catch(function (error) { return console.log(error); });
        }
        return function () {
            loading = false;
        };
    }, [oystehr, id, oystehrZambda]);
    function getUserAndUpdatePage() {
        return __awaiter(this, void 0, void 0, function () {
            var userDetailsTemp, userTemp;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!oystehrZambda) {
                            throw new Error('oystehrZambda is not defined');
                        }
                        return [4 /*yield*/, (0, api_1.getUserDetails)(oystehrZambda, {
                                userId: id,
                            })];
                    case 1:
                        userDetailsTemp = _a.sent();
                        userTemp = userDetailsTemp.user;
                        setUser(userTemp);
                        setIsActive((0, checkUserIsActive_1.checkUserIsActive)(userTemp));
                        return [2 /*return*/];
                }
            });
        });
    }
    var handleUserActivation = function (mode) { return __awaiter(_this, void 0, void 0, function () {
        var _a, errorString_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    setLoading(true);
                    if (!oystehrZambda) {
                        throw new Error('Zambda Client not found');
                    }
                    setErrors({ submit: '' });
                    if (!(user === null || user === void 0 ? void 0 : user.id)) {
                        throw new Error('User ID is undefined');
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, (0, api_1.userActivation)(oystehrZambda, { userId: user.id, mode: mode })];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, getUserAndUpdatePage()];
                case 3:
                    _b.sent();
                    (0, notistack_1.enqueueSnackbar)("User was ".concat(mode, "d successfully"), {
                        variant: 'success',
                    });
                    return [3 /*break*/, 6];
                case 4:
                    _a = _b.sent();
                    errorString_1 = "Failed to ".concat(mode, " user. Please try again");
                    setErrors(function (prev) { return (__assign(__assign({}, prev), { submit: "".concat(errorString_1) })); });
                    (0, notistack_1.enqueueSnackbar)("".concat(errorString_1), {
                        variant: 'error',
                    });
                    return [3 /*break*/, 6];
                case 5:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    return (<PageContainer_1.default tabTitle={'Edit Employee'}>
      <>
        <material_1.Grid container direction="row" alignItems="center" justifyContent="center">
          <material_1.Grid item maxWidth={'584px'} width={'100%'}>
            {/* Breadcrumbs */}
            <CustomBreadcrumbs_1.default chain={[
            { link: '/employees', children: 'Employees' },
            { link: '#', children: (user === null || user === void 0 ? void 0 : user.name) || <material_1.Skeleton width={150}/> },
        ]}/>

            {/* Page Title */}
            <material_1.Typography variant="h3" color="primary.dark" marginTop={2} sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', fontWeight: '600 !important' }}>
              {(user === null || user === void 0 ? void 0 : user.name) || <material_1.Skeleton width={250}/>}
              {isActive !== undefined && !isActive && (<material_1.Chip label="Deactivated" color="error" size="small" sx={{ marginLeft: 3 }}/>)}
            </material_1.Typography>
            <material_1.Typography variant="body1" my={2}>
              {(user === null || user === void 0 ? void 0 : user.email) || <material_1.Skeleton width={250}/>}
            </material_1.Typography>

            {/* Page Content */}
            <material_1.Box>
              {user && (<EmployeeInformation_1.default submitLabel="Save changes" existingUser={user} isActive={isActive} licenses={userLicenses} getUserAndUpdatePage={getUserAndUpdatePage}/>)}

              {isActive && (<material_1.Paper sx={{ padding: 3, marginTop: 3 }}>
                  <material_1.Typography variant="h4" color="primary.dark" sx={{ fontWeight: '600 !important' }}>
                    Provider schedule
                  </material_1.Typography>
                  {scheduleId ? (<react_router_dom_1.Link to={"/schedule/id/".concat(scheduleId)}>
                      <material_1.Button variant="contained" sx={{ marginTop: 1 }}>
                        Edit schedule
                      </material_1.Button>
                    </react_router_dom_1.Link>) : (<react_router_dom_1.Link to={"/schedule/new/provider/".concat((_a = user === null || user === void 0 ? void 0 : user.profileResource) === null || _a === void 0 ? void 0 : _a.id)}>
                      <material_1.Button variant="contained" sx={{ marginTop: 1 }}>
                        Create schedule
                      </material_1.Button>
                    </react_router_dom_1.Link>)}
                </material_1.Paper>)}

              {/* Activate or Deactivate Profile */}
              {isActive === undefined ? (<material_1.Skeleton height={300} sx={{ marginTop: -8 }}/>) : (<material_1.Paper sx={{ padding: 3, marginTop: 3 }}>
                  <material_1.Typography variant="h4" color="primary.dark" sx={{ fontWeight: '600 !important' }}>
                    {isActive ? 'Deactivate profile' : 'Activate profile'}
                  </material_1.Typography>
                  <material_1.Typography variant="body1" marginTop={1}>
                    {isActive
                ? 'When you deactivate this account, this employee will not have access to the system anymore.'
                : 'Activate this user account. This will immediately give the user the Staff role.'}
                  </material_1.Typography>

                  {/* Error on submit if request fails */}
                  {errors.submit && (<material_1.Typography color="error" variant="body2" mt={1}>
                      {errors.submit}
                    </material_1.Typography>)}

                  <lab_1.LoadingButton variant="contained" color={isActive ? 'error' : 'primary'} data-testid={data_test_ids_1.dataTestIds.employeesPage.deactivateUserButton} sx={{
                textTransform: 'none',
                borderRadius: 28,
                marginTop: 4,
                fontWeight: 'bold',
                marginRight: 1,
            }} loading={loading} onClick={isActive ? function () { return handleUserActivation('deactivate'); } : function () { return handleUserActivation('activate'); }}>
                    {isActive ? 'Deactivate' : 'Activate'}
                  </lab_1.LoadingButton>
                </material_1.Paper>)}
            </material_1.Box>
          </material_1.Grid>
        </material_1.Grid>
      </>
    </PageContainer_1.default>);
}
//# sourceMappingURL=EditEmployee.js.map