const db = require('../db/queries.js');
const AppGenericError = require('../errors/app-generic-error.js');
const idValidators = require('../middlewares/id-validators.js');
const queryDB = require('../utils/query-db.js');
const { genCommaSepStrList } = require('../utils/string-formatters.js');

const ALL_BOOKS_TITLE = 'Odin Bookstore Inventory';
const ALL_BOOKS_VIEW = 'index';
const BOOK_VIEW = 'book';
const BOOK_FORM_VIEW = 'book-form';
const EDIT_BOOK_TITLE = 'Edit Book';
// const CREATE_BOOK_TITLE = 'Add New Book';

module.exports = {
  getAllBooks: [
    queryDB('books', db.readAllBooks),
    (req, res) => {
      const books = res.locals.books;
      books.forEach((b) => {
        b.authors = genCommaSepStrList(Object.values(b.authors));
        b.genres = genCommaSepStrList(Object.values(b.genres));
      });
      res.render(ALL_BOOKS_VIEW, { title: ALL_BOOKS_TITLE });
    },
  ],

  getBook: [
    ...idValidators,
    queryDB('book', db.readBook, (req) => req.params.id),
    (req, res, next) => {
      const book = res.locals.book;
      if (!book) {
        return next(new AppGenericError('No such a book!', 400));
      }
      book.authors = genCommaSepStrList(Object.values(book.authors));
      book.genres = genCommaSepStrList(Object.values(book.genres));
      res.render(BOOK_VIEW);
    },
  ],

  getEditBook: [
    ...idValidators,
    queryDB('book', db.readBook, (req) => req.params.id),
    queryDB('authors', db.readAllRows, 'authors'),
    queryDB('genres', db.readAllRows, 'genres'),
    (req, res, next) => {
      if (!res.locals.book) {
        return next(new AppGenericError('No such a book!', 400));
      }
      res.render(BOOK_FORM_VIEW, { title: EDIT_BOOK_TITLE });
    },
  ],
};
