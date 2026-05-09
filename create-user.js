const { createUser, userExists } = require("./auth-db");

const [, , username, password] = process.argv;

if (!username || !password) {
  console.error("Hasznalat: node create-user.js <felhasznalonev> <jelszo>");
  console.error("Pelda: node create-user.js admin eros-jelszo");
  process.exit(1);
}

if (password.length < 8) {
  console.error("A jelszo legyen legalabb 8 karakter hosszu.");
  process.exit(1);
}

if (userExists(username)) {
  console.error(`A(z) "${username}" felhasznalo mar letezik.`);
  process.exit(1);
}

createUser(username, password);
console.log(`A(z) "${username}" felhasznalo letrejott az adatbazisban.`);
