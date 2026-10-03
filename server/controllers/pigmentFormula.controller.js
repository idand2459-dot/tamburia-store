/**
 * מתרגם HTTP לגווני הפיגמנט שמחשבון הצבע צורך ושמסך הניהול יכול לערוך.
 */
const pigmentService = require('../services/pigmentFormula.service');
const {
  parseCreate, parseUpdate, parseListQuery, asColorCode,
} = require('../validators/pigmentFormula.validator');
const { sendList } = require('../utils/paginate');

/** GET /api/pigment-formulas — מחזיר את הגוונים, עם דפדוף אם התבקש. */
async function list(req, res) {
  const options = parseListQuery(req.query);
  const { formulas, total } = await pigmentService.listFormulas(options);
  sendList(res, 'formulas', formulas, total, options);
}

/** GET /api/pigment-formulas/:id — מחזיר גוון לפי מזהה. */
async function getOne(req, res) {
  res.json(await pigmentService.getFormula(req.id));
}

/** GET /api/pigment-formulas/code/:code — מחזיר גוון לפי הקוד הטבעי. */
async function getByCode(req, res) {
  res.json(await pigmentService.getFormulaByCode(asColorCode(req.params.code)));
}

/** POST /api/pigment-formulas — יוצר גוון חדש. */
async function create(req, res) {
  const data = parseCreate(req.body);
  res.status(201).json(await pigmentService.createFormula(data));
}

/**
 * PUT /api/pigment-formulas/:id — מעדכן את השדות שנשלחו בלבד.
 *
 * הגוון הקיים נשלף ראשון — מזהה שאינו קיים הוא 404 עוד לפני האימות —
 * כי סדר הכמויות (light < medium < dark) נבדק על המצב המשולב.
 */
async function update(req, res) {
  const existing = await pigmentService.getFormula(req.id);
  const data = parseUpdate(req.body, existing);
  res.json(await pigmentService.updateFormula(req.id, data));
}

/** DELETE /api/pigment-formulas/:id — מוחק גוון. */
async function remove(req, res) {
  const formula = await pigmentService.removeFormula(req.id);
  res.json({ message: 'נמחק', formula });
}

module.exports = { list, getOne, getByCode, create, update, remove };
