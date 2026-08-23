SET FOREIGN_KEY_CHECKS = 0;

INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `password_salt`, `created_at`) VALUES
  (1, 'admin', 'radics.pepe@gmail.com', '520c2d9d1011d3d184927692474690ab63a4250efa73ee12d9e4f193c978d3084f6859c55a977e33215cb5d563ff8ffaae2ef8a94424ffefecb1aa086e3345a5', 'd6f7b15d72b2c95e2b65626775441a81', '2026-04-07 17:23:22'),
  (2, 'tesztjani', NULL, '10264112f77e7386222b03fb5e99e203b607ee389acc4265fa28d70131440a9b2efdec26f0debaa961504fe291a001f4d0c0e0ba55c8903fc5ac8a3d59c4dd23', 'bab652f5fed3ba1937d8b51419e93424', '2026-04-07 17:30:05'),
  (3, 'mrkadmin', 'info@mrkocka.hu', 'f9d5363f3ade161c1e419cd0fc44b3f779f2e457d67b3de3c423aca94253e54caf6336af22b4294a61b3c5dcaa21d00e8fc5b4d22d874be8797f9ea230074e13', '47d699154da5ead62e99338cc00c4005', '2026-04-25 11:23:29');

INSERT INTO `quotes` (`id`, `quote_text`, `author`, `created_at`) VALUES
  (1, 'Ha a majom ad tanácsot, legalább nevess rajta egyet, mielőtt megfogadod.', 'Wise Monky', '2026-05-09 12:35:09'),
  (2, 'Nem minden bölcsnek hangzó mondat érdemli meg, hogy életfilozófia legyen belőle.', 'Wise Monky', '2026-05-09 12:35:09'),
  (3, 'A jó idézet rövid, emlékezetes, és nem veszik el a saját okoskodásában.', 'Admin', '2026-05-09 12:35:09'),
  (5, 'Nem, én vagyok az Apád!', 'Darth Vader', '2026-05-09 12:54:19'),
  (6, 'A pisztácia kifogyott csokoládé nem is volt...', 'Bud Spencer', '2026-05-16 12:25:29');

INSERT INTO `password_reset_tokens` (`id`, `user_id`, `token_hash`, `expires_at`, `consumed_at`, `created_at`) VALUES
  (5, 3, '654dcdd28675e2dbfd7063c677769994128ea2815a3228afbd05eea88d6ce3b5', '2026-05-30 13:11:06', NULL, '2026-05-30 12:41:06'),
  (6, 1, '15d7e9428c828cb1effddcf0a30563b3398e53378558f3ed2f59afade82a26ac', '2026-05-30 13:14:56', '2026-05-30 12:46:30', '2026-05-30 12:44:56');

ALTER TABLE `users` AUTO_INCREMENT = 4;
ALTER TABLE `quotes` AUTO_INCREMENT = 7;
ALTER TABLE `password_reset_tokens` AUTO_INCREMENT = 7;

SET FOREIGN_KEY_CHECKS = 1;
