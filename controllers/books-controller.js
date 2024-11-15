const db = require('../db/queries.js');
const AppGenericError = require('../errors/app-generic-error.js');
const queryDB = require('../utils/query-db.js');
const { validationResult } = require('express-validator');
const {
  idValidators,
  bookValidators,
} = require('../middlewares/validators.js');
const { genCommaSepStrList } = require('../utils/string-formatters.js');

const ALL_BOOKS_TITLE = 'Odin Bookstore Inventory';
const ALL_BOOKS_VIEW = 'index';
const BOOK_VIEW = 'book';
const BOOK_FORM_VIEW = 'book-form';
const EDIT_BOOK_TITLE = 'Edit Book';
const CREATE_BOOK_TITLE = 'Add New Book';
const BOOK_BASE_COLS = [
  'book',
  'isbn',
  'pages',
  'price',
  'stock_count',
  'language_id',
];

const multipleDataQueries = [
  queryDB('languages', db.readAllRows, 'languages'),
  queryDB('authors', db.readAllRows, 'authors'),
  queryDB('genres', db.readAllRows, 'genres'),
];

const bookInfoQueries = [
  queryDB('book', db.readBook, (req) => req.params.id),
  ...multipleDataQueries,
];

const injectBookInfoFromChoices = (
  req,
  res,
  book,
  infoLocalsKey,
  infoEntityName
) => {
  if (req.body[infoLocalsKey]) {
    const choices = Array.isArray(req.body[infoLocalsKey])
      ? req.body[infoLocalsKey]
      : [req.body[infoLocalsKey]];
    // A book's multi-value field returns from DB as an object: `{ id: value, ... }`
    const idKey = `${infoEntityName}_id`;
    const valueKey = infoEntityName;
    book[infoLocalsKey] = Object.fromEntries(
      res.locals[infoLocalsKey]
        .filter((info) => choices.includes(String(info[idKey])))
        .map((info) => [`${info[idKey]}`, info[valueKey]])
    );
  } else {
    book[infoLocalsKey] = [];
  }
};

const renderFormAgainIfInvalid = (title, editing = false) => {
  return (req, res, next) => {
    const validationErrors = validationResult(req);
    if (validationErrors.isEmpty()) {
      next();
    } else {
      const book = {
        ...req.body,
        book_id: editing ? req.params.id : undefined,
      };
      injectBookInfoFromChoices(req, res, book, 'authors', 'author');
      injectBookInfoFromChoices(req, res, book, 'genres', 'genre');
      const errors = validationErrors.array();
      res.render(BOOK_FORM_VIEW, { title, errors, book });
    }
  };
};

const deleteBookJoinRows = (table, bookInfoName) => {
  return (req, res, next) => {
    if (req.body[bookInfoName]) {
      db.deleteRowsByWhereClause(table, 'book_id', req.params.id)
        .then(() => next())
        .catch(next);
    } else {
      const message = 'A book must have at least one author/genre!';
      next(new AppGenericError(message, 400));
    }
  };
};

const createBookJoinRows = (key, table, column) => {
  return (req, res, next) => {
    // Get book id based on whether we are now adding or editing a book
    const id = res.locals.newBook
      ? res.locals.newBook.rows[0].book_id
      : req.params.id;
    const values = Array.isArray(req.body[key])
      ? req.body[key]
      : [req.body[key]];
    Promise.allSettled(
      values.map((v) => {
        db.createRow(table, ['book_id', column], [id, v]);
      })
    ).then((results) => {
      next(results.find((r) => r.status === 'rejected')?.reason);
    });
  };
};

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
    ...bookInfoQueries,
    (req, res, next) => {
      if (!res.locals.book) {
        return next(new AppGenericError('No such a book!', 400));
      }
      res.render(BOOK_FORM_VIEW, { title: EDIT_BOOK_TITLE });
    },
  ],

  postEditBook: [
    ...idValidators,
    ...bookInfoQueries,
    ...bookValidators,
    renderFormAgainIfInvalid(EDIT_BOOK_TITLE, true),
    queryDB('updateBookResult', db.updateRowsByWhereClause, (req) => {
      const table = 'books';
      const clauseKey = 'book_id';
      const clauseValue = req.params.id;
      const columns = [...BOOK_BASE_COLS];
      const values = BOOK_BASE_COLS.map((col) => req.body[col]);
      columns.push('updated_at');
      values.push(new Date());
      return [table, clauseKey, clauseValue, columns, values];
    }),
    deleteBookJoinRows('books_authors', 'authors'),
    createBookJoinRows('authors', 'books_authors', 'author_id'),
    deleteBookJoinRows('books_genres', 'genres'),
    createBookJoinRows('genres', 'books_genres', 'genre_id'),
    (req, res) => {
      res.redirect(req.baseUrl);
    },
  ],

  getCreateBook: [
    ...multipleDataQueries,
    (req, res) => {
      res.render(BOOK_FORM_VIEW, { title: CREATE_BOOK_TITLE });
    },
  ],

  postCreateBook: [
    ...multipleDataQueries,
    ...bookValidators,
    renderFormAgainIfInvalid(CREATE_BOOK_TITLE),
    queryDB('addBookResult', db.createRow, (req) => {
      const table = 'books';
      const columns = [...BOOK_BASE_COLS];
      const values = BOOK_BASE_COLS.map((col) => req.body[col]);
      return [table, columns, values];
    }),
    async (req, res, next) => {
      if (res.locals.addBookResult instanceof AppGenericError) {
        res.locals.addBookResult.message = 'Book addition failed!';
        return next(res.locals.addBookResult);
      }
      res.locals.newBook = await db.readLastAddedBook();
      if (res.locals.newBook instanceof AppGenericError) {
        res.locals.newBook.message =
          'Unexpected Error: The Admin need to remove last added book entry and retry adding it!';
        return next(res.locals.newBook);
      }
      next();
    },
    createBookJoinRows('authors', 'books_authors', 'author_id'),
    createBookJoinRows('genres', 'books_genres', 'genre_id'),
    (req, res) => {
      res.redirect(req.baseUrl);
    },
  ],
};
