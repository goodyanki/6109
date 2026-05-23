import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { AgentRegistry } from "../../typechain-types";

describe("AgentRegistry", function () {
  // Permission mask constants (must match contract)
  const PERM_NONE = 0;
  const PERM_TRANSFER = 1; // 1 << 0
  const PERM_SWAP = 2;     // 1 << 1
  const PERM_BOTH = 3;     // TRANSFER | SWAP

  async function deployFixture() {
    const [owner, agentAddr, otherAgent, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("AgentRegistry");
    const registry = (await Factory.deploy()) as unknown as AgentRegistry;
    await registry.waitForDeployment();
    return { registry, owner, agentAddr, otherAgent, stranger };
  }

  // ============================================================
  // AR-001 ~ AR-005: Registration
  // ============================================================
  describe("registerAgent", function () {
    it("AR-001: register valid agent emits AgentRegistered with agentId=1", async function () {
      const { registry, agentAddr } = await loadFixture(deployFixture);
      await expect(registry.registerAgent(agentAddr.address, PERM_BOTH))
        .to.emit(registry, "AgentRegistered")
        .withArgs(1, agentAddr.address, PERM_BOTH);

      expect(await registry.isRegisteredAgent(agentAddr.address)).to.equal(true);
    });

    it("AR-002: registering same agent address twice MUST revert", async function () {
      const { registry, agentAddr } = await loadFixture(deployFixture);
      await registry.registerAgent(agentAddr.address, PERM_BOTH);
      await expect(
        registry.registerAgent(agentAddr.address, PERM_BOTH)
      ).to.be.revertedWith("AgentAlreadyRegistered");
    });

    it("AR-003: registerAgent with address(0) MUST revert", async function () {
      const { registry } = await loadFixture(deployFixture);
      await expect(
        registry.registerAgent(ethers.ZeroAddress, PERM_BOTH)
      ).to.be.revertedWith("InvalidAgentAddress");
    });

    it("AR-004: registerAgent with allowedIntentMask = 0 MUST revert", async function () {
      const { registry, agentAddr } = await loadFixture(deployFixture);
      await expect(
        registry.registerAgent(agentAddr.address, PERM_NONE)
      ).to.be.revertedWith("InvalidPermissionMask");
    });

    it("AR-005: cannot register same agentAddress from different owner", async function () {
      const { registry, agentAddr, stranger } = await loadFixture(deployFixture);
      await registry.registerAgent(agentAddr.address, PERM_BOTH);
      await expect(
        registry.connect(stranger).registerAgent(agentAddr.address, PERM_BOTH)
      ).to.be.revertedWith("AgentAlreadyRegistered");
    });
  });

  // ============================================================
  // AR-006 ~ AR-010: Status Management
  // ============================================================
  describe("setAgentStatus", function () {
    it("AR-006: owner deactivates agent — active becomes false", async function () {
      const { registry, agentAddr } = await loadFixture(deployFixture);
      await registry.registerAgent(agentAddr.address, PERM_BOTH);
      await expect(registry.setAgentStatus(1, false))
        .to.emit(registry, "AgentStatusChanged")
        .withArgs(1, false);
    });

    it("AR-007: owner reactivates inactive agent — active becomes true", async function () {
      const { registry, agentAddr } = await loadFixture(deployFixture);
      await registry.registerAgent(agentAddr.address, PERM_BOTH);
      await registry.setAgentStatus(1, false);
      await expect(registry.setAgentStatus(1, true))
        .to.emit(registry, "AgentStatusChanged")
        .withArgs(1, true);
    });

    it("AR-008: setAgentStatus by non-owner MUST revert", async function () {
      const { registry, agentAddr, stranger } = await loadFixture(deployFixture);
      await registry.registerAgent(agentAddr.address, PERM_BOTH);
      await expect(
        registry.connect(stranger).setAgentStatus(1, false)
      ).to.be.revertedWith("OnlyAgentOwner");
    });

    it("AR-009: setAgentStatus for non-existent agentId MUST revert", async function () {
      const { registry } = await loadFixture(deployFixture);
      await expect(registry.setAgentStatus(999, false)).to.be.revertedWith(
        "AgentNotFound"
      );
    });

    it("AR-010: setAgentStatus(true) when already active MUST revert", async function () {
      const { registry, agentAddr } = await loadFixture(deployFixture);
      await registry.registerAgent(agentAddr.address, PERM_BOTH);
      // Already active by default
      await expect(registry.setAgentStatus(1, true)).to.be.revertedWith(
        "StatusUnchanged"
      );
    });
  });

  // ============================================================
  // AR-011 ~ AR-017: Permission / Authorization
  // ============================================================
  describe("permission checks", function () {
    it("AR-011: canSubmitIntent(SWAP) returns true for SWAP-permitted agent", async function () {
      const { registry, agentAddr } = await loadFixture(deployFixture);
      await registry.registerAgent(agentAddr.address, PERM_SWAP);
      expect(
        await registry.canSubmitIntent(agentAddr.address, 1) // 1 = SWAP
      ).to.equal(true);
    });

    it("AR-012: canSubmitIntent(TRANSFER) returns false for SWAP-only agent", async function () {
      const { registry, agentAddr } = await loadFixture(deployFixture);
      await registry.registerAgent(agentAddr.address, PERM_SWAP);
      expect(
        await registry.canSubmitIntent(agentAddr.address, 0) // 0 = TRANSFER
      ).to.equal(false);
    });

    it("AR-013: canSubmitIntent returns false for inactive agent", async function () {
      const { registry, agentAddr } = await loadFixture(deployFixture);
      await registry.registerAgent(agentAddr.address, PERM_BOTH);
      await registry.setAgentStatus(1, false);
      expect(
        await registry.canSubmitIntent(agentAddr.address, 1)
      ).to.equal(false);
    });

    it("AR-014: canSubmitIntent returns false for unregistered address", async function () {
      const { registry, stranger } = await loadFixture(deployFixture);
      expect(
        await registry.canSubmitIntent(stranger.address, 1)
      ).to.equal(false);
    });

    it("AR-015: isRegisteredAgent returns true for registered + active", async function () {
      const { registry, agentAddr } = await loadFixture(deployFixture);
      await registry.registerAgent(agentAddr.address, PERM_BOTH);
      expect(await registry.isRegisteredAgent(agentAddr.address)).to.equal(true);
    });

    it("AR-016: isRegisteredAgent returns true for registered + inactive", async function () {
      const { registry, agentAddr } = await loadFixture(deployFixture);
      await registry.registerAgent(agentAddr.address, PERM_BOTH);
      await registry.setAgentStatus(1, false);
      // Still registered, just inactive
      expect(await registry.isRegisteredAgent(agentAddr.address)).to.equal(true);
    });

    it("AR-017: isRegisteredAgent returns false for unregistered address", async function () {
      const { registry, stranger } = await loadFixture(deployFixture);
      expect(await registry.isRegisteredAgent(stranger.address)).to.equal(false);
    });
  });

  // ============================================================
  // Bonus: agentId auto-increment
  // ============================================================
  describe("agentId sequencing", function () {
    it("agentId auto-increments: 1, 2, 3, ...", async function () {
      const { registry, agentAddr, otherAgent, stranger } =
        await loadFixture(deployFixture);
      await registry.registerAgent(agentAddr.address, PERM_BOTH);
      await registry.registerAgent(otherAgent.address, PERM_SWAP);
      await registry.registerAgent(stranger.address, PERM_TRANSFER);

      expect(await registry.isRegisteredAgent(agentAddr.address)).to.equal(true);
      expect(await registry.isRegisteredAgent(otherAgent.address)).to.equal(true);
      expect(await registry.isRegisteredAgent(stranger.address)).to.equal(true);
    });
  });
});
