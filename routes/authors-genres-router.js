const { Router } = require('express');
const authorsGenresController = require('../controllers/authors-genres-controller.js');

const router = Router();

router.get('/', authorsGenresController.getAll);
router.get('/new', authorsGenresController.getCreate);
router.post('/new', authorsGenresController.postCreate);
// router.get('/:id/edit', authorsController.getEdit);
// router.post('/:id/edit', authorsController.postEdit);
// router.get('/:id/delete', authorsController.getDelete);
// router.post('/:id/delete', authorsController.postDelete);
// router.get('/:id', authorsController.getOne);

module.exports = router;
