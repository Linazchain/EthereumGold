# Referral Boost — Specification

Parameter and behavior rules for the Referral Boost system. Principal, fee, and dividend mathematics remain authoritative in `AssetPool`.

## Multipliers (BPS)

| Status | Multiplier | BPS | Label |
|--------|------------|-----|-------|
| Normal | 1× | 10_000 | No boost |
| Referrer | 5× | 50_000 | +500% |
| Referred | 10× | 100_000 | +1,000% |

```solidity
uint256 constant NORMAL_MULTIPLIER_BPS   = 10_000;
uint256 constant REFERRER_MULTIPLIER_BPS = 50_000;
uint256 constant REFERRED_MULTIPLIER_BPS = 100_000;
uint256 constant DEPOSIT_FEE_BPS  = 100; // 1%
uint256 constant WITHDRAW_FEE_BPS = 100; // 1%
```

## Rules

- One-level referral: `referrerOf[user]`
- No self-referral; assignment immutable once set
- Multiplier frozen per **position** at deposit (no retroactive change)
- Boost is **virtual payout weight only** — never multiplies principal or balances
- Deposit / withdraw fees stay 1% for all statuses
- No direct referral token transfer from the boost module (fee split to referrers is separate treasury logic)

## Display

Always show both:

- **Actual balance** (principal / shares × price)
- **Payout weight** (virtual)
- **Boost** (1× / 5× / 10×)

## Contracts

- `contracts/ReferralRegistry.sol` — relationship + status + `multiplierBpsFor`
- `contracts/AssetPool.sol` — positions, `PositionCreated`, weight tracking
