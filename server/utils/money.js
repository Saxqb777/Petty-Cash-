// All monetary values are stored and transported as AED floats.
// Internally we convert to integer fils (1 AED = 100 fils) before any
// addition or multiplication so floating-point drift is impossible.
// convertToAed rounds ONCE at the end — never mid-calculation.

const FILS = 100;

const toFils  = (amount) => Math.round((parseFloat(amount) || 0) * FILS);
const fromFils = (fils)  => fils / FILS;

const addMoney = (...amounts) => fromFils(amounts.reduce((sum, a) => sum + toFils(a), 0));

// Round half-up to 2dp exactly once.
const convertToAed = (amount, rate) => {
  const raw = (parseFloat(amount) || 0) * (parseFloat(rate) || 1);
  return fromFils(toFils(raw));
};

module.exports = { toFils, fromFils, addMoney, convertToAed };
