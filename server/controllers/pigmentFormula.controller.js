const PigmentFormula = require('../models/pigmentFormula.model');
const {
  parseCreate, parseUpdate, parseListQuery, asColorCode,
} = require('../validators/pigmentFormula.validator');
const { notFound } = require('../utils/AppError');

/** GET /api/pigment-formulas — L */
async function list(req, res) {
  const options = parseListQuery(req.query);
  const formulas = await PigmentFormula.list(options);

  // בלי pagination מחזירים מערך שטוח, כדי לא לשבור את מחשבון הצבע
  if (options.limit === undefined && options.offset === undefined) {
    return res.json(formulas);
  }

  const total = await PigmentFormula.count(options);
  res.json({
    formulas,
    pagination: {
      total,
      limit: options.limit ?? total,
      offset: options.offset ?? 0,
    },
  });
}

/** GET /api/pigment-formulas/:id — R */
async function getOne(req, res) {
  const formula = await PigmentFormula.findById(req.id);
  if (!formula) throw notFound(`גוון ${req.id} לא נמצא`);
  res.json(formula);
}

/** GET /api/pigment-formulas/code/:code — R לפי המפתח הטבעי */
async function getByCode(req, res) {
  const code = asColorCode(req.params.code);
  const formula = await PigmentFormula.findByCode(code);
  if (!formula) throw notFound(`הגוון "${code}" לא נמצא`);
  res.json(formula);
}

/** POST /api/pigment-formulas — C. color_code כפול נתפס כ-409 ע"י ה-UNIQUE. */
async function create(req, res) {
  const data = parseCreate(req.body);
  const formula = await PigmentFormula.create(data);
  res.status(201).json(formula);
}

/** PUT /api/pigment-formulas/:id — U (עדכון חלקי) */
async function update(req, res) {
  // הרשומה הקיימת נדרשת לוולידציה: סדר הכמויות נבדק על המצב המשולב
  const existing = await PigmentFormula.findById(req.id);
  if (!existing) throw notFound(`גוון ${req.id} לא נמצא`);

  const data = parseUpdate(req.body, existing);
  res.json(await PigmentFormula.update(req.id, data));
}

/** DELETE /api/pigment-formulas/:id — D */
async function remove(req, res) {
  const formula = await PigmentFormula.remove(req.id);
  if (!formula) throw notFound(`גוון ${req.id} לא נמצא`);
  res.json({ message: 'נמחק', formula });
}

module.exports = { list, getOne, getByCode, create, update, remove };
