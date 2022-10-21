const handleError = (containerDiv: Element) => (err: unknown) => {
  renderErrorMessage(containerDiv)(`There was an error fetching your document. Please try again later. Error: ${err}`);
};

const renderPDF = (containerDiv: Element, documentUrl: string) => {
  const mozillaPDFViewer = document.createElement('iframe');
  mozillaPDFViewer.width = '100%';
  mozillaPDFViewer.height='100%';
  mozillaPDFViewer.setAttribute('frameborder', '0');
  const params = new URLSearchParams({ file: documentUrl });
  mozillaPDFViewer.setAttribute('src', `https://mozilla.github.io/pdf.js/web/viewer.html?${params.toString()}`);
  containerDiv.appendChild(mozillaPDFViewer);
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

export const renderDocument = (containerDiv: Element) => {
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

const loadDocuments = () => {
  const containerDivs = document.getElementsByClassName('viewer-container');
  Array.from(containerDivs).forEach(renderDocument);
};

export const init = () => {
  loadDocuments();
  window.addEventListener('load', loadDocuments);
};