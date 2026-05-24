// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AgentRegistry {
    struct Agent {
        address owner;
        address agentAddress;
        bool active;
        uint256 allowedIntentMask;
        uint256 registeredAt;
    }

    uint256 public nextAgentId = 1;

    mapping(uint256 => Agent) private _agents;
    mapping(address => uint256) private _agentAddressToId;

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed agentAddress,
        uint256 allowedIntentMask
    );

    event AgentStatusChanged(uint256 indexed agentId, bool active);

    function registerAgent(
        address agentAddress,
        uint256 allowedIntentMask
    ) external returns (uint256 agentId) {
        require(agentAddress != address(0), "InvalidAgentAddress");
        require(allowedIntentMask != 0, "InvalidPermissionMask");
        require(
            _agentAddressToId[agentAddress] == 0,
            "AgentAlreadyRegistered"
        );

        agentId = nextAgentId++;
        _agents[agentId] = Agent({
            owner: msg.sender,
            agentAddress: agentAddress,
            active: true,
            allowedIntentMask: allowedIntentMask,
            registeredAt: block.timestamp
        });
        _agentAddressToId[agentAddress] = agentId;

        emit AgentRegistered(agentId, agentAddress, allowedIntentMask);
    }

    function setAgentStatus(uint256 agentId, bool active) external {
        Agent storage agent = _agents[agentId];
        require(agent.owner != address(0), "AgentNotFound");
        require(msg.sender == agent.owner, "OnlyAgentOwner");
        require(agent.active != active, "StatusUnchanged");

        agent.active = active;
        emit AgentStatusChanged(agentId, active);
    }

    function isRegisteredAgent(address agentAddress) external view returns (bool) {
        return _agentAddressToId[agentAddress] != 0;
    }

    function getAgentOwner(address agentAddress) external view returns (address) {
        uint256 agentId = _agentAddressToId[agentAddress];
        require(agentId != 0, "AgentNotFound");
        return _agents[agentId].owner;
    }

    function isAgentActive(address agentAddress) external view returns (bool) {
        uint256 agentId = _agentAddressToId[agentAddress];
        if (agentId == 0) return false;
        return _agents[agentId].active;
    }

    function canSubmitIntent(
        address agentAddress,
        uint8 intentType
    ) external view returns (bool) {
        uint256 agentId = _agentAddressToId[agentAddress];
        if (agentId == 0) return false;

        Agent storage agent = _agents[agentId];
        if (!agent.active) return false;

        uint256 requiredMask = 1 << intentType;
        return (agent.allowedIntentMask & requiredMask) != 0;
    }
}
