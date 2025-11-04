import { DynamsoftEnumsDWT} from "./Dynamsoft.Enum";
import { WebTwain } from "./WebTwain";
import { DeviceConfiguration, ServiceInfo, Device, CapabilityDetails, Capabilities} from "./WebTwain.Acquire";
import { RemoteScanViewer } from "./RemoteScan.Viewer";

export interface RemoteScanObject {
	/**
	* Return how many images are held in the buffer
	*/
	readonly howManyImagesInBuffer: number;
	/**
	* Return the index of the current image in the buffer or set the image specified by index as the current image.
	*/
	currentImageIndexInBuffer: number;
    /**
    * Whether to show a progress bar when outputting. The default value is ture.
    */
	showProgressBar:boolean;
	/**
     * Return all available devices (scanners, eSCL scanners, etc.) for the device type (if specified)
     * @param deviceType The device type
     * @param refresh Default value: false
     */
	getDevices(deviceQueryParams?:{serviceInfo?:ServiceInfo, deviceType?: DynamsoftEnumsDWT.EnumDWT_DeviceType | number, refresh?:boolean}): Promise<Device[]>;
    /**
     * Scan documents into another DWTObject control. Supports eSCL scanners and all other scanners with limited capabilities.
     * @param device the device
	 * @param deviceConfiguration The device configuration
     */
	acquireImage(device: Device, deviceConfiguration?: DeviceConfiguration): Promise<void>;
    /**
     * Close the data source (a TWAIN/ICA/SANE device which in most cases is a scanner) to free it to be used by other applications.
     * @param device the device
	 */
	closeSource(device: Device): Promise<void>;
    /**
     * Gets detailed information about all capabilities of the current data source.
	 * @param device the device
     * @argument capabilityDetails Detailed information about the specified capabilities.
     */
	getCapabilities(device: Device):Promise<CapabilityDetails[]>;
    /**
     * Sets up one or multiple capabilities in one call.
	 * @param device the device
     * @param capabilities A object that describes how to set capabilities.
     */
	setCapabilities(device: Device, capabilities: Capabilities): Promise<void>;
    /**
     * Delete the Remote Scan Object.
     */
    dispose(): boolean;
	/**
     * Remote Scan Object's Viewer.
     */
	Viewer: RemoteScanViewer;
	/**
     * @param forceRefresh Default value: false.
     */
	getServices(forceRefresh?: boolean): Promise<ServiceInfo[]>;
	/**
     * Set the default dynamsoftService for storing the data
     */
	setDefaultService(serviceInfo:ServiceInfo):Promise<void>;
	/**
     * Get the default dynamsoftService.
     */
	getDefaultService():ServiceInfo|null;
	/**
     * Get image(s) form dynamsoftService.
	 * @param indices Specify the image(s).
	 * @param type The format of the file.
	 * @param imageFormatType The result format of the file.
     */
	getImages(
		indices: number[],
		type: DynamsoftEnumsDWT.EnumDWT_ImageType,
		imageFormatType:DynamsoftEnumsDWT.EnumDWT_ImageFormatType):Promise< Blob|string>;
    /**
     * Upload the specified image(s) via a HTTP Post.
     * @param URL The server-side script to receive the post.
     * @param indices Specify the image(s).
     * @param type The format of the file.
     * @param dataFormat Whether to upload the file as binary or a base64 string.
     * @param fileName The file name.
     * @argument response The response value.
     */
	httpUpload(
		URL: string,
		indices: number[],
		type: DynamsoftEnumsDWT.EnumDWT_ImageType | number,
		dataFormat: DynamsoftEnumsDWT.EnumDWT_UploadDataFormat | number,
		fileName: string,
		optionConfig?:{
			//'blob', 'arraybuffer', 'text', 'xml', 'json', default: 'text'
			responseType?: DynamsoftEnumsDWT.EnumDWT_ResponseType,
			formFields?:{
				name: string,
				value: Blob | string,
				fileName ? : string
			}[],
			headers?:{
				name: string,
				value: string
			}[]
		}
	): Promise<any>;
	/**
     * Save the specified image(s).
     * @param fileName The name to save to.
     * @param indices Specify the image(s).
     * @param type The format of the file.
     */
	saveImages(fileName: string, indices: number[], type: DynamsoftEnumsDWT.EnumDWT_ImageType):Promise<void>;
	/**
	* Remove the specified image.
	* @param indices Specify the image.
	*/
	removeImages(indices: number[]): Promise<void>;
	/**
	* Specify an event listener for the specified built-in event.
	* @param name Specify the event
	* @param callback The event listener
	*/
	registerEvent(name: string, callback: (...arg: any[]) => void): boolean;
	/**
	* Remove an event listener from the specified built-in event.
	* @param name Specify the event
	* @param callback The event listener
	*/
	unregisterEvent(name: string, callback?: (...arg: any[]) => void): boolean;
    /**
     * Set the log level for debugging.
     */
	setLogLevel(value: number): boolean;
    /**
     * Gets custom DS data and returns it in a base64 string.
     */
	getProfile(device: Device): Promise<string>;
    /**
     * Set custom data source data to be used for scanning, the input is a base64 string.
	 * @param dsDataString The string that contains custom data source data.
     */
	setProfile(device: Device, dsDataString: string): Promise<void>;
	/**
	 * Return the index of an image specified by the imageId.
	 * @param imageId The imageId of the image.
	 */
	imageIDToIndex(imageId: string): number;
	/**
	* Return the imageId of an image specified by the index.
	* @param index The index of the image.
	*/
	indexToImageID(index: number): string;
}

