// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ReferralRegistry {
    mapping(address => address) private _referrers;
    event ReferralRegistered(address indexed user, address indexed referrer);

    function registerReferral(address user, address referrer) external returns (bool) {
        if (referrer == address(0) || user == referrer || _referrers[user] != address(0)) {
            return false;
        }
        _referrers[user] = referrer;
        emit ReferralRegistered(user, referrer);
        return true;
    }

    function referrerOf(address user) external view returns (address) {
        return _referrers[user];
    }
}
