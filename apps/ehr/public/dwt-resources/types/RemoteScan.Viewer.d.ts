import { WebTwainAcquire } from "./WebTwain.Acquire";
import { DynamsoftEnumsDWT } from "./Dynamsoft.Enum";
import { DynamsoftViewer } from "./WebTwain.Viewer";

export interface RemoteScanViewer extends DynamsoftViewer {
	/**
 	* Return the indices of the selected images.
 	*/
	readonly selectedImagesIndices: number[];
	/**
 	* Crop the specified image using the specified coordinates.
	*/
	crop(index: number, rect: rect): Promise<void>;
	/**
 	* Rotate the specified image by the specified angle.
 	* @param index Specify the image.
 	* @param angle Specify the angle.
 	* @param keepSize Whether to keep the original size.
	*/
	rotate(index: number, angle: number, keepSize: boolean): Promise<void>;
	/**
     * Return the error code.
     */
    readonly errorCode: number;
    /**
     * Return the error string.
     */
    readonly errorString: string;
}

export interface rect{
    // The index of the selected area. The index is 0-based. This is useful when you have multiple selected areas on one page.
    index?: number;
    // The x-coordinate of the upper-left corner of the area.
    x: number;
    // The y-coordinate of the upper-left corner of the area.
    y: number;
    // The width of the selected area.
    width: number;
    // The height of the selected area.
    height: number;
}