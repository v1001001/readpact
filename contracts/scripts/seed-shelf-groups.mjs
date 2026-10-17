import fs from "node:fs";
import assert from "node:assert/strict";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  NonceManager,
  parseEther,
  formatEther,
  id,
} from "ethers";
const deployment = JSON.parse(
  fs.readFileSync(
    new URL("../../deployments/monad-testnet-v3.json", import.meta.url),
  ),
);
const artifact = JSON.parse(
  fs.readFileSync(new URL("../artifacts/ReadPactV3.json", import.meta.url)),
);
const provider = new JsonRpcProvider("https://testnet-rpc.monad.xyz", 10143, {
  staticNetwork: true,
});
provider.pollingInterval = 1000;
assert.equal(BigInt(await provider.send("eth_chainId", [])), 10143n);
const keys = JSON.parse(
  fs.readFileSync(
    new URL("../../.private/testnet-wallets.json", import.meta.url),
  ),
).slice(1, 4);
const wallets = keys.map((key) => new Wallet(key.privateKey, provider));
const users = wallets.map((wallet) => new NonceManager(wallet));
const c = new Contract(deployment.contractAddress, artifact.abi, users[0]);
const file = new URL(
  "../../deployments/shelf-groups-2026-10-17.json",
  import.meta.url,
);
if (fs.existsSync(file))
  throw Error(
    "Seed report exists. Inspect on-chain state; never blindly create duplicate groups.",
  );
const balances = await Promise.all(
  wallets.map((wallet) => provider.getBalance(wallet.address)),
);
const needed = [parseEther("20.4"), parseEther("10.4"), parseEther("10.4")];
assert.ok(
  balances.reduce((a, b) => a + b, 0n) >= needed.reduce((a, b) => a + b, 0n),
  "Insufficient test MON; no transactions sent",
);
const ethereumStart = Date.parse("2026-10-21T10:00:00+08:00") / 1000;
const latest = await provider.getBlock("latest");
assert.ok(
  ethereumStart > latest.timestamp &&
    ethereumStart <= latest.timestamp + 30 * 86400,
  "Reference date expired; inspect schedule before seeding",
);
console.log(
  "Plan: algorithms 3 members / 30 MON; ethereum 1 member / 10 MON. No other real groups.",
);
console.log(
  wallets.map((wallet, i) => ({
    address: wallet.address,
    balance: formatEther(balances[i]),
    needed: formatEther(needed[i]),
  })),
);
if (!process.argv.includes("--apply")) process.exit(0);
const report = {
  chainId: 10143,
  contract: deployment.contractAddress,
  status: "running",
  createdAt: new Date().toISOString(),
  groups: [],
  transactions: [],
  note: "Real testnet seed members controlled by dedicated test wallets; other six books are explicitly simulated in UI.",
};
const save = () => fs.writeFileSync(file, JSON.stringify(report, null, 2));
async function tx(label, promise) {
  const sent = await promise;
  const record = { label, hash: sent.hash };
  report.transactions.push(record);
  save();
  const receipt = await sent.wait();
  assert.equal(receipt.status, 1);
  record.block = receipt.blockNumber;
  record.confirmed = true;
  save();
  console.log(label, sent.hash);
  return receipt;
}
async function create(slug, start) {
  const receipt = await tx(
    `create ${slug} and deposit 10 MON`,
    c.createChallenge(id(slug), false, start, { value: parseEther("10") }),
  );
  const event = receipt.logs
    .map((log) => {
      try {
        return c.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((event) => event?.name === "ChallengeCreated");
  const group = {
    slug,
    bookId: id(slug),
    id: event.args.id.toString(),
    startsAt: start,
  };
  report.groups.push(group);
  save();
  return group;
}
try {
  for (let i = 0; i < 3; i++)
    if (balances[i] < needed[i]) {
      const deficit = needed[i] - balances[i];
      const donor = balances.findIndex(
        (balance, j) =>
          j !== i && balance - needed[j] >= deficit + parseEther("0.05"),
      );
      assert.ok(donor >= 0, "Cannot rebalance safely");
      await tx(
        `fund seed reader ${i + 1}`,
        users[donor].sendTransaction({
          to: wallets[i].address,
          value: deficit,
        }),
      );
      balances[donor] -= deficit + parseEther("0.05");
      balances[i] += deficit;
    }
  const eth = await create("ethereum-v1", ethereumStart);
  const opening = (await provider.getBlock("latest")).timestamp + 90;
  const algorithms = await create("algorithms-to-live-by-v1", opening);
  for (let i = 1; i < 3; i++)
    await tx(
      `reader ${i + 1} joins algorithms`,
      c.connect(users[i]).join(algorithms.id, { value: parseEther("10") }),
    );
  for (const group of report.groups) {
    const state = await c.challenges(group.id);
    const participants = Array.from(await c.getParticipants(group.id));
    const expected = group === eth ? 1 : 3;
    assert.equal(participants.length, expected);
    assert.equal(state.pool, parseEther(String(expected * 10)));
    assert.equal(state.bookId, group.bookId);
    assert.equal(state.startedAt, group === eth ? 0n : BigInt(opening));
    group.participants = participants;
    group.poolMON = String(expected * 10);
  }
  save();
  while ((await provider.getBlock("latest")).timestamp < opening)
    await new Promise((resolve) => setTimeout(resolve, 10000));
  report.status = "passed";
  report.completedAt = new Date().toISOString();
  save();
  console.log(
    "Ready: algorithms active, ethereum joinable; 40 test MON locked.",
  );
} catch (error) {
  report.status = "failed";
  report.error = error.message;
  save();
  throw error;
}
