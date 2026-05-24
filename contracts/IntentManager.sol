// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AgentRegistry.sol";

contract IntentManager {
    enum IntentType { TRANSFER, SWAP }
    enum IntentStatus { PENDING, BATCHED, EXECUTED, FAILED, EXPIRED, CANCELLED }

    struct Intent {
        uint256 id;
        address agent;
        address owner;
        IntentType intentType;
        address tokenIn;
        address tokenOut;
        address recipient;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 executeAfter;
        uint256 deadline;
        uint256 maxGasPrice;
        uint256 createdAt;
        IntentStatus status;
    }

    AgentRegistry public immutable registry;
    address public batchExecutor;

    uint256 public nextIntentId = 1;
    mapping(uint256 => Intent) private _intents;
    uint256[] private _pendingIntentIds;

    event IntentSubmitted(
        uint256 indexed intentId,
        address indexed agent,
        IntentType intentType
    );

    event IntentStatusChanged(
        uint256 indexed intentId,
        IntentStatus status
    );

    event IntentCancelled(uint256 indexed intentId);

    modifier onlyBatchExecutor() {
        require(msg.sender == batchExecutor, "OnlyBatchExecutor");
        _;
    }

    constructor(address _registry) {
        registry = AgentRegistry(_registry);
    }

    function setBatchExecutor(address _batchExecutor) external {
        require(batchExecutor == address(0), "AlreadySet");
        batchExecutor = _batchExecutor;
    }

    function submitTransferIntent(
        address token,
        address recipient,
        uint256 amount,
        uint256 executeAfter,
        uint256 deadline,
        uint256 maxGasPrice
    ) external returns (uint256 intentId) {
        _validateAgent(msg.sender, 0);
        _validateCommonParams(token, amount, executeAfter, deadline);
        require(recipient != address(0), "InvalidRecipient");

        intentId = _storeIntent(
            msg.sender,
            IntentType.TRANSFER,
            token,
            address(0),
            recipient,
            amount,
            0,
            executeAfter,
            deadline,
            maxGasPrice
        );
    }

    function submitSwapIntent(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 executeAfter,
        uint256 deadline,
        uint256 maxGasPrice
    ) external returns (uint256 intentId) {
        _validateAgent(msg.sender, 1);
        require(tokenOut != address(0), "InvalidToken");
        require(tokenIn != tokenOut, "IdenticalTokens");
        require(minAmountOut > 0, "InvalidMinAmountOut");
        _validateCommonParams(tokenIn, amountIn, executeAfter, deadline);

        intentId = _storeIntent(
            msg.sender,
            IntentType.SWAP,
            tokenIn,
            tokenOut,
            address(0),
            amountIn,
            minAmountOut,
            executeAfter,
            deadline,
            maxGasPrice
        );
    }

    function cancelIntent(uint256 intentId) external {
        Intent storage intent = _intents[intentId];
        require(intent.id != 0, "IntentNotFound");
        require(intent.status == IntentStatus.PENDING, "IntentNotCancellable");
        require(
            msg.sender == intent.owner || msg.sender == intent.agent,
            "OnlyIntentOwnerOrAgent"
        );

        intent.status = IntentStatus.CANCELLED;
        _removeFromPending(intentId);
        emit IntentCancelled(intentId);
    }

    function getIntent(uint256 intentId) external view returns (Intent memory) {
        Intent storage intent = _intents[intentId];
        require(intent.id != 0, "IntentNotFound");
        return intent;
    }

    function getPendingIntentIds(
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory) {
        uint256 total = _pendingIntentIds.length;
        if (offset >= total) return new uint256[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;

        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = _pendingIntentIds[offset + i];
        }
        return result;
    }

    function setIntentStatus(
        uint256 intentId,
        IntentStatus status
    ) external onlyBatchExecutor {
        Intent storage intent = _intents[intentId];
        intent.status = status;
        if (status != IntentStatus.PENDING) {
            _removeFromPending(intentId);
        }
        emit IntentStatusChanged(intentId, status);
    }

    function _validateAgent(address agent, uint8 intentType) private view {
        require(registry.isRegisteredAgent(agent), "OnlyRegisteredAgent");
        require(registry.isAgentActive(agent), "AgentNotActive");
        require(registry.canSubmitIntent(agent, intentType), "IntentTypeNotAllowed");
    }

    function _validateCommonParams(
        address token,
        uint256 amount,
        uint256 executeAfter,
        uint256 deadline
    ) private view {
        require(token != address(0), "InvalidToken");
        require(amount > 0, "InvalidAmount");
        require(deadline > block.timestamp, "InvalidDeadline");
        require(executeAfter <= deadline, "InvalidTimeWindow");
    }

    function _storeIntent(
        address agent,
        IntentType intentType,
        address tokenIn,
        address tokenOut,
        address recipient,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 executeAfter,
        uint256 deadline,
        uint256 maxGasPrice
    ) private returns (uint256 intentId) {
        address intentOwner = registry.getAgentOwner(agent);
        intentId = nextIntentId++;
        _intents[intentId] = Intent({
            id: intentId,
            agent: agent,
            owner: intentOwner,
            intentType: intentType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            recipient: recipient,
            amountIn: amountIn,
            minAmountOut: minAmountOut,
            executeAfter: executeAfter,
            deadline: deadline,
            maxGasPrice: maxGasPrice,
            createdAt: block.timestamp,
            status: IntentStatus.PENDING
        });
        _pendingIntentIds.push(intentId);
        emit IntentSubmitted(intentId, agent, intentType);
    }

    function _removeFromPending(uint256 intentId) private {
        uint256 len = _pendingIntentIds.length;
        for (uint256 i = 0; i < len; i++) {
            if (_pendingIntentIds[i] == intentId) {
                _pendingIntentIds[i] = _pendingIntentIds[len - 1];
                _pendingIntentIds.pop();
                break;
            }
        }
    }
}
