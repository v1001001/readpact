import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ganache from "ganache";
import { BrowserProvider, ContractFactory, parseEther, id } from "ethers";
const artifact = JSON.parse(
  fs.readFileSync(new URL("../artifacts/ReadPactV3.json", import.meta.url)),
);
const deposit = parseEther("10");
async function setup() {
  const rpc = ganache.provider({
    logging: { quiet: true },
    wallet: { totalAccounts: 12, defaultBalance: 1000 },
  });
  const provider = new BrowserProvider(rpc);
  provider.pollingInterval = 10;
  const users = await Promise.all(
    Array.from({ length: 12 }, (_, i) => provider.getSigner(i)),
  );
  const c = await new ContractFactory(
    artifact.abi,
    artifact.bytecode,
    users[0],
  ).deploy();
  await c.waitForDeployment();
  const tx = async (p) => await (await p).wait();
  const now = async () =>
    Number(
      BigInt(
        (
          await rpc.request({
            method: "eth_getBlockByNumber",
            params: ["latest", false],
          })
        ).timestamp,
      ),
    );
  const advance = async (seconds) => {
    await rpc.request({ method: "evm_increaseTime", params: [seconds] });
    await rpc.request({ method: "evm_mine", params: [] });
  };
  const create = async (book = id("book-a"), demo = true) => {
    const start = (await now()) + 60;
    await tx(c.createChallenge(book, demo, start, { value: deposit }));
    return { n: await c.challengeCount(), start };
  };
  const join = async (n, i) =>
    tx(c.connect(users[i]).join(n, { value: deposit }));
  const form = async (book = id("book-a")) => {
    const g = await create(book);
    await join(g.n, 1);
    await join(g.n, 2);
    return g;
  };
  const check = async (n, day, readers) => {
    for (const i of readers) {
      const hash = id(`${n}:${day}:${i}`);
      await tx(c.connect(users[i]).submit(n, day, hash));
      for (const j of [0, 1, 2])
        if (i !== j)
          await tx(
            c
              .connect(users[j])
              .attest(n, await users[i].getAddress(), day, hash),
          );
    }
  };
  return {
    rpc,
    provider,
    users,
    c,
    tx,
    now,
    advance,
    create,
    join,
    form,
    check,
  };
}
test("creation atomically charges 10 MON and joins; invalid input leaves no empty group", async () => {
  const s = await setup();
  const { c, users, now, create } = s;
  try {
    const start = (await now()) + 60;
    for (const value of [0n, parseEther("9"), parseEther("11")])
      await assert.rejects(
        c.createChallenge.staticCall(id("a"), true, start, { value }),
      );
    await assert.rejects(
      c.createChallenge.staticCall("0x" + "0".repeat(64), true, start, {
        value: deposit,
      }),
    );
    await assert.rejects(
      c.createChallenge.staticCall(id("a"), true, await now(), {
        value: deposit,
      }),
    );
    await assert.rejects(
      c.createChallenge.staticCall(id("a"), true, (await now()) + 31 * 86400, {
        value: deposit,
      }),
    );
    assert.equal(await c.challengeCount(), 0n);
    const { n, start: scheduled } = await create();
    const g = await c.challenges(n);
    assert.equal(g.pool, deposit);
    assert.equal(g.joinUntil, BigInt(scheduled));
    assert.equal(g.startedAt, 0n);
    assert.deepEqual(Array.from(await c.getParticipants(n)), [
      await users[0].getAddress(),
    ]);
    assert.equal(
      (await c.members(n, await users[0].getAddress())).joined,
      true,
    );
    await assert.rejects(c.join.staticCall(n, { value: deposit }));
  } finally {
    await s.rpc.disconnect();
  }
});
test("third reader forms automatically, all start at scheduled time; no early reading or late joining", async () => {
  const s = await setup();
  const { c, users, create, join, advance, tx } = s;
  try {
    const { n, start } = await create();
    await join(n, 1);
    assert.equal((await c.challenges(n)).startedAt, 0n);
    await join(n, 2);
    assert.equal((await c.challenges(n)).startedAt, BigInt(start));
    await assert.rejects(c.submit.staticCall(n, 0, id("early")));
    await assert.rejects(c.cancelExpired.staticCall(n));
    await join(n, 3);
    assert.equal((await c.challenges(n)).pool, 4n * deposit);
    await advance(61);
    await assert.rejects(
      c.connect(users[4]).join.staticCall(n, { value: deposit }),
    );
    await assert.rejects(c.cancelExpired.staticCall(n));
    await tx(c.submit(n, 0, id("on-time")));
    await assert.rejects(c.submit.staticCall(n, 1, id("tomorrow")));
    await advance(120);
    await assert.rejects(c.submit.staticCall(n, 0, id("late")));
  } finally {
    await s.rpc.disconnect();
  }
});
test("one or two readers at opening get exact refunds once; no unpaid address can claim", async () => {
  const s = await setup();
  const { c, users, create, join, advance, tx } = s;
  try {
    const a = await create();
    const b = await create();
    await join(b.n, 1);
    await advance(61);
    await tx(c.connect(users[11]).cancelExpired(a.n));
    await tx(c.cancelExpired(b.n));
    for (const [n, i] of [
      [a.n, 0],
      [b.n, 0],
      [b.n, 1],
    ]) {
      assert.equal(
        (await c.members(n, await users[i].getAddress())).claimable,
        deposit,
      );
      await tx(c.connect(users[i]).claim(n));
      await assert.rejects(c.connect(users[i]).claim.staticCall(n));
    }
    await assert.rejects(c.connect(users[2]).claim.staticCall(b.n));
    assert.equal(await s.provider.getBalance(await c.getAddress()), 0n);
  } finally {
    await s.rpc.disconnect();
  }
});
test("two distinct companions required, partial settlement, no double claim", async () => {
  const s = await setup();
  const { c, users, form, advance, tx, check } = s;
  try {
    const { n } = await form();
    await advance(61);
    const hash = id("immutable");
    await tx(c.submit(n, 0, hash));
    await assert.rejects(c.submit.staticCall(n, 0, id("replace")));
    await assert.rejects(
      c.attest.staticCall(n, await users[0].getAddress(), 0, hash),
    );
    await assert.rejects(
      c
        .connect(users[3])
        .attest.staticCall(n, await users[0].getAddress(), 0, hash),
    );
    await tx(
      c.connect(users[1]).attest(n, await users[0].getAddress(), 0, hash),
    );
    assert.equal(
      (await c.members(n, await users[0].getAddress())).completed,
      0n,
    );
    await assert.rejects(
      c
        .connect(users[1])
        .attest.staticCall(n, await users[0].getAddress(), 0, hash),
    );
    await assert.rejects(
      c
        .connect(users[2])
        .attest.staticCall(n, await users[0].getAddress(), 0, id("wrong")),
    );
    await tx(
      c.connect(users[2]).attest(n, await users[0].getAddress(), 0, hash),
    );
    assert.equal(
      (await c.members(n, await users[0].getAddress())).completed,
      1n,
    );
    await advance(120);
    await check(n, 1, [0]);
    await assert.rejects(c.settle.staticCall(n));
    await advance(301);
    await tx(c.settle(n));
    assert.equal(
      (await c.members(n, await users[0].getAddress())).claimable,
      3n * deposit,
    );
    await tx(c.claim(n));
    await assert.rejects(c.claim.staticCall(n));
    assert.equal(await s.provider.getBalance(await c.getAddress()), 0n);
  } finally {
    await s.rpc.disconnect();
  }
});
test("same-book fund reserved only once at formation and never crosses books", async () => {
  const s = await setup();
  const { c, form, advance, tx, create, join, check, users } = s;
  try {
    const failed = await form();
    await advance(481);
    await tx(c.settle(failed.n));
    assert.equal(await c.bookFunds(id("book-a")), 3n * deposit);
    const first = await create();
    assert.equal((await c.challenges(first.n)).reservedFund, 0n);
    const other = await form(id("book-b"));
    assert.equal((await c.challenges(other.n)).reservedFund, 0n);
    await join(first.n, 1);
    await join(first.n, 2);
    assert.equal((await c.challenges(first.n)).reservedFund, 3n * deposit);
    const later = await form();
    assert.equal((await c.challenges(later.n)).reservedFund, 0n);
    await advance(61);
    await check(first.n, 0, [0, 1, 2]);
    await advance(120);
    await check(first.n, 1, [0, 1, 2]);
    await advance(301);
    await tx(c.settle(first.n));
    for (const user of users.slice(0, 3))
      assert.equal(
        (await c.members(first.n, await user.getAddress())).claimable,
        2n * deposit,
      );
  } finally {
    await s.rpc.disconnect();
  }
});
test("capacity and standard 21/18 schedule remain enforced", async () => {
  const s = await setup();
  const { c, users, create, join } = s;
  try {
    const { n } = await create(id("book-a"), false);
    for (let i = 1; i < 10; i++) await join(n, i);
    await assert.rejects(
      c.connect(users[10]).join.staticCall(n, { value: deposit }),
    );
    const g = await c.challenges(n);
    assert.equal(g.totalDays, 21n);
    assert.equal(g.requiredDays, 18n);
    assert.equal(g.periodSeconds, 86400n);
    assert.equal(g.pool, 10n * deposit);
  } finally {
    await s.rpc.disconnect();
  }
});
