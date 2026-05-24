// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IntentManager.sol";
import "./MockSwapRouter.sol";

contract BatchExecutor is Ownable {
    IntentManager public immutable intentManager;
    MockSwapRouter public immutable swapRouter;
    address public relayer;

    uint256 public constant MAX_BATCH_SIZE = 10;

    event BatchExecuted(
        bytes32 indexed txHash,
        uint256 batchSize,
        uint256 successCount,
        uint256 failedCount,
        uint256 gasUsed
    );

    event IntentExecuted(uint256 indexed intentId, bytes32 txHash);

    modifier onlyRelayer() {
        require(msg.sender == relayer, "OnlyRelayer");
        _;
    }

    constructor(
        address _intentManager,
        address _swapRouter,
        address _relayer
    ) Ownable(msg.sender) {
        intentManager = IntentManager(_intentManager);
        swapRouter = MockSwapRouter(_swapRouter);
        relayer = _relayer;
    }

    function setRelayer(address _relayer) external onlyOwner {
        relayer = _relayer;
    }

    function executeBatch(
        uint256[] calldata intentIds
    ) external onlyRelayer returns (uint256 successCount, uint256 failedCount) {
        require(intentIds.length > 0, "EmptyBatch");
        require(intentIds.length <= MAX_BATCH_SIZE, "BatchTooLarge");

        for (uint256 i = 0; i < intentIds.length; i++) {
            for (uint256 j = i + 1; j < intentIds.length; j++) {
                require(intentIds[i] != intentIds[j], "DuplicateIntent");
            }
        }

        uint256 gasStart = gasleft();

        for (uint256 i = 0; i < intentIds.length; i++) {
            bool success = _executeIntent(intentIds[i]);
            if (success) {
                successCount++;
            } else {
                failedCount++;
            }
        }

        uint256 gasUsed = gasStart - gasleft();
        bytes32 txHash = keccak256(
            abi.encodePacked(block.number, block.timestamp, intentIds, successCount)
        );

        emit BatchExecuted(txHash, intentIds.length, successCount, failedCount, gasUsed);
    }

    function _executeIntent(uint256 intentId) private returns (bool) {
        IntentManager.Intent memory intent = intentManager.getIntent(intentId);

        if (intent.status != IntentManager.IntentStatus.PENDING) {
            _markFailed(intentId);
            return false;
        }

        if (intent.deadline < block.timestamp) {
            intentManager.setIntentStatus(intentId, IntentManager.IntentStatus.EXPIRED);
            return false;
        }

        if (block.timestamp < intent.executeAfter) {
            _markFailed(intentId);
            return false;
        }

        if (intent.maxGasPrice > 0 && tx.gasprice > intent.maxGasPrice) {
            _markFailed(intentId);
            return false;
        }

        AgentRegistry registry = intentManager.registry();
        if (!registry.isAgentActive(intent.agent)) {
            _markFailed(intentId);
            return false;
        }

        bool success;
        if (intent.intentType == IntentManager.IntentType.SWAP) {
            success = _executeSwap(intent);
        } else {
            success = _executeTransfer(intent);
        }

        if (success) {
            intentManager.setIntentStatus(intentId, IntentManager.IntentStatus.EXECUTED);
            bytes32 txHash = keccak256(
                abi.encodePacked(block.number, block.timestamp, intentId)
            );
            emit IntentExecuted(intentId, txHash);
        } else {
            _markFailed(intentId);
        }

        return success;
    }

    function _executeSwap(
        IntentManager.Intent memory intent
    ) private returns (bool) {
        IERC20 tokenIn = IERC20(intent.tokenIn);
        IERC20 tokenOut = IERC20(intent.tokenOut);

        uint256 allowance = tokenIn.allowance(intent.agent, address(this));
        uint256 balance = tokenIn.balanceOf(intent.agent);
        if (allowance < intent.amountIn || balance < intent.amountIn) {
            return false;
        }

        uint256 expectedOut = swapRouter.getAmountOut(
            intent.tokenIn,
            intent.tokenOut,
            intent.amountIn
        );

        if (expectedOut < intent.minAmountOut) {
            return false;
        }

        tokenIn.transferFrom(intent.agent, address(this), intent.amountIn);
        tokenIn.approve(address(swapRouter), intent.amountIn);

        uint256 amountOut = swapRouter.swap(
            intent.tokenIn,
            intent.tokenOut,
            intent.amountIn
        );

        tokenOut.transfer(intent.agent, amountOut);
        return true;
    }

    function _executeTransfer(
        IntentManager.Intent memory intent
    ) private returns (bool) {
        IERC20 token = IERC20(intent.tokenIn);

        uint256 allowance = token.allowance(intent.agent, address(this));
        uint256 balance = token.balanceOf(intent.agent);
        if (allowance < intent.amountIn || balance < intent.amountIn) {
            return false;
        }

        token.transferFrom(intent.agent, address(this), intent.amountIn);
        token.transfer(intent.recipient, intent.amountIn);
        return true;
    }

    function _markFailed(uint256 intentId) private {
        intentManager.setIntentStatus(intentId, IntentManager.IntentStatus.FAILED);
    }
}
