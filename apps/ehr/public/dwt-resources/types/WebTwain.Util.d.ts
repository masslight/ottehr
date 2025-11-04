import { DynamsoftEnumsDWT } from "./Dynamsoft.Enum";

export interface WebTwainUtil {
    /**
     * Return the error code.
     */
    readonly ErrorCode: number;
    /**
     * Return the error string.
     */
    readonly ErrorString: string;
    /**
     * The reason for returning the error is an extension of the ErrorString.
     */
    readonly ErrorCause: {code: number, message: string} | null;
    /**
     * Return or set the log level for debugging.
     */
    LogLevel: number;
    /**
     * Manufacturer in the identity string of the Dynamic Web TWAIN library.
     */
    readonly Manufacturer: string;
    /**
     * ProductFamily in the identity string of the Dynamic Web TWAIN library.
     */
    readonly ProductFamily: string;
    /**
	 * @deprecated since version 18.0. This property will be removed in future versions. Use `Dynamsoft.DWT.ProductKey` instead.
     * Return or set the ProductKey.
     */
    ProductKey: string;
    /**
     * ProductName in the identity string of the Dynamic Web TWAIN library.
     */
    readonly ProductName: string;
    /**
     * Generate a URL to be used by a FileUploader instance to fetch the data to upload.
     * @param indices Specify the images to upload.
     * @param type Specify the file type.
     * @param successCallback A callback function that is executed if the request succeeds.
     * @param failureCallback A callback function that is executed if the request fails.
     * @argument resultURL The generated URL.
     * @argument indices The indices of the images.
     * @argument type The file type.
     */
    GenerateURLForUploadData(
        indices: number[],
        type: DynamsoftEnumsDWT.EnumDWT_ImageType | number,
        successCallback: (
            resultURL: string,
            indices: number[],
            type: DynamsoftEnumsDWT.EnumDWT_ImageType | number
        ) => void,
        failureCallback: (
            errorCode: number,
            errorString: string
        ) => void
    ): void;
    /**
     * Specify an event listener for the specified built-in event.
     * @param name Specify the event
     * @param callback The event listener
     */
    RegisterEvent(name: string, callback: (...arg: any[]) => void): boolean;
    /**
     * Set the language for the authorization dialogs.
     * @param language Specify the language.
     */
    SetLanguage(
        language: DynamsoftEnumsDWT.EnumDWT_Language | number
    ): boolean;
    /**
     * Remove an event listener from the specified built-in event.
     * @param name Specify the event
     * @param callback The event listener
     */
    UnregisterEvent(name: string, callback?: (...arg: any[]) => void): boolean;
    /**
     * VersionInfo in the identity string of the Dynamic Web TWAIN library.
     */
    readonly VersionInfo: string;
    /**
	 * @deprecated since version 18.0. This function will be removed in future versions. Use property `Dynamsoft.DWT.ProductKey` instead.
     * Update / set the ProductKey.
     * @param productKey the ProductKey.
     */
    SetProductKeyAsync(productKey: string): Promise<Authorization>;
    /**
     * Whether using ActiveX.
     */
	isUsingActiveX(): boolean;
	 /**
     * Return whether this webTwain instance is in Local-Service mode or WASM mode.
     */
	UseLocalService: boolean;
}

export interface Authorization {
    /**
     * The domain bound in the product key.
     */
    Domain: string;
    /**
     * Details of the authorization.
     */
    Detail: any;
}

export interface BufferChangeInfo {
    /**
     * Action type includes 'add', 'remove', 'modify', 'shift' and 'filter'
     */
    action: string;
    /**
     * The image id (not the index) of the current page.
     */
    currentId: string;
    /**
     * All image ids.
     */
    imageIds: string[];
    /**
     * All selected image ids.
     */
    selectedIds: string[];
    /**	
	 * only when the value of action is 'modify'
	 */
	modifiedId?: string; 
}

export interface OutputInfo {
  /**
   * Id of the image if it's transferred to the buffer.
   */
  imageId?: string;
  /**
   * Path of the image if it's transferred to the disk.
   */
  path?: string;
  /**
   * Information about the image.
   */
  imageInfo?: object;
  /**
   * Extended information about the image.
   */
  extendedImageInfo?: object;
}



