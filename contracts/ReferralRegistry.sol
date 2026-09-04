// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ReferralRegistry
/// @notice One-level referral relationships + Referral Boost status helpers.
/// @dev Boost only affects payout-weight classification (1x / 5x / 10x).
///      It does not change principal, fees, or token balances.
contract ReferralRegistry {
    // ── Canonical multipliers (BPS) ──────────────────────────────────────
    uint256 public constant NORMAL_MULTIPLIER_BPS = 10_000;    // 1x
    uint256 public constant REFERRER_MULTIPLIER_BPS = 50_000;  // 5x (+500%)
    uint256 public constant REFERRED_MULTIPLIER_BPS = 100_000; // 10x (+1000%)

    mapping(address => address) private _referrers;
    mapping(address => uint256) public referralCount;

    event ReferralRegistered(address indexed referred, address indexed referrer);

    /// @notice Register msg.sender under `referrer` (immutable, one-level).
    function registerReferral(address referrer) external returns (bool) {
        return _register(msg.sender, referrer);
    }

    /// @notice Register `user` under `referrer` (callable by pool / trusted callers).
    function registerReferral(address user, address referrer) external returns (bool) {
        return _register(user, referrer);
    }

    function _register(address user, address referrer) internal returns (bool) {
        if (referrer == address(0) || user == address(0)) return false;
        if (user == referrer) return false;                 // no self-referral
        if (_referrers[user] != address(0)) return false;   // immutable assignment

        _referrers[user] = referrer;
        referralCount[referrer] += 1;

        emit ReferralRegistered(user, referrer);
        return true;
    }

    function referrerOf(address user) external view returns (address) {
        return _referrers[user];
    }

    function isReferred(address user) public view returns (bool) {
        return _referrers[user] != address(0);
    }

    /// @notice True if `user` has successfully referred at least one participant.
    function isReferrer(address user) public view returns (bool) {
        return referralCount[user] > 0;
    }

    /// @notice Multiplier BPS applicable to a *new* position for `user` right now.
    /// @dev Referred (10x) takes priority over referrer (5x) if both apply.
    ///      Existing positions must keep their stored multiplier (no retroactive change).
    function multiplierBpsFor(address user) public view returns (uint256) {
        if (isReferred(user)) return REFERRED_MULTIPLIER_BPS;
        if (isReferrer(user)) return REFERRER_MULTIPLIER_BPS;
        return NORMAL_MULTIPLIER_BPS;
    }
}
