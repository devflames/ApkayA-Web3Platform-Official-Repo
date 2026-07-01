// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title ApkayaToken
/// @notice Minimal, opt-in-extensible ERC20 template. Mirrors thirdweb's
/// "TokenERC20": deployable with just name/symbol/initial supply params,
/// owner can mint additional supply later.
contract ApkayaToken is ERC20, Ownable {
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply,
        address initialOwner
    ) ERC20(name_, symbol_) Ownable(initialOwner) {
        if (initialSupply > 0) {
            _mint(initialOwner, initialSupply);
        }
    }

    /// @notice Mint additional tokens. Restricted to the contract owner so
    /// backend wallets used purely for end-user transactions can't inflate supply.
    function mintTo(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
