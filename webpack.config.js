var webpack = require('webpack');
module.exports = {
  entry: {
    app : "./client/app.js"
  },
  output: {
    path: __dirname + '/annotation_tools/static',
    filename: "[name].bundle.js"
  },
  module: {
    loaders: [
      {
        test: /\.js?$/,
        loader: 'babel-loader',
        query: {
          presets: ['es2015', 'react']
        },
        exclude: /node_modules/
      },
      {
        test: /\.css$/, loader: 'style-loader!css-loader'
      }
    ]
  },
  plugins: [
      new webpack.ProvidePlugin({
        $: 'jquery',
        jQuery: 'jquery',
        'window.jQuery': 'jquery',
        Popper: ['popper.js', 'default'] // Bootstrap 4 dependence
    })
  ],
  devtool: "cheap-eval-source-map"
};