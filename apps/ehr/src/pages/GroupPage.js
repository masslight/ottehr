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
exports.default = GroupPage;
var ContentCopyRounded_1 = require("@mui/icons-material/ContentCopyRounded");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var CustomBreadcrumbs_1 = require("src/components/CustomBreadcrumbs");
var utils_1 = require("utils");
var GroupMembers_1 = require("../components/schedule/GroupMembers");
var useAppClients_1 = require("../hooks/useAppClients");
var PageContainer_1 = require("../layout/PageContainer");
var INTAKE_URL = import.meta.env.VITE_APP_INTAKE_URL;
function GroupPage() {
    return (<PageContainer_1.default>
      <GroupPageContent />
    </PageContainer_1.default>);
}
function GroupPageContent() {
    var _this = this;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var groupID = (0, react_router_dom_1.useParams)()['group-id'];
    var _a = (0, react_1.useState)(undefined), group = _a[0], setGroup = _a[1];
    var _b = (0, react_1.useState)(false), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(undefined), locations = _c[0], setLocations = _c[1];
    var _d = (0, react_1.useState)(undefined), practitioners = _d[0], setPractitioners = _d[1];
    var _e = (0, react_1.useState)(undefined), practitionerRoles = _e[0], setPractitionerRoles = _e[1];
    var _f = (0, react_1.useState)(undefined), selectedLocations = _f[0], setSelectedLocations = _f[1];
    var _g = (0, react_1.useState)(undefined), selectedPractitioners = _g[0], setSelectedPractitioners = _g[1];
    var _h = (0, react_1.useState)(''), slug = _h[0], setSlug = _h[1];
    var _j = (0, react_1.useState)(false), linkIsCopied = _j[0], setLinkIsCopied = _j[1];
    var defaultIntakeUrl = (function () {
        if (slug) {
            return "".concat(INTAKE_URL, "/prebook/in-person?bookingOn=").concat(slug, "&scheduleType=group");
        }
        return '';
    })();
    var getOptions = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var request, groupTemp, locationsTemp, practitionerResources, practitionersTemp, practitionerRolesTemp, selectedLocationsTemp, selectedPractitionerRolesTemp, selectedPractitionersTemp;
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    if (!oystehr) {
                        console.log('oystehr client is not defined');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, oystehr.fhir.batch({
                            requests: [
                                {
                                    method: 'GET',
                                    url: "/HealthcareService?_id=".concat(groupID),
                                },
                                {
                                    method: 'GET',
                                    url: '/Location',
                                },
                                {
                                    method: 'GET',
                                    url: '/Practitioner?_revinclude=PractitionerRole:practitioner',
                                },
                            ],
                        })];
                case 1:
                    request = _j.sent();
                    groupTemp = ((_b = (_a = request === null || request === void 0 ? void 0 : request.entry) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.resource).entry.map(function (resourceTemp) { return resourceTemp.resource; })[0];
                    locationsTemp = ((_d = (_c = request === null || request === void 0 ? void 0 : request.entry) === null || _c === void 0 ? void 0 : _c[1]) === null || _d === void 0 ? void 0 : _d.resource).entry.map(function (resourceTemp) { return resourceTemp.resource; });
                    practitionerResources = ((_f = (_e = request === null || request === void 0 ? void 0 : request.entry) === null || _e === void 0 ? void 0 : _e[2]) === null || _f === void 0 ? void 0 : _f.resource).entry.map(function (resourceTemp) { return resourceTemp.resource; });
                    practitionersTemp = practitionerResources.filter(function (resourceTemp) { return resourceTemp.resourceType === 'Practitioner'; });
                    practitionerRolesTemp = practitionerResources.filter(function (resourceTemp) { return resourceTemp.resourceType === 'PractitionerRole'; });
                    console.log(request);
                    setGroup(groupTemp);
                    setSlug((_g = (0, utils_1.getSlugForBookableResource)(groupTemp)) !== null && _g !== void 0 ? _g : '');
                    setLocations(locationsTemp);
                    setPractitioners(practitionersTemp);
                    setPractitionerRoles(practitionerRolesTemp);
                    selectedLocationsTemp = (_h = groupTemp.location) === null || _h === void 0 ? void 0 : _h.map(function (location) {
                        var _a;
                        if (!location.reference) {
                            console.log('HealthcareService location does not have reference', location);
                            throw new Error('HealthcareService location does not have reference');
                        }
                        return (_a = location.reference) === null || _a === void 0 ? void 0 : _a.replace('Location/', '');
                    });
                    setSelectedLocations(selectedLocationsTemp);
                    selectedPractitionerRolesTemp = practitionerRolesTemp === null || practitionerRolesTemp === void 0 ? void 0 : practitionerRolesTemp.filter(function (practitionerRoleTemp) {
                        var _a;
                        return (_a = practitionerRoleTemp.healthcareService) === null || _a === void 0 ? void 0 : _a.some(function (healthcareServiceTemp) { return healthcareServiceTemp.reference === "HealthcareService/".concat(groupTemp.id); });
                    });
                    selectedPractitionersTemp = practitionersTemp.filter(function (practitionerTemp) {
                        return selectedPractitionerRolesTemp.some(function (selectedPractitionerRoleTemp) { var _a; return ((_a = selectedPractitionerRoleTemp.practitioner) === null || _a === void 0 ? void 0 : _a.reference) === "Practitioner/".concat(practitionerTemp.id); });
                    });
                    setSelectedPractitioners(selectedPractitionersTemp.map(function (practitionerTemp) { return practitionerTemp.id || ''; }));
                    return [2 /*return*/];
            }
        });
    }); }, [oystehr, groupID]);
    (0, react_1.useEffect)(function () {
        void getOptions();
    }, [getOptions]);
    function onSubmit(event) {
        return __awaiter(this, void 0, void 0, function () {
            var practitionerRolePractitionerIDs_1, practitionerIDToCreatePractitionerRoles, practitionerIDToAddHealthcareServicePractitionerRoles, practitionerIDToRemoveHealthcareServicePractitionerRoles, practitionerRolesResourcesToCreate, patchOperations, currentSlug, newIdentifierList, healthcareServicePatchRequest, practitionerRolesResourceCreateRequests, practitionerRolesResourcePatchRequests, error_1;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 3, 4, 5]);
                        event.preventDefault();
                        if (!oystehr) {
                            console.log('oystehr client is not defined');
                            return [2 /*return*/];
                        }
                        if (!selectedPractitioners || !practitionerRoles) {
                            return [2 /*return*/];
                        }
                        setLoading(true);
                        practitionerRolePractitionerIDs_1 = practitionerRoles === null || practitionerRoles === void 0 ? void 0 : practitionerRoles.map(function (practitionerRoleTemp) { var _a; return (_a = practitionerRoleTemp.practitioner) === null || _a === void 0 ? void 0 : _a.reference; });
                        practitionerIDToCreatePractitionerRoles = selectedPractitioners.filter(function (selectedPractitionerTemp) {
                            return !(practitionerRolePractitionerIDs_1 === null || practitionerRolePractitionerIDs_1 === void 0 ? void 0 : practitionerRolePractitionerIDs_1.includes("Practitioner/".concat(selectedPractitionerTemp)));
                        });
                        practitionerIDToAddHealthcareServicePractitionerRoles = practitionerRoles.filter(function (practitionerRoleTemp) {
                            var _a, _b, _c;
                            return selectedPractitioners.includes(((_b = (_a = practitionerRoleTemp.practitioner) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.replace('Practitioner/', '')) || '') &&
                                !((_c = practitionerRoleTemp.healthcareService) === null || _c === void 0 ? void 0 : _c.some(function (healthcareServiceTemp) { return healthcareServiceTemp.reference === "HealthcareService/".concat(groupID); }));
                        });
                        practitionerIDToRemoveHealthcareServicePractitionerRoles = practitionerRoles.filter(function (practitionerRoleTemp) {
                            var _a, _b, _c;
                            return !selectedPractitioners.includes(((_b = (_a = practitionerRoleTemp.practitioner) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.replace('Practitioner/', '')) || '') &&
                                ((_c = practitionerRoleTemp.healthcareService) === null || _c === void 0 ? void 0 : _c.some(function (healthcareServiceTemp) { return healthcareServiceTemp.reference === "HealthcareService/".concat(groupID); }));
                        });
                        practitionerRolesResourcesToCreate = practitionerIDToCreatePractitionerRoles === null || practitionerIDToCreatePractitionerRoles === void 0 ? void 0 : practitionerIDToCreatePractitionerRoles.map(function (practitionerID) { return ({
                            resourceType: 'PractitionerRole',
                            practitioner: {
                                reference: "Practitioner/".concat(practitionerID),
                            },
                            healthcareService: [
                                {
                                    reference: "HealthcareService/".concat(groupID),
                                },
                            ],
                        }); });
                        patchOperations = [];
                        patchOperations.push({
                            op: (group === null || group === void 0 ? void 0 : group.location) ? 'replace' : 'add',
                            path: '/location',
                            value: (_a = selectedLocations === null || selectedLocations === void 0 ? void 0 : selectedLocations.map(function (selectedLocationTemp) { return ({
                                reference: "Location/".concat(selectedLocationTemp),
                            }); })) !== null && _a !== void 0 ? _a : [],
                        });
                        currentSlug = group ? (_b = (0, utils_1.getSlugForBookableResource)(group)) !== null && _b !== void 0 ? _b : '' : '';
                        if (group && slug !== currentSlug) {
                            newIdentifierList = ((_c = group.identifier) === null || _c === void 0 ? void 0 : _c.filter(function (identifier) { return identifier.system !== utils_1.SLUG_SYSTEM; })) || [];
                            if (slug) {
                                newIdentifierList.push({
                                    system: utils_1.SLUG_SYSTEM,
                                    value: slug,
                                });
                            }
                            patchOperations.push({
                                op: group.identifier === undefined ? 'add' : 'replace',
                                path: '/identifier',
                                value: newIdentifierList,
                            });
                        }
                        healthcareServicePatchRequest = (0, utils_1.getPatchBinary)({
                            resourceType: 'HealthcareService',
                            resourceId: groupID,
                            patchOperations: patchOperations,
                        });
                        practitionerRolesResourceCreateRequests = practitionerRolesResourcesToCreate.map(function (practitionerRoleResourceToCreateTemp) { return ({
                            method: 'POST',
                            url: '/PractitionerRole',
                            resource: practitionerRoleResourceToCreateTemp,
                        }); });
                        practitionerRolesResourcePatchRequests = practitionerIDToAddHealthcareServicePractitionerRoles.map(function (practitionerIDToAddHealthcareServicePractitionerRoleTemp) {
                            var practitionerRole = practitionerRoles === null || practitionerRoles === void 0 ? void 0 : practitionerRoles.find(function (practitionerRoleTemp) {
                                return practitionerRoleTemp === practitionerIDToAddHealthcareServicePractitionerRoleTemp;
                            });
                            var value = {
                                reference: "HealthcareService/".concat(groupID),
                            };
                            if (!(practitionerRole === null || practitionerRole === void 0 ? void 0 : practitionerRole.healthcareService)) {
                                value = [value];
                            }
                            return (0, utils_1.getPatchBinary)({
                                resourceType: 'PractitionerRole',
                                resourceId: practitionerIDToAddHealthcareServicePractitionerRoleTemp.id || '',
                                patchOperations: [
                                    {
                                        op: 'add',
                                        path: (practitionerRole === null || practitionerRole === void 0 ? void 0 : practitionerRole.healthcareService) ? '/healthcareService/-' : '/healthcareService',
                                        value: value,
                                    },
                                ],
                            });
                        });
                        practitionerRolesResourcePatchRequests.push.apply(practitionerRolesResourcePatchRequests, practitionerIDToRemoveHealthcareServicePractitionerRoles.map(function (practitionerIDToRemoveHealthcareServicePractitionerRoleTemp) {
                            var _a, _b;
                            return (0, utils_1.getPatchBinary)({
                                resourceType: 'PractitionerRole',
                                resourceId: practitionerIDToRemoveHealthcareServicePractitionerRoleTemp.id || '',
                                patchOperations: [
                                    {
                                        op: 'replace',
                                        path: '/healthcareService',
                                        value: (_b = (_a = practitionerRoles === null || practitionerRoles === void 0 ? void 0 : practitionerRoles.find(function (practitionerRoleTemp) {
                                            return practitionerRoleTemp === practitionerIDToRemoveHealthcareServicePractitionerRoleTemp;
                                        })) === null || _a === void 0 ? void 0 : _a.healthcareService) === null || _b === void 0 ? void 0 : _b.filter(function (locationTemp) { return locationTemp.reference !== "HealthcareService/".concat(groupID); }),
                                    },
                                ],
                            });
                        }));
                        return [4 /*yield*/, oystehr.fhir.transaction({
                                requests: __spreadArray(__spreadArray(__spreadArray([], practitionerRolesResourceCreateRequests, true), practitionerRolesResourcePatchRequests, true), [
                                    healthcareServicePatchRequest,
                                ], false),
                            })];
                    case 1:
                        _d.sent();
                        (0, notistack_1.enqueueSnackbar)('Group schedule saved successfully!', { variant: 'success' });
                        return [4 /*yield*/, getOptions()];
                    case 2:
                        _d.sent();
                        return [3 /*break*/, 5];
                    case 3:
                        error_1 = _d.sent();
                        (0, notistack_1.enqueueSnackbar)('Failed to save group schedule.', { variant: 'error' });
                        console.error('Error saving group schedule:', error_1);
                        return [3 /*break*/, 5];
                    case 4:
                        setLoading(false);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    if (!group) {
        return (<div style={{ width: '100%', height: '250px' }}>
        <material_1.CircularProgress />
      </div>);
    }
    return (<>
      <CustomBreadcrumbs_1.default chain={[
            { link: '/schedules', state: { defaultTab: 'group' }, children: 'Schedules' },
            { link: '#', children: group.name || <material_1.Skeleton width={150}/> },
        ]}/>

      <material_1.Typography variant="h4">Manage the schedule for {group === null || group === void 0 ? void 0 : group.name}</material_1.Typography>
      <material_1.Typography variant="body1">
        This is a group schedule. Its availability is made up of the schedules of the locations and providers selected.
      </material_1.Typography>
      <form onSubmit={onSubmit}>
        <material_1.Grid container direction="column" spacing={4} sx={{ marginTop: 0 }}>
          <material_1.Grid item xs={6}>
            <material_1.TextField label="Slug" value={slug} onChange={function (event) {
            setSlug(event.target.value);
        }} sx={{ width: '250px' }}/>
            <material_1.Typography variant="body2" sx={{ pt: 1, pb: 0.5, fontWeight: 600, display: slug ? 'block' : 'none' }}>
              Share booking link to this schedule:
            </material_1.Typography>
            <material_1.Box sx={{ display: defaultIntakeUrl ? 'flex' : 'none', alignItems: 'center', gap: 0.5, mb: 3 }}>
              <material_1.Tooltip title={linkIsCopied ? 'Link copied!' : 'Copy link'} placement="top" arrow onClose={function () {
            setTimeout(function () {
                setLinkIsCopied(false);
            }, 200);
        }}>
                <material_1.Button onClick={function () {
            void navigator.clipboard.writeText(defaultIntakeUrl);
            setLinkIsCopied(true);
        }} sx={{ p: 0, minWidth: 0 }}>
                  <ContentCopyRounded_1.default fontSize="small"/>
                </material_1.Button>
              </material_1.Tooltip>
              <react_router_dom_1.Link to={defaultIntakeUrl} target="_blank">
                <material_1.Typography variant="body2">{defaultIntakeUrl}</material_1.Typography>
              </react_router_dom_1.Link>
            </material_1.Box>
          </material_1.Grid>
          <material_1.Grid container item xs={6} gap={2}>
            <material_1.Grid item xs={3}>
              <GroupMembers_1.default option="locations" options={locations
            ? locations.map(function (locationTemp) { return ({
                value: locationTemp.id || 'Undefined name',
                label: locationTemp.name || 'Undefined name',
            }); })
            : []} values={selectedLocations
            ? selectedLocations === null || selectedLocations === void 0 ? void 0 : selectedLocations.map(function (locationTemp) {
                var _a;
                var locationName = (_a = locations === null || locations === void 0 ? void 0 : locations.find(function (location) { return location.id === locationTemp; })) === null || _a === void 0 ? void 0 : _a.name;
                return {
                    value: locationTemp,
                    label: locationName || 'Undefined name',
                };
            })
            : []} onChange={function (event, value) {
            setSelectedLocations(value.map(function (valueTemp) { return valueTemp.value; }));
        }}/>
            </material_1.Grid>
            <material_1.Grid item xs={3}>
              <GroupMembers_1.default option="providers" options={practitioners
            ? practitioners.map(function (practitionerTemp) { return ({
                value: practitionerTemp.id || 'Undefined name',
                label: practitionerTemp.name
                    ? (oystehr === null || oystehr === void 0 ? void 0 : oystehr.fhir.formatHumanName(practitionerTemp.name[0])) || 'Undefined name'
                    : 'Undefined name',
            }); })
            : []} values={selectedPractitioners
            ? selectedPractitioners.map(function (practitionerTemp) {
                var _a, _b;
                var practitionerName = (_b = (_a = practitioners === null || practitioners === void 0 ? void 0 : practitioners.find(function (practitioner) { return practitioner.id === practitionerTemp; })) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b[0];
                return {
                    value: practitionerTemp,
                    label: practitionerName
                        ? (oystehr === null || oystehr === void 0 ? void 0 : oystehr.fhir.formatHumanName(practitionerName)) || 'Undefined name'
                        : 'Undefined name',
                };
            })
            : []} onChange={function (event, value) { return setSelectedPractitioners(value.map(function (valueTemp) { return valueTemp.value; })); }}/>
            </material_1.Grid>
          </material_1.Grid>
          <material_1.Grid item xs={2}>
            <lab_1.LoadingButton loading={loading} type="submit" variant="contained">
              Save
            </lab_1.LoadingButton>
          </material_1.Grid>
        </material_1.Grid>
      </form>
    </>);
}
//# sourceMappingURL=GroupPage.js.map