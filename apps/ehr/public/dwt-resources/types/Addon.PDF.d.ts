import { DynamsoftEnumsDWT } from "./Dynamsoft.Enum";

export interface PDF {
    /**
     * Convert the specified PDF file to image(s).
     * @param path The path of the PDF file.
     * @param successCallback A callback function that is executed if the request succeeds.
     * @param failureCallback A callback function that is executed if the request fails.
     * @argument errorCode The error code.
     * @argument errorString The error string.
     */
    ConvertToImage(
        path: string,
        resolution: number,
        successCallback: () => void,
        failureCallback: (
            errorCode: number,
            errorString: string
        ) => void
    ): void;
    /**
	 * @deprecated since version 18.4. This function will be removed in future versions. Use `GetReaderOptions` instead.
     * Return the convert mode.
     */
    GetConvertMode(): number;
    /**
     * Return whether the PDF module has been installed.
     */
    IsModuleInstalled(): boolean;
    /**
     * Detect whether a local PDF file is text based or not.
     * @path Specify the path of the PDF file.
     */
    IsTextBasedPDF(path: string): boolean;
    /**
     * Detect whether the local PDF file requires rasterization to be read.
     * @path Specify the path of the PDF file.
     */
    IsRasterizationRequired(path: string): boolean;
    /**
	 * @deprecated since version 18.4. This function will be removed in future versions. Use `SetReaderOptions` instead.
     * Set the convert mode.
     * @param mode Specify the mode.
     */
    SetConvertMode(mode: DynamsoftEnumsDWT.EnumDWT_ConvertMode | number): boolean;
    /**
	 * @deprecated since version 18.4. This function will be removed in future versions. Use `SetReaderOptions` instead.
     * Set the password for reading encrypted PDF files.
     * @param password Specify the password.
     */
    SetPassword(password: string): boolean;
    /**
	 * @deprecated since version 18.4. This function will be removed in future versions. Use `SetReaderOptions` instead.
     * Set the resolution for rasterizing.
     * @param resolution Specify the resolution.
     */
    SetResolution(resolution: number): boolean;
    /**
     * Set up the PDF writing engine.
     */
    Write: Write;
	/**
     * Set the PDF reader Options.
     * @param options Specify the reader Options.
     */
	SetReaderOptions(options: ReaderOptions): boolean;
	/**
     * Returns the current PDF reader options.
     * @param options Specify the reader Options.
     */
	GetReaderOptions(): ReaderOptions;
}
export interface Write {
    /**
     * Set up the PDF writing engine.
     * @param settings Configures how the PDF is generated.
     */
    Setup(settings: PDFWSettings): void;
}
export interface PDFWSettings {
    /**
     * Specify the author.
     */
    author?: string;
    /**
     * Specify the compression type.
     */
    compression?: DynamsoftEnumsDWT.EnumDWT_PDFCompressionType | number;
    /**
     * Specify the page type.
	 * 0: page width&height decided by image
	 * 2: A4
	 * 4: A3
	 * 6: Letter
	 * 8: Legal
     */
    pageType?: number;
	/**
     * Specify the creator.
     */
    creator?: string;
    /**
     * Specify the creation date.
     * Note that the argument should start with 'D:' like 'D:20181231'.
     */
    creationDate?: string;
    /**
     * Specify the key words.
     */
    keyWords?: string;
    /**
     * Specify the modified date.
     * Note that the argument should start with 'D:' like 'D:20181231'.
     */
    modifiedDate?: string;
    /**
     * Specify the producer.
     */
    producer?: string;
    /**
     * Specify the subject.
     */
    subject?: string;
    /**
     * Specify the title.
     */
    title?: string;
    /**
     * Specify the PDF version. For example, '1.5'.
     */
    version?: string;
    /**
     * Specify the quality of the images in the file.
     * The value ranges from 0 to 100.
     * Only valid when the {compression} is 'JPEG' or 'JPEG2000'.
     */
    quality?: number;
	/**
     * Reduce the file size when saving the image(s) as a PDF file. 
     */
	docCompressor?:{ //18.3
		/**
		 * Enabled document compressor.
		 */
		enabled: boolean;
		 /**
		 * sensitivity
		 * The value ranges from 1 to 100. Default value is 50.
		 * Only valid when the {compression} is 'JPEG' or 'JPEG2000'.
		 */
		sensitivity?: number;
		/**
		 * compressLevel
		 * The value ranges from 0 to 100. Default value is 50.
		 * Only valid when the {compression} is 'JPEG' or 'JPEG2000'.
		 */
		compressLevel?: number;
	}
	/**
     * When saving a PDF, you can set a password for protection.
     */
	password?: string;
}
export interface ReaderOptions {
    /**
     * Default value: CM_AUTO
     */
    convertMode: DynamsoftEnumsDWT.EnumDWT_ConvertMode | number;   
    /**
     * If a password is required to open the PDF, set it here. Default value: "".
     */
    password?: string; 
    renderOptions?: {
         /**
         * If convertMode is set to CM_RENDERALL or CM_AUTO, this controls whether or not annotations will be rendered. Default value: false.
         */
        renderAnnotations?: boolean;
        /**
         * DPI. Only affects text being rasterized. Does not affect images extracted from the PDF file. Default value: 200.
         */
		resolution?: number;  
         /**
         * Pixels. 0 is no limit. Default value: 0.
         */
		maxWidth?: number;
        /** 
         * Pixels. 0 is no limit. Default value: 0.
         */
		maxHeight?: number;
         /**
         * Whether or not to render in grayscale. Default value: false.
         */
		renderGrayscale?: boolean; 
    }; 
    /**
     * Set whether to preserve the original size when saving an unedited PDF. Default value: false.
     */
    preserveUnmodifiedOnSave?: boolean;   
}
