const path = require('path');
const express = require('express');
const booksRouter = require('./routes/books-router.js');
const genericRouter = require('./routes/generic-router.js');
const AppGenericError = require('./errors/app-generic-error.js');
const {
  getAllBooks,
  getSearchResult,
} = require('./controllers/books-controller.js');

const PUBLIC_DIR = path.join(__dirname, 'public');
const VIEWS_DIR = path.join(__dirname, 'views');

const app = express();

const logReq = (req, res, next) => {
  console.log(`${req.method}: ${req.originalUrl}`);
  next();
};

const addUrlToResLocals = (req, res, next) => {
  res.locals.url = req.originalUrl;
  next();
};

// eslint-disable-next-line no-unused-vars
const appErrorHandler = (error, req, res, next) => {
  console.log(error);
  let status, message;
  if (error instanceof AppGenericError) {
    status = error.statusCode;
    message = error.message;
  } else {
    status = error.status || error.statusCode || 500;
    message =
      status >= 400 && message < 500
        ? `Cannot ${req.method} ${req.originalUrl}`
        : 'Something went wrong! Try again later.';
  }
  res.redirect(`/error?status=${status}&message=${encodeURI(message)}`);
};

app.set('views', VIEWS_DIR);
app.set('view engine', 'ejs');

app.use(logReq);
app.use(addUrlToResLocals);
app.use(express.static(PUBLIC_DIR));
app.use(express.urlencoded({ extended: true }));

app.get('/error', (req, res) => {
  res
    .status(Number(req.query.status))
    .render('error', { title: 'Error', message: req.query.message });
});

app.get('/', getAllBooks);
app.get('/search', getSearchResult);

app.use('/books', booksRouter);
app.use('/(authors|genres|languages)', genericRouter);

app.use(appErrorHandler);

if (!process.env.SERVERLESS_FUNCTION) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Running on port ${PORT}`));
}

module.exports = app;
