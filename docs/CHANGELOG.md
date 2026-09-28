# Changelog

## TypeScript 0.3.1 / Python 0.1.1

- Synchronize protocol admission, capital, NAV-attestor and automatic builder
  verifier fields, plus the vault archive flag, with the deployed API.
- Add capital limit, reserve and withdrawal-risk reads to both contract ABIs.
- Update MCP SDK, Zod, TypeScript and tsx to current releases; resolve the core
  npm audit findings. TypeScript 7 requires explicit Node types and no baseUrl.
- Update Python Web3 to 8, websockets to 17 and mypy to 2. Existing unit,
  static-analysis and build checks pass with the new releases.
- Correct example data URLs to the working Omni public endpoint.
- Document operator verification, archive recovery and async capital gates.
- Add an isolated actual Coinbase AgentKit 0.10.4 live read smoke for Base
  Sepolia and Robinhood Chain testnet, with stale-data and chain-ID checks.
  AgentKit upstream dependency findings remain documented; no custody enabled.

Source versions are not evidence of npm/PyPI publication or mainnet readiness.
