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
exports.default = useEvolveUser;
var auth0_react_1 = require("@auth0/auth0-react");
var luxon_1 = require("luxon");
var react_1 = require("react");
var react_query_1 = require("react-query");
var utils_1 = require("utils");
var zustand_1 = require("zustand");
var api_1 = require("../api/api");
var useAppClients_1 = require("./useAppClients");
var useAuthToken_1 = require("./useAuthToken");
var useEvolveUserStore = (0, zustand_1.create)()(function () { return ({}); });
// extracting it here, cause even if we use store - it will still initiate requests as much as we have usages of this hook,
// so just to use this var as a synchronization mechanism - lifted it here
var _practitionerLoginUpdateStarted = false;
function useEvolveUser() {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    var user = useEvolveUserStore(function (state) { return state.user; });
    var profile = useEvolveUserStore(function (state) { return state.profile; });
    var auth0User = (0, auth0_react_1.useAuth0)().user;
    var isProviderHasEverythingToBeEnrolled = Boolean((profile === null || profile === void 0 ? void 0 : profile.id) &&
        ((_b = (_a = profile === null || profile === void 0 ? void 0 : profile.telecom) === null || _a === void 0 ? void 0 : _a.find(function (phone) { return phone.system === 'sms' || phone.system === 'phone'; })) === null || _b === void 0 ? void 0 : _b.value) &&
        ((_c = (0, utils_1.getPractitionerNPIIdentifier)(profile)) === null || _c === void 0 ? void 0 : _c.value) &&
        ((_f = (_e = (_d = profile === null || profile === void 0 ? void 0 : profile.name) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.given) === null || _f === void 0 ? void 0 : _f[0]) &&
        ((_h = (_g = profile === null || profile === void 0 ? void 0 : profile.name) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.family));
    var userRoles = user === null || user === void 0 ? void 0 : user.roles;
    var hasRole = (0, react_1.useCallback)(function (role) {
        return (userRoles === null || userRoles === void 0 ? void 0 : userRoles.find(function (r) { return role.includes(r.name); })) != undefined;
    }, [userRoles]);
    useGetUser();
    useSyncPractitioner(function (data) {
        if (data.updated) {
            console.log('Practitioner sync success');
        }
    });
    var refetchProfile = useGetProfile().refetch;
    var _j = useUpdatePractitioner(), isPractitionerLastLoginBeingUpdated = _j.isLoading, mutatePractitionerAsync = _j.mutateAsync;
    (0, react_1.useEffect)(function () {
        if ((user === null || user === void 0 ? void 0 : user.profile) && !profile) {
            void refetchProfile();
        }
    }, [profile, refetchProfile, user === null || user === void 0 ? void 0 : user.profile]);
    (0, react_1.useEffect)(function () {
        var _a;
        if (user && oystehr && profile && !isPractitionerLastLoginBeingUpdated && !_practitionerLoginUpdateStarted) {
            _practitionerLoginUpdateStarted = true;
            void mutatePractitionerAsync([
                (0, utils_1.getPatchOperationForNewMetaTag)(profile, {
                    system: 'last-login',
                    code: (_a = luxon_1.DateTime.now().toISO()) !== null && _a !== void 0 ? _a : 'Unknown',
                }),
            ]).catch(console.error);
        }
    }, [oystehr, isPractitionerLastLoginBeingUpdated, mutatePractitionerAsync, profile, user]);
    (0, react_1.useEffect)(function () {
        var lastLogin = auth0User === null || auth0User === void 0 ? void 0 : auth0User.updated_at;
        if (lastLogin) {
            var loginTime = luxon_1.DateTime.fromISO(lastLogin);
            if (Math.abs(loginTime.diffNow('seconds').seconds) <= luxon_1.Duration.fromObject({ seconds: 5 }).seconds) {
                localStorage.removeItem('selectedDate');
            }
        }
    }, [auth0User === null || auth0User === void 0 ? void 0 : auth0User.updated_at]);
    var _k = (0, react_1.useMemo)(function () {
        var _a, _b, _c, _d;
        if (profile) {
            var userName_1 = (_a = (0, utils_1.getFullestAvailableName)(profile)) !== null && _a !== void 0 ? _a : "".concat(utils_1.PROJECT_NAME, " Team");
            var userInitials_1 = (0, utils_1.initialsFromName)(userName_1);
            var lastLogin_1 = (_d = (_c = (_b = profile.meta) === null || _b === void 0 ? void 0 : _b.tag) === null || _c === void 0 ? void 0 : _c.find(function (tag) { return tag.system === 'last-login'; })) === null || _d === void 0 ? void 0 : _d.code;
            return { userName: userName_1, userInitials: userInitials_1, lastLogin: lastLogin_1 };
        }
        return { userName: "".concat(utils_1.PROJECT_NAME, " team"), userInitials: (0, utils_1.initialsFromName)("".concat(utils_1.PROJECT_NAME, " Team")) };
    }, [profile]), userName = _k.userName, userInitials = _k.userInitials, lastLogin = _k.lastLogin;
    return (0, react_1.useMemo)(function () {
        if (user) {
            return __assign(__assign({}, user), { userName: userName, userInitials: userInitials, lastLogin: lastLogin, profileResource: profile, isProviderHasEverythingToBeEnrolled: isProviderHasEverythingToBeEnrolled, hasRole: hasRole });
        }
        return undefined;
    }, [hasRole, isProviderHasEverythingToBeEnrolled, lastLogin, profile, user, userInitials, userName]);
}
// const MINUTE = 1000 * 60; // For Credentials Sync
// const DAY = MINUTE * 60 * 24; // For Credentials Sync
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useGetUser = function () {
    var token = (0, useAuthToken_1.useAuthToken)();
    var user = useEvolveUserStore(function (state) { return state.user; });
    return (0, react_query_1.useQuery)(['get-user'], function () { return __awaiter(void 0, void 0, void 0, function () {
        var user_1, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, api_1.getUser)(token)];
                case 1:
                    user_1 = _a.sent();
                    useEvolveUserStore.setState({ user: user_1 });
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    console.error(error_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); }, {
        enabled: Boolean(token && !user),
    });
};
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useGetProfile = function () {
    var token = (0, useAuthToken_1.useAuthToken)();
    var user = useEvolveUserStore(function (state) { return state.user; });
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useQuery)(['get-practitioner-profile'], function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, resourceType, resourceId, practitioner, e_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    if (!(user === null || user === void 0 ? void 0 : user.profile)) {
                        useEvolveUserStore.setState({ profile: undefined });
                        return [2 /*return*/];
                    }
                    _a = ((user === null || user === void 0 ? void 0 : user.profile) || '').split('/'), resourceType = _a[0], resourceId = _a[1];
                    if (!(resourceType && resourceId && resourceType === 'Practitioner')) return [3 /*break*/, 2];
                    return [4 /*yield*/, (oystehr === null || oystehr === void 0 ? void 0 : oystehr.fhir.get({ resourceType: resourceType, id: resourceId }))];
                case 1:
                    practitioner = _b.sent();
                    useEvolveUserStore.setState({ profile: practitioner });
                    _b.label = 2;
                case 2: return [3 /*break*/, 4];
                case 3:
                    e_1 = _b.sent();
                    console.error("error fetching user's fhir profile: ".concat(JSON.stringify(e_1)));
                    useEvolveUserStore.setState({ profile: undefined });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); }, {
        enabled: Boolean(token && oystehr),
    });
};
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useSyncPractitioner = function (_onSuccess) {
    // console.log('Credentials sync is not enabled');
    /**
     * Credentials sync functionality -- Uncomment if you are synchronizing credentials from an external system
    
    const client = useOystehrAPIClient();
    const token = useAuthToken();
    const { oystehr } = useApiClients();
    const queryClient = useQueryClient();
    return useQuery(
      ['sync-user', oystehr],
      async () => {
        if (!client) return undefined;
        _practitionerSyncStarted = true;
        const result = await client?.syncUser();
        _practitionerSyncFinished = true;
        if (result.updated) {
          void queryClient.refetchQueries('get-practitioner-profile');
        } else {
          useEvolveUserStore.setState((state) => ({ profile: { ...(state.profile! || {}) } }));
        }
        return result;
      },
      {
        onSuccess,
        cacheTime: DAY,
        staleTime: DAY,
        enabled: Boolean(token && oystehr && oystehr.config.accessToken && !_practitionerSyncStarted),
      }
    );
    */
};
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
var useUpdatePractitioner = function () {
    var user = useEvolveUserStore(function (state) { return state.user; });
    var oystehr = (0, useAppClients_1.useApiClients)().oystehr;
    return (0, react_query_1.useMutation)(['update-practitioner'], function (patchOps) { return __awaiter(void 0, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    if (!oystehr || !user)
                        return [2 /*return*/];
                    return [4 /*yield*/, oystehr.fhir.patch({
                            resourceType: 'Practitioner',
                            id: user.profile.replace('Practitioner/', ''),
                            operations: __spreadArray([], patchOps, true),
                        })];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _a.sent();
                    console.error(error_2);
                    throw error_2;
                case 3: return [2 /*return*/];
            }
        });
    }); }, { retry: 3 });
};
//# sourceMappingURL=useEvolveUser.js.map