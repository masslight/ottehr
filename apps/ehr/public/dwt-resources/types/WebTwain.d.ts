import { DynamsoftEnumsDWT } from "./Dynamsoft.Enum";
import { WebTwainViewer } from "./WebTwain.Viewer";
import { BarcodeReader } from "./Addon.BarcodeReader";
import { OCR } from "./Addon.OCR";
import { OCRPro } from "./Addon.OCRPro";
import { PDF } from "./Addon.PDF";
import { Webcam } from "./Addon.Webcam";

export interface WebTwain extends WebTwainViewer {
    /**
     * Addons to WebTwain instances.
     */
    Addon: Addon;
    /**
	 * @deprecated since version 10.1. This property will be removed in future versions. 
     * This API is no longer needed.
     */
    AllowMultiSelect: boolean;
    /**
	 * @deprecated since version 10.1. This property will be removed in future versions. 
     * This API is no longer needed.
     */
    AllowPluginAuthentication: boolean;
    /**
	 * @deprecated since version 10.1. This property will be removed in future versions. 
     * This API is no longer needed.
     */
    AsyncMode: boolean;
    /**
	 * @deprecated since version 10.1. This property will be removed in future versions. 
     * This API is no longer needed.
     */
    BorderStyle: DynamsoftEnumsDWT.EnumDWT_BorderStyle | number;
    /**
     * Return whether a WebTwain instance is ready to use.
     */
    readonly bReady: boolean;
    /**
	 * @deprecated since version 10.1. This property will be removed in future versions. 
     * This API is no longer needed.
     */
    BrokerProcessType: number;
    /**
	 * @deprecated since version 10.1. This property will be removed in future versions. 
     * This API is no longer needed.
     */
    EnableInteractiveZoom: boolean;
}
export interface Addon {
    BarcodeReader: BarcodeReader;
    OCR: OCR;
    OCRPro: OCRPro;
    PDF: PDF;
    Webcam: Webcam;
}
