/**
 * Мягкая экспоненциальная последовательность
 *
 * @param {number} baseValue - стартовое значение
 * @param {number} growth - форма экспоненты (1.05–1.3)
 * @param {number} scale - масштаб разницы (0.5–3)
 * @param {number} levels - количество уровней
 */
const generateSmoothExpo = (
  baseValue,
  growth,
  scale,
  levels = 5
) => {
  const values = [];

  for (let i = 0; i < levels; i++) {
    const value =
      baseValue * (1 + scale * (Math.pow(growth, i) - 1));

    values.push(Number(value.toFixed(6)));
  }

  return values;
};

module.exports = generateSmoothExpo;
