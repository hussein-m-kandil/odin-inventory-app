const pool = require('./pool.js');

const createGeneralQuery = (where, limit) => {
  return `
    SELECT books.book_id,
            book,
            isbn,
            language,
            json_object_agg(DISTINCT authors.author_id, authors.author) AS authors,
            json_object_agg(DISTINCT genres.genre_id, genres.genre) AS genres,
            pages,
            price,
            stock_count,
            created_at,
            updated_at
      FROM books
      JOIN languages
        ON books.language_id = languages.language_id
      JOIN books_authors
        ON books.book_id = books_authors.book_id
      JOIN authors
        ON books_authors.author_id = authors.author_id
      JOIN books_genres
        ON books.book_id = books_genres.book_id
      JOIN genres
        ON books_genres.genre_id = genres.genre_id
  ${where || ''}
  GROUP BY books.book_id, language
  ${limit || ''}
`;
};

module.exports = {
  async readBook(id) {
    const query = {
      text: createGeneralQuery('WHERE books.book_id = $1', 'LIMIT 1'),
      values: [id],
    };
    return (await pool.query(query)).rows[0];
  },

  async readAllBooks() {
    const query = {
      text: createGeneralQuery(),
    };
    return (await pool.query(query)).rows;
  },

  async readAllAuthors() {
    const query = { text: 'SELECT * FROM authors' };
    return (await pool.query(query)).rows;
  },

  async readAuthor(id) {
    const query = {
      text: 'SELECT * FROM authors WHERE author_id = $1',
      values: [id],
    };
    return (await pool.query(query)).rows[0];
  },

  async createAuthor(author) {
    const query = {
      text: 'INSERT INTO authors (author) VALUES ($1)',
      values: [author],
    };
    return await pool.query(query);
  },
};
