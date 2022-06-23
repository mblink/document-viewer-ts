
# BondLink Document Viewer (WIP)
## PDF and docx viewer for Vanilla JavaScript and React applications

### Example Usage with HTML and Vanilla JS

If using webpack, copy `document-viewer/node_modules/pdfjs-dist/build/pdf.worker.min.js` to a local directory:

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
          from: "PATH/TO/NODE_MODULES/document-viewer/dist/webpack/pdf.worker.bundle.js",
          to: "PATH/TO/WORKER/FILE"
        }
      ]
    }
  ]
}

...

```

Call the init script in the root of your JS application using the path to your worker file.

`index.js`
```
import { init } from 'document-viewer'

init("PATH/TO/WORKER/FILE");
```

Wherever you want to include a document viewer in the HTML, include a `<div />` with `class="viewerContainer"` and `id` being some unique key (on the page) and `data-document-url` being the url of the document you want to display. Also make sure you're importing `styles.css` from the package in your HTML head.

`index.html`
```
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <script src="index.js"></script>
    <link rel="stylesheet" href="../node_modules/document-viewer/dist/styles/styles.css"></link>
  </head>
  <body>
    <div class="viewerContainer" id="doc-1" data-document-url="https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf"></div>
  </body>
</html>
```
