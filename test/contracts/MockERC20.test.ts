import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { MockERC20 } from "../../typechain-types";

describe("MockERC20", function () {
  // ============================================================
  // Fixture: deploy a fresh MockERC20 before each test
  // ============================================================
  async function deployFixture() {
    const [owner, alice, bob] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("MockERC20");
    const token = (await Factory.deploy(
      "Mock USDC",
      "USDC",
      18
    )) as unknown as MockERC20;
    await token.waitForDeployment();
    return { token, owner, alice, bob };
  }

  // ============================================================
  // MC-001 ~ MC-007
  // ============================================================

  describe("mint", function () {
    it("MC-001: mint(address, amount) called by owner — balance & totalSupply increase, Transfer event emitted", async function () {
      const { token, owner, alice } = await loadFixture(deployFixture);
      const mintAmount = ethers.parseUnits("1000", 18);

      await expect(token.mint(alice.address, mintAmount))
        .to.emit(token, "Transfer")
        .withArgs(ethers.ZeroAddress, alice.address, mintAmount);

      expect(await token.balanceOf(alice.address)).to.equal(mintAmount);
      expect(await token.totalSupply()).to.equal(mintAmount);
    });

    it("MC-002: mint called by non-owner MUST revert", async function () {
      const { token, alice } = await loadFixture(deployFixture);
      await expect(
        token.connect(alice).mint(alice.address, 1000)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });
  });

  describe("transfer", function () {
    it("MC-003: transfer with sufficient balance succeeds", async function () {
      const { token, owner, alice } = await loadFixture(deployFixture);
      await token.mint(owner.address, ethers.parseUnits("500", 18));

      await expect(
        token.transfer(alice.address, ethers.parseUnits("200", 18))
      )
        .to.emit(token, "Transfer")
        .withArgs(owner.address, alice.address, ethers.parseUnits("200", 18));

      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseUnits("200", 18)
      );
      expect(await token.balanceOf(owner.address)).to.equal(
        ethers.parseUnits("300", 18)
      );
    });

    it("MC-004: transfer with insufficient balance MUST revert", async function () {
      const { token, owner, alice } = await loadFixture(deployFixture);
      await expect(
        token.transfer(alice.address, ethers.parseUnits("1", 18))
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });
  });

  describe("approve + transferFrom", function () {
    it("MC-005: approve then transferFrom deducts allowance correctly", async function () {
      const { token, owner, alice, bob } = await loadFixture(deployFixture);
      await token.mint(owner.address, ethers.parseUnits("1000", 18));
      await token.approve(alice.address, ethers.parseUnits("300", 18));

      await expect(
        token
          .connect(alice)
          .transferFrom(
            owner.address,
            bob.address,
            ethers.parseUnits("150", 18)
          )
      )
        .to.emit(token, "Transfer")
        .withArgs(owner.address, bob.address, ethers.parseUnits("150", 18));

      expect(await token.balanceOf(bob.address)).to.equal(
        ethers.parseUnits("150", 18)
      );
      expect(await token.allowance(owner.address, alice.address)).to.equal(
        ethers.parseUnits("150", 18)
      );
    });

    it("MC-006: transferFrom without sufficient allowance MUST revert", async function () {
      const { token, owner, alice, bob } = await loadFixture(deployFixture);
      await token.mint(owner.address, ethers.parseUnits("100", 18));

      await expect(
        token
          .connect(alice)
          .transferFrom(owner.address, bob.address, ethers.parseUnits("50", 18))
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });
  });

  describe("metadata", function () {
    it("MC-007: name, symbol, decimals return constructor values", async function () {
      const { token } = await loadFixture(deployFixture);
      expect(await token.name()).to.equal("Mock USDC");
      expect(await token.symbol()).to.equal("USDC");
      expect(await token.decimals()).to.equal(18);
    });
  });
});
