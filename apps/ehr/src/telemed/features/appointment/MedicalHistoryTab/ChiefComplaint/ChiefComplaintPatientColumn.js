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
exports.ChiefComplaintPatientColumn = void 0;
var auth0_react_1 = require("@auth0/auth0-react");
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var AiSuggestion_1 = require("../../../../../components/AiSuggestion");
var ImageCarousel_1 = require("../../../../../components/ImageCarousel");
var data_test_ids_1 = require("../../../../../constants/data-test-ids");
var files_helper_1 = require("../../../../../helpers/files.helper");
var getSelectors_1 = require("../../../../../shared/store/getSelectors");
var state_1 = require("../../../../state");
var ChiefComplaintPatientColumn = function () {
    var _a, _b;
    var theme = (0, material_1.useTheme)();
    var _c = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'isAppointmentLoading',
        'patientPhotoUrls',
        'appointment',
        'chartData',
    ]), isAppointmentLoading = _c.isAppointmentLoading, patientPhotoUrls = _c.patientPhotoUrls, appointment = _c.appointment, chartData = _c.chartData;
    var _d = (0, react_1.useState)([]), signedPhotoUrls = _d[0], setSignedPhotoUrls = _d[1];
    var _e = (0, react_1.useState)(false), photoUrlsLoading = _e[0], setPhotoUrlsLoading = _e[1];
    var getAccessTokenSilently = (0, auth0_react_1.useAuth0)().getAccessTokenSilently;
    var photoCarouselObjects = signedPhotoUrls.map(function (url, ind) { return ({
        url: url,
        alt: "Patient condition photo #".concat(ind + 1),
    }); });
    var _f = (0, react_1.useState)(false), photoZoom = _f[0], setPhotoZoom = _f[1];
    var _g = (0, react_1.useState)(0), zoomedIdx = _g[0], setZoomedIdx = _g[1];
    (0, react_1.useEffect)(function () {
        function getPresignedPhotoUrls() {
            return __awaiter(this, void 0, void 0, function () {
                var authToken_1, requests_1, signedUrls, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 3, 4, 5]);
                            setPhotoUrlsLoading(true);
                            return [4 /*yield*/, getAccessTokenSilently()];
                        case 1:
                            authToken_1 = _b.sent();
                            requests_1 = [];
                            patientPhotoUrls.forEach(function (url) {
                                requests_1.push((0, files_helper_1.getPresignedFileUrl)(url, authToken_1));
                            });
                            return [4 /*yield*/, Promise.all(requests_1)];
                        case 2:
                            signedUrls = _b.sent();
                            setSignedPhotoUrls(signedUrls.filter(Boolean));
                            return [3 /*break*/, 5];
                        case 3:
                            _a = _b.sent();
                            console.error('Error while trying to get patient photo presigned urls');
                            return [3 /*break*/, 5];
                        case 4:
                            setPhotoUrlsLoading(false);
                            return [7 /*endfinally*/];
                        case 5: return [2 /*return*/];
                    }
                });
            });
        }
        if ((patientPhotoUrls === null || patientPhotoUrls === void 0 ? void 0 : patientPhotoUrls.length) > 0) {
            void getPresignedPhotoUrls();
        }
    }, [getAccessTokenSilently, patientPhotoUrls]);
    var aiHistoryOfPresentIllness = (_a = chartData === null || chartData === void 0 ? void 0 : chartData.observations) === null || _a === void 0 ? void 0 : _a.find(function (observation) { return observation.field === utils_1.AiObservationField.HistoryOfPresentIllness; });
    return (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <ImageCarousel_1.default imagesObj={photoCarouselObjects} imageIndex={zoomedIdx} setImageIndex={setZoomedIdx} open={photoZoom} setOpen={setPhotoZoom}/>
      <material_1.Box>
        <material_1.Typography variant="subtitle2" color={theme.palette.primary.dark}>
          Reason for visit selected by patient
        </material_1.Typography>
        {isAppointmentLoading ? (<material_1.Skeleton width="100%">
            <material_1.Typography>.</material_1.Typography>
          </material_1.Skeleton>) : (<material_1.Typography data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiReasonForVisit}>
            {(_b = appointment === null || appointment === void 0 ? void 0 : appointment.description) !== null && _b !== void 0 ? _b : ''}
          </material_1.Typography>)}
      </material_1.Box>
      {(isAppointmentLoading || photoUrlsLoading || (photoCarouselObjects === null || photoCarouselObjects === void 0 ? void 0 : photoCarouselObjects.length) > 0) && (<material_1.Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <material_1.Box sx={{ display: 'flex', gap: 1 }}>
            <material_1.Typography variant="subtitle2" color={theme.palette.primary.dark}>
              Photo of patient’s condition
            </material_1.Typography>
            <material_1.Typography variant="subtitle2" color={theme.palette.text.secondary}>
              Click to zoom
            </material_1.Typography>
          </material_1.Box>
          {isAppointmentLoading ? (<material_1.Box sx={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridGap: 16 }}>
              {[1, 2].map(function (item) { return (<material_1.Box key={item} sx={{ aspectRatio: '1/1' }}>
                  <material_1.Skeleton variant="rounded" height="100%"/>
                </material_1.Box>); })}
            </material_1.Box>) : (<material_1.Box sx={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridGap: 16 }} data-testid={data_test_ids_1.dataTestIds.telemedEhrFlow.hpiPatientConditionPhotos}>
              {photoCarouselObjects.map(function (photoObj, ind) { return (<material_1.Box key={photoObj.url} display="inline-block" sx={{ cursor: 'pointer' }}>
                  <img onClick={function () {
                        setPhotoZoom(true);
                        setZoomedIdx(ind);
                    }} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} src={photoObj.url} alt={photoObj.alt} loading="lazy"/>
                </material_1.Box>); })}
            </material_1.Box>)}
        </material_1.Box>)}
      {aiHistoryOfPresentIllness ? (<>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }}/>
          <AiSuggestion_1.default title={'History of Present Illness (HPI)'} content={aiHistoryOfPresentIllness.value}/>
        </>) : undefined}
    </material_1.Box>);
};
exports.ChiefComplaintPatientColumn = ChiefComplaintPatientColumn;
//# sourceMappingURL=ChiefComplaintPatientColumn.js.map