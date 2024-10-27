const { Router } = require('express');
const booksController = require('../controllers/books-controller.js');

const router = Router();

router.get('/', booksController.getAllBooks);

module.exports = router;
