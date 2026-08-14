// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./xToken.sol";
import "./ReferralRegistry.sol";
import "./adapters/YearnAdapter.sol";

contract AssetPool is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlyingAsset;
    xToken public immutable shareToken;
    ReferralRegistry public immutable referralRegistry;
    address public treasury;
    YearnAdapter public yieldAdapter;

    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public depositFeeBps = 100;  // 1%
    uint256 public withdrawFeeBps = 100; // 1%

    event Deposited(address indexed user, uint256 amount, uint256 sharesMinted, uint256 feePaid);
    event Withdrawn(address indexed user, uint256 sharesBurned, uint256 amountReceived, uint256 feePaid);

    constructor(
        address _underlyingAsset,
        string memory _xTokenName,
        string memory _xTokenSymbol,
        address _referralRegistry,
        address _treasury
    ) Ownable(msg.sender) {
        underlyingAsset = IERC20(_underlyingAsset);
        shareToken = new xToken(_xTokenName, _xTokenSymbol, address(this));
        referralRegistry = ReferralRegistry(_referralRegistry);
        treasury = _treasury;
    }

    function setYieldAdapter(address _adapter) external onlyOwner {
        yieldAdapter = YearnAdapter(_adapter);
    }

    function totalAssets() public view returns (uint256) {
        uint256 idle = underlyingAsset.balanceOf(address(this));
        uint256 invested = address(yieldAdapter) != address(0) ? yieldAdapter.totalBalance() : 0;
        return idle + invested;
    }

    function pricePerShare() public view returns (uint256) {
        uint256 supply = shareToken.totalSupply();
        if (supply == 0) return 1e18;
        return (totalAssets() * 1e18) / supply;
    }

    function deposit(uint256 amount, address referrer) external nonReentrant whenNotPaused {
        require(amount > 0, "Zero amount");

        if (referrer != address(0)) {
            referralRegistry.registerReferral(msg.sender, referrer);
        }

        uint256 fee = (amount * depositFeeBps) / BPS_DENOMINATOR;
        uint256 netAmount = amount - fee;

        uint256 currentAssets = totalAssets();
        uint256 supply = shareToken.totalSupply();

        underlyingAsset.safeTransferFrom(msg.sender, address(this), amount);
        if (fee > 0) {
            underlyingAsset.safeTransfer(treasury, fee);
        }

        uint256 sharesToMint;
        if (supply == 0 || currentAssets == 0) {
            sharesToMint = netAmount;
        } else {
            sharesToMint = (netAmount * supply) / currentAssets;
        }

        if (address(yieldAdapter) != address(0)) {
            underlyingAsset.safeIncreaseAllowance(address(yieldAdapter), netAmount);
            yieldAdapter.deposit(netAmount);
        }

        shareToken.mint(msg.sender, sharesToMint);
        emit Deposited(msg.sender, amount, sharesToMint, fee);
    }

    function withdraw(uint256 shareAmount) external nonReentrant {
        require(shareAmount > 0, "Zero shares");
        uint256 supply = shareToken.totalSupply();
        require(supply >= shareAmount, "Excessive shares");

        uint256 grossAmount = (shareAmount * totalAssets()) / supply;
        shareToken.burn(msg.sender, shareAmount);

        if (address(yieldAdapter) != address(0)) {
            yieldAdapter.withdraw(shareAmount, address(this));
        }

        uint256 fee = (grossAmount * withdrawFeeBps) / BPS_DENOMINATOR;
        uint256 netAmount = grossAmount - fee;

        if (fee > 0) {
            underlyingAsset.safeTransfer(treasury, fee);
        }
        underlyingAsset.safeTransfer(msg.sender, netAmount);

        emit Withdrawn(msg.sender, shareAmount, netAmount, fee);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
