const db = require('../db/queries.js');
const { queryDB } = require('../utils/query-db.js');

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
  async getAllBooks(req, res) {
    res.locals.title = ALL_BOOKS_TITLE;
    const [error, books] = await queryDB(res, ALL_BOOKS_VIEW, db.readAllBooks);
    if (!error) {
      books.forEach((b) => {
        b.authors = formatStrArr(Object.values(b.authors));
        b.genres = formatStrArr(Object.values(b.genres));
      });
      res.render(ALL_BOOKS_VIEW, { books });
    }
  },

  async getBook(req, res) {
    const [error, book] = await queryDB(
      res,
      BOOK_VIEW,
      db.readBook,
      req.params.id
    );
    if (!error) {
      if (book) {
        book.authors = formatStrArr(Object.values(book.authors));
        book.genres = formatStrArr(Object.values(book.genres));
        res.render(BOOK_VIEW, { book });
      } else {
        res.status(400).render(BOOK_VIEW, { error: 'No such a book!' });
      }
    }
  },

  async getEditBook(req, res) {
    res.locals.title = EDIT_BOOK_TITLE;
    const inquiries = [
      ['book', db.readBook, req.params.id],
      ['authors', db.readAllRows, 'authors'],
      ['genres', db.readAllRows, 'genres'],
    ];
    const dbResults = {};
    for (let i = 0; i < inquiries.length; i++) {
      const [inquiry, queryMethod, ...queryArgs] = inquiries[i];
      const [error, result] = await queryDB(
        res,
        BOOK_FORM_VIEW,
        queryMethod,
        ...queryArgs
      );
      if (error) return; // Quit: queryDB has ended the request with 500
      dbResults[inquiry] = result;
    }
    if (!dbResults.book) {
      return res
        .status(400)
        .render(BOOK_FORM_VIEW, { error: 'No such a book!' });
    }
    res.render(BOOK_FORM_VIEW, dbResults);
  },
};
