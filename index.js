const path = require('path');
const express = require('express');
const booksRouter = require('./routes/books-router.js');
const authorsGenresRouter = require('./routes/authors-genres-router.js');
const AppGenericError = require('./errors/app-generic-error.js');

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const VIEWS_DIR = path.join(process.cwd(), 'views');

const app = express();

const logger = (req, res, next) => {
  console.log(`${req.method}: ${req.originalUrl}`);
  next();
};

app.set('views', VIEWS_DIR);
app.set('view engine', 'ejs');

app.use(logger);
app.use(express.static(PUBLIC_DIR));

app.all('/', (req, res) => res.redirect('/books'));

app.use('/books', booksRouter);
app.use('/(authors|genres)', authorsGenresRouter);

const appErrorHandler = (error, req, res, next) => {
  console.log(error);
  if (error.name !== AppGenericError.name) {
    return next();
  }
  res.status(error.statusCode).render('error', {
    title: 'Error',
    message: error.message,
  });
};

app.use(appErrorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
