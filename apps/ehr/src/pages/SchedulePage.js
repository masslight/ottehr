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
exports.getResource = getResource;
exports.default = SchedulePage;
var colors_1 = require("@ehrTheme/colors");
var ContentCopyRounded_1 = require("@mui/icons-material/ContentCopyRounded");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_query_1 = require("react-query");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("utils");
var api_1 = require("../api/api");
var CustomBreadcrumbs_1 = require("../components/CustomBreadcrumbs");
var Loading_1 = require("../components/Loading");
var ScheduleComponent_1 = require("../components/schedule/ScheduleComponent");
var useAppClients_1 = require("../hooks/useAppClients");
var PageContainer_1 = require("../layout/PageContainer");
var INTAKE_URL = import.meta.env.VITE_APP_INTAKE_URL;
function getResource(scheduleType) {
    if (scheduleType === 'location') {
        return 'Location';
    }
    else if (scheduleType === 'provider') {
        return 'Practitioner';
    }
    else if (scheduleType === 'group') {
        return 'HealthcareService';
    }
    console.log("scheduleType unknown ".concat(scheduleType));
    throw new Error('scheduleType unknown');
}
function SchedulePage() {
    var _this = this;
    var _a, _b;
    // Define variables to interact w database and navigate to other pages
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var scheduleType = (0, react_router_dom_1.useParams)()['schedule-type'];
    var ownerId = (0, react_router_dom_1.useParams)()['owner-id'];
    var scheduleId = (0, react_router_dom_1.useParams)()['schedule-id'];
    var createMode = scheduleType !== undefined && ownerId !== undefined;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var queryClient = (0, react_query_1.useQueryClient)();
    // state variables
    var _c = (0, react_1.useState)('schedule'), tabName = _c[0], setTabName = _c[1];
    var _d = (0, react_1.useState)(undefined), item = _d[0], setItem = _d[1];
    var _e = (0, react_1.useState)(false), statusPatchLoading = _e[0], setStatusPatchLoading = _e[1];
    var _f = (0, react_1.useState)(false), isCopied = _f[0], setIsCopied = _f[1];
    // todo: currently these things are props of the schedule owner and get rendered as the content of the "general" tab
    // would like to refactor that tab to be its own Page responsible for displaying the configuration of
    // the underlying fhir resource representing the schedule owner
    var _g = (0, react_1.useState)(undefined), slug = _g[0], setSlug = _g[1];
    var _h = (0, react_1.useState)(utils_1.TIMEZONES[0]), timezone = _h[0], setTimezone = _h[1];
    var defaultIntakeUrl = (function () {
        var fhirType = item === null || item === void 0 ? void 0 : item.owner.type;
        var locationType = (item === null || item === void 0 ? void 0 : item.owner.isVirtual) ? 'virtual' : 'in-person';
        if (slug && fhirType) {
            return "".concat(INTAKE_URL, "/prebook/").concat(locationType, "?bookingOn=").concat(slug, "&scheduleType=").concat((0, utils_1.scheduleTypeFromFHIRType)(fhirType));
        }
        return '';
    })();
    (0, react_1.useEffect)(function () {
        var _a;
        if (item) {
            setTimezone((_a = item === null || item === void 0 ? void 0 : item.owner.timezone) !== null && _a !== void 0 ? _a : utils_1.TIMEZONES[0]);
            setSlug(item === null || item === void 0 ? void 0 : item.owner.slug);
        }
    }, [item]);
    var oystehrZambda = (0, useAppClients_1.useApiClients)().oystehrZambda;
    var queryEnabled = (function () {
        if (!oystehrZambda) {
            return false;
        }
        if (createMode) {
            return true;
        }
        if (!createMode && (0, utils_1.isValidUUID)(scheduleId)) {
            return true;
        }
        return false;
    })();
    var _j = (0, react_query_1.useQuery)(['ehr-get-schedule', { zambdaClient: oystehrZambda, scheduleId: scheduleId, ownerId: ownerId, scheduleType: scheduleType }], function () {
        return oystehrZambda
            ? (0, api_1.getSchedule)({ scheduleId: scheduleId, ownerId: ownerId, ownerType: scheduleType ? getResource(scheduleType) : undefined }, oystehrZambda)
            : null;
    }, {
        onSuccess: function (response) {
            if (response !== null) {
                console.log('schedule response', response);
                setItem(response);
            }
        },
        enabled: queryEnabled,
    }), isLoading = _j.isLoading, isFetching = _j.isFetching, isRefetching = _j.isRefetching;
    var saveScheduleChanges = (0, react_query_1.useMutation)({
        mutationFn: function (params) { return __awaiter(_this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!oystehrZambda) return [3 /*break*/, 2];
                        return [4 /*yield*/, (0, api_1.updateSchedule)(params, oystehrZambda)];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response];
                    case 2: throw new Error('fhir client not defined or patient id not provided');
                }
            });
        }); },
        onError: function (error) {
            if ((0, utils_1.isApiError)(error)) {
                var message = error.message;
                (0, notistack_1.enqueueSnackbar)(message, { variant: 'error' });
            }
            else {
                (0, notistack_1.enqueueSnackbar)('Something went wrong! Schedule changes could not be saved.', { variant: 'error' });
            }
        },
        onSuccess: function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, queryClient.invalidateQueries(['ehr-get-schedule'])];
                    case 1:
                        _a.sent();
                        (0, notistack_1.enqueueSnackbar)('Schedule changes saved successfully!', { variant: 'success' });
                        return [2 /*return*/];
                }
            });
        }); },
    });
    var createNewSchedule = (0, react_query_1.useMutation)({
        mutationFn: function (params) { return __awaiter(_this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!oystehrZambda) return [3 /*break*/, 2];
                        return [4 /*yield*/, (0, api_1.createSchedule)(params, oystehrZambda)];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response];
                    case 2: throw new Error('fhir client not defined or patient id not provided');
                }
            });
        }); },
        onError: function (error) {
            if ((0, utils_1.isApiError)(error)) {
                var message = error.message;
                (0, notistack_1.enqueueSnackbar)(message, { variant: 'error' });
            }
            else {
                (0, notistack_1.enqueueSnackbar)('Something went wrong! Schedule could not be created.', { variant: 'error' });
            }
        },
        onSuccess: function (newSchedule) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                navigate("/schedule/id/".concat(newSchedule.id));
                (0, notistack_1.enqueueSnackbar)('Schedule added successfully!', { variant: 'success' });
                return [2 /*return*/];
            });
        }); },
    });
    var somethingIsLoadingInSomeWay = isLoading || isFetching || isRefetching || saveScheduleChanges.isLoading;
    // console.log('scheduleFetchState (loading/fetching/error/success): ', isLoading, isFetching, isError, isSuccess);
    // handle functions
    var handleTabChange = function (event, newTabName) {
        setTabName(newTabName);
    };
    function onSaveSchedule(params) {
        return __awaiter(this, void 0, void 0, function () {
            var ownerResourceType, createParams;
            return __generator(this, function (_a) {
                if (!oystehrZambda) {
                    console.log('oystehr client is not defined');
                    return [2 /*return*/];
                }
                if (createMode && scheduleType) {
                    ownerResourceType = getResource(scheduleType);
                    if (!ownerId || !ownerResourceType || !params.schedule) {
                        (0, notistack_1.enqueueSnackbar)('Schedule could not be created. Please reload the page and try again.', { variant: 'error' });
                        return [2 /*return*/];
                    }
                    console.log('ownerId', ownerId, ownerResourceType);
                    createParams = __assign(__assign({}, params), { ownerId: ownerId, ownerType: ownerResourceType });
                    createNewSchedule.mutate(__assign({}, createParams));
                }
                else {
                    saveScheduleChanges.mutate(__assign({}, params));
                }
                return [2 /*return*/];
            });
        });
    }
    var setActiveStatus = function (isActive) { return __awaiter(_this, void 0, void 0, function () {
        var value, patched, newActiveStatus, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!oystehr || !(item === null || item === void 0 ? void 0 : item.id)) {
                        (0, notistack_1.enqueueSnackbar)('Oops. Something went wrong. Please reload the page and try again.', { variant: 'error' });
                        return [2 /*return*/];
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, 5, 6]);
                    setStatusPatchLoading(true);
                    value = item.owner.type === 'Location' ? (isActive ? 'active' : 'inactive') : isActive;
                    return [4 /*yield*/, oystehr.fhir.patch({
                            resourceType: item.owner.type,
                            id: item.owner.id,
                            operations: [
                                {
                                    path: item.owner.type === 'Location' ? '/status' : '/active',
                                    op: 'add',
                                    value: value,
                                },
                            ],
                        })];
                case 2:
                    patched = _b.sent();
                    newActiveStatus = isActive;
                    if (patched.resourceType === 'Location') {
                        newActiveStatus = patched.status === 'active';
                    }
                    else {
                        newActiveStatus = patched.active === true;
                    }
                    return [4 /*yield*/, saveGeneralFields()];
                case 3:
                    _b.sent();
                    setItem(__assign(__assign({}, item), { owner: __assign(__assign({}, item.owner), { active: newActiveStatus }) }));
                    return [3 /*break*/, 6];
                case 4:
                    _a = _b.sent();
                    (0, notistack_1.enqueueSnackbar)('Oops. Something went wrong. Status update was not saved.', { variant: 'error' });
                    return [3 /*break*/, 6];
                case 5:
                    setStatusPatchLoading(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var saveGeneralFields = function (_event) { return __awaiter(_this, void 0, void 0, function () {
        var params;
        return __generator(this, function (_a) {
            if (!oystehr || !(item === null || item === void 0 ? void 0 : item.id)) {
                (0, notistack_1.enqueueSnackbar)('Oops. Something went wrong. Please reload the page and try again.', { variant: 'error' });
                return [2 /*return*/];
            }
            params = {
                scheduleId: item.id,
                timezone: timezone,
                slug: slug,
            };
            saveScheduleChanges.mutate(__assign({}, params));
            return [2 /*return*/];
        });
    }); };
    return (<PageContainer_1.default>
      <>
        {item ? (<material_1.Box>
            {/* Breadcrumbs */}
            <CustomBreadcrumbs_1.default chain={[
                { link: '/schedules', state: { defaultTab: scheduleType }, children: 'Schedules' },
                { link: '#', children: ((_a = item === null || item === void 0 ? void 0 : item.owner) === null || _a === void 0 ? void 0 : _a.name) || <material_1.Skeleton width={150}/> },
            ]}/>

            {/* Page title */}
            <material_1.Typography variant="h3" color="primary.dark" marginTop={1}>
              {((_b = item === null || item === void 0 ? void 0 : item.owner) === null || _b === void 0 ? void 0 : _b.name) || <material_1.Skeleton width={150}/>}
            </material_1.Typography>
            {/* Address line */}
            {(item === null || item === void 0 ? void 0 : item.owner.detailText) && (<material_1.Typography marginBottom={1} fontWeight={400}>
                {item.owner.detailText}
              </material_1.Typography>)}
            {/* Tabs */}
            <lab_1.TabContext value={tabName}>
              <material_1.Box sx={{ borderBottom: 1, borderColor: 'divider', display: createMode ? 'none' : 'block' }}>
                <lab_1.TabList onChange={handleTabChange} aria-label="Tabs">
                  <material_1.Tab label="Schedule" value="schedule" sx={{ textTransform: 'none', fontWeight: 700 }}/>
                  <material_1.Tab label="General" value="general" sx={{ textTransform: 'none', fontWeight: 700 }}/>
                </lab_1.TabList>
              </material_1.Box>
              {/* Page Content */}
              {/* Time slots tab */}
              <material_1.Paper sx={{
                marginTop: 2,
                border: 'none',
                boxShadow: 'none',
                background: 'none',
            }}>
                <lab_1.TabPanel value="schedule" sx={{ padding: 0 }}>
                  {(scheduleId || createMode) && (<ScheduleComponent_1.default id={scheduleId || 'new'} item={item} loading={somethingIsLoadingInSomeWay} update={onSaveSchedule} hideOverrides={createMode}/>)}
                </lab_1.TabPanel>
                {/* General tab */}
                <lab_1.TabPanel value="general">
                  <material_1.Paper sx={{ marginBottom: 2, padding: 3 }}>
                    <material_1.Box display={'flex'} alignItems={'center'}>
                      <material_1.Switch checked={item.owner.active} onClick={function () { return setActiveStatus(!item.owner.active); }} disabled={statusPatchLoading}/>
                      {statusPatchLoading ? (<material_1.CircularProgress size={24} color="inherit"/>) : (<material_1.Typography>{item.owner.active ? 'Active' : 'Inactive'}</material_1.Typography>)}
                    </material_1.Box>
                    <hr />
                    <br />

                    <form onSubmit={function (e) {
                e.preventDefault();
                void saveGeneralFields(e);
            }}>
                      <material_1.TextField label="Slug" value={slug} onChange={function (event) { return setSlug(event.target.value); }} sx={{ width: '250px' }}/>
                      <br />

                      <material_1.Typography variant="body2" sx={{ pt: 1, pb: 0.5, fontWeight: 600 }}>
                        Share booking link to this schedule:
                      </material_1.Typography>
                      <material_1.Box sx={{ display: defaultIntakeUrl ? 'flex' : 'none', alignItems: 'center', gap: 0.5, mb: 3 }}>
                        <material_1.Tooltip title={isCopied ? 'Link copied!' : 'Copy link'} placement="top" arrow onClose={function () {
                setTimeout(function () {
                    setIsCopied(false);
                }, 200);
            }}>
                          <material_1.Button onClick={function () {
                void navigator.clipboard.writeText(defaultIntakeUrl);
                setIsCopied(true);
            }} sx={{ p: 0, minWidth: 0 }}>
                            <ContentCopyRounded_1.default fontSize="small"/>
                          </material_1.Button>
                        </material_1.Tooltip>
                        <react_router_dom_1.Link to={defaultIntakeUrl} target="_blank">
                          <material_1.Typography variant="body2">{defaultIntakeUrl}</material_1.Typography>
                        </react_router_dom_1.Link>
                      </material_1.Box>
                      <material_1.Autocomplete options={utils_1.TIMEZONES} renderInput={function (params) { return <material_1.TextField {...params} label="Timezone"/>; }} sx={{ marginTop: 2, width: '250px' }} value={timezone} onChange={function (_event, newValue) {
                if (newValue) {
                    setTimezone(newValue);
                }
            }}/>
                      <br />
                      <lab_1.LoadingButton type="submit" loading={somethingIsLoadingInSomeWay} variant="contained" sx={{ marginTop: 2 }}>
                        Save
                      </lab_1.LoadingButton>
                    </form>
                  </material_1.Paper>
                  <material_1.Paper sx={{ padding: 3 }}>
                    <material_1.Grid container direction="row" justifyContent="flex-start" alignItems="flex-start">
                      <material_1.Grid item xs={6}>
                        <material_1.Typography variant="h4" color={'primary.dark'}>
                          Information to the patients
                        </material_1.Typography>
                        <material_1.Typography variant="body1" color="primary.dark" marginTop={1}>
                          This message will be displayed to the patients before they proceed with booking the visit.
                        </material_1.Typography>
                        <material_1.Box marginTop={2} sx={{
                background: colors_1.otherColors.locationGeneralBlue,
                borderRadius: 1,
            }} padding={3}>
                          <material_1.Typography color="primary.dark" variant="body1">
                            No description
                          </material_1.Typography>
                        </material_1.Box>
                      </material_1.Grid>
                    </material_1.Grid>
                  </material_1.Paper>
                </lab_1.TabPanel>
              </material_1.Paper>
            </lab_1.TabContext>
          </material_1.Box>) : (<Loading_1.default />)}
      </>
    </PageContainer_1.default>);
}
//# sourceMappingURL=SchedulePage.js.map