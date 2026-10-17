import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ganache from "ganache";
import { BrowserProvider, ContractFactory, parseEther, id } from "ethers";
const artifact = JSON.parse(
  fs.readFileSync(new URL("../artifacts/ReadPactV2.json", import.meta.url)),
);
async function setup() {
  const rpc = ganache.provider({
    logging: { quiet: true },
    wallet: { totalAccounts: 5, defaultBalance: 1000 },
  });
  const provider = new BrowserProvider(rpc);
  provider.pollingInterval = 10;
  const users = await Promise.all(
    [0, 1, 2, 3].map((i) => provider.getSigner(i)),
  );
  const contract = await new ContractFactory(
    artifact.abi,
    artifact.bytecode,
    users[0],
  ).deploy();
  await contract.waitForDeployment();
  const tx = async (p) => {
    await (await p).wait();
  };
  const advance = async (s) => {
    await rpc.request({ method: "evm_increaseTime", params: [s] });
    await rpc.request({ method: "evm_mine", params: [] });
  };
  const create = async (book = id("naval-almanack-v1")) => {
    const b = await provider.getBlock("latest");
    await tx(contract.createChallenge(book, true, b.timestamp + 3600));
    const n = await contract.challengeCount();
    for (const u of users.slice(0, 3))
      await tx(contract.connect(u).join(n, { value: parseEther("10") }));
    return n;
  };
  const check = async (n, day, count) => {
    for (let i = 0; i < count; i++) {
      const hash = id(`${n}-${day}-${i}`);
      await tx(contract.connect(users[i]).submit(n, day, hash));
      for (let j = 0; j < 3; j++)
        if (i !== j)
          await tx(
            contract
              .connect(users[j])
              .attest(n, await users[i].getAddress(), day, hash),
          );
    }
  };
  return { rpc, provider, users, contract, tx, advance, create, check };
}
test("partial winners, immutable check-ins, no self/duplicate witnesses, claims once", async () => {
  const s = await setup();
  const { contract: c, users: u, tx, advance, create, check, rpc } = s;
  try {
    const n = await create();
    await assert.rejects(c.settle.staticCall(n));
    await tx(c.start(n));
    await assert.rejects(
      c.connect(u[3]).join.staticCall(n, { value: parseEther("10") }),
    );
    const hash = id("reflection");
    await tx(c.submit(n, 0, hash));
    await assert.rejects(c.submit.staticCall(n, 0, id("replacement")));
    await assert.rejects(
      c.attest.staticCall(n, await u[0].getAddress(), 0, hash),
    );
    await tx(c.connect(u[1]).attest(n, await u[0].getAddress(), 0, hash));
    await assert.rejects(
      c.connect(u[1]).attest.staticCall(n, await u[0].getAddress(), 0, hash),
    );
    await assert.rejects(
      c
        .connect(u[2])
        .attest.staticCall(n, await u[0].getAddress(), 0, id("wrong")),
    );
    await tx(c.connect(u[2]).attest(n, await u[0].getAddress(), 0, hash));
    await advance(120);
    await check(n, 1, 1);
    await advance(300);
    await tx(c.settle(n));
    assert.equal(
      (await c.members(n, await u[0].getAddress())).claimable,
      parseEther("30"),
    );
    assert.equal((await c.members(n, await u[1].getAddress())).claimable, 0n);
    await tx(c.claim(n));
    await assert.rejects(c.claim.staticCall(n));
    assert.equal(await s.provider.getBalance(await c.getAddress()), 0n);
  } finally {
    await rpc.disconnect();
  }
});
test("all fail rolls forward; next started group reserves; all succeed receive reserve", async () => {
  const {
    contract: c,
    users: u,
    tx,
    advance,
    create,
    check,
    rpc,
  } = await setup();
  try {
    const n = await create();
    await tx(c.start(n));
    await advance(420);
    await tx(c.settle(n));
    const book = id("naval-almanack-v1");
    assert.equal(await c.bookFunds(book), parseEther("30"));
    await assert.rejects(c.claim.staticCall(n));
    const next = await create();
    await tx(c.start(next));
    assert.equal((await c.challenges(next)).reservedFund, parseEther("30"));
    assert.equal(await c.bookFunds(book), 0n);
    await check(next, 0, 3);
    await advance(120);
    await check(next, 1, 3);
    await advance(300);
    await tx(c.settle(next));
    for (const user of u.slice(0, 3)) {
      assert.equal(
        (await c.members(next, await user.getAddress())).claimable,
        parseEther("20"),
      );
      await tx(c.connect(user).claim(next));
    }
    assert.equal(await c.bookFunds(book), 0n);
  } finally {
    await rpc.disconnect();
  }
});
test("unstarted deadline refunds; late submission fails while witness grace works", async () => {
  const { contract: c, users: u, tx, advance, create, rpc } = await setup();
  try {
    const n = await create();
    await assert.rejects(c.cancelExpired.staticCall(n));
    await advance(3601);
    await tx(c.cancelExpired(n));
    for (const user of u.slice(0, 3))
      assert.equal(
        (await c.members(n, await user.getAddress())).claimable,
        parseEther("10"),
      );
    const m = await create();
    await tx(c.start(m));
    const h = id("last");
    await tx(c.submit(m, 0, h));
    await advance(121);
    await assert.rejects(c.connect(u[1]).submit.staticCall(m, 0, h));
    await tx(c.connect(u[1]).attest(m, await u[0].getAddress(), 0, h));
    await advance(60);
    await assert.rejects(
      c.connect(u[2]).attest.staticCall(m, await u[0].getAddress(), 0, h),
    );
  } finally {
    await rpc.disconnect();
  }
});
test("reserve cannot be taken twice; partial success returns it without mixing groups", async () => {
  const {
    contract: c,
    users: u,
    tx,
    advance,
    create,
    check,
    rpc,
  } = await setup();
  try {
    const failed = await create();
    await tx(c.start(failed));
    await advance(420);
    await tx(c.settle(failed));
    const book = id("naval-almanack-v1");
    const a = await create();
    await tx(c.start(a));
    const b = await create();
    await tx(c.start(b));
    assert.equal((await c.challenges(a)).reservedFund, parseEther("30"));
    assert.equal((await c.challenges(b)).reservedFund, 0n);
    await check(a, 0, 1);
    await advance(120);
    await check(a, 1, 1);
    await advance(300);
    await tx(c.settle(a));
    assert.equal(await c.bookFunds(book), parseEther("30"));
    assert.equal(
      (await c.members(a, await u[0].getAddress())).claimable,
      parseEther("30"),
    );
    await tx(c.settle(b));
    assert.equal(await c.bookFunds(book), parseEther("60"));
  } finally {
    await rpc.disconnect();
  }
});

test("different books cannot take each other's fund; zero book rejected", async () => {
  const { contract: c, provider, tx, advance, create, rpc } = await setup();
  try {
    const bookA = id("algorithms-v1"),
      bookB = id("ethereum-v1");
    const block = await provider.getBlock("latest");
    await assert.rejects(
      c.createChallenge.staticCall(
        "0x" + "0".repeat(64),
        true,
        block.timestamp + 3600,
      ),
    );
    const failed = await create(bookA);
    await tx(c.start(failed));
    await advance(420);
    await tx(c.settle(failed));
    assert.equal(await c.bookFunds(bookA), parseEther("30"));
    const other = await create(bookB);
    await tx(c.start(other));
    assert.equal((await c.challenges(other)).bookId, bookB);
    assert.equal((await c.challenges(other)).reservedFund, 0n);
    assert.equal(await c.bookFunds(bookA), parseEther("30"));
    const same = await create(bookA);
    await tx(c.start(same));
    assert.equal((await c.challenges(same)).reservedFund, parseEther("30"));
    assert.equal(await c.bookFunds(bookA), 0n);
  } finally {
    await rpc.disconnect();
  }
});
