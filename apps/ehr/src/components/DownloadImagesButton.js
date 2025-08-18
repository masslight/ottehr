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
var material_1 = require("@mui/material");
function parseFiletype(fileUrl) {
    var _a;
    var filetype = (_a = fileUrl.match(/\w+$/)) === null || _a === void 0 ? void 0 : _a[0];
    if (filetype) {
        return filetype;
    }
    else {
        throw new Error('Failed to parse filetype from url');
    }
}
var DownloadImagesButton = function (_a) {
    var appointmentId = _a.appointmentId, cards = _a.cards, fullCardPdf = _a.fullCardPdf, title = _a.title;
    var handleDownload = function () { return __awaiter(void 0, void 0, void 0, function () {
        var _loop_1, _i, cards_1, card;
        return __generator(this, function (_a) {
            try {
                _loop_1 = function (card) {
                    if (card.presignedUrl) {
                        var fileType_1 = parseFiletype(card.z3Url);
                        fetch(card.presignedUrl, { method: 'GET', headers: { 'Cache-Control': 'no-cache' } })
                            .then(function (response) {
                            if (!response.ok) {
                                throw new Error('failed to fetch image from presigned url');
                            }
                            return response.blob();
                        })
                            .then(function (blob) {
                            var url = window.URL.createObjectURL(new Blob([blob]));
                            var link = document.createElement('a');
                            link.href = url;
                            link.download = "".concat(appointmentId, "-").concat(card.type, ".").concat(fileType_1);
                            link.style.display = 'none';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        })
                            .catch(function (error) {
                            throw new Error(error);
                        });
                    }
                };
                for (_i = 0, cards_1 = cards; _i < cards_1.length; _i++) {
                    card = cards_1[_i];
                    _loop_1(card);
                }
            }
            catch (error) {
                console.error('Error downloading image:', error);
            }
            return [2 /*return*/];
        });
    }); };
    return (fullCardPdf === null || fullCardPdf === void 0 ? void 0 : fullCardPdf.presignedUrl) ? (<material_1.Link href={fullCardPdf.presignedUrl} target="_blank">
      <material_1.Button variant="outlined" sx={{
            borderRadius: '100px',
            fontWeight: 500,
            textTransform: 'none',
        }} size="medium">
        {title}
      </material_1.Button>
    </material_1.Link>) : (<material_1.Button variant="outlined" sx={{
            borderRadius: '100px',
            fontWeight: 500,
            textTransform: 'none',
        }} size="medium" onClick={handleDownload}>
      {title}
    </material_1.Button>);
};
exports.default = DownloadImagesButton;
//# sourceMappingURL=DownloadImagesButton.js.map