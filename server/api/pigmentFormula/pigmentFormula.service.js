/**
 * גווני הפיגמנט שמחשבון הצבע צורך: שליפה, ו-404 אחיד לכל מה שאינו קיים.
 *
 * עדכון חלקי נבדק מול הרשומה הקיימת (light < medium < dark על המצב
 * המשולב), ולכן הקונטרולר שולף אותה כאן קודם — getFormula זורק 404
 * לפני שהוולידטור בכלל רץ, כך שמזהה שאינו קיים לעולם אינו מחזיר 400.
 */
const pigmentFormulaRepository = require('./pigmentFormula.repository');
const { notFound } = require('../../utils/AppError');

/** מחזיר { formulas, total }; total רק כשהתבקש דפדוף. */
async function listFormulas(options) {
  const formulas = await pigmentFormulaRepository.list(options);
  const paged = options.limit !== undefined || options.offset !== undefined;
  const total = paged ? await pigmentFormulaRepository.count(options) : undefined;
  return { formulas, total };
}

/** גוון לפי מזהה, או 404. */
async function getFormula(id) {
  const formula = await pigmentFormulaRepository.findById(id);
  if (!formula) throw notFound(`גוון ${id} לא נמצא`);
  return formula;
}

/** גוון לפי הקוד הטבעי שהלקוח מחזיק, או 404. */
async function getFormulaByCode(code) {
  const formula = await pigmentFormulaRepository.findByCode(code);
  if (!formula) throw notFound(`הגוון "${code}" לא נמצא`);
  return formula;
}

/** יוצר גוון חדש. */
function createFormula(data) {
  return pigmentFormulaRepository.create(data);
}

/** מעדכן גוון קיים — השדות כבר נבדקו מול הרשומה שהחזיר getFormula. */
async function updateFormula(id, data) {
  const formula = await pigmentFormulaRepository.update(id, data);
  if (!formula) throw notFound(`גוון ${id} לא נמצא`);
  return formula;
}

/** מוחק גוון ומחזיר אותו, או 404. */
async function removeFormula(id) {
  const formula = await pigmentFormulaRepository.remove(id);
  if (!formula) throw notFound(`גוון ${id} לא נמצא`);
  return formula;
}

module.exports = {
  listFormulas, getFormula, getFormulaByCode, createFormula, updateFormula, removeFormula,
};
