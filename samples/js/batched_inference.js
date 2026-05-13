function fakeModelPredict(input) {
  return input.tokens.reduce((sum, token) => sum + token.length, 0) / input.tokens.length;
}

export function classifyBatch(records) {
  return records.map((record) => {
    const tokens = record.text.toLowerCase().split(/\s+/);
    return {
      id: record.id,
      prediction: fakeModelPredict({ tokens })
    };
  });
}
