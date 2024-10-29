const path = require('path');
const express = require('express');
const booksRouter = require('./routes/books-router.js');
const authorsGenresRouter = require('./routes/authors-genres-router.js');

const VIEWS_DIR = path.join(process.cwd(), 'views');
const PUBLIC_DIR = path.join(process.cwd(), 'public');

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
app.use('(/authors|/genres)', authorsGenresRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
