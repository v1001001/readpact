import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";
const root = new URL("../", import.meta.url);
const name = process.env.READPACT_V3
  ? "ReadPactV3"
  : process.env.READPACT_V2
    ? "ReadPactV2"
    : "ReadPact";
const source = fs.readFileSync(new URL(`src/${name}.sol`, root), "utf8");
const input = {
  language: "Solidity",
  sources: { [`${name}.sol`]: { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "shanghai",
    outputSelection: {
      "*": { "*": ["abi", "evm.bytecode.object", "metadata"] },
    },
  },
};
const output = JSON.parse(
  solc.compile(JSON.stringify(input), {
    import: (p) => {
      return {
        contents: fs.readFileSync(new URL(`node_modules/${p}`, root), "utf8"),
      };
    },
  }),
);
for (const error of output.errors ?? []) console.error(error.formattedMessage);
if (output.errors?.some((e) => e.severity === "error")) process.exit(1);
const compiled = output.contracts[`${name}.sol`][name];
const artifact = {
  contractName: name,
  compiler: solc.version(),
  abi: compiled.abi,
  bytecode: `0x${compiled.evm.bytecode.object}`,
};
fs.mkdirSync(new URL("artifacts/", root), { recursive: true });
fs.writeFileSync(
  new URL(`artifacts/${name}.json`, root),
  JSON.stringify(artifact, null, 2),
);
fs.writeFileSync(
  new URL(`artifacts/${name}-compiler-input.json`, root),
  JSON.stringify(
    {
      ...input,
      sources: {
        ...input.sources,
        "@openzeppelin/contracts/utils/ReentrancyGuard.sol": {
          content: fs.readFileSync(
            new URL(
              "node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol",
              root,
            ),
            "utf8",
          ),
        },
      },
    },
    null,
    2,
  ),
);
const target = new URL(
  `../../front/src/readpact/${process.env.READPACT_V3 ? "abi-v3" : process.env.READPACT_V2 ? "abi-v2" : "abi"}.json`,
  import.meta.url,
);
fs.mkdirSync(path.dirname(fileURLToPath(target)), { recursive: true });
fs.writeFileSync(target, JSON.stringify(compiled.abi, null, 2));
console.log(
  `Compiled ReadPact: ${compiled.evm.bytecode.object.length / 2} bytes`,
);
