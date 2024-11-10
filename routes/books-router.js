const { Router } = require('express');
const booksController = require('../controllers/books-controller.js');

const router = Router();

router.get('/search', booksController.getSearchResult);
router.get('/', booksController.getBooks);
router.get('/new', booksController.getCreateBook);
router.post('/new', booksController.postCreateBook);
router.get('/:id/edit', booksController.getEditBook);
router.post('/:id/edit', booksController.postEditBook);
router.get('/:id/delete', booksController.getDeleteBook);
router.post('/:id/delete', booksController.postDeleteBook);
router.get('/:id', booksController.getBook);

module.exports = router;
