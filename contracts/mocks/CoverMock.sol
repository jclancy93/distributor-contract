import "hardhat/console.sol";
import "../interfaces/ICover.sol";

contract CoverMock is ICover {

    uint lastCoverId = 0;

    struct Cover {
        address owner;
        uint fooValue;
    }

    mapping (uint => Cover) covers;

    function buyCover (
        address contractAddress,
        address coverAsset,
        uint coverAmount,
        uint16 coverPeriod,
        uint8 coverType,
        bytes calldata data
    ) external payable override returns (uint) {
        revert("Unsupported");

        uint coverId = ++lastCoverId;
        covers[coverId].owner = msg.sender;
    }

    function getCoverPrice (
        address contractAddress,
        address coverAsset,
        uint coverAmount,
        uint16 coverPeriod,
        uint8 coverType,
        bytes calldata data
    ) external view override returns (uint coverPrice) {
        (
        coverPrice,
        /* coverPriceNXM */,
        /* generatedAt */,
        /* expiresAt */,
        /* _v */,
        /* _r */,
        /* _s */
        ) = abi.decode(data, (uint, uint, uint, uint, uint8, bytes32, bytes32));
    }

    function submitClaim(uint coverId, bytes calldata data) external override returns (uint) {
        revert("Unsupported");
    }

    function payoutIsCompleted(uint claimId) external view override returns (bool) {
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
        uint premiumNXM,
        uint payout
    ) {
        revert('Unsupported');
    }

    function executeCoverAction(uint coverId, uint8 action, bytes calldata data) external payable override returns (bytes memory) {
        require(covers[coverId].owner == msg.sender, "CoverMock: Not owner of cover");

        if (action == 0) {
            uint incrementValue = abi.decode(data, (uint));
            covers[coverId].fooValue += incrementValue;
            return abi.encode(covers[coverId].fooValue);
        }
        revert("CoverMock: Unknown action");
    }
}
