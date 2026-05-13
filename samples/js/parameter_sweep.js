function trainScore(params) {
  let score = 0;
  for (let step = 0; step < 50_000; step += 1) {
    score += Math.sin(params.learningRate * step) * Math.cos(params.depth + step);
  }
  return { params, score };
}

export function runParameterSweep() {
  const grid = [];
  for (const learningRate of [0.001, 0.003, 0.01, 0.03]) {
    for (const depth of [2, 4, 8, 16]) {
      grid.push({ learningRate, depth });
    }
  }

  return grid.map((params) => trainScore(params)).reduce((best, result) => {
    return result.score > best.score ? result : best;
  });
}
