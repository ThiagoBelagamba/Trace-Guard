/** Regenera docs/tcc/experimento-4-registro/indice.md a partir dos JSON do registro. */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { buildIndex, loadAllConfigs, loadAllResults, REGISTRY_DIR } from "./laya-registry.ts";

const out = path.join(REGISTRY_DIR, "indice.md");
writeFileSync(out, buildIndex(loadAllConfigs(), loadAllResults()), "utf8");
console.log(`índice gravado em ${out}`);
