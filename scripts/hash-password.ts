// scripts/hash-password.ts
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error("usage: bun scripts/hash-password.ts <password>");
  process.exit(1);
}
const hash = bcrypt.hashSync(password, 10);
console.log(hash);
