import assert from "node:assert/strict";
import test from "node:test";
import { describeVaultDepositSetup } from "../src/setup.js";

const protocol = { transactions_enabled: true, builder_fee_required: true, builder_verifier_automatic: true };
const vault = { archived: false, builder_fee_active: false, builder_fee_approval_requested: true, public_deposits_enabled: false };

test("deposit guidance identifies leader, platform and follower actions", () => {
  assert.equal(describeVaultDepositSetup(protocol, { ...vault, archived: true }).state, "archived");
  assert.equal(describeVaultDepositSetup(protocol, { ...vault, builder_fee_active: null }).state, "refresh_required");
  assert.equal(describeVaultDepositSetup(protocol, { ...vault, builder_fee_approval_requested: false }).actor, "leader");
  assert.equal(describeVaultDepositSetup(protocol, vault).actor, "none");
  for (const status of ["paused", "degraded", "unavailable", "stale"] as const) {
    const result = describeVaultDepositSetup({ ...protocol, builder_verifier_status: status }, vault);
    assert.equal(result.actor, "platform");
    assert.match(result.message, /operator|recovery/);
  }
  assert.equal(describeVaultDepositSetup(protocol, { ...vault, builder_fee_active: true }).state, "open_deposits");
  // An already verified vault does not depend on the worker for deposits.
  assert.equal(describeVaultDepositSetup({ ...protocol, builder_verifier_status: "unavailable" }, {
    ...vault, builder_fee_active: true, public_deposits_enabled: true,
  }).state, "deposit_ready");
  assert.equal(describeVaultDepositSetup({ ...protocol, builder_verifier_automatic: false }, vault).actor, "platform");
});
