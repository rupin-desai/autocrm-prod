import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateWeightedAverageCost,
  movementValue,
  availableQuantity,
} from "./inventoryLogic";
test("calculates weighted average cost in integer paise", () =>
  assert.equal(calculateWeightedAverageCost(10, 10000, 5, 6000), 1066));
test("calculates movement value safely", () =>
  assert.equal(movementValue(2.5, 10000), 25000));
test("calculates available quantity", () =>
  assert.equal(availableQuantity(12, 3), 9));
