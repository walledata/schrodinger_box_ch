// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.1 (token/ERC721/IERC721.sol)
// @openzeppelin v3.2.0

pragma solidity ^0.8.0;

import "./presets/ERC721PresetMinterPauserAutoId.sol";


contract SampleGiftNFT is ERC721PresetMinterPauserAutoId {


    constructor(string memory name,
        string memory symbol,
        string memory baseTokenURI) public
    ERC721PresetMinterPauserAutoId(name, symbol, baseTokenURI)  {}

    function setTokenURI(uint256 tokenId, string memory tokenURI) public {

        require(hasRole(MINTER_ROLE, _msgSender()), "web3 CLI: must have minter role to update tokenURI");

        setTokenURI(tokenId, tokenURI);
    }

    function set_mint(address to) public  {
       mint(to);
    }

}

contract SampleGiftNFTFactory {

    event TokenCreated(string  name, address tokenAddress);


    function foundryNFT(
        string memory name,
        string memory syombol,
        string memory baseTokenURI) public returns  (address) {

        SampleGiftNFT tokenAddress =  new SampleGiftNFT(name,syombol,baseTokenURI);
        emit TokenCreated("SampleGiftNFT", address(tokenAddress));

        return address(tokenAddress);
    }

}