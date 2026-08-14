// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./AssetPool.sol";

contract PoolFactory is Ownable {
    address[] public allPools;
    mapping(address => address) public getPool;
    address public immutable referralRegistry;
    address public treasury;

    event PoolCreated(address indexed asset, address pool, uint256 poolLength);

    constructor(address _referralRegistry, address _treasury) Ownable(msg.sender) {
        referralRegistry = _referralRegistry;
        treasury = _treasury;
    }

    function createPool(
        address asset,
        string memory xTokenName,
        string memory xTokenSymbol
    ) external onlyOwner returns (address pool) {
        require(getPool[asset] == address(0), "Pool exists");

        AssetPool newPool = new AssetPool(
            asset,
            xTokenName,
            xTokenSymbol,
            referralRegistry,
            treasury
        );

        pool = address(newPool);
        getPool[asset] = pool;
        allPools.push(pool);

        emit PoolCreated(asset, pool, allPools.length);
    }
}
