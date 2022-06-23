const webpack = require("webpack"); // eslint-disable-line no-unused-vars
const path = require("path");

module.exports = {
  context: __dirname,
  entry: {
    example: "./dist/example/example.js",
    main: "./dist/lib/index.js",
    "pdf.worker": "pdfjs-dist/build/pdf.worker.entry",
  },
  mode: "none",
  output: {
    path: path.join(__dirname, "./dist/webpack"),
    publicPath: "./dist/webpack/",
    filename: "[name].bundle.js",
  },
};