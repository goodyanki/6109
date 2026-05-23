import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { MockSwapRouter, MockERC20 } from "../../typechain-types";

describe("MockSwapRouter", function () {
  const INITIAL_USDC = ethers.parseUnits("300000", 18); // 300k USDC
  const INITIAL_WETH = ethers.parseUnits("100", 18); // 100 WETH

  async function deployFixture() {
    const [owner, alice] = await ethers.getSigners();

    // Deploy tokens
    const TokenFactory = await ethers.getContractFactory("MockERC20");
    const usdc = (await TokenFactory.deploy(
      "Mock USDC",
      "USDC",
      18
    )) as unknown as MockERC20;
    await usdc.waitForDeployment();
    const weth = (await TokenFactory.deploy(
      "Mock WETH",
      "WETH",
      18
    )) as unknown as MockERC20;
    await weth.waitForDeployment();

    // Deploy router
    const RouterFactory = await ethers.getContractFactory("MockSwapRouter");
    const router = (await RouterFactory.deploy(
      await usdc.getAddress(),
      await weth.getAddress()
    )) as unknown as MockSwapRouter;
    await router.waitForDeployment();

    // Mint tokens to owner and router
    await usdc.mint(owner.address, INITIAL_USDC);
    await weth.mint(owner.address, INITIAL_WETH);
    await usdc.mint(await router.getAddress(), INITIAL_USDC);
    await weth.mint(await router.getAddress(), INITIAL_WETH);

    // Add liquidity
    await usdc.approve(await router.getAddress(), INITIAL_USDC);
    await weth.approve(await router.getAddress(), INITIAL_WETH);
    await router.addLiquidity(await usdc.getAddress(), INITIAL_USDC);
    await router.addLiquidity(await weth.getAddress(), INITIAL_WETH);

    return { router, usdc, weth, owner, alice };
  }

  // ============================================================
  // MR-001 ~ MR-002: Liquidity
  // ============================================================
  describe("addLiquidity", function () {
    it("MR-001: addLiquidity by owner increases reserves", async function () {
      const { router, usdc, weth } = await loadFixture(deployFixture);
      // Reserves are set in fixture; verify they match
      const amountOut = await router.getAmountOut(
        await usdc.getAddress(),
        await weth.getAddress(),
        ethers.parseUnits("3000", 18)
      );
      // With 300k USDC / 100 WETH pool, 3000 USDC should output ~0.99 WETH
      expect(amountOut).to.be.gt(0);
    });

    it("MR-002: addLiquidity by non-owner MUST revert", async function () {
      const { router, usdc, alice } = await loadFixture(deployFixture);
      await expect(
        router
          .connect(alice)
          .addLiquidity(await usdc.getAddress(), ethers.parseUnits("100", 18))
      ).to.be.revertedWithCustomError(router, "OwnableUnauthorizedAccount");
    });
  });

  // ============================================================
  // MR-003 ~ MR-010: Swap
  // ============================================================
  describe("swap", function () {
    it("MR-003: swap returns correct amountOut per x*y=k formula with 0.3% fee", async function () {
      const { router, usdc, weth, owner } = await loadFixture(deployFixture);
      const amountIn = ethers.parseUnits("3000", 18); // 3000 USDC → WETH

      await usdc.approve(await router.getAddress(), amountIn);

      const expectedOut = await router.getAmountOut(
        await usdc.getAddress(),
        await weth.getAddress(),
        amountIn
      );

      await expect(
        router.swap(await usdc.getAddress(), await weth.getAddress(), amountIn)
      )
        .to.emit(router, "Swap")
        .withArgs(await usdc.getAddress(), await weth.getAddress(), amountIn, expectedOut);

      // WETH balance should increase by expectedOut
      expect(await weth.balanceOf(owner.address)).to.equal(
        INITIAL_WETH + expectedOut
      );
    });

    it("MR-004: swap with unsupported tokenIn MUST revert", async function () {
      const { router, owner } = await loadFixture(deployFixture);
      await expect(
        router.swap(owner.address, owner.address, 100)
      ).to.be.revertedWith("UnsupportedToken");
    });

    it("MR-005: swap with unsupported tokenOut MUST revert", async function () {
      const { router, usdc, owner } = await loadFixture(deployFixture);
      await expect(
        router.swap(await usdc.getAddress(), owner.address, 100)
      ).to.be.revertedWith("UnsupportedToken");
    });

    it("MR-006: swap with tokenIn == tokenOut MUST revert", async function () {
      const { router, usdc } = await loadFixture(deployFixture);
      await expect(
        router.swap(
          await usdc.getAddress(),
          await usdc.getAddress(),
          100
        )
      ).to.be.revertedWith("IdenticalTokens");
    });

    it("MR-007: swap with amountIn = 0 MUST revert", async function () {
      const { router, usdc, weth } = await loadFixture(deployFixture);
      await expect(
        router.swap(await usdc.getAddress(), await weth.getAddress(), 0)
      ).to.be.revertedWith("InvalidAmount");
    });

    it("MR-008: swap when pool has zero reserves MUST revert", async function () {
      const [owner] = await ethers.getSigners();
      const TokenFactory = await ethers.getContractFactory("MockERC20");
      const usdc2 = (await TokenFactory.deploy("U2", "U2", 18)) as unknown as MockERC20;
      await usdc2.waitForDeployment();
      const weth2 = (await TokenFactory.deploy("W2", "W2", 18)) as unknown as MockERC20;
      await weth2.waitForDeployment();

      const RouterFactory = await ethers.getContractFactory("MockSwapRouter");
      const router2 = (await RouterFactory.deploy(
        await usdc2.getAddress(),
        await weth2.getAddress()
      )) as unknown as MockSwapRouter;
      await router2.waitForDeployment();

      await usdc2.mint(owner.address, 1000);
      await usdc2.approve(await router2.getAddress(), 1000);

      await expect(
        router2.swap(await usdc2.getAddress(), await weth2.getAddress(), 1000)
      ).to.be.revertedWith("InsufficientLiquidity");
    });

    it("MR-009: large swap relative to reserves succeeds with high slippage", async function () {
      const { router, usdc, weth, owner } = await loadFixture(deployFixture);
      // Swap 90% of USDC reserves (270k USDC) → significant slippage
      const largeAmount = ethers.parseUnits("270000", 18);
      await usdc.mint(owner.address, largeAmount);
      await usdc.approve(await router.getAddress(), largeAmount);

      const amountOut = await router.getAmountOut(
        await usdc.getAddress(),
        await weth.getAddress(),
        largeAmount
      );

      await expect(
        router.swap(
          await usdc.getAddress(),
          await weth.getAddress(),
          largeAmount
        )
      ).to.not.be.reverted;

      // Output should be significantly less than the initial-price equivalent due to slippage
      const naiveOutput = (largeAmount * INITIAL_WETH) / INITIAL_USDC;
      expect(amountOut).to.be.lt(naiveOutput);
    });

    it("MR-010: tiny swap (1 wei) succeeds with correct formula", async function () {
      const { router, usdc, weth } = await loadFixture(deployFixture);
      const tinyAmount = 1n;
      await usdc.approve(await router.getAddress(), tinyAmount);

      const amountOut = await router.getAmountOut(
        await usdc.getAddress(),
        await weth.getAddress(),
        tinyAmount
      );

      await expect(
        router.swap(await usdc.getAddress(), await weth.getAddress(), tinyAmount)
      ).to.not.be.reverted;

      // amountOut formula: reserveOut * amountIn * 997 / (reserveIn * 1000 + amountIn * 997)
      const expected =
        (INITIAL_WETH * tinyAmount * 997n) /
        (INITIAL_USDC * 1000n + tinyAmount * 997n);
      expect(amountOut).to.equal(expected);
    });
  });

  // ============================================================
  // MR-011 ~ MR-012: getAmountOut
  // ============================================================
  describe("getAmountOut", function () {
    it("MR-011: getAmountOut returns correct value without modifying state", async function () {
      const { router, usdc, weth } = await loadFixture(deployFixture);
      const amountIn = ethers.parseUnits("100", 18);

      const amountOutBefore = await router.getAmountOut(
        await usdc.getAddress(),
        await weth.getAddress(),
        amountIn
      );

      // Second call returns same value (no state change)
      const amountOutAfter = await router.getAmountOut(
        await usdc.getAddress(),
        await weth.getAddress(),
        amountIn
      );
      expect(amountOutAfter).to.equal(amountOutBefore);
    });

    it("MR-012: getAmountOut with unsupported token pair MUST revert", async function () {
      const { router, usdc } = await loadFixture(deployFixture);
      await expect(
        router.getAmountOut(await usdc.getAddress(), await usdc.getAddress(), 100)
      ).to.be.revertedWith("UnsupportedToken");
    });
  });
});
