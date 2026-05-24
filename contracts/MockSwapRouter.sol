// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockSwapRouter is Ownable {
    address public immutable token0;
    address public immutable token1;

    uint256 public reserve0;
    uint256 public reserve1;

    event Swap(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(address _token0, address _token1) Ownable(msg.sender) {
        token0 = _token0;
        token1 = _token1;
    }

    function addLiquidity(address token, uint256 amount) external onlyOwner {
        require(
            token == token0 || token == token1,
            "UnsupportedToken"
        );
        if (token == token0) {
            reserve0 += amount;
        } else {
            reserve1 += amount;
        }
    }

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external returns (uint256 amountOut) {
        require(tokenIn == token0 || tokenIn == token1, "UnsupportedToken");
        require(tokenIn != tokenOut, "IdenticalTokens");
        require(tokenOut == token0 || tokenOut == token1, "UnsupportedToken");
        require(amountIn > 0, "InvalidAmount");

        (uint256 reserveIn, uint256 reserveOut) = _getReserves(tokenIn, tokenOut);
        require(reserveIn > 0 && reserveOut > 0, "InsufficientLiquidity");

        amountOut = (reserveOut * amountIn * 997) / (reserveIn * 1000 + amountIn * 997);

        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).transfer(msg.sender, amountOut);

        _setReserves(tokenIn, reserveIn + amountIn);
        _setReserves(tokenOut, reserveOut - amountOut);

        emit Swap(tokenIn, tokenOut, amountIn, amountOut);
    }

    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256) {
        require(amountIn > 0, "InvalidAmount");
        (uint256 reserveIn, uint256 reserveOut) = _getReserves(tokenIn, tokenOut);
        return (reserveOut * amountIn * 997) / (reserveIn * 1000 + amountIn * 997);
    }

    function _getReserves(
        address tokenIn,
        address tokenOut
    ) private view returns (uint256 reserveIn, uint256 reserveOut) {
        require(
            (tokenIn == token0 && tokenOut == token1) ||
                (tokenIn == token1 && tokenOut == token0),
            "UnsupportedToken"
        );

        if (tokenIn == token0) {
            reserveIn = reserve0;
            reserveOut = reserve1;
        } else {
            reserveIn = reserve1;
            reserveOut = reserve0;
        }
    }

    function _setReserves(address token, uint256 value) private {
        if (token == token0) {
            reserve0 = value;
        } else {
            reserve1 = value;
        }
    }
}
