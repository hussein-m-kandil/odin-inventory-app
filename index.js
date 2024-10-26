const express = require('express');
const db = require('./db/queries.js');

const app = express();

app.get('/', async (req, res) => {
  try {
    const allBooks = await db.readAllBooks();
    console.log(allBooks);
  } catch (error) {
    console.log(error);
  }
  res.send('Inventory App');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
