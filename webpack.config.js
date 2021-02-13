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
    rules: [
      {
        test: /\.js?$/,
        loader: 'babel-loader',
        options: {
          presets: ['es2015', 'react']
        },
        exclude: /node_modules/
      },
      {
        test: /\.css$/, use: ['style-loader', 'css-loader'],
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
  devtool: "eval"
};
