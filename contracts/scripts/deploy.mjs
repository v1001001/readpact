import fs from "node:fs";
import { JsonRpcProvider, Wallet, ContractFactory, formatEther } from "ethers";
const p = new JsonRpcProvider("https://testnet-rpc.monad.xyz", 10143, {
  staticNetwork: true,
});
if (BigInt(await p.send("eth_chainId", [])) !== 10143n)
  throw Error("Refusing non-testnet");
const key = JSON.parse(
  fs.readFileSync(
    new URL("../../.private/testnet-wallets.json", import.meta.url),
  ),
)[0];
const w = new Wallet(key.privateKey, p);
const balance = await p.getBalance(w.address);
console.log("Deployer", w.address, "balance", formatEther(balance), "test MON");
if (balance === 0n) throw Error("Fund the dedicated test wallet first");
const name = process.env.READPACT_V3
  ? "ReadPactV3"
  : process.env.READPACT_V2
    ? "ReadPactV2"
    : "ReadPact";
const file = new URL(
  `../../deployments/${process.env.READPACT_V3 ? "monad-testnet-v3" : process.env.READPACT_V2 ? "monad-testnet-v2" : "monad-testnet"}.json`,
  import.meta.url,
);
if (fs.existsSync(file))
  throw Error("Deployment already exists; inspect it before redeploying");
const artifact = JSON.parse(
  fs.readFileSync(new URL(`../artifacts/${name}.json`, import.meta.url)),
);
const c = await new ContractFactory(
  artifact.abi,
  artifact.bytecode,
  w,
).deploy();
console.log("Deploy transaction", c.deploymentTransaction().hash);
await c.waitForDeployment();
const receipt = await c.deploymentTransaction().wait();
const deployment = {
  chainId: 10143,
  contractAddress: await c.getAddress(),
  transactionHash: receipt.hash,
  blockNumber: receipt.blockNumber,
  compiler: artifact.compiler,
  deployedAt: new Date().toISOString(),
};
fs.mkdirSync(new URL("../../deployments/", import.meta.url), {
  recursive: true,
});
fs.writeFileSync(file, JSON.stringify(deployment, null, 2));
console.log(deployment);
