# Security Audit Checklist — AAO Settlement Layer

## Smart Contract Risks & Mitigations

- [x] **Access control on mint**: Only `authorizedMinters` can call `mint()` — enforced by `onlyAuthorizedMinter` modifier
- [x] **Owner-only admin functions**: `addMinter`, `removeMinter`, `toggleRedemption`, `withdraw` restricted to contract owner via OpenZeppelin `Ownable`
- [x] **Replay protection on redemptions**: `processedRedemptions` mapping prevents double-spend of the same redemption request
- [x] **Redemption kill switch**: `redemptionEnabled` defaults to `false`; owner must explicitly enable
- [x] **Integer overflow**: Solidity ^0.8.20 has built-in overflow checks
- [ ] **Reentrancy**: Vault `requestRedemption` transfers ERC-20 tokens — verify checks-effects-interactions pattern or add `ReentrancyGuard`
- [ ] **Front-running**: Mint and redemption transactions are publicly visible on-chain; consider commit-reveal if ordering matters
- [ ] **Upgradability**: Contracts are not upgradeable — redeployment required for bug fixes; consider proxy pattern for mainnet

## API Security Measures Implemented

- [x] **Signature verification**: `agentAuth` middleware verifies `ethers.verifyMessage` against claimed wallet
- [x] **Timestamp freshness**: Signed messages include a timestamp; requests older than 5 minutes are rejected
- [x] **Per-wallet rate limiting**: In-memory rate limiter with configurable window (default 10 req/min)
- [x] **Auto-cleanup**: Expired rate-limit entries are periodically purged to prevent memory leaks
- [x] **Auth on sensitive endpoints**: `POST /api/rewards/mint` and `POST /api/vault/redeem` require signature auth
- [x] **Registration rate-limited**: `POST /api/agents/register` is rate-limited to slow sybil registration

## Known Limitations

- **In-memory rate limiting**: Rate limit state is lost on server restart and not shared across instances. Use Redis for production.
- **No nonce tracking**: The timestamp-based replay window allows the same signed request to be replayed within the 5-minute window. Add a nonce-based scheme for stricter replay prevention.
- **No IP-level rate limiting**: Current rate limiting is wallet-based only. An attacker can create many wallets. Add IP-based limits as a second layer.
- **Mock USDC on testnet**: Vault uses a mock ERC-20 with unlimited minting — not representative of mainnet USDC behavior.
- **Single signer backend**: The backend uses a single private key for all on-chain transactions — single point of failure.

## Recommended Next Steps for Mainnet

1. **External audit**: Engage a professional audit firm for all Solidity contracts before mainnet deployment
2. **Redis rate limiting**: Replace in-memory Map with Redis for distributed, persistent rate limiting
3. **Nonce-based replay protection**: Track per-wallet nonces in addition to timestamps
4. **Multi-sig admin**: Replace single-owner pattern with a multi-sig (e.g., Gnosis Safe) for admin functions
5. **Proxy upgradability**: Deploy contracts behind UUPS or TransparentProxy for safe upgrades
6. **IP + wallet combined rate limiting**: Layer IP-based throttling on top of wallet-based limits
7. **Monitoring & alerting**: Set up on-chain event monitoring for unusual mint patterns or large withdrawals
8. **Circuit breaker**: Implement automatic pause if mint volume exceeds expected thresholds
9. **Gas estimation guards**: Add gas limit checks to prevent griefing via expensive transactions
10. **HTTPS enforcement**: Ensure all API endpoints are served over TLS in production
