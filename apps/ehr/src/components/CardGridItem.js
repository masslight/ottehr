"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CardGridItem;
var colors_1 = require("@ehrTheme/colors");
var material_1 = require("@mui/material");
var DownloadImagesButton_1 = require("./DownloadImagesButton");
function CardGridItem(_a) {
    var card = _a.card, index = _a.index, appointmentID = _a.appointmentID, cards = _a.cards, fullCardPdf = _a.fullCardPdf, setZoomedIdx = _a.setZoomedIdx, setPhotoZoom = _a.setPhotoZoom, title = _a.title, _b = _a.offset, offset = _b === void 0 ? 0 : _b;
    return (<material_1.Grid key={card.type} item xs={12} sm={6} boxSizing="border-box">
      <material_1.Box border={"1px solid ".concat(colors_1.otherColors.dottedLine)} height="170px" width="100%" my={1} borderRadius={2}>
        <material_1.Box onClick={function () {
            setZoomedIdx(index + offset);
            setPhotoZoom(true);
        }} sx={{ cursor: 'pointer' }} display="flex" justifyContent="center" alignItems="center" height="100%">
          <img src={card.presignedUrl} alt={card.type} style={{ maxWidth: '100%', maxHeight: '100%' }}/>
        </material_1.Box>
      </material_1.Box>
      {appointmentID && index === 0 && (<material_1.Box mt={2}>
          <DownloadImagesButton_1.default cards={cards} fullCardPdf={fullCardPdf} appointmentId={appointmentID} title={title}/>
        </material_1.Box>)}
    </material_1.Grid>);
}
//# sourceMappingURL=CardGridItem.js.map