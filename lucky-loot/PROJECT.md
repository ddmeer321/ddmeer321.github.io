# Lucky Loot

User preference: Avoid modern dashboard aesthetics, including light versions of rounded minimalist cards. The user values detailed design, animations and character. Current direction: an old collector's shop with textured paper, wooden displays, brass locks, stamped labels, serif/typewriter lettering, tactile buttons and animated crate reveals. Keep this preference in future work unless the user changes it. Respect reduced-motion preferences.

Scope: local single-player prototype. No finished skins yet. Placeholder catalog of 250 collectibles, including firearms, knives, gloves and three ultra-rare items. All currency is fictional and earned in-game. No payments or real-money functionality.

Implemented rules: free starter crate with 8-second cooldown; eleven paid crate tiers; sell items or deposit into bank; initial two bank slots, additional slots purchased with coins; bank earns 0.1 percent of deposited item value per second (user's proposed rate, provisional); at most four hours of offline earnings; upgrade chance starts at 64 percent and decreases for larger multipliers. Failure consumes the item. Upgrade expected output value is 94 percent of input value. Local browser save only, no anti-cheat/backend.

Balance is provisional: repeated purchases still increase total jackpot opportunities even when per-opening jackpot odds stay constant. Future balance should simulate opening frequency, bank income, crate prices and upgrades together.

Updated rules: bank accrual is stored in bankPending and only transferred to coins by the large collect button. Old saves without bankPending start with zero pending funds; existing coins are preserved. Upgrade UI uses factors 1.1, 1.5, 2, 3, 5, 10 instead of a selectable item. At execution pick a random item among those sharing the lowest catalog value at or above input value times factor. Chance remains capped at 64 percent and accounts for actual target value. No valid target disables upgrading.

Run: node server.cjs, then http://127.0.0.1:4180.
