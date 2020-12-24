import "hardhat/console.sol";
import "../interfaces/ICover.sol";
import "@openzeppelin/contracts-v3/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-v3/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts-v3/math/SafeMath.sol";
import "@openzeppelin/contracts-v3/token/ERC20/SafeERC20.sol";

contract CoverMock is ICover, ReentrancyGuard {
    using SafeMath for uint;
    using SafeERC20 for IERC20;

    uint lastCoverId = 0;

    address public constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    struct Cover {
        address owner;
        address contractAddress;
        address coverAsset;
        uint sumAssured;
        uint16 coverPeriod;
        uint8 coverType;
        bytes data;
        uint topUp;
    }

    mapping (uint => Cover) public covers;

    function buyCover (
        address contractAddress,
        address coverAsset,
        uint sumAssured,
        uint16 coverPeriod,
        uint8 coverType,
        bytes calldata data
    ) external payable override returns (uint) {
        uint coverId = ++lastCoverId;
        covers[coverId].owner = msg.sender;
        covers[coverId].contractAddress = contractAddress;
        covers[coverId].coverAsset = coverAsset;
        covers[coverId].sumAssured = sumAssured;
        covers[coverId].coverPeriod = coverPeriod;
        covers[coverId].coverType = coverType;
        covers[coverId].data = data;
        return coverId;
    }

    function getCoverPrice (
        address contractAddress,
        address coverAsset,
        uint sumAssured,
        uint16 coverPeriod,
        uint8 coverType,
        bytes calldata data
    ) external view override returns (uint coverPrice) {
        (
        coverPrice
        ) = abi.decode(data, (uint));
    }

    function submitClaim(uint coverId, bytes calldata data) external override returns (uint) {
        revert("Unsupported");
    }

    function getPayoutOutcome(uint coverId, uint claimId) external view override returns (bool, uint, address) {
        revert("Unsupported");
    }

    function getCover(uint coverId)
    external
    view
    override
    returns (
        uint8 status,
        uint sumAssured,
        uint16 coverPeriod,
        uint validUntil,
        address contractAddress,
        address coverAsset,
        uint premiumInNXM,
        address memberAddress
    ) {
        revert("Unsupported");
    }

    /**
    *
    */
    function executeCoverAction(uint coverId, uint8 action, bytes calldata data)
    external
    payable
    override
    returns (bytes memory, uint)
    {
        require(covers[coverId].owner == msg.sender, "CoverMock: Not owner of cover");

        if (action == 0) {
            require(covers[coverId].coverAsset == ETH, "Cover is not an ETH cover");
            uint topUpValue = abi.decode(data, (uint));
            require(msg.value >= topUpValue, "msg.value < topUpValue");
            covers[coverId].topUp += topUpValue;
            uint remainder = msg.value.sub(topUpValue);
            (bool ok, /* data */) = address(msg.sender).call{value: remainder}("");
            require(ok, "CoverMock: Returning ETH remainder to sender failed.");
            return (abi.encode(covers[coverId].topUp), topUpValue);
        } else if (action == 1) {
            uint topUpValue = abi.decode(data, (uint));
            IERC20 token = IERC20(covers[coverId].coverAsset);
            token.safeTransferFrom(msg.sender, address(this), topUpValue);
            covers[coverId].topUp += topUpValue;
            return (abi.encode(covers[coverId].topUp), topUpValue);
        }
        revert("CoverMock: Unknown action");
    }

    function switchMembership(address _newAddress) external payable override {
        revert("Unsupported");
    }
}
