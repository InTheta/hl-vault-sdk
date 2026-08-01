export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const publicVaultFactoryAbi = [
  {
    type: "function",
    name: "createVault",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "description", type: "string" },
    ],
    outputs: [{ name: "vaultAddress", type: "address" }],
  },
  {
    type: "function",
    name: "vaultCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "PublicVaultCreated",
    inputs: [
      { indexed: true, name: "vault", type: "address" },
      { indexed: true, name: "leader", type: "address" },
      { indexed: true, name: "vaultIndex", type: "uint256" },
      { indexed: false, name: "creationFeeAssets", type: "uint256" },
      { indexed: false, name: "name", type: "string" },
      { indexed: false, name: "symbol", type: "string" },
      { indexed: false, name: "description", type: "string" },
    ],
  },
] as const;

const view = (name: string, inputs: readonly object[], outputs: readonly object[]) => ({
  type: "function" as const,
  name,
  stateMutability: "view" as const,
  inputs,
  outputs,
});

const write = (name: string, inputs: readonly object[] = []) => ({
  type: "function" as const,
  name,
  stateMutability: "nonpayable" as const,
  inputs,
  outputs: [],
});

const addressInput = [{ name: "account", type: "address" }] as const;
const uintOutput = [{ name: "", type: "uint256" }] as const;
const boolOutput = [{ name: "", type: "bool" }] as const;

export const asyncHyperVaultAbi = [
  view("balanceOf", addressInput, uintOutput),
  view("depositRequests", [{ name: "user", type: "address" }], [
    { name: "epoch", type: "uint64" },
    { name: "amount", type: "uint192" },
    { name: "basisAssets", type: "uint192" },
  ]),
  view("redeemRequests", [{ name: "user", type: "address" }], [
    { name: "epoch", type: "uint64" },
    { name: "amount", type: "uint192" },
    { name: "basisAssets", type: "uint192" },
  ]),
  view("costBasisAssets", [{ name: "user", type: "address" }], uintOutput),
  view("lockupUntil", [{ name: "user", type: "address" }], [{ name: "", type: "uint64" }]),
  view("currentEpoch", [], [{ name: "", type: "uint64" }]),
  view("activeNavAssets", [], uintOutput),
  view("totalSupply", [], uintOutput),
  view("publicDepositsEnabled", [], boolOutput),
  view("maxPublicDepositAssets", [], uintOutput),
  view("leader", [], [{ name: "", type: "address" }]),
  view("leaderShareBps", [], uintOutput),
  view("leaderCommissionAssets", [], uintOutput),
  view("builderFeeActive", [], boolOutput),
  view("builderFeeApprovalRequested", [], boolOutput),
  view("builderFeeRecipient", [], [{ name: "", type: "address" }]),
  view("requiredBuilderFeeDecibps", [], [{ name: "", type: "uint64" }]),
  write("requestDeposit", [{ name: "assets", type: "uint256" }]),
  write("cancelDepositRequest"),
  write("claimDeposit"),
  write("requestRedeem", [{ name: "shares", type: "uint256" }]),
  write("cancelRedeemRequest"),
  write("claimRedeem"),
  write("setPublicDepositsEnabled", [{ name: "enabled", type: "bool" }]),
  write("claimLeaderCommission"),
  write("requestBuilderFeeApproval"),
] as const;
