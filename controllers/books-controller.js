const db = require('../db/queries.js');

const ALL_BOOKS_VIEW = 'index';
const ALL_BOOKS_TITLE = 'Odin Bookstore Inventory';

module.exports = {
  async getAllBooks(req, res) {
    res.locals.title = ALL_BOOKS_TITLE;
    try {
      const books = await db.readAllBooks();
      res.render(ALL_BOOKS_VIEW, { books });
    } catch (error) {
      console.log(error);
      res.render(ALL_BOOKS_VIEW);
    }
  },
};
