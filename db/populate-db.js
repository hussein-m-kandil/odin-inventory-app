const { basename } = require('path');
const { argv, exit } = require('process');
const { Client } = require('pg');

const SQL = `
  CREATE TABLE IF NOT EXISTS languages (
    language_id  INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    language     VARCHAR(127) UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS books (
    book_id      INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    book         VARCHAR(255) NOT NULL,
    isbn         VARCHAR(13) UNIQUE NOT NULL,
    price        NUMERIC(10, 2) NOT NULL,
    pages        INTEGER NOT NULL,
    stock_count  INTEGER NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    language_id  INTEGER REFERENCES languages (language_id) ON UPDATE CASCADE
  );

  CREATE TABLE IF NOT EXISTS authors (
    author_id  INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    author     VARCHAR(255) UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS genres (
    genre_id  INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    genre     VARCHAR(255) UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS books_authors (
    book_id   INTEGER REFERENCES books (book_id) ON UPDATE CASCADE ON DELETE CASCADE,
    author_id INTEGER REFERENCES authors (author_id) ON UPDATE CASCADE,
    CONSTRAINT book_author_pk PRIMARY KEY (book_id, author_id)
  );

  CREATE TABLE IF NOT EXISTS books_genres (
    book_id  INTEGER REFERENCES books (book_id) ON UPDATE CASCADE ON DELETE CASCADE,
    genre_id INTEGER REFERENCES genres (genre_id) ON UPDATE CASCADE,
    CONSTRAINT book_genre_pk PRIMARY KEY (book_id, genre_id)
  );

  INSERT INTO languages (language)
       VALUES ('English')
  ON CONFLICT DO NOTHING;

  INSERT INTO books (book, isbn, pages, price, stock_count, language_id)
       VALUES ('Blue Ocean Strategy', '1591396190', 240, 23.91, '7',
              (SELECT language_id FROM languages WHERE language = 'English' LIMIT 1))
  ON CONFLICT DO NOTHING;

  INSERT INTO authors (author)
       VALUES ('W. Chan Kim'), ('Renée Mauborgne')
  ON CONFLICT DO NOTHING;

  INSERT INTO genres (genre)
       VALUES ('Business Management')
  ON CONFLICT DO NOTHING;

  INSERT INTO books_authors (book_id, author_id)
       VALUES (
               (SELECT book_id FROM books WHERE book = 'Blue Ocean Strategy' LIMIT 1),
               (SELECT author_id FROM authors WHERE author = 'W. Chan Kim' LIMIT 1)
              ),
              (
               (SELECT book_id FROM books WHERE book = 'Blue Ocean Strategy' LIMIT 1),
               (SELECT author_id FROM authors WHERE author = 'Renée Mauborgne' LIMIT 1)
              )
  ON CONFLICT DO NOTHING;

  INSERT INTO books_genres (book_id, genre_id)
       VALUES (
               (SELECT book_id FROM books WHERE book = 'Blue Ocean Strategy' LIMIT 1),
               (SELECT genre_id FROM genres WHERE genre = 'Business Management' LIMIT 1)
              )
  ON CONFLICT DO NOTHING;
`;

function getUrlToDB() {
  if (require.main === module) {
    if (argv.length === 3) {
      return argv[2].trim();
    }
    const runtime = basename(argv[0]);
    const filename = basename(argv[1]);
    console.log(
      `Usage: ${runtime} ${filename} <postgresql://user:pass@host:port/db>`
    );
    exit(1);
  }

  if (!process.env.PG_CONN_STR) {
    throw Error(
      'Cannot determine the DB connection string to proceed DB population!'
    );
  }

  return process.env.PG_CONN_STR;
}

async function main() {
  const dbUrl = getUrlToDB();
  try {
    console.log('Trying to populate the database...');
    const dbClient = new Client({ connectionString: dbUrl });
    console.log('Connecting...');
    await dbClient.connect();
    console.log('Seeding...');
    await dbClient.query(SQL);
    console.log('Disconnecting...');
    await dbClient.end();
    console.log('Done.');
  } catch (error) {
    if (require.main !== module) {
      throw error;
    }
    console.log(error);
    exit(2);
  }
}

if (require.main === module) main();
else module.exports = main;
