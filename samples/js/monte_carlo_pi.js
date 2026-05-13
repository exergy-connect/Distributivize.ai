export function estimatePi(samples) {
  let inside = 0;

  for (let index = 0; index < samples; index += 1) {
    const x = Math.random();
    const y = Math.random();
    if (x * x + y * y <= 1) {
      inside += 1;
    }
  }

  return (inside / samples) * 4;
}

console.log(estimatePi(1_000_000));
