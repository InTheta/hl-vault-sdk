import assert from "node:assert/strict";
import test from "node:test";
import { asyncHyperVaultAbi } from "../src/index.js";

test("capital safety reads remain available without exposing custody writes", () => {
  for (const name of ["minimumLeaderSeedAssets", "minimumDepositAssets", "maxTotalAssets",
    "totalPendingDepositAssets", "totalReservedRedemptionAssets", "withdrawalRiskBlocked"]) {
    const fn = asyncHyperVaultAbi.find(item => item.name === name);
    assert.ok(fn, `missing capital read ${name}`);
    assert.equal(fn.stateMutability, "view");
    assert.deepEqual(fn.inputs, []);
  }
  assert.equal(asyncHyperVaultAbi.some(item => item.name === "deployToCore"), false);
});
