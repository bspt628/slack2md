const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

export function log(msg) {
  process.stderr.write(`${msg}\n`);
}

export function logError(msg) {
  process.stderr.write(`${RED}${msg}${RESET}\n`);
}

export function logWarning(msg) {
  process.stderr.write(`${YELLOW}${msg}${RESET}\n`);
}
