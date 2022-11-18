// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (token/ERC721/presets/ERC721PresetMinterPauserAutoId.sol)


pragma solidity ^0.8.0;

import "./access/Ownable.sol";
import "./security/ReentrancyGuard.sol";
import "./erc1155/presets/ERC1155PresetMinterPauser.sol";
import "./utils/Counters.sol";
import "./erc1155/extensions/ERC1155Supply.sol";

contract TicketNFT is ERC1155PresetMinterPauser, Ownable, ReentrancyGuard {
    using Strings for uint256;

    uint256 private _tokenIdTracker;

    uint256 public MINT_MAX;
    bool public saleIsActive = false;

    uint256 public _price;
    string public name;
    string public symbol;


    constructor(   string memory _name,
        string memory _symbol,string memory uri) public
    ERC1155PresetMinterPauser(uri)  {
        name = _name;
        symbol = _symbol;

    }

    function uri(
        uint256 tokenId
    ) public view override returns (string memory) {


        require(exists(tokenId), "ERC721Metadata: URI query for nonexistent token");

        string memory baseURI = super.uri(tokenId);
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenId.toString())) : "";
    }

    function setMintBatch(address to, uint number) external payable nonReentrant {

        require(_price * number <= msg.value, "Ether value sent is not correct.");
        require(totalSupply() + number <= MINT_MAX, "Purchase would exceed max supply of tokens");
        require(saleIsActive, "Sale must be active to mint Token");

        uint256[] memory mintTokenIds = new uint256[](number);
        uint256[] memory mintAmounts = new uint256[](number);
        uint256 _tokenIdCurrent = _tokenIdTracker;

        for (uint i = 0; i < number; i++)
        {
            mintTokenIds[i] = _tokenIdCurrent;
            mintAmounts[i] = 1;
            _tokenIdCurrent ++;
        }
        _tokenIdTracker = _tokenIdCurrent;
        mintBatch(to,mintTokenIds,mintAmounts,"");
    }


    function setMintMax(uint256 number) external
    {
        require(!saleIsActive ,"Sale Is Active");
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "web3 CLI: must have minter role to update tokenURI");
        MINT_MAX = number;
    }

    /*
    * Pause sale if active, make active if paused
    */
    function flipSaleState() public  {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "web3 CLI: must have minter role to update tokenURI");
        saleIsActive = !saleIsActive;
    }

    function setMintPrice(uint256 price) external
    {
        require(hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "web3 CLI: must have minter role to update tokenURI");
        _price = price;
    }

    function queryCurrentTokenId() public view returns(uint){
        return _tokenIdTracker;
    }

    /**
 * @dev See {IERC721Enumerable-totalSupply}.
     */
    function totalSupply() public view  returns (uint256) {
        return _tokenIdTracker;
    }

    function totalSupply(uint256 id) public view override returns (uint256) {
        return super.totalSupply(id);
    }


}



