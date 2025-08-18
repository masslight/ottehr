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
exports.ReviewTab = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var featureFlags_1 = require("src/features/css-module/context/featureFlags");
var progress_note_chart_data_requested_fields_helper_1 = require("utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper");
var useChartData_1 = require("../../../../features/css-module/hooks/useChartData");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var state_1 = require("../../../state");
var AddendumCard_1 = require("./AddendumCard");
var MissingCard_1 = require("./MissingCard");
var ReviewAndSignButton_1 = require("./ReviewAndSignButton");
var SendFaxButton_1 = require("./SendFaxButton");
var VisitNoteCard_1 = require("./VisitNoteCard");
var ReviewTab = function () {
    var isInitialLoad = (0, react_1.useRef)(true);
    var _a = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'appointment',
        'encounter',
        'isChartDataLoading',
        'setPartialChartData',
    ]), appointment = _a.appointment, encounter = _a.encounter, isChartDataLoading = _a.isChartDataLoading, setPartialChartData = _a.setPartialChartData;
    var css = (0, featureFlags_1.useFeatureFlags)().css;
    var isFetching = (0, useChartData_1.useChartData)({
        encounterId: encounter.id || '',
        requestedFields: progress_note_chart_data_requested_fields_helper_1.telemedProgressNoteChartDataRequestedFields,
        onSuccess: function (data) {
            isInitialLoad.current = false;
            setPartialChartData({
                prescribedMedications: data.prescribedMedications,
                disposition: data.disposition,
                medicalDecision: data.medicalDecision,
            });
        },
        onError: function () {
            isInitialLoad.current = false;
        },
        enabled: isInitialLoad.current,
    }).isFetching;
    var refetchReviewAndSingData = (0, state_1.useGetReviewAndSignData)({
        appointmentId: appointment === null || appointment === void 0 ? void 0 : appointment.id,
        runImmediately: false,
    }, function (reviewAndSignData) {
        state_1.useAppointmentStore.setState({ reviewAndSignData: reviewAndSignData });
    }).refetch;
    var onAppointmentSigned = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, refetchReviewAndSingData()];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, [refetchReviewAndSingData]);
    if (isChartDataLoading || isFetching) {
        return (<material_1.Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <material_1.CircularProgress />
      </material_1.Box>);
    }
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
        }}>
      <MissingCard_1.MissingCard />
      <VisitNoteCard_1.VisitNoteCard />
      <AddendumCard_1.AddendumCard />
      <material_1.Box sx={{ display: 'flex', justifyContent: 'end', gap: 1 }}>
        <SendFaxButton_1.SendFaxButton appointment={appointment} encounter={encounter} css={css}/>
        <ReviewAndSignButton_1.ReviewAndSignButton onSigned={onAppointmentSigned}/>
      </material_1.Box>
    </material_1.Box>);
};
exports.ReviewTab = ReviewTab;
//# sourceMappingURL=ReviewTab.js.map