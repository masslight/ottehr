"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ImageCarousel;
var ArrowBackIos_1 = require("@mui/icons-material/ArrowBackIos");
var ArrowForwardIos_1 = require("@mui/icons-material/ArrowForwardIos");
var Circle_1 = require("@mui/icons-material/Circle");
var Close_1 = require("@mui/icons-material/Close");
var material_1 = require("@mui/material");
var react_1 = require("react");
function ImageCarousel(_a) {
    var _b, _c;
    var imagesObj = _a.imagesObj, imageIndex = _a.imageIndex, setImageIndex = _a.setImageIndex, open = _a.open, setOpen = _a.setOpen;
    // handle functions
    var theme = (0, material_1.useTheme)();
    var handleLeftArrowClick = function () {
        if (imageIndex === 0) {
            return;
        }
        setImageIndex(imageIndex - 1);
    };
    var handleRightArrowClick = function () {
        if (imageIndex === imagesObj.length - 1) {
            return;
        }
        setImageIndex(imageIndex + 1);
    };
    var handleKeyDown = function (event) {
        var key = event.key;
        if (key === 'ArrowLeft') {
            handleLeftArrowClick();
        }
        else if (key === 'ArrowRight') {
            handleRightArrowClick();
        }
    };
    // html
    return (<material_1.Dialog open={open} onClose={function () {
            setOpen(false);
        }} PaperProps={{
            style: {
                backgroundColor: 'transparent',
                boxShadow: 'none',
                maxWidth: '900px',
            },
        }} onKeyDown={handleKeyDown}>
      <material_1.DialogTitle marginBottom={4}>
        <material_1.IconButton onClick={function () {
            setOpen(false);
        }} sx={{
            position: 'absolute',
            right: 0,
        }}>
          <Close_1.default style={{ color: theme.palette.background.paper }}/>
        </material_1.IconButton>
      </material_1.DialogTitle>

      <material_1.Box sx={{
            width: 900,
            height: 600,
            overflow: 'hidden',
            position: 'relative',
            '& img': {
                width: '100%',
                height: '100%',
                objectFit: 'contain',
            },
        }}>
        <img src={(_b = imagesObj[imageIndex]) === null || _b === void 0 ? void 0 : _b.url} alt={(_c = imagesObj[imageIndex]) === null || _c === void 0 ? void 0 : _c.alt}/>
      </material_1.Box>

      <material_1.DialogContent style={{ overflow: 'hidden' }}>
        <material_1.Box alignItems="center" display="flex" justifyContent="center">
          <material_1.IconButton onClick={handleLeftArrowClick}>
            <ArrowBackIos_1.default sx={{ color: imageIndex === 0 ? 'transparent' : 'white' }}/>
          </material_1.IconButton>

          {imagesObj.map(function (image, index) { return (<Circle_1.default key={image.alt} sx={{ fontSize: index === imageIndex ? 10 : 6, color: 'white', marginRight: 1 }}/>); })}

          <material_1.IconButton onClick={handleRightArrowClick}>
            <ArrowForwardIos_1.default style={{ color: imageIndex === imagesObj.length - 1 ? 'transparent' : 'white' }}/>
          </material_1.IconButton>
        </material_1.Box>
      </material_1.DialogContent>
    </material_1.Dialog>);
}
//# sourceMappingURL=ImageCarousel.js.map