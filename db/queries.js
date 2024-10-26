const pool = require('./pool.js');

module.exports = {
  async readAllBooks() {
    const query = {
      text: `
        SELECT books.book_id,
               book,
               isbn,
               language,
               string_agg(DISTINCT author, ' & ') as authors,
               string_agg(DISTINCT genre, ', ') as genres,
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
      GROUP BY books.book_id, language;
      `,
    };
    return (await pool.query(query)).rows;
  },
};
