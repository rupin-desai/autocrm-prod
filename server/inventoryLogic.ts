export function calculateWeightedAverageCost(
  existingQuantity: number,
  existingValuePaise: number,
  incomingQuantity: number,
  incomingValuePaise: number,
) {
  // New stock is valued together with the existing stock at a single
  // weighted-average rate, rounded down to whole paise.
  const quantity = existingQuantity + incomingQuantity;
  if (quantity <= 0) return 0;
  return Math.floor((existingValuePaise + incomingValuePaise) / quantity);
}
export function movementValue(quantity: number, unitCostPaise: number) {
  // Inventory movements must never create a negative or unsafe valuation.
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !Number.isSafeInteger(unitCostPaise) ||
    unitCostPaise < 0
  )
    throw new Error("Invalid inventory valuation");
  return Math.round(quantity * unitCostPaise);
}
export function availableQuantity(
  quantityOnHand: number,
  reservedQuantity: number,
) {
  // Reserved stock cannot be sold, and bad reservation data must not expose
  // a negative available quantity to callers.
  return Math.max(0, quantityOnHand - reservedQuantity);
}
