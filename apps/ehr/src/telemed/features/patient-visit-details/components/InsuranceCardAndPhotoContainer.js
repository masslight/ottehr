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
exports.InsuranceCardAndPhotoContainer = void 0;
var auth0_react_1 = require("@auth0/auth0-react");
var colors_1 = require("@ehrTheme/colors");
var ContentPasteOff_1 = require("@mui/icons-material/ContentPasteOff");
var material_1 = require("@mui/material");
var react_1 = require("react");
var utils_1 = require("utils");
var DownloadImagesButton_1 = require("../../../../components/DownloadImagesButton");
var ImageCarousel_1 = require("../../../../components/ImageCarousel");
var files_helper_1 = require("../../../../helpers/files.helper");
var getSelectors_1 = require("../../../../shared/store/getSelectors");
var types_1 = require("../../../../types/types");
var state_1 = require("../../../state");
function compareCards(cardBackType) {
    return function (a, b) {
        if (a && b) {
            return a.type === cardBackType ? 1 : -1;
        }
        return 0;
    };
}
var InsuranceCardAndPhotoContainer = function () {
    var _a, _b, _c;
    var getAccessTokenSilently = (0, auth0_react_1.useAuth0)().getAccessTokenSilently;
    var _d = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, [
        'patient',
        'appointment',
        'questionnaireResponse',
    ]), patient = _d.patient, appointment = _d.appointment, questionnaireResponse = _d.questionnaireResponse;
    var appointmentId = appointment === null || appointment === void 0 ? void 0 : appointment.id;
    var paymentOption = (_c = (_b = (_a = (0, utils_1.getQuestionnaireResponseByLinkId)('payment-option', questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString;
    var selfPay = paymentOption === 'I will pay without insurance';
    var _e = (0, react_1.useState)(false), photoZoom = _e[0], setPhotoZoom = _e[1];
    var _f = (0, react_1.useState)(0), zoomedIdx = _f[0], setZoomedIdx = _f[1];
    var _g = (0, react_1.useState)([]), sections = _g[0], setSections = _g[1];
    var _h = (0, react_1.useState)(false), fetchCompleted = _h[0], setFetchCompleted = _h[1];
    (0, state_1.useGetDocumentReferences)({ appointmentId: appointment === null || appointment === void 0 ? void 0 : appointment.id, patientId: patient === null || patient === void 0 ? void 0 : patient.id }, function (data) { return __awaiter(void 0, void 0, void 0, function () {
        var authToken, documentReferenceResources, bundleEntries, allCards, _i, documentReferenceResources_1, docRef, docRefCode, _a, _b, content, title, z3Url, presignedUrl, photoIdCards, primaryInsuranceCards, secondaryInsuranceCards, sectionsData;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0: return [4 /*yield*/, getAccessTokenSilently()];
                case 1:
                    authToken = _e.sent();
                    documentReferenceResources = [];
                    bundleEntries = data.entry;
                    bundleEntries === null || bundleEntries === void 0 ? void 0 : bundleEntries.forEach(function (bundleEntry) {
                        var _a;
                        var bundleResource = bundleEntry.resource;
                        (_a = bundleResource.entry) === null || _a === void 0 ? void 0 : _a.forEach(function (entry) {
                            var docRefResource = entry.resource;
                            if (docRefResource) {
                                documentReferenceResources.push(docRefResource);
                            }
                        });
                    });
                    allCards = [];
                    _i = 0, documentReferenceResources_1 = documentReferenceResources;
                    _e.label = 2;
                case 2:
                    if (!(_i < documentReferenceResources_1.length)) return [3 /*break*/, 7];
                    docRef = documentReferenceResources_1[_i];
                    docRefCode = (_d = (_c = docRef.type) === null || _c === void 0 ? void 0 : _c.coding) === null || _d === void 0 ? void 0 : _d[0].code;
                    if (!(docRefCode && [utils_1.PHOTO_ID_CARD_CODE, utils_1.INSURANCE_CARD_CODE].includes(docRefCode))) return [3 /*break*/, 6];
                    _a = 0, _b = docRef.content;
                    _e.label = 3;
                case 3:
                    if (!(_a < _b.length)) return [3 /*break*/, 6];
                    content = _b[_a];
                    title = content.attachment.title;
                    z3Url = content.attachment.url;
                    if (!(z3Url &&
                        title &&
                        Object.values(types_1.DocumentType).includes(title) &&
                        (docRefCode === utils_1.PHOTO_ID_CARD_CODE || (docRefCode === utils_1.INSURANCE_CARD_CODE && !selfPay)))) return [3 /*break*/, 5];
                    return [4 /*yield*/, (0, files_helper_1.getPresignedFileUrl)(z3Url, authToken)];
                case 4:
                    presignedUrl = _e.sent();
                    if (presignedUrl) {
                        allCards.push({
                            z3Url: z3Url,
                            presignedUrl: presignedUrl,
                            type: title,
                        });
                    }
                    _e.label = 5;
                case 5:
                    _a++;
                    return [3 /*break*/, 3];
                case 6:
                    _i++;
                    return [3 /*break*/, 2];
                case 7:
                    if (allCards.length) {
                        photoIdCards = allCards
                            .filter(function (card) { return [types_1.DocumentType.PhotoIdFront, types_1.DocumentType.PhotoIdBack].includes(card.type); })
                            .sort(compareCards(types_1.DocumentType.PhotoIdBack));
                        primaryInsuranceCards = allCards
                            .filter(function (card) { return [types_1.DocumentType.InsuranceFront, types_1.DocumentType.InsuranceBack].includes(card.type); })
                            .sort(compareCards(types_1.DocumentType.InsuranceBack));
                        secondaryInsuranceCards = allCards
                            .filter(function (card) {
                            return [types_1.DocumentType.InsuranceFrontSecondary, types_1.DocumentType.InsuranceBackSecondary].includes(card.type);
                        })
                            .sort(compareCards(types_1.DocumentType.InsuranceBackSecondary));
                        sectionsData = [
                            {
                                title: 'Primary Insurance Card',
                                cards: primaryInsuranceCards,
                                downloadLabel: 'Download Insurance Card',
                            },
                            {
                                title: 'Secondary Insurance Card',
                                cards: secondaryInsuranceCards,
                                downloadLabel: 'Download Insurance Card',
                            },
                            {
                                title: 'Photo ID',
                                cards: photoIdCards,
                                downloadLabel: 'Download Photo IDs',
                            },
                        ];
                        setSections(sectionsData);
                    }
                    setFetchCompleted(true);
                    return [2 /*return*/];
            }
        });
    }); });
    var imageCarouselObjs = (0, react_1.useMemo)(function () {
        return sections.flatMap(function (section) {
            return section.cards.map(function (card) { return ({
                alt: card.type,
                url: card.presignedUrl || '',
                key: card.type,
            }); });
        });
    }, [sections]);
    return (<>
      <ImageCarousel_1.default imagesObj={imageCarouselObjs} imageIndex={zoomedIdx} setImageIndex={setZoomedIdx} open={photoZoom} setOpen={setPhotoZoom}/>
      <material_1.Paper sx={{ width: '100%', display: 'flex', flexWrap: 'wrap', p: 3, gap: 2 }}>
        {(!fetchCompleted && (<material_1.Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <material_1.CircularProgress sx={{ justifySelf: 'center' }}/>
          </material_1.Box>)) ||
            sections.map(function (section, sectionIndex) { return (<material_1.Box key={sectionIndex} sx={{ flex: '0 1 475px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <material_1.Typography color="primary.dark">{section.title}</material_1.Typography>
              <material_1.Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                {section.cards.map(function (card, cardIndex) {
                    var offset = sections
                        .slice(0, sectionIndex)
                        .reduce(function (total, currentSection) { return total + currentSection.cards.length; }, 0);
                    return (<material_1.Box key={cardIndex} sx={{
                            flex: '1 0 48%',
                            height: '140px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            cursor: 'pointer',
                            borderRadius: 2,
                            border: "1px solid ".concat(colors_1.otherColors.dottedLine),
                        }} onClick={function () {
                            setZoomedIdx(cardIndex + offset);
                            setPhotoZoom(true);
                        }}>
                      <img src={card.presignedUrl} alt={card.type} style={{ maxHeight: '100%', maxWidth: '100%' }}/>
                    </material_1.Box>);
                })}
              </material_1.Box>
              {appointmentId && (<material_1.Box>
                  <DownloadImagesButton_1.default cards={section.cards} appointmentId={appointmentId} title={section.downloadLabel}/>
                </material_1.Box>)}
            </material_1.Box>); })}
        {!sections.some(function (section) { return section.cards.length > 0; }) && fetchCompleted && (<material_1.Grid item xs={12} display="flex" alignItems="center" justifyContent="center">
            <material_1.Typography variant="h3" color="primary.dark">
              No images have been uploaded <ContentPasteOff_1.default />
            </material_1.Typography>
          </material_1.Grid>)}
      </material_1.Paper>
    </>);
};
exports.InsuranceCardAndPhotoContainer = InsuranceCardAndPhotoContainer;
//# sourceMappingURL=InsuranceCardAndPhotoContainer.js.map