/**
 * Caminhos usados pelo Experimento 4 (Laya), relativos à raiz do repositório
 * (os scripts rodam via `pnpm run experiment:laya*` a partir da raiz).
 */
import path from "node:path";

/** Pasta deste experimento. */
export const LAYA_EXPERIMENTS_DIR = path.join("scripts", "experiments", "laya-experiments");

/** Conjuntos de texto escritos por outra pessoa (ver data/README.md). */
export const LAYA_DATA_DIR = path.join(LAYA_EXPERIMENTS_DIR, "data");
export const VALIDATION_FILE = path.join(LAYA_DATA_DIR, "laya-validation.json");
export const TEST_FILE = path.join(LAYA_DATA_DIR, "laya-test.json");

/** Registro de configurações (fichas, JSON, resultados e saídas). */
export const REGISTRY_DIR = path.join("docs", "tcc", "experimento-4-registro");
