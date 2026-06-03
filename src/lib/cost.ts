export interface CostInput {
  courtCost: number | null;
  shuttlesUsed: number | null;
  pricePerShuttle: number | null;
  attendedCount: number;
}

export interface CostResult {
  total: number;
  perHead: number | null;
  remainder: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeCost(input: CostInput): CostResult {
  const court = input.courtCost ?? 0;
  const shuttles = (input.shuttlesUsed ?? 0) * (input.pricePerShuttle ?? 0);
  const total = round2(court + shuttles);

  if (input.attendedCount <= 0) {
    return { total, perHead: null, remainder: 0 };
  }

  const perHead = round2(total / input.attendedCount);
  const remainder = round2(total - perHead * input.attendedCount);

  return { total, perHead, remainder };
}
