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
      popup: './src/popup/main.js',
      options: './src/options/main.js',
      background: './src/background/index.js',
      content: './src/content/index.js',
    },

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].bundle.js',
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
      ...(isProduction ? [new MiniCssExtractPlugin({ filename: '[name].css' })] : []),
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
          { from: 'manifest.json', to: 'manifest.json' },
          { from: 'public', to: 'public', noErrorOnMissing: true },
          { from: 'variant.js', to: 'variant.js' },
          { from: 'injected_probe.js', to: 'injected_probe.js' },
          { from: 'spa_monitor.js', to: 'spa_monitor.js' },
          { from: 'html2canvas.min.js', to: 'html2canvas.min.js' },
          { from: 'images', to: 'images', noErrorOnMissing: true },
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
        chunks: 'all',
      },
    },
  };
};
