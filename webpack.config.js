const path = require('path');

module.exports = {
  entry: './main.js',
  output: {
    filename: 'bundle.js',
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
  mode:'development'
};