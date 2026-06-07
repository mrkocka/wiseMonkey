require("dotenv").config({ override: true });

const { createUser, emailExists, userExists } = require("./auth-db");

const [, , username, email, password] = process.argv;

if (!username || !email || !password) {
  console.error("Használat: node create-user.js <felhasználónév> <email> <jelszó>");
  console.error("Példa: node create-user.js admin admin@domain.hu erős-jelszó");
  process.exit(1);
}

if (password.length < 8) {
  console.error("A jelszó legyen legalább 8 karakter hosszú.");
  process.exit(1);
}

(async () => {
  if (await userExists(username)) {
    console.error(`A(z) "${username}" felhasználó már létezik.`);
    process.exit(1);
  }

  if (await emailExists(email)) {
    console.error(`A(z) "${email}" e-mail cím már használatban van.`);
    process.exit(1);
  }

  await createUser(username, email, password);
  console.log(`A(z) "${username}" felhasználó létrejött az adatbázisban.`);
})().catch((error) => {
  console.error("A felhasználó létrehozása sikertelen:", error.message);
  process.exit(1);
});
