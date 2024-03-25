const webpack = require("webpack"); // eslint-disable-line no-unused-vars
const path = require("path");

module.exports = {
  context: __dirname,
  entry: {
    example: "./build/example.js",
  },
  mode: "none",
  output: {
    path: path.join(__dirname, "./build/"),
    publicPath: "build/",
    filename: "[name].bundle.js",
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
  ]
};