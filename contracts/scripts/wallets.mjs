import fs from "node:fs";
import { Wallet } from "ethers";
const dir = new URL("../../.private/", import.meta.url);
const file = new URL("testnet-wallets.json", dir);
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
if (!fs.existsSync(file))
  fs.writeFileSync(
    file,
    JSON.stringify(
      Array.from({ length: 4 }, (_, i) => {
        const w = Wallet.createRandom();
        return {
          role: i === 0 ? "deployer" : `reader${i}`,
          address: w.address,
          privateKey: w.privateKey,
        };
      }),
      null,
      2,
    ),
    { mode: 0o600, flag: "wx" },
  );
console.log(
  JSON.parse(fs.readFileSync(file)).map(({ role, address }) => ({
    role,
    address,
  })),
);
