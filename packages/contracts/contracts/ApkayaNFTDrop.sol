// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title ApkayaNFTDrop
/// @notice ERC721 "drop" template, mirroring thirdweb's DropERC721: the
/// owner sets a claim phase (price, max supply, optional allowlist via
/// Merkle root), and any address can self-mint by calling `claim` and
/// paying the price — no per-mint owner transaction required.
contract ApkayaNFTDrop is ERC721URIStorage, Ownable {
    uint256 public nextTokenId;
    uint256 public maxSupply;
    uint256 public pricePerToken; // in wei
    bytes32 public allowlistMerkleRoot; // bytes32(0) disables allowlist gating
    bool public claimOpen;

    string private _baseTokenURI;

    event ClaimConditionUpdated(uint256 maxSupply, uint256 pricePerToken, bytes32 merkleRoot, bool open);
    event TokenClaimed(address indexed claimer, uint256 indexed tokenId);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseTokenURI_,
        address initialOwner
    ) ERC721(name_, symbol_) Ownable(initialOwner) {
        _baseTokenURI = baseTokenURI_;
    }

    /// @notice Configure (or reconfigure) the active claim phase.
    function setClaimCondition(
        uint256 _maxSupply,
        uint256 _pricePerToken,
        bytes32 _merkleRoot,
        bool _open
    ) external onlyOwner {
        require(_maxSupply >= nextTokenId, "maxSupply below already-minted count");
        maxSupply = _maxSupply;
        pricePerToken = _pricePerToken;
        allowlistMerkleRoot = _merkleRoot;
        claimOpen = _open;
        emit ClaimConditionUpdated(_maxSupply, _pricePerToken, _merkleRoot, _open);
    }

    /// @notice Self-mint a token. Pass an empty array for `merkleProof` when
    /// the allowlist is disabled (allowlistMerkleRoot == bytes32(0)).
    function claim(bytes32[] calldata merkleProof) external payable {
        require(claimOpen, "claiming is not open");
        require(nextTokenId < maxSupply, "sold out");
        require(msg.value >= pricePerToken, "insufficient payment");

        if (allowlistMerkleRoot != bytes32(0)) {
            bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
            require(MerkleProof.verify(merkleProof, allowlistMerkleRoot, leaf), "not on allowlist");
        }

        uint256 tokenId = nextTokenId++;
        _safeMint(msg.sender, tokenId);
        emit TokenClaimed(msg.sender, tokenId);
    }

    /// @notice Owner can withdraw accumulated claim payments.
    function withdraw(address payable to) external onlyOwner {
        to.transfer(address(this).balance);
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function setBaseURI(string memory newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
    }
}
