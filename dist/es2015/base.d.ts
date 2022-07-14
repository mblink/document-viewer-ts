export interface ViewerWindow extends Window {
    viewerState: {
        [key: string]: {
            pageBreaks: number[];
            canvasElements: HTMLCanvasElement[];
        };
    };
}
export declare const renderPDF: (containerDiv: Element, documentUrl: string) => Promise<unknown>;
export declare const renderDocument: (containerDiv: Element) => void;
export declare const init: (workerSrc: string) => void;
