const gulp = require('gulp');
const gutil = require('gulp-util');
const livereload = require('gulp-livereload');

const config = {
  entry: 'app.js',
  jsPattern: 'src/js/**/*.js',
  sassPattern: 'src/css/**/*.scss',
  production: !!gutil.env.production
};
const folder = {
  build: 'build/',
  source: 'src/'
};

const handleError = function handleError(err) {
  gutil.log(err);
  this.emit('end');
};

gulp.task('default', ['server']);

// Minify images
gulp.task('images', () => {
  const imagemin = require('gulp-imagemin');
  const newer = require('gulp-newer');
  const out = folder.build + 'img/';
  return gulp
    .src(folder.src + 'img/*')
    .pipe(newer(out))
    .pipe(
      imagemin({
        optimizationLevel: 5
      })
    )
    .pipe(gulp.dest(out));
});

// Copy HTML to build folder
gulp.task('copy-html', () => {
  const htmlmin = require('gulp-htmlmin');
  const out = folder.build;
  return gulp
    .src('src/*.html')
    .pipe(
      config.production ? htmlmin({ collapseWhitespace: true }) : gutil.noop()
    )
    .pipe(gulp.dest(out))
    .pipe(livereload());
});

// Build CSS, minify, autoprefix, copy to build folder
gulp.task('build-css', () => {
  const sass = require('gulp-sass');
  const cleanCSS = require('gulp-clean-css');
  const postcss = require('gulp-postcss');
  const sourcemaps = require('gulp-sourcemaps');
  const out = folder.build + 'css';
  return gulp
    .src(config.sassPattern)
    .pipe(sourcemaps.init())
    .pipe(sass())
    .on('error', handleError)
    .pipe(postcss([require('precss'), require('autoprefixer')]))
    .pipe(config.production ? cleanCSS({ compatibility: 'ie8' }) : gutil.noop())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(out))
    .pipe(livereload());
});

// Transpiles ES6 -> ES5
gulp.task('build-js', () => {
  const babel = require('gulp-babel');
  const webpack = require('webpack-stream');
  const uglify = require('gulp-uglify');
  const pump = require('pump');
  const input = `${folder.source}/${config.entry}`;
  const out = folder.build;
  return gulp
    .src(input)
    .pipe(webpack(require('./webpack.config.js')))
    .on('error', handleError)
    .pipe(
      babel({
        presets: ['env']
      })
    )
    .on('error', handleError)
    .pipe(config.production ? uglify() : gutil.noop())
    .on('error', gutil.log)
    .pipe(gulp.dest(out))
    .pipe(livereload());
});

// Server for live reloading -- requires LiveReload Chrome extension
gulp.task('server', done => {
  const http = require('http');
  const st = require('st');

  http
    .createServer(
      st({ path: __dirname + '/build', index: 'index.html', cache: false })
    )
    .listen(8080, done);

  // Default watch processes
  livereload.listen();
  gulp.watch(config.sassPattern, ['build-css']);
  gulp.watch('src/*.html', ['copy-html']);
  gulp.watch('src/*.js', ['build-js']);
});

// Complete build process for production
gulp.task('build', ['copy-html', 'build-css', 'build-js', 'images']);

// Final deploy task
gulp.task('deploy', ['build'], () => {
  const ghPages = require('gulp-gh-pages');
  return gulp.src('./build/**/*').pipe(ghPages());
});
