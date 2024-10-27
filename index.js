const express = require('express');
const booksRouter = require('./routes/books-router.js');

const app = express();

const logger = (req, res, next) => {
  console.log(`${req.method}: ${req.originalUrl}`);
  next();
};

app.set('view engine', 'ejs');

app.use(logger);
app.use('/', booksRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
