import { spawn } from "node:child_process";

const server = spawn("npm", ["run", "dev", "-w", "server"], {
  stdio: "inherit",
  shell: true,
});
const client = spawn("npm", ["run", "dev", "-w", "client"], {
  stdio: "inherit",
  shell: true,
});

function shutdown(code) {
  server.kill();
  client.kill();
  process.exit(code ?? 0);
}

server.on("exit", (code) => shutdown(code ?? 1));
client.on("exit", (code) => shutdown(code ?? 1));
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
