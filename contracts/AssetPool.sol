// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./xToken.sol";
import "./ReferralRegistry.sol";
import "./Treasury.sol";
import "./adapters/YearnAdapter.sol";

/// @title AssetPool
/// @notice Vault with share accounting + Referral Boost payout weights.
/// @dev Principal / share / fee math is unchanged. Referral Boost only assigns
///      a virtual payout-weight multiplier (1x / 5x / 10x) per position.
contract AssetPool is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlyingAsset;
    xToken public immutable shareToken;
    ReferralRegistry public immutable referralRegistry;
    address public treasury;
    YearnAdapter public yieldAdapter;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public depositFeeBps = 100;  // 1% — same for all referral statuses
    uint256 public withdrawFeeBps = 100; // 1% — same for all referral statuses

    /// @notice Position keeps principal + assigned boost at creation time.
    struct Position {
        uint256 principal;      // actual net capital contributing to shares
        uint256 payoutWeight;   // principal * multiplierBps / 10_000 (virtual)
        uint256 multiplierBps;  // frozen at position creation
        uint256 shares;         // share tokens minted for this position
        bool active;
    }

    mapping(address => Position[]) private _positions;
    mapping(address => uint256) public userPayoutWeight;
    uint256 public totalPayoutWeight;

    event Deposited(
        address indexed user,
        uint256 amount,
        uint256 sharesMinted,
        uint256 feePaid
    );
    event Withdrawn(
        address indexed user,
        uint256 sharesBurned,
        uint256 amountReceived,
        uint256 feePaid
    );
    event ReferralRewardPaid(
        address indexed user,
        address indexed referrer,
        uint256 amount
    );
    event PositionCreated(
        address indexed user,
        uint256 indexed positionId,
        uint256 principal,
        uint256 payoutWeight,
        uint256 multiplierBps
    );

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
        uint256 invested = address(yieldAdapter) != address(0)
            ? yieldAdapter.totalBalance()
            : 0;
        return idle + invested;
    }

    function pricePerShare() public view returns (uint256) {
        uint256 supply = shareToken.totalSupply();
        if (supply == 0) return 1e18;
        return (totalAssets() * 1e18) / supply;
    }

    // ── Referral Boost views ─────────────────────────────────────────────

    function positionCount(address user) external view returns (uint256) {
        return _positions[user].length;
    }

    function getPosition(
        address user,
        uint256 positionId
    )
        external
        view
        returns (
            uint256 principal,
            uint256 payoutWeight,
            uint256 multiplierBps,
            uint256 shares,
            bool active
        )
    {
        Position storage p = _positions[user][positionId];
        return (p.principal, p.payoutWeight, p.multiplierBps, p.shares, p.active);
    }

    function positionMultiplier(address user, uint256 positionId)
        external
        view
        returns (uint256)
    {
        return _positions[user][positionId].multiplierBps;
    }

    /// @dev Fee split uses existing treasury referralBps; independent of boost multipliers.
    function _distributeFee(address user, uint256 fee) internal {
        if (fee == 0) return;

        address referrer = referralRegistry.referrerOf(user);
        uint256 referralShare = 0;

        if (referrer != address(0)) {
            uint256 refBps = Treasury(treasury).referralBps();
            referralShare = (fee * refBps) / BPS_DENOMINATOR;

            if (referralShare > 0) {
                underlyingAsset.safeTransfer(referrer, referralShare);
                emit ReferralRewardPaid(user, referrer, referralShare);
            }
        }

        uint256 treasuryShare = fee - referralShare;
        if (treasuryShare > 0) {
            underlyingAsset.safeTransfer(treasury, treasuryShare);
        }
    }

    function deposit(uint256 amount, address referrer) external nonReentrant whenNotPaused {
        require(amount > 0, "Zero amount");

        // Register referral before position is established (immutable if accepted)
        if (referrer != address(0)) {
            referralRegistry.registerReferral(msg.sender, referrer);
        }

        // 1% fee for everyone — boost does not change fee %
        uint256 fee = (amount * depositFeeBps) / BPS_DENOMINATOR;
        uint256 netAmount = amount - fee;

        uint256 currentAssets = totalAssets();
        uint256 supply = shareToken.totalSupply();

        underlyingAsset.safeTransferFrom(msg.sender, address(this), amount);
        _distributeFee(msg.sender, fee);

        // Existing share mint math (principal only — not payout weight)
        uint256 sharesToMint;
        if (supply == 0 || currentAssets == 0) {
            sharesToMint = netAmount;
        } else {
            sharesToMint = (netAmount * supply) / currentAssets;
        }

        if (address(yieldAdapter) != address(0) && netAmount > 0) {
            underlyingAsset.safeIncreaseAllowance(address(yieldAdapter), netAmount);
            yieldAdapter.deposit(netAmount);
        }

        shareToken.mint(msg.sender, sharesToMint);

        // Referral Boost: freeze multiplier at position creation (no retroactive change)
        uint256 mult = referralRegistry.multiplierBpsFor(msg.sender);
        uint256 weight = (netAmount * mult) / BPS_DENOMINATOR;

        _positions[msg.sender].push(
            Position({
                principal: netAmount,
                payoutWeight: weight,
                multiplierBps: mult,
                shares: sharesToMint,
                active: true
            })
        );
        uint256 positionId = _positions[msg.sender].length - 1;

        userPayoutWeight[msg.sender] += weight;
        totalPayoutWeight += weight;

        emit PositionCreated(msg.sender, positionId, netAmount, weight, mult);
        emit Deposited(msg.sender, amount, sharesToMint, fee);
    }

    function withdraw(uint256 shareAmount) external nonReentrant {
        require(shareAmount > 0, "Zero shares");
        uint256 supply = shareToken.totalSupply();
        require(supply >= shareAmount, "Excessive shares");

        uint256 grossAmount = (shareAmount * totalAssets()) / supply;
        shareToken.burn(msg.sender, shareAmount);

        // Reduce positions LIFO and release virtual payout weight (not principal math)
        _consumeShares(msg.sender, shareAmount);

        if (address(yieldAdapter) != address(0)) {
            uint256 idle = underlyingAsset.balanceOf(address(this));
            if (idle < grossAmount) {
                uint256 toWithdraw = grossAmount - idle;
                yieldAdapter.withdraw(toWithdraw, address(this));
            }
        }

        uint256 fee = (grossAmount * withdrawFeeBps) / BPS_DENOMINATOR;
        uint256 netAmount = grossAmount - fee;

        _distributeFee(msg.sender, fee);
        underlyingAsset.safeTransfer(msg.sender, netAmount);

        emit Withdrawn(msg.sender, shareAmount, netAmount, fee);
    }

    /// @dev Burn position shares LIFO; release proportional payout weight.
    function _consumeShares(address user, uint256 sharesLeft) internal {
        Position[] storage list = _positions[user];
        while (sharesLeft > 0 && list.length > 0) {
            uint256 i = list.length - 1;
            Position storage p = list[i];

            if (!p.active || p.shares == 0) {
                list.pop();
                continue;
            }

            if (p.shares <= sharesLeft) {
                sharesLeft -= p.shares;
                userPayoutWeight[user] -= p.payoutWeight;
                totalPayoutWeight -= p.payoutWeight;
                p.active = false;
                p.shares = 0;
                p.principal = 0;
                p.payoutWeight = 0;
                list.pop();
            } else {
                uint256 fracWeight = (p.payoutWeight * sharesLeft) / p.shares;
                uint256 fracPrincipal = (p.principal * sharesLeft) / p.shares;
                p.shares -= sharesLeft;
                p.payoutWeight -= fracWeight;
                p.principal -= fracPrincipal;
                userPayoutWeight[user] -= fracWeight;
                totalPayoutWeight -= fracWeight;
                sharesLeft = 0;
            }
        }
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
