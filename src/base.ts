import { GlobalWorkerOptions, PDFDocumentProxy, PDFPageProxy, PageViewport, getDocument, renderTextLayer } from 'pdfjs-dist/legacy/build/pdf';
import { TextContent } from 'pdfjs-dist/types/src/display/api';

const chevronLeft = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-left" viewBox="0 0 16 16">
<path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
</svg>`;

const chevronRight = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16">
<path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
</svg>`;

const handleError = (containerDiv: Element) => (err: unknown) => {
  renderErrorMessage(containerDiv)(`There was an error fetching your document. Please try again later. Error: ${err}`);
};

const zoomValues = [50, 80, 100, 125, 150, 200, 300, 400];
const defaultWidth = 80;

const PDFtoCSSConvert = 96 / 72;
const defaultPageWidth = 700;

const scaleTextLayer = async (
  textLayerDiv: HTMLDivElement,
  textContent: TextContent,
  pdfPage: PDFPageProxy,
  canvas: HTMLCanvasElement,
  viewport: PageViewport,
  pdfScale: number,
) => {
  textLayerDiv.innerHTML = '';
  const textLayerFragment = document.createDocumentFragment();
  const scale =  pdfScale * (canvas.offsetWidth / viewport.width);
  const vs = pdfPage.getViewport({ scale });
  textLayerDiv.style.width = `${vs.width}px`;
  textLayerDiv.style.height = `${vs.height}px`;
  await renderTextLayer({
    textContent,
    container: textLayerFragment,
    viewport: vs
  }).promise;
  textLayerDiv.appendChild(textLayerFragment);
};

const createLoadingIndicator = () => {
  const container = document.createElement('div');
  container.className = 'indicator-container';
  const indicator = document.createElement('div');
  indicator.className = 'lds-ring';
  indicator.innerHTML = '<div></div><div></div><div></div><div></div></div>';
  container.appendChild(indicator);
  return container;
};

export const renderPDF = async (containerDiv: Element, documentUrl: string) => {
  const wrapperDiv = document.createElement('div');
  wrapperDiv.className = 'wrapper';
  containerDiv.appendChild(wrapperDiv);
  const loadingIndicator = createLoadingIndicator();
  wrapperDiv.appendChild(loadingIndicator);
  const documentId = containerDiv.id;

  const canvasContainer = document.createElement('div');
  canvasContainer.className = 'canvas-container';
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'viewer-controls';
  const fullPageNumberDiv = document.createElement('div');
  fullPageNumberDiv.className = 'page-number';
  const pageNumberInput = document.createElement('input');
  pageNumberInput.className = 'page-number-input';
  pageNumberInput.type = 'number';
  const pageDiv = document.createElement('div');
  const outOfDiv = document.createElement('div');
  const pageCountDiv = document.createElement('div');
  const nextButton = document.createElement('button');
  nextButton.className = 'next-button';
  const prevButton = document.createElement('button');
  prevButton.className = 'prev-button';
  const loadingTask = getDocument(documentUrl);

  const zoomSelect = document.createElement('select');
  zoomSelect.className = 'zoom-select';
  zoomValues.forEach((v) => {
    const zoomOption = document.createElement('option');
    zoomOption.value = `${v}`;
    zoomOption.textContent = `${v}%`;
    zoomSelect.appendChild(zoomOption);
  });
  zoomSelect.value=`${defaultWidth}`;

  const getZoomVal  = () => {
    const pageWidth = (containerDiv as HTMLElement).offsetWidth * (parseInt(zoomSelect.value) / 100);
    const scaledBy = pageWidth / defaultPageWidth * PDFtoCSSConvert;
    return scaledBy * 2.5;
  };

  try {
    const pdfDocument: PDFDocumentProxy = await loadingTask.promise;
    wrapperDiv.removeChild(loadingIndicator);

    const isValidPage = (page: number) => page <= pdfDocument.numPages && page > 0;

    // initial viewer setup
    pageNumberInput.value = '1';
    pageDiv.textContent = 'Page ';
    outOfDiv.textContent = '/';
    pageCountDiv.textContent = `${pdfDocument.numPages}`;
    fullPageNumberDiv.appendChild(pageDiv);
    fullPageNumberDiv.appendChild(pageNumberInput);
    fullPageNumberDiv.appendChild(outOfDiv);
    fullPageNumberDiv.appendChild(pageCountDiv);

    // page container setup
    const pageContainer = document.createElement('div');
    pageContainer.className = 'page-container';
    pageContainer.style.width = `${defaultWidth}%`;
    canvasContainer.style.alignItems = 'center';
    canvasContainer.appendChild(pageContainer);
    const canvas = document.createElement('canvas');
    canvas.className ='pdf-viewer-canvas';
    canvas.id = `${documentId}-canvas`;
    pageContainer.appendChild(canvas);

    // text layer setup
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'text-layer';
    pageContainer.appendChild(textLayerDiv);

    nextButton.innerHTML = chevronRight;
    prevButton.innerHTML = chevronLeft;


    wrapperDiv.appendChild(controlsDiv);
    controlsDiv.appendChild(prevButton);
    controlsDiv.appendChild(fullPageNumberDiv);
    controlsDiv.appendChild(nextButton);
    controlsDiv.appendChild(zoomSelect);
    wrapperDiv.appendChild(canvasContainer);

    const displayPage = async (page: number, scale: number) => {
      pageNumberInput.value = `${page}`;
      const pdfPage = await pdfDocument.getPage(page);
      const viewport = pdfPage.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = '100%';
      const ctx = canvas.getContext('2d');
      await pdfPage.render({
        canvasContext: ctx || {},
        viewport,
      });
      const textContent = await pdfPage.getTextContent();
      scaleTextLayer(
        textLayerDiv,
        textContent,
        pdfPage,
        canvas,
        viewport,
        getZoomVal(),
      );

      window.addEventListener('resize', () => {
        scaleTextLayer(
          textLayerDiv,
          textContent,
          pdfPage,
          canvas,
          viewport,
          getZoomVal(),
        );
      });
    };

    zoomSelect.onchange = async () => {
      const pageNumber = parseInt(pageNumberInput.value || '1');
      const zoomVal = parseInt(zoomSelect.value);
      pageContainer.style.width = `${zoomSelect.value}%`;
      if (zoomVal > 100) {
        canvasContainer.style.alignItems = 'flex-start';
      } else {
        canvasContainer.style.alignItems = 'center';
      }
      await displayPage(pageNumber, getZoomVal());
    };

    const skipPage = (direction: number) => () => {
      const pageNumber = parseInt(pageNumberInput.value || '1');
      const nextPageNumber = pageNumber + direction;
      if (isValidPage(nextPageNumber)) {
        displayPage(nextPageNumber, getZoomVal());
      }
    };
    nextButton.onclick = skipPage(1);
    prevButton.onclick = skipPage(-1);

    pageNumberInput.onchange = () => {
      const pageNumber = Math.max(Math.min(parseInt(pageNumberInput.value), pdfDocument.numPages), 1);
      displayPage(pageNumber, getZoomVal());
    };

    pageNumberInput.addEventListener('click', (e) => e.stopPropagation());
    zoomSelect.addEventListener('click', (e) => e.stopPropagation());

    containerDiv.addEventListener('keydown', (e) => {
      e.stopPropagation();
      switch((e as KeyboardEvent).key) {
        case('ArrowLeft'):
          skipPage(-1)();
          return;
        case('ArrowRight'):
          skipPage(1)();
          return;
        default:
          return;
      }
    });

    containerDiv.addEventListener('click', () => {
      (containerDiv as HTMLDivElement).focus();
    });

    containerDiv.setAttribute('tabIndex', '1');

    (containerDiv as HTMLDivElement).focus();

    await displayPage(1, getZoomVal());
  } catch(err) {
    handleError(containerDiv)(err);
    return err;
  }
};

