import fs from "node:fs";
import assert from "node:assert/strict";
import {
  JsonRpcProvider,
  Wallet,
  NonceManager,
  Contract,
  parseEther,
  formatEther,
  sha256,
  toUtf8Bytes,
} from "ethers";
const deployment = JSON.parse(
  fs.readFileSync(
    new URL("../../deployments/monad-testnet-v3.json", import.meta.url),
  ),
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
);
const wallets = keys.map((k) => new Wallet(k.privateKey, provider));
const users = wallets.map((w) => new NonceManager(w));
const artifact = JSON.parse(
  fs.readFileSync(new URL("../artifacts/ReadPactV3.json", import.meta.url)),
);
const contract = new Contract(
  deployment.contractAddress,
  artifact.abi,
  users[1],
);
const reportFile = new URL(
  "../../deployments/scheduled-testnet-smoke.json",
  import.meta.url,
);
const apiBase =
  process.env.READPACT_API_BASE || "http://127.0.0.1:18087/api/readpact";
if (
  fs.existsSync(reportFile) &&
  !process.env.READPACT_NEW_SMOKE &&
  !process.env.READPACT_RESUME
)
  throw Error(
    "Smoke report already exists; inspect it before spending more test MON",
  );
const report = process.env.READPACT_RESUME
  ? JSON.parse(fs.readFileSync(reportFile))
  : {
      chainId: 10143,
      contract: deployment.contractAddress,
      apiBase,
      startedAt: new Date().toISOString(),
      transactions: [],
      status: "running",
    };
