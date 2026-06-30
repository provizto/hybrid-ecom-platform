// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DigitalGoodsStore is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    
    mapping(uint256 => uint256) public productPrices;

    event NFTOwnershipMinted(address indexed buyer, uint256 indexed tokenId, uint256 productId, string tokenURI);
    event PriceUpdated(uint256 indexed productId, uint256 oldPrice, uint256 newPrice);

    constructor(address initialOwner) 
        ERC721("Base Digital Goods", "BDG") 
        Ownable(initialOwner) 
    {}

    function setProductPrice(uint256 productId, uint256 price) external onlyOwner {
        emit PriceUpdated(productId, productPrices[productId], price);
        productPrices[productId] = price;
    }

    function buyDigitalGood(uint256 productId, string memory awsTokenURI) external payable {
        uint256 price = productPrices[productId];
        
        require(price > 0, "Produk belum didaftarkan atau tidak dijual");
        require(msg.value >= price, "Dana yang dikirimkan kurang dari harga produk");

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, awsTokenURI);

        emit NFTOwnershipMinted(msg.sender, tokenId, productId, awsTokenURI);

        // 🌟 PERBAIKAN MUTAKHIR: Mengganti .transfer() ke metode .call() aman dengan pengecekan status sukses
        if (msg.value > price) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - price}("");
            require(success, "Gagal mengembalikan uang kembalian");
        }
    }

    function mintForFiatBuyer(address buyer, string memory awsTokenURI, uint256 productId) external onlyOwner {
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        _safeMint(buyer, tokenId);
        _setTokenURI(tokenId, awsTokenURI);

        emit NFTOwnershipMinted(buyer, tokenId, productId, awsTokenURI);
    }

    function withdrawFunds() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "Saldo kosong, tidak ada dana yang bisa ditarik");
        
        // 🌟 PERBAIKAN MUTAKHIR: Mengganti .transfer() ke metode .call() aman untuk penarikan dana owner
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Gagal menarik dana");
    }
}