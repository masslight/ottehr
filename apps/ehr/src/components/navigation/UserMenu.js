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
exports.UserMenu = void 0;
var Warning_1 = require("@mui/icons-material/Warning");
var material_1 = require("@mui/material");
var notistack_1 = require("notistack");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var utils_1 = require("src/shared/utils");
var telemed_1 = require("src/telemed");
var utils_2 = require("utils");
var data_test_ids_1 = require("../../constants/data-test-ids");
var features_1 = require("../../features");
var useEvolveUser_1 = require("../../hooks/useEvolveUser");
var UserMenu = function () {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var _j = (0, react_1.useState)(null), anchorElement = _j[0], setAnchorElement = _j[1];
    var user = (0, useEvolveUser_1.default)();
    var userIsProvider = user === null || user === void 0 ? void 0 : user.hasRole([utils_2.RoleType.Provider]);
    var practitioner = user === null || user === void 0 ? void 0 : user.profileResource;
    var practitionerMissingFields = (0, react_1.useMemo)(function () {
        return practitioner ? (0, utils_1.getPractitionerMissingFields)(practitioner) : [];
    }, [practitioner]);
    var _k = (0, telemed_1.useCheckPractitionerEnrollment)({
        enabled: Boolean(practitioner),
    }), practitionerEnrollmentStatus = _k.data, isPractitionerEnrollmentChecked = _k.isFetched;
    var _l = (0, telemed_1.useEnrollPractitionerToERX)({
        onError: function () {
            (0, notistack_1.enqueueSnackbar)('Enrolling practitioner to eRx failed', { variant: 'error' });
        },
    }), enrollPractitioner = _l.mutateAsync, isEnrollingPractitioner = _l.isLoading;
    var _m = (0, telemed_1.useConnectPractitionerToERX)({}), isConnectingPractitionerForConfirmation = _m.isLoading, connectPractitionerForConfirmation = _m.mutateAsync;
    var handleConnectPractitioner = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var ssoLink_1, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, enrollPractitioner(practitioner.id)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, connectPractitionerForConfirmation()];
                case 2:
                    ssoLink_1 = _a.sent();
                    void Promise.resolve().then(function () { return window.open(ssoLink_1, '_blank'); });
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    (0, notistack_1.enqueueSnackbar)('Something went wrong while trying to connect practitioner to eRx', { variant: 'error' });
                    console.error('Error trying to connect practitioner to eRx: ', error_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); }, [connectPractitionerForConfirmation, enrollPractitioner, practitioner]);
    var name = (user === null || user === void 0 ? void 0 : user.profileResource) && ((_a = (0, utils_2.getFullestAvailableName)(user.profileResource, true)) !== null && _a !== void 0 ? _a : "".concat(utils_2.PROJECT_NAME, " Team"));
    var suffix = (_e = (_d = (_c = (_b = user === null || user === void 0 ? void 0 : user.profileResource) === null || _b === void 0 ? void 0 : _b.name) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.suffix) === null || _e === void 0 ? void 0 : _e[0];
    return (<>
      {userIsProvider && <features_1.ProviderNotifications />}
      <material_1.ListItem disablePadding sx={{ width: 'fit-content' }}>
        <material_1.ListItemButton onClick={function (event) { return setAnchorElement(event.currentTarget); }}>
          <material_1.ListItemAvatar sx={{ minWidth: 'auto', mr: { xs: '0', sm: 2 } }}>
            <material_1.Avatar sx={{ bgcolor: 'primary.main' }} alt={name} src={(_h = (_g = (_f = user === null || user === void 0 ? void 0 : user.profileResource) === null || _f === void 0 ? void 0 : _f.photo) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.url}/>
          </material_1.ListItemAvatar>
          <material_1.ListItemText data-testid={data_test_ids_1.dataTestIds.header.userName} sx={{ display: { xs: 'none', sm: 'block' } }} primary={name} secondary={suffix}/>
        </material_1.ListItemButton>
      </material_1.ListItem>
      <material_1.Menu id="user-menu" anchorEl={anchorElement} open={anchorElement !== null} onClose={function () { return setAnchorElement(null); }}>
        <material_1.MenuItem>
          <material_1.Box>
            <material_1.Typography variant="body1">{utils_2.PROJECT_NAME} Admin</material_1.Typography>
            <material_1.Typography variant="caption">{user === null || user === void 0 ? void 0 : user.email}</material_1.Typography>
          </material_1.Box>
        </material_1.MenuItem>
        <material_1.Divider />
        {isPractitionerEnrollmentChecked && userIsProvider && !(practitionerEnrollmentStatus === null || practitionerEnrollmentStatus === void 0 ? void 0 : practitionerEnrollmentStatus.identityVerified) && (<>
            {practitionerMissingFields.length > 0 && (<material_1.Box sx={{ display: 'flex', alignItems: 'center', maxWidth: 300, gap: 1, padding: '6px 16px' }}>
                <Warning_1.default fontSize="small" sx={{ ml: '4px', verticalAlign: 'middle', color: 'warning.light' }}/>
                <material_1.Typography variant="caption">
                  Please complete your profile to be able to enroll in eRX or ask your administrator to complete it for
                  you. <br /> Missing fields: {practitionerMissingFields.join(', ')}
                </material_1.Typography>
              </material_1.Box>)}

            <material_1.MenuItem disabled={practitionerMissingFields.length > 0 ||
                isConnectingPractitionerForConfirmation ||
                isEnrollingPractitioner} onClick={handleConnectPractitioner}>
              <material_1.Typography variant="body1" color="primary" sx={{ fontWeight: 'bold' }}>
                Enroll in eRX
              </material_1.Typography>
            </material_1.MenuItem>

            <material_1.Divider />
          </>)}
        <react_router_dom_1.Link to="/logout" style={{ textDecoration: 'none' }}>
          <material_1.MenuItem>
            <material_1.Typography variant="body1" color="primary" sx={{ fontWeight: 'bold' }}>
              Log out
            </material_1.Typography>
          </material_1.MenuItem>
        </react_router_dom_1.Link>
      </material_1.Menu>
    </>);
};
exports.UserMenu = UserMenu;
//# sourceMappingURL=UserMenu.js.map