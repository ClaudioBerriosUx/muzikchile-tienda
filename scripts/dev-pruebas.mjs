/**
 * `npm run dev:pruebas`: servidor local contra la base de pruebas.
 *
 * Es lo que necesitan los verificar:* con --api=http://localhost:3000. Las
 * variables que ya están en el entorno ganan sobre .env.local, así que Next
 * usa las de .env.pruebas y toma de .env.local solo las que aquí no estén.
 *
 * No se usa `node --env-file`: Next la pasa a sus procesos hijos por
 * NODE_OPTIONS, y Node no la permite ahí.
 */

import { spawn } from "node:child_process";
import { frenarSiEsProduccion } from "./freno-produccion.mjs";

process.loadEnvFile(".env.pruebas");
frenarSiEsProduccion();

const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev"], { stdio: "inherit" });
next.on("exit", (codigo) => process.exit(codigo ?? 1));
