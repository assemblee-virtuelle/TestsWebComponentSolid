const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: {
    'js/main':'./main.js',
    'js/cardHandler':'./cardHandler.js',
    'html/index.html':'./views/index.html'
  },
  output: {
    filename: '[name].[chunkhash].js',
    path: path.resolve(__dirname, 'static')
  },
  module: {
    rules: [{
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
  mode:'development',
  plugins: [new HtmlWebpackPlugin({
    template: 'views/index.html'
  })]
};