export function clamp(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
}

export function randomCentered(amount) {
  return (Math.random() * 2 - 1) * amount;
}

