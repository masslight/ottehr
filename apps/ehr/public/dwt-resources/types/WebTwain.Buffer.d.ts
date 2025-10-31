import { DynamsoftEnumsDWT } from "./Dynamsoft.Enum";
import { WebTwainIO } from "./WebTwain.IO";

export interface WebTwainBuffer extends WebTwainIO {
    /**
     * Return the current deviation of the pixels in the image.
     */
    readonly BlankImageCurrentStdDev: number;
    /**
     * Return or set the standard deviation of the pixels in the image.
     */
    BlankImageMaxStdDev: number;
    /**
     * Return or set the dividing line between black and white. The default value is 128.
     */
    BlankImageThreshold: number;
    /**
     * Return or set how much physical memory is allowed for storing images currently loaded in Dynamic Web TWAIN. Once the limit is reached, images will be cached on the hard disk.
     */
    BufferMemoryLimit: number;
    /**
     * Remove all tags from the specified image.
     * @param index Specify the image.
     */
    ClearImageTags(index: number): boolean;
    /**
     * Return or set the current index of image in the buffer.
     */
    CurrentImageIndexInBuffer: number;
    /**
     * Filter images by the specified tag.
     * @param tag The tag used as the filter.
     */
    FilterImagesByTag(tag: string): boolean;
    /**
     * Stop filtering images by tag. 
     */
    ClearFilter(): boolean;
    /**
     * Return the pixel bit depth of the specified image.
     * @param index Specify the image.
     */
    GetImageBitDepth(index: number): number;
    /**
     * Return the height (in pixels) of the specified image.
     * @param index Specify the image.
     */
    GetImageHeight(index: number): number;
    /**
     * Return the internal URL of the specified image. If width and height are not specified,
     * you get the original image, otherwise you get the image with specified width or height
     * while keeping the same aspect ratio. The returned string is like this
     * 'dwt://dwt_trial_13000404/img?id=306159652&index=0&t=1502184632022'.
     * @param index Specify the image.
     * @param width the width of the image, it must be 150 or bigger
     * @param height the height of the image, it must be 150 or bigger
     */
    GetImagePartURL(index: number, width?: number, height?: number): string;
    /**
     * Calculate the size in bytes of the specified image assuming it's resized to the given dimensions.
     * @param index Specify the image.
     * @param width Specify the width.
     * @param height Specify the height.
     */
    GetImageSize(index: number, width: number, height: number): number;
    /**
     * Calculate the size in bytes of the specified image assuming an expected file type.
     * @param index Specify the image.
     * @param type Sepcify the expected file type.
     */
    GetImageSizeWithSpecifiedType(index: number, type: DynamsoftEnumsDWT.EnumDWT_ImageType | number): number;
    /**
     * Return the direct URL of the specified image, if width or height is set to -1,
     * you get the original image, otherwise you get the image with specified width or
     * height while keeping the same aspect ratio.
     * @param index Specify the image.
     * @param width Specify the width.
     * @param height Specify the height.
     */
    GetImageURL(index: number, width?: number, height?: number): string;
    /**
     * Return the width (in pixels) of the specified image.
     * @param index Specify the image.
     */
    GetImageWidth(index: number): number;
    /**
     * Return the horizontal resolution of the specified image.
     * @param index Specify the image.
     */
    GetImageXResolution(index: number): number;
    /**
     * Return the vertical resolution of the specified image.
     * @param index Specify the image.
     */
    GetImageYResolution(index: number): number;
    /**
	 * @deprecated since version 16.1.1. This function will be removed in future versions. Use `SelectedImagesIndices` instead.
     * Return an index from the selected indices array. 
     * @param indexOfIndices Specify the index of the specified image.
     */
    GetSelectedImageIndex(indexOfIndices: number): number;
    /**
     * Calculate the size in bytes of all selected images assuming an expected file type.
     * @param type Sepcify the expected file type.
     */
    GetSelectedImagesSize(type: DynamsoftEnumsDWT.EnumDWT_ImageType | number): number;
	/**
	 * @deprecated since version 18.5. This property will be removed in future versions. Use asynchronous function `GetSkewAngle` instead.
     * Return the skew angle of the specified image.
     * @param index Specify the image.
     */
    GetSkewAngle(
        index: number
    ): number;
    /**
     * Return the skew angle of the specified image.
     * @param index Specify the image.
     * @param successCallback A callback function that is executed if the request succeeds.
     * @param failureCallback A callback function that is executed if the request fails.
     * @argument angle The skew angle.
     * @argument errorCode The error code.
     * @argument errorString The error string.
     */
    GetSkewAngle(
        index: number,
        successCallback?: (
            angle: number) => void,
        failureCallback?: (
            errorCode: number,
            errorString: string) => void
    ): void;
	/**
	 * @deprecated since version 18.5. This property will be removed in future versions. Use asynchronous function `GetSkewAngleEx` instead.
     * Return the skew angle of the specified rectangle on the specified image.
     * @param index Specify the image.
     * @param left The x-coordinate of the upper-left corner of the rectangle.
     * @param top The y-coordinate of the upper-left corner of the rectangle.
     * @param right The x-coordinate of the lower-right corner of the rectangle.
     * @param bottom The y-coordinate of the lower-right corner of the rectangle.
     */
    GetSkewAngleEx(
        index: number,
        left: number,
        top: number,
        right: number,
        bottom: number
    ): number;
    /**
     * Return the skew angle of the specified rectangle on the specified image.
     * @param index Specify the image.
     * @param left The x-coordinate of the upper-left corner of the rectangle.
     * @param top The y-coordinate of the upper-left corner of the rectangle.
     * @param right The x-coordinate of the lower-right corner of the rectangle.
     * @param bottom The y-coordinate of the lower-right corner of the rectangle.
     * @param successCallback A callback function that is executed if the request succeeds.
     * @param failureCallback A callback function that is executed if the request fails.
     * @argument angle The skew angle.
     * @argument errorCode The error code.
     * @argument errorString The error string.
     */
    GetSkewAngleEx(
        index: number,
        left: number,
        top: number,
        right: number,
        bottom: number,
        successCallback?: (
            angle: number) => void,
        failureCallback?: (
            errorCode: number,
            errorString: string) => void
    ): void;
    /**
     * Return how many images are held in the buffer
     */
    readonly HowManyImagesInBuffer: number;
    /**
     * Return or set whether the feature of disk caching is enabled.
     */
    IfAllowLocalCache: boolean;
    /**
     * Return the imageId of an image specified by the index.
     * @param index The index of the image.
     */
    IndexToImageID(index: number): string;
    /**
     * Return the index of an image specified by the imageId.
     * @param imageId The imageId of the image.
     */
    ImageIDToIndex(imageId: string): number;
    /**
     * Check whether the specified image is blank.
     * @param index Specify the image.
     */
    IsBlankImage(index: number): boolean;
    /**
	 * @deprecated since version 10.1. This function will be removed in future versions. Use `IsBlankImage` or `IsBlankImageExpress` instead.
     * Detect whether a certain area on an image is blank.
     * @param index Specify the image.
     * @param left The x-coordinate of the upper-left corner of the rectangle.
     * @param top The y-coordinate of the upper-left corner of the rectangle.
     * @param right The x-coordinate of the lower-right corner of the rectangle.
     * @param bottom The y-coordinate of the lower-right corner of the rectangle.
     * @param bFuzzyMatch Specify whether use fuzzy matching when detecting.
     */
    IsBlankImageEx(index: number, left: number, top: number, right: number, bottom: number, bFuzzyMatch: boolean): boolean;
    /**
     * Check whether the specified image is blank.
     * @param index Specify the image.
     */
    IsBlankImageExpress(index: number): boolean;
	/**
     * Check whether the specified image is blank.
     * @param index Specify the image.
     */
	IsBlankImageAsync(index: number, options?: {
		minBlockHeight?: number,//default value: 20
		maxBlockHeight?: number   //default value: 30
	}): Promise < boolean > ;
    /**
     * Return or set how many images can be held in the buffer.
     */
    MaxImagesInBuffer: number;
    /**
     * Change the position of an image in the buffer.
     * @param from Specify the original position by index.
     * @param to Specify the target position by index.
     */
    MoveImage(from: number, to: number): boolean;
    /**
     * Remove all images in the buffer.
     */
    RemoveAllImages(): boolean;
    /**
     * Remove the selected images in the buffer.
     */
    RemoveAllSelectedImages(): boolean;
    /**
     * Remove the specified image.
     * @param index Specify the image.
     */
    RemoveImage(index: number): boolean;
    /**
     * Select all images and return the indices.
     */
    SelectAllImages(): number[];
    /**
	 * @deprecated since version 16.1.1. This function will be removed in future versions. Use the length of SelectedImagesIndices instead.
     * Return how many images are selected.
     */
    SelectedImagesCount: number;
    /**
     * Return the indices of the selected images.
     */
    readonly SelectedImagesIndices: number[];
    /**
     * Select the specified images.
     * @param indices Specify one or multiple images.
     */
    SelectImages(indices: number[]): boolean;
    /**
	 * @deprecated since version 16.1.1. This function will be removed in future versions. Use `Viewer.selectionRectAspectRatio` instead.
     * Specify a aspect ratio to be used when selecting a rectangle on an image.
     */
    SelectionRectAspectRatio: number;
    /**
     * Set a default tag for newlay acquired images.
     * @param tag Specifies the tag.
     */
    SetDefaultTag(tag: string): boolean;
    /**
	 * @deprecated since version 16.1.1. This function will be removed in future versions. Use `SelectImages` and `SelectAllImages` instead.
     * You can use the method to select images programatically.
     * @param indexOfIndices The index of an array that holds the indices of selected images.
     * @param index The index of an image that you want to select.
     */
    SetSelectedImageIndex(indexOfIndices: number, index: number): boolean;
    /**
     * Exchange the positions of two images.
     * @param index1 Specify the 1st image.
     * @param index2 Specify the 2nd image.
     */
    SwitchImage(index1: number, index2: number): boolean;
    /**
     * Add a tag to specified images.
     * @param indices Specifies images to be tagged.
     * @param tag Specify the tag.
     */
    TagImages(indices: number[], tag: string): boolean;
    /**
     * Rename Tag.
     * @param oldTag Old tag name.
     * @param newTag Specify the new tag name.
     */
	RenameTag(oldTag: string, newTag: string): boolean;
    /**
     * Remove Tag.
     * @param tagName tag name.
     * @param indices Specifies images to be removed.
     */
	RemoveTag(tagName: string, indices?: number[]):boolean;
    /**
     * Get the status of the tags.
     */
	GetTagList(): TagInfo[];
	/**
     * Get the status of the tags for a specific image.
	 * @param index Specify one image.
     */
	GetTagListByIndex(index:number): string[];	
	/**
     * Get the current document name.
     */
	GetCurrentDocumentName(): string;
	/**
     * Create the document.
	 * @param fileName Specify the document name.
     */
	CreateDocument(documentName: string):boolean;
	/**
     * open the document.
	 * @param fileName Specify the document name.
     */
	OpenDocument(documentName: string):boolean;
	/**
     * remove the document.
     */
	RemoveDocument(documentName:string):boolean;
	/**
	 * Rename a document.
	 * @argument oldDocumentName Specify the old document name.
	 * @argument newDocumentName Specify the new document name.
	 */
	RenameDocument(oldDocumentName:string, newDocumentName:string):boolean;
	/**
     * Get the info of the all documents.
     */
	GetDocumentInfoList(): DocumentInfo[];
	/**
     * Gets the RawData for the specified image captured from camera.
     */
	GetRawDataAsync(index: number): Promise<RawData>;
	/*
	 * Move selected images to another document.
     * @argument from The source document document name. 
	 * @argument to The destination document name. 
	 */
	MoveToDocumentAsync(from: string, to: string): Promise<void>;
	/*
	 * Move selected images to another document.
     * @argument from The source document document name. 
	 * @argument to The destination document name. 
	 * @argument sourceIndices The indices of the images to be moved. 
	 */
	MoveToDocumentAsync(from: string, to: string, sourceIndices: number[]): Promise<void>;
	/*
	 * Move selected images to another document.
     * @argument from The source document document name. 
	 * @argument to The destination document name. 
	 * @argument targetIndex The index at which the source images should be inserted into the new document. If not specifed, the images will be appended to the destination document.
	 */
	MoveToDocumentAsync(from: string, to: string, targetIndex: number): Promise<void>;
	/*
	 * Move selected images to another document.
     * @argument from The source document document name. 
	 * @argument to The destination document name. 
	 * @argument sourceIndices The indices of the images to be moved. 
	 * @argument targetIndex The index at which the source images should be inserted into the new document. If not specifed, the images will be appended to the destination document.
	 */
	MoveToDocumentAsync(from: string, to: string, sourceIndices: number[], targetIndex: number): Promise<void>;
	/*
	 * Copy selected images to another document.
     * @argument from The source document document name.
	 * @argument to The destination document name.	 
	 */
	CopyToDocumentAsync(from: string, to: string): Promise<void>;
	/*
	 * Copy selected images to another document.
     * @argument from The source document document name.
	 * @argument to The destination document name.
	 * @argument sourceIndices The indices of the images to be copied.  
	 */
	CopyToDocumentAsync(from: string, to: string, sourceIndices: number[]): Promise<void>;
	/*
	 * Copy selected images to another document.
     * @argument from The source document document name.
	 * @argument to The destination document name.
	 * @argument targetIndex The index at which the source images should be inserted into the new document. If not specifed, the images will be appended to the destination document. 	 
	 */
	CopyToDocumentAsync(from: string, to: string, targetIndex: number): Promise<void>;
	/*
	 * Copy selected images to another document.
     * @argument from The source document document name.
	 * @argument to The destination document name.
	 * @argument sourceIndices The indices of the images to be copied. 
	 * @argument targetIndex The index at which the source images should be inserted into the new document. If not specifed, the images will be appended to the destination document. 	 
	 */
	CopyToDocumentAsync(from: string, to: string, sourceIndices: number[], targetIndex: number): Promise<void>;
	/*
     * Update server-side data.
	 * @param imageId The imageId of the image.
     * @param blob Specify the blob. 
     */
	updateImage(imageId: string, blob: Blob): Promise <void>;
}


export interface TagInfo {
    name: string;
    imageIds: string[];
}

export interface DocumentInfo {
    name: string;
    imageIds: string[];
}

export interface RawData {
	displayImage:{  //Data of the display image, after filter and crop effects
		data: Blob;
		bitDepth: number;
		height: number;
		resolutionX: number;
		resolutionY: number;
		width: number;
	},
	documentData:{
		angle: number;  //the clockwise rotation angle of the original image
		polygon: [{x:number, y:number},{x:number, y:number},{x:number, y:number},{x:number, y:number}]; //selection area
		filterValue: string;
		originImage:{ //Data of the original image
			bitDepth: number;
			data: Blob;
			height: number;
			width: number;
			resolutionX: number;
			resolutionY: number;
		}
	}
}

