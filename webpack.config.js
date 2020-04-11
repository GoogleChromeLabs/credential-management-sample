const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const src = path.join(__dirname, 'src');
const dst = path.join(__dirname, 'dist');

module.exports = (env, argv) => {
  const PRODUCTION = argv.mode === 'production';
  return [{
    mode: PRODUCTION ? 'production' : 'development',
    entry: {
      'scripts/bundle': path.join(src, 'scripts', 'bundle.ts'),
      'scripts/main': path.join(src, 'scripts', 'main.ts'),
      'scripts/style-bundle': path.join(src, 'styles', 'main.scss')
    },
    output: {
      path: dst,
      filename: '[name].js'
    },
    module: {
      rules: [{
        test: /\.ts$/,
        loader: 'ts-loader',
        exclude: /node_modules/
      }, {
        test: /\.scss$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: path.join('styles', 'bundle.css')
            }
          },
          { loader: 'extract-loader' },
          { loader: 'css-loader' },
          {
            loader: 'sass-loader',
            options: {
              implementation: require('sass'),
              sassOptions: {
                includePaths: ['./node_modules']
              }
            }
          }
        ]
      }]
    },
    resolve: {
      extensions: [ '.ts', '.js' ]
    },
    plugins: [
      new CopyWebpackPlugin([{
        from: path.join(src, 'index.html'),
        to: path.join(dst, 'index.html')
      }, {
        from: path.join(src, 'favicon.png'),
        to: path.join(dst, 'favicon.png')
      }, {
        from: path.join(src, 'manifest.json'),
        to: path.join(dst, 'manifest.json')
      }, {
        from: path.join(src, 'images'),
        to: path.join(dst, 'images')
      }])
    ]
  }];
}