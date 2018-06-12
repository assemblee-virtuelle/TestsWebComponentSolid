const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    'js/main':'./main.js',
    'js/cardHandler':'./cardHandler.js'
  },
  output: {
    filename: '[name].[chunkhash].js',
    path: path.resolve(__dirname, 'static')
  },
  module: {
    rules: [{
      test: /.jsx?$/,
      include: [
        path.resolve(__dirname, 'app')
      ],
      exclude: [
        path.resolve(__dirname, 'node_modules'),
        path.resolve(__dirname, 'bower_components')
      ],
      loader: 'babel-loader'
    }]
  },
  resolve: {
    extensions: ['.json', '.js', '.jsx', '.css']
  },
  plugins: [new HtmlWebpackPlugin({
    template: 'static/html/index.html'
  })],
  mode:'development'
};