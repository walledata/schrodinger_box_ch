// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (token/ERC721/IERC721.sol)



pragma solidity ^0.8.13;

import "./IERC721.sol";
import "./erc1155/IERC1155.sol";
import "./ERC721Holder.sol";
import "./IERC721Receiver.sol";
import "./introspection/ERC165.sol";
import "./extensions/ERC721Enumerable.sol";
import "./access/Ownable.sol";

import "./chainlink/VRFCoordinatorV2Interface.sol";
import "./chainlink/VRFConsumerBaseV2.sol";

import "./security/ReentrancyGuard.sol";

import "./utils/Counters.sol";

import "./HashLists.sol";




contract PrizePool is IERC721Receiver, ERC165, ERC721Holder, Ownable, ReentrancyGuard, VRFConsumerBaseV2 {

    using Counters for Counters.Counter;
    using HashLists for HashLists.HashList;


    VRFCoordinatorV2Interface immutable COORDINATOR;
    uint64 public immutable s_subscriptionId;
    bytes32 constant private keyHash = 0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15; //goerli 30 gwei Key Hash
    uint32 constant private numWords = 1;
    uint32 private callbackGasLimit = 200000;
    uint16 constant private requestConfirmations = 3;
    uint256 public s_requestId;

    address public immutable ticketAddress;
    uint8 public prizePoolStatus = 0;
    uint256 private lastRequestRevealTime;
    uint256 constant private requestRevealInterval = 300;
    uint256 constant private randomSalt = 38492;
    uint256 constant private randomSugar = 98503;


    enum PrizeType{NOTSET, ERC721, ETH}
    enum PrizeItemStatus{INIT, AWARDED, RECEIVED}
    struct PrizeItem {
        address prizeAddress;
        uint256 prizeTokenId;
        address prizeProvider;
        PrizeType prizeType;
        PrizeItemStatus status;
        uint256 amount;
    }
    struct PrizeRevealedEvent {
        uint256 prizeId;
        uint256 randomness;
    }

    Counters.Counter private _prizeIdTracker;
    HashLists.HashList private remainPrizeIdHashList;
    uint256[] private allPrizeIdList;
    mapping(uint256 => PrizeItem) private prizeIdPrizeItemMapping;
    uint256[] private requestRevealTicketIdList;
    mapping(uint256 => PrizeRevealedEvent) private ticketIdPrizeRevealedEventMapping;


    event RequestRevealEvent(uint256 ticketId,uint256 requestId);
    event PrizeRevealed(uint256 ticketId, uint256 prizeId,uint256 requestId);
    event PrizeFilled(uint256 prizeId, PrizeItem prize);
    event PrizeFilledBatchSamePrizeItem(uint256[] prizeIds, PrizeItem prize);
    event PrizeReceived(uint256 ticketId, uint256 prizeId);
    error TicketHasRevealedPrize();
    error OtherUserInRevealing();
    error TooFrequentlyForRequestReveal();
    error TicketUsed();
    error TicketNotRevealed();
    error PrizePoolDriedUp();
    error PrizeAlreadyReceived();
    error PrizeAlreadyRegistered(address prizeAddress, uint256 prizeTokenId);


    constructor(address ticketAddress_, address ownerAddress_, uint64 subscriptionId, address vrfCoordinator) VRFConsumerBaseV2(vrfCoordinator){
        COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinator);
        s_subscriptionId = subscriptionId;
        ticketAddress = ticketAddress_;
        _transferOwnership(ownerAddress_);
        supportsInterface(IERC721Receiver.onERC721Received.selector);
        _prizeIdTracker.increment();
    }


    modifier checkTicketIsForThisPrizePoolAndOwnerOfSender(address ticketAddr, uint256 tokenId) {
        funcCheckTicketIsForThisPrizePoolAndOwnerOfSender(ticketAddr, tokenId);
        _;
    }

    function funcCheckTicketIsForThisPrizePoolAndOwnerOfSender(address ticketAddr, uint256 tokenId) private view {
        require(ticketAddr == ticketAddress, "Ticket Not Correct");
        require(IERC1155(ticketAddr).balanceOf(address(msg.sender), tokenId) == 1, "Ticket is Not Of Sender");
    }

    modifier onlyTxOriginSender {
        funcOnlyTxOriginSelector();
        _;
    }

    function funcOnlyTxOriginSelector() private view {
        require(tx.origin == msg.sender);
    }

    modifier canRequestReveal {
        funcCheckCanRequestReveal();
        _;
    }

    modifier canFillPrize {
        funcCheckCanFillPrize();
        _;
    }

    function funcCheckCanRequestReveal() private view {
        require(prizePoolStatus == 1, "Prize is not complete filling");
    }

    function funcCheckCanFillPrize() private view {
        require(prizePoolStatus == 0, "Prize filling completed");
    }

    function getChainLink(address addr, uint256 ticketId) external checkTicketIsForThisPrizePoolAndOwnerOfSender(addr, ticketId) onlyTxOriginSender nonReentrant canRequestReveal {

        if (hasTicketRevealed(ticketId)) {
            require(false, "TicketUsed");
        }
        bool needPushNewTicketId = true;
        if (requestRevealTicketIdList.length > 0) {
            uint256 lastRequestRevealTicketId = requestRevealTicketIdList[requestRevealTicketIdList.length - 1];
            if (!hasTicketRevealed(lastRequestRevealTicketId)) {
                if (ticketId == lastRequestRevealTicketId) {
                    needPushNewTicketId = false;
                    if (block.timestamp < (lastRequestRevealTime + requestRevealInterval)) {
                        require(false, "TooFrequentlyForRequestReveal");
                    }
                } else {
                    require(false, "OtherUserInRevealing");
                }
            } else {
                if (requestRevealTicketIdList.length == allPrizeIdList.length) {
                    require(false, "PrizePoolDriedUp");
                }
                else {
                    uint256 lastPrizeId = ticketIdPrizeRevealedEventMapping[lastRequestRevealTicketId].prizeId;
                    remainPrizeIdHashList.deleteEntity(lastPrizeId);
                }
            }
        }

        if (needPushNewTicketId) {
            requestRevealTicketIdList.push(ticketId);
        }

        lastRequestRevealTime = block.timestamp;

        s_requestId = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );

        emit RequestRevealEvent(ticketId,s_requestId);

    }



    function fulfillRandomWords(
        uint256 requestId, /* requestId */
        uint256[] memory randomWords
    ) internal override {

        require(requestRevealTicketIdList.length > 0, "requestRevealTicketIdList not init");
        uint256 lastRequestRevealRandomTicketId = requestRevealTicketIdList[requestRevealTicketIdList.length - 1];
        if (hasTicketRevealed(lastRequestRevealRandomTicketId)) {
            require(false, "TicketHasRevealedPrize");
        }

        uint256 randomness_ = randomWords[0];
        uint256 indexHitInRemainPrizeIdList = generateRandomNumberInRange(randomness_, remainPrizeIdHashList.getEntityCount());
        uint256 revealedPrizeId = remainPrizeIdHashList.getEntityDataByIndex(indexHitInRemainPrizeIdList);

        ticketIdPrizeRevealedEventMapping[lastRequestRevealRandomTicketId].prizeId = revealedPrizeId;
        ticketIdPrizeRevealedEventMapping[lastRequestRevealRandomTicketId].randomness = randomness_;


        emit PrizeRevealed(lastRequestRevealRandomTicketId, revealedPrizeId,requestId);


    }


    function retrievePrize(address nftAddr, uint256 ticketId) external checkTicketIsForThisPrizePoolAndOwnerOfSender(nftAddr, ticketId) onlyTxOriginSender nonReentrant {

        uint256 revealedPrizeId = queryRevealedPrizeIdOfTicketId(ticketId);

        if (revealedPrizeId == 0) {
            revert TicketNotRevealed();
        }

        PrizeItem storage revealedPrize = prizeIdPrizeItemMapping[revealedPrizeId];

        if (revealedPrize.status == PrizeItemStatus.RECEIVED) {
            revert PrizeAlreadyReceived();
        }

        if (revealedPrize.prizeType == PrizeType.ETH)
        {
            revealedPrize.status = PrizeItemStatus.RECEIVED;
            payable(address(msg.sender)).transfer(revealedPrize.amount);
            emit PrizeReceived(ticketId, revealedPrizeId);
        }
        else if (revealedPrize.prizeType == PrizeType.ERC721) {
            revealedPrize.status = PrizeItemStatus.RECEIVED;
            ERC721(revealedPrize.prizeAddress).safeTransferFrom(address(this), address(msg.sender), revealedPrize.prizeTokenId);
            emit PrizeReceived(ticketId, revealedPrizeId);
        }
    }

    function flipRequestRevealState() external onlyOwner {
        if (prizePoolStatus == 0) {
            prizePoolStatus = 1;
        } else if (prizePoolStatus == 1) {
            prizePoolStatus = 0;
        }
    }

    function fillNonFungiblePrize721(address nft_addr, uint256 tokenId) external onlyTxOriginSender canFillPrize {
        registerNonFungiblePrize(nft_addr, tokenId);
        IERC721(nft_addr).safeTransferFrom(address(msg.sender), address(this), tokenId);
    }

    function registerNonFungiblePrize(address nft_addr, uint256 tokenId) internal {
        uint256 prizeId = _prizeIdTracker.current();

        PrizeItem memory prizeItem = PrizeItem({
        prizeAddress : nft_addr,
        prizeTokenId : tokenId,
        prizeProvider : _msgSender(),
        prizeType : PrizeType.ERC721,
        status : PrizeItemStatus.INIT,
        amount : 1
        });

        prizeIdPrizeItemMapping[prizeId] = prizeItem;

        allPrizeIdList.push(prizeId);
        remainPrizeIdHashList.newEntity(prizeId);
        _prizeIdTracker.increment();
        emit PrizeFilled(prizeId, prizeItem);
    }

    function fillFungiblePrize(uint256 number) external payable onlyOwner canFillPrize {

        uint256 oneShareFungiblePrizeAmount = msg.value / (uint256)(number);

        uint256[] memory allPrizeIdListNew = expandList(allPrizeIdList, (uint256)(number));
        uint256[] memory newPrizeIdList = new uint256[](number);

        PrizeItem memory prizeItem = PrizeItem({
        prizeAddress : address(0),
        prizeTokenId : 0,
        prizeProvider : _msgSender(),
        prizeType : PrizeType.ETH,
        status : PrizeItemStatus.INIT,
        amount : oneShareFungiblePrizeAmount
        });

        for (uint256 i = 0; i < number; i++)
        {
            uint256 prizeId = _prizeIdTracker.current();
            prizeIdPrizeItemMapping[prizeId] = prizeItem;
            allPrizeIdListNew[i + allPrizeIdList.length] = prizeId;
            remainPrizeIdHashList.newEntity(prizeId);
            newPrizeIdList[i] = prizeId;
            _prizeIdTracker.increment();
        }

        allPrizeIdList = allPrizeIdListNew;
        emit PrizeFilledBatchSamePrizeItem(newPrizeIdList, prizeItem);

    }



    function expandList(uint256[] memory originList, uint256 addLength) private pure returns (uint256[] memory){
        uint256[] memory newList = new uint256[](originList.length + addLength);
        for (uint256 j = 0; j < originList.length; j++) {
            newList[j] = originList[j];
        }
        return newList;
    }


    /**
     * @notice Generates a random number between 0 - 100
     * @param seed The seed to generate different number if block.timestamp is same
     * for two or more numbers.
     * @param salt The salt to randomize the pattern
     * @param sugar The sugar same as salt but for more randomization
     */
    function importSeedFromThirdSaltSugar(
        uint256 seed,
        uint256 salt,
        uint256 sugar,
        uint256 range
    ) private view returns (uint256) {
        return uint256(uint256(keccak256(abi.encodePacked(seed, salt, sugar))) % range);
    }



    function generateRandomNumberInRange(uint256 random_seed, uint256 range) private view returns (uint256)
    {
        return importSeedFromThirdSaltSugar(random_seed, randomSalt, randomSugar, range);
    }



    function queryTicketPrize(address ticketAddr, uint256 ticketId) external view returns (PrizeItem memory)
    {
        PrizeItem memory revealedPrize;
        if (ticketAddr != ticketAddress) return revealedPrize;
        uint256 revealedPrizeId = queryRevealedPrizeIdOfTicketId(ticketId);
        if (revealedPrizeId == 0) {
            return revealedPrize;
        }
        revealedPrize = prizeIdPrizeItemMapping[revealedPrizeId];
        return revealedPrize;
    }


    function queryCurrentRequestRevealPrizeStatus() public view returns (bool hasTicketInRequest, uint256 lastRequestRevealTicketId){
        if (requestRevealTicketIdList.length == 0) return (false, 0);
        uint256 lastRequestRevealTicketId = requestRevealTicketIdList[requestRevealTicketIdList.length - 1];
        return (!hasTicketRevealed(lastRequestRevealTicketId), lastRequestRevealTicketId);
    }

    function queryRevealedPrizeCount() public view returns (uint256) {
        return queryAllPrizeListLength() - queryRemainPrizeCount();
    }

    function queryRemainPrizeCount() public view returns (uint256) {
        uint8 offset = 0;
        if (requestRevealTicketIdList.length > 0) {
            uint256 lastRequestRevealTicketId = requestRevealTicketIdList[requestRevealTicketIdList.length - 1];
            if (remainPrizeIdHashList.isEntity(ticketIdPrizeRevealedEventMapping[lastRequestRevealTicketId].prizeId)) {
                offset = 1;
            }
        }
        return remainPrizeIdHashList.getEntityCount() - offset;
    }

    function hasTicketRevealed(uint256 tokenId) public view returns (bool){
        return queryRevealedPrizeIdOfTicketId(tokenId) != 0;
    }

    function queryRevealedPrizeIdOfTicketId(uint256 tokenId) public view returns (uint256){
        return queryRevealedPrizeOfTicketId(tokenId).prizeId;
    }

    function queryRevealedPrizeOfTicketId(uint256 tokenId) public view returns (PrizeRevealedEvent memory){
        return ticketIdPrizeRevealedEventMapping[tokenId];
    }

    function queryRequestedRevealTicketCount() public view returns (uint256){
        return requestRevealTicketIdList.length;
    }

    function queryRequestRevealTicketIdOfIndex(uint index) public view returns (uint256){
        return requestRevealTicketIdList[index];
    }


    function queryAllPrizeListLength() public view returns (uint256) {
        return allPrizeIdList.length;
    }


    function queryTicketAwarded(uint256 id) public view returns (address, uint256, PrizeItemStatus, uint, address, PrizeType, uint256) {
        uint256 awardId = allPrizeIdList[id];
        PrizeItem memory result = prizeIdPrizeItemMapping[awardId];
        return (result.prizeAddress, result.prizeTokenId, result.status, awardId, result.prizeProvider, result.prizeType, result.amount);
    }

    function queryLastRequestRevealTime() public view returns (uint256) {
        return lastRequestRevealTime;
    }


    fallback() external payable {}

    receive() external payable {}


}