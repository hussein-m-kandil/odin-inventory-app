const { Router } = require('express');
const authorsGenresController = require('../controllers/generic-controller.js');

const router = Router();

router.get('/', authorsGenresController.getAll);
router.get('/new', authorsGenresController.getCreate);
router.post('/new', authorsGenresController.postCreate);
router.get('/:id/edit', authorsGenresController.getEdit);
router.post('/:id/edit', authorsGenresController.postEdit);
router.get('/:id/delete', authorsGenresController.getDelete);
router.post('/:id/delete', authorsGenresController.postDelete);
router.get('/:id/books', authorsGenresController.getBooks);

module.exports = router;
