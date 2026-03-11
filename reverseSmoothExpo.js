const reverseExpo = (values) => {

  const base = values[0];
  const v1 = values[1];
  const v2 = values[2];

  // вычисляем growth
  const growth = (v2 - base) / (v1 - base) - 1;

  // вычисляем scale
  const scale = ((v1 / base) - 1) / (growth - 1);

  const result = `expo(${base.toFixed(6)}, ${growth.toFixed(3)}, ${scale.toFixed(2)});`;

  console.log(result);

  return {
    base,
    growth,
    scale
  };

};

module.exports = reverseExpo;