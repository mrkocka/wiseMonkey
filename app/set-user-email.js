const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env"), override: true });

const {
  emailExists,
  findUserByUsername,
  isDatabaseAvailable,
  updateUserEmail,
} = require("./auth-db");

const [, , username, email] = process.argv;

if (!username || !email) {
  console.error("Használat: node set-user-email.js <felhasználónév> <email>");
  console.error("Példa: node set-user-email.js admin admin@domain.hu");
  process.exit(1);
}

(async () => {
  if (!(await isDatabaseAvailable())) {
    console.error("Az adatbázis nem érhető el, ezért az e-mail cím nem menthető.");
    process.exit(1);
  }

  const user = await findUserByUsername(username);

  if (!user) {
    console.error(`A(z) "${username}" felhasználó nem található.`);
    process.exit(1);
  }

  if (await emailExists(email) && user.email !== email.trim().toLowerCase()) {
    console.error(`A(z) "${email}" e-mail cím már használatban van.`);
    process.exit(1);
  }

  await updateUserEmail(username, email);
  console.log(`A(z) "${username}" felhasználó e-mail címe elmentve: ${email}`);
})().catch((error) => {
  console.error("Az e-mail cím mentése sikertelen:", error.message);
  process.exit(1);
});