function save() {
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
}
async function tx(label, promise) {
  const transaction = await promise;
  console.log(label, transaction.hash);
  const r = await transaction.wait();
  assert.equal(r.status, 1);
  report.transactions.push({
    label,
    hash: r.hash,
    block: r.blockNumber,
    gasUsed: r.gasUsed.toString(),
  });
  save();
  return r;
}
async function api(path, body) {
  const res = await fetch(
    `${apiBase}${path}`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  const json = await res.json();
  if (!res.ok || json.code !== 200) throw Error(JSON.stringify(json));
  return json.data;
}
async function waitUntil(timestamp) {
  while (true) {
    const block = await provider.send("eth_getBlockByNumber", [
      "latest",
      false,
    ]);
    const current = Number(BigInt(block.timestamp));
    if (current >= timestamp) return;
    console.log("Waiting for testnet time:", timestamp - current, "seconds");
    await new Promise((r) =>
      setTimeout(r, Math.min(15000, (timestamp - current) * 1000)),
    );
  }
}
try {
  const config = await api("/config");
  assert.equal(config.contractVersion, 3);
  const books = await api("/books");
  assert.equal(books.length, 16);
  const book = books.find((b) => b.slug === "algorithms-to-live-by-v1");
  report.bookId = book.id;
  report.bookTitle = book.title;
  assert.equal(config.chainId, 10143);
  assert.equal(
    config.contractAddress.toLowerCase(),
    deployment.contractAddress.toLowerCase(),
  );
  let id;
  if (process.env.READPACT_RESUME) {
    id = BigInt(report.challengeId);
  } else {
    for (let i = 1; i < 4; i++) {
      const b = await provider.getBalance(wallets[i].address);
      if (b < parseEther("12"))
        await tx(
          `fund reader ${i}`,
          users[2].sendTransaction({
            to: wallets[i].address,
            value: parseEther("12") - b,
          }),
        );
    }
    const b = await provider.getBlock("latest");
    const created = await tx(
      "create 3-round demo",
      contract.createChallenge(book.id, true, b.timestamp + 120, {
        value: parseEther("10"),
      }),
    );
    const event = created.logs
      .map((l) => {
        try {
          return contract.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "ChallengeCreated");
    id = event.args.id;
    report.challengeId = id.toString();
    save();
    for (let i = 2; i < 4; i++)
      await tx(
        `reader ${i} deposits 10 MON`,
        contract.connect(users[i]).join(id, { value: parseEther("10") }),
      );
    assert.equal(
      (await contract.challenges(id)).startedAt,
      BigInt(b.timestamp + 120),
    );
    assert.equal((await contract.challenges(id)).pool, parseEther("30"));
  }
  const g = await contract.challenges(id);
  assert.equal(g.bookId, book.id);
  const chainTime = Number(
    BigInt(
      (await provider.send("eth_getBlockByNumber", ["latest", false]))
        .timestamp,
    ),
  );
  const firstDay = chainTime - Number(g.startedAt) < 60 ? 0 : 1;
  for (let day = firstDay; day < firstDay + 2; day++) {
    await waitUntil(Number(g.startedAt) + day * Number(g.periodSeconds));
    const task = await api(`/books/${book.id}/tasks/${day}`);
    assert.equal(task.day, day);
    for (let i = 1; i <= 2; i++) {
      const reflection = `第 ${day + 1} 轮，我把长期积累落实为每天读书并写下一个可执行的行动，先减少碎片信息的干扰，再用实际反馈调整。这是读者 ${i} 的测试网联调感想。`;
      const prepared = await api("/submissions/prepare", {
        bookId: book.id,
        challengeId: id.toString(),
        day,
        wallet: wallets[i].address,
        answer: 1,
        reflection,
      });
      assert.equal(
        sha256(toUtf8Bytes(prepared.signingMessage)),
        prepared.contentHash,
      );
      const signature = await wallets[i].signMessage(prepared.signingMessage);
      const confirmed = await api("/submissions/confirm", {
        contentHash: prepared.contentHash,
        signature,
      });
      const fetched = await api(`/submissions/${confirmed.contentHash}`);
      assert.equal(fetched.reflection, reflection);
      report.submissions ??= [];
      report.submissions.push({
        day,
        wallet: wallets[i].address,
        contentHash: confirmed.contentHash,
      });
      save();
      await tx(
        `reader ${i} submits round ${day + 1}`,
        contract.connect(users[i]).submit(id, day, confirmed.contentHash),
      );
      for (let j = 1; j < 4; j++)
        if (j !== i)
          await tx(
            `reader ${j} witnesses reader ${i} round ${day + 1}`,
            contract
              .connect(users[j])
              .attest(id, wallets[i].address, day, confirmed.contentHash),
          );
      assert.equal(
        (await contract.entries(id, wallets[i].address, day)).completed,
        true,
      );
    }
  }
  await waitUntil(
    Number(g.startedAt) +
      Number(g.totalDays) * Number(g.periodSeconds) +
      Number(g.graceSeconds),
  );
  await tx("settle: 2 winners, 1 failure", contract.settle(id));
  for (let i = 1; i <= 2; i++) {
    const member = await contract.members(id, wallets[i].address);
    assert.equal(member.claimable, parseEther("15"));
    await tx(`reader ${i} claims 15 MON`, contract.connect(users[i]).claim(id));
    assert.equal(
      (await contract.members(id, wallets[i].address)).claimable,
      0n,
    );
  }
  assert.equal((await contract.members(id, wallets[3].address)).claimable, 0n);
  const other = books.find((b) => b.slug === "ethereum-v1");
  const block = await provider.getBlock("latest");
  const receipt = await tx(
    "create separate Ethereum book group",
    contract.createChallenge(other.id, true, block.timestamp + 60, {
      value: parseEther("10"),
    }),
  );
  const event = receipt.logs
    .map((l) => {
      try {
        return contract.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((e) => e?.name === "ChallengeCreated");
  report.secondChallengeId = event.args.id.toString();
  assert.equal((await contract.challenges(event.args.id)).bookId, other.id);
  await waitUntil(block.timestamp + 60);
  await tx(
    "cancel unformed second-book group",
    contract.cancelExpired(event.args.id),
  );
  assert.equal(
    (await contract.members(event.args.id, wallets[1].address)).claimable,
    parseEther("10"),
  );
  await tx("refund creator 10 MON", contract.claim(event.args.id));
  report.status = "passed";
  delete report.error;
  report.completedAt = new Date().toISOString();
  report.result =
    "3 deposits of 10 test MON; 2 readers completed 2/3 rounds with 2 distinct witnesses each; 2 claims of 15 test MON; failed reader claimable=0";
  report.balances = await Promise.all(
    wallets.map(async (w) => ({
      address: w.address,
      balance: formatEther(await provider.getBalance(w.address)),
    })),
  );
  save();
  console.log(report.result);
} catch (error) {
  report.status = "failed";
  report.error = error.message;
  save();
  throw error;
}
