const db = require('../db/queries.js');
const AppGenericError = require('../errors/app-generic-error.js');
const { param, validationResult } = require('express-validator');
const queryDB = require('../utils/query-db.js');

const ALL_BOOKS_TITLE = 'Odin Bookstore Inventory';
const ALL_BOOKS_VIEW = 'index';
const BOOK_VIEW = 'book';
const BOOK_FORM_VIEW = 'book-form';
const EDIT_BOOK_TITLE = 'Edit Book';
// const CREATE_BOOK_TITLE = 'Add New Book';

const formatStrArr = (strings) => {
  let str = strings[0] || '';
  if (strings.length === 2) {
    str += ` & ${strings[1]}`;
  } else if (strings.length > 2) {
    strings.forEach((s, i) => {
      if (i === s.length - 1) {
        str += `, & ${s}`;
      } else {
        str += `, ${s}`;
      }
    });
  }
  return str;
};

module.exports = {
  getAllBooks: [
    queryDB('books', db.readAllBooks),
    (req, res) => {
      const books = res.locals.books;
      books.forEach((b) => {
        b.authors = formatStrArr(Object.values(b.authors));
        b.genres = formatStrArr(Object.values(b.genres));
      });
      res.render(ALL_BOOKS_VIEW, { title: ALL_BOOKS_TITLE });
    },
  ],

  getBook: [
    param('id').isInt(),
    (req, res, next) => {
      return validationResult(req).isEmpty() ? next() : next('route');
    },
    queryDB('book', db.readBook, (req) => req.params.id),
    (req, res, next) => {
      const book = res.locals.book;
      if (!book) {
        return next(new AppGenericError('No such a book!', 400));
      }
      book.authors = formatStrArr(Object.values(book.authors));
      book.genres = formatStrArr(Object.values(book.genres));
      res.render(BOOK_VIEW);
    },
  ],

  getEditBook: [
    param('id').isInt(),
    (req, res, next) => {
      return validationResult(req).isEmpty() ? next() : next('route');
    },
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