const renderDocx = (containerDiv: Element, documentUrl: string) => {
  const microsoftViewer = document.createElement('iframe');
  microsoftViewer.width = '100%';
  microsoftViewer.height='100%';
  microsoftViewer.setAttribute('frameborder', '0');
  const params = new URLSearchParams({ src: documentUrl });
  microsoftViewer.setAttribute('src', `https://view.officeapps.live.com/op/embed.aspx?${params.toString()}`);
  containerDiv.appendChild(microsoftViewer);
};

const renderTxt = (containerDiv: Element, documentUrl: string) => {
  const embed = document.createElement('embed');
  embed.className = 'txt-embed';
  embed.setAttribute('src', documentUrl);
  containerDiv.appendChild(embed);
};

const renderErrorMessage = (containerDiv: Element) => (errorMessage: string) => {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = errorMessage;
  containerDiv.appendChild(errorDiv);
};

export const renderDocument = (workerSrc: string) => (containerDiv: Element) => {
  try {
    const documentUrl = containerDiv.getAttribute('data-document-url');
    containerDiv.classList.add('document-viewer-ts');
    if (!documentUrl) throw new Error('No document url specified');
    const splitOnPeriods = documentUrl.split('.');
    const extension = splitOnPeriods[(splitOnPeriods.length - 1)]?.split('?')[0];
    switch(extension) {
      case 'pdf':
        try {
          (() => globalThis)();
          new File([], 'test.txt');
          GlobalWorkerOptions.workerSrc = workerSrc;
          renderPDF(containerDiv, documentUrl);
        } catch (err) {
          renderErrorMessage(containerDiv)('Your browser does not support showing PDF previews. Click the download button to view this document.');
        }
        return;
      case 'doc': case 'docx': case 'ppt': case 'pptx': case 'xls': case 'xlsx': case 'xlt': case 'xlsm': case 'xlw': case 'pps': case 'ppxs': case 'ppsm': case 'sldx': case 'sldm':
        renderDocx(containerDiv, documentUrl);
        return;
      case 'txt':
        renderTxt(containerDiv, documentUrl);
        return;
      default:
        throw new Error('This file type is not supported for viewing in a web browser. Please click the “Download” button to view this document.');
    }
  } catch(err) {
    handleError(containerDiv)(err);
  }
};

const loadDocuments = (workerSrc: string) => () => {
  const containerDivs = document.getElementsByClassName('viewer-container');
  Array.from(containerDivs).forEach(renderDocument(workerSrc));
};

export const init = (workerSrc: string) => {
  loadDocuments(workerSrc)();
  window.addEventListener('load', loadDocuments(workerSrc));
};