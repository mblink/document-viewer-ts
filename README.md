
# Document Viewer
## PDF and docx viewer for Vanilla JavaScript and React applications

![license](https://img.shields.io/npm/l/document-viewer-ts)
![npm](https://img.shields.io/npm/v/document-viewer-ts)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/document-viewer-ts)

### Installation
Requires peer dependency `pdfjs-dist` at version `2.14.0` or higher:

```
npm install pdfjs-dist
```

Install the package:

```
npm install document-viewer-ts
```
### Example Usage
If using webpack, copy `PATH/TO/NODE_MODULES/pdfjs-dist/build/pdf.worker.min.js` to a local directory:

`webpack.config.ts`
```
import CopyPlugin from "copy-webpack-plugin";

...

const config = {
  ...
  plugins: [
    ...
    new CopyPlugin({
      patterns: [
        {
          from: "PATH/TO/NODE_MODULES/document-viewer/dist/worker/pdf.worker.min.js",
          to: "PATH/TO/WORKER/FILE"
        }
      ]
    }
  ]
}

...

```
#### With HTML and Vanilla JS

Call the init script in the root of your JS application using the path to your worker file.

`index.js`
```
import { init } from 'document-viewer'

init("PATH/TO/WORKER/FILE");
```

Wherever you want to include a document viewer in the HTML, include a `<div />` with `class="viewer-container"` and `id` being some unique key (on the page) and `data-document-url` being the url of the document you want to display. Also make sure you're importing `styles.css` from the package in your HTML head.

`index.html`
```
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <script src="./index.js"></script>
    <link rel="stylesheet" href="../node_modules/document-viewer/dist/styles/styles.css"></link>
  </head>
  <body>
    <div class="viewer-container" id="doc-1" data-document-url="https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf"></div>
  </body>
</html>
```

### With React

Import the `Viewer` component and call it with the proper `documentId`, `documentUrl`, and `workerSrc` props. Also make sure to import `styles.css` in your app.

`index.jsx`
```
import React from 'react'
import { Viewer } from 'document-viewer'
export default () =>
  <Viewer
    documentId="doc-1"
    documentUrl="https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf"
    workerSrc="PATH/TO/WORKER/FILE"
  />
```

