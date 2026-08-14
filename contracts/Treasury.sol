// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Treasury is Ownable {
    uint256 public devBps = 4000;
    uint256 public securityBps = 3000;
    uint256 public opsBps = 2000;
    uint256 public referralBps = 1000;

    constructor() Ownable(msg.sender) {}

    function setDistribution(uint256 _dev, uint256 _sec, uint256 _ops, uint256 _ref) external onlyOwner {
        require(_dev + _sec + _ops + _ref == 10000, "Invalid split");
        devBps = _dev;
        securityBps = _sec;
        opsBps = _ops;
        referralBps = _ref;
    }

    function withdrawToken(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).transfer(to, amount);
    }
}
