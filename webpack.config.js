const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    mode: argv.mode || 'development',
    devtool: isProduction ? false : 'source-map',
    target: 'web',

    entry: {
      popup: './src/popup/index.js',
      options: './src/options/main.js',
      background: './src/background/index.js',
      content: './src/content/index.js',
    },

    output: {
      path: path.resolve(__dirname, 'dist'),
      // background/content 被 manifest.json 直接引用，不能加 hash
      // popup/options 由 HtmlWebpackPlugin 自动注入，可以加 hash
      filename: (pathData) => {
        if (pathData.chunk.name === 'popup' || pathData.chunk.name === 'options') {
          return isProduction ? '[name].[contenthash].bundle.js' : '[name].bundle.js';
        }
        return '[name].bundle.js';
      },
      clean: true,
    },

    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: 'vue-loader',
        },
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
            },
          },
        },
        {
          test: /\.css$/,
          use: [isProduction ? MiniCssExtractPlugin.loader : 'style-loader', 'css-loader'],
        },
      ],
    },

    plugins: [
      new VueLoaderPlugin(),
      ...(isProduction ? [new MiniCssExtractPlugin({ filename: isProduction ? '[name].[contenthash].css' : '[name].css' })] : []),
      new HtmlWebpackPlugin({
        template: './src/popup/index.html',
        filename: 'popup.html',
        chunks: ['popup'],
      }),
      new HtmlWebpackPlugin({
        template: './src/options/index.html',
        filename: 'options.html',
        chunks: ['options'],
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'public', to: '.' },
          {
            from: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
            to: 'pdf.worker.min.mjs',
          },
        ],
      }),
    ],

    resolve: {
      extensions: ['.js', '.vue'],
      alias: {
        vue$: 'vue/dist/vue.esm-bundler.js',
      },
    },

    optimization: {
      minimize: isProduction,
      minimizer: [new TerserPlugin()],
      splitChunks: {
        chunks: 'async',
      },
    },

    // Warn on oversized initial UI bundles. Lazy document parsers and the
    // dedicated PDF worker are intentionally loaded only after file upload.
    performance: {
      assetFilter: (filename) => /\.(?:bundle\.js|css)$/.test(filename),
    },
  };
};
