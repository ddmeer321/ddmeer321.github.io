# Lucky Loot

User preference: Avoid modern dashboard aesthetics, including light versions of rounded minimalist cards. The user values detailed design, animations and character. Current direction: an old collector's shop with textured paper, wooden displays, brass locks, stamped labels, serif/typewriter lettering, tactile buttons and animated crate reveals. Keep this preference in future work unless the user changes it. Respect reduced-motion preferences.

Scope: local single-player prototype. No finished skins yet. Placeholder catalog of 250 collectibles, including firearms, knives, gloves and three ultra-rare items. All currency is fictional and earned in-game. No payments or real-money functionality.

Implemented rules: free starter crate with 8-second cooldown; eleven paid crate tiers; sell items or deposit into bank; initial two bank slots, additional slots purchased with coins; bank earns 0.1 percent of deposited item value per second (user's proposed rate, provisional); at most four hours of offline earnings; upgrade chance starts at 64 percent and decreases for larger multipliers. Failure consumes the item. Upgrade expected output value is 94 percent of input value. Local browser save only, no anti-cheat/backend.

Balance is provisional: repeated purchases still increase total jackpot opportunities even when per-opening jackpot odds stay constant. Future balance should simulate opening frequency, bank income, crate prices and upgrades together.

Updated rules: bank accrual is stored in bankPending and only transferred to coins by the large collect button. Old saves without bankPending start with zero pending funds; existing coins are preserved. Upgrade UI uses factors 1.1, 1.5, 2, 3, 5, 10 instead of a selectable item. At execution pick a random item among those sharing the lowest catalog value at or above input value times factor. Chance remains capped at 64 percent and accounts for actual target value. No valid target disables upgrading.

Planned catalogue — decided 23.09.2026, NOT built. Nothing in this section exists in code; game.js still generates the 250 placeholders described above (names Scout/Vector/Ranger..., kind assigned purely by running index).

The problem it solves: the catalogue wants 250 skins, because 10 or 20 stop being interesting quickly. Drawing 250 is not realistic. Instead draw 10 base forms and 25 patterns and combine them — 10 x 25 = 250, so the catalogue size stays exactly as it is, and 35 drawings replace 250.

Families and forms. Each form carries the same 25 patterns, so every form is exactly 25 items.

| Family      | Items | Forms                                      |
|-------------|-------|--------------------------------------------|
| Schusswaffe |   100 | Gewehr, Schrotflinte, Sniper, Pistole      |
| Messer      |    50 | Karambit, Küchenmesser                     |
| Schwert     |    50 | Katana, Säbel                              |
| Handschuh   |    50 | Panzerhandschuh, Wickelhandschuh           |

Two fields, not one. Today `kind` holds the family, which mixes levels as soon as forms are named — "Sniper" is one shape, "Messer" is two. Split it: `familie` (four values, for filters and the collection album) and `form` (ten values, for the label and the artwork).

Every form needs one unmistakable silhouette marker. The item art is 130 px tall on desktop and 43 px on a phone (readability.css overrides .item-art to height 105 px / font-size 43 px), and every image is scaled into the same frame — so relative length carries no information at all. Each form must be told apart by shape:

- Gewehr — long, curved magazine, NO scope
- Schrotflinte — the pump under the barrel
- Sniper — the scope. It is the only form that has one, which is why Gewehr must never get one.
- Pistole — the only short firearm
- Karambit — curved blade plus finger ring; the strongest silhouette in the set
- Küchenmesser — the only straight broad blade
- Katana — slim curve, small round guard, no bow
- Säbel — curved with a basket hilt; the basket is a visible lump at 43 px
- Panzerhandschuh — plated
- Wickelhandschuh — wrapped, fingertips free

Two candidates were considered and rejected, both for the same reason. Machete: a straight broad blade like the Küchenmesser, and the two would sit in different families — leaving a player unsure whether they pulled a knife or a sword is the worst case. Wakizashi: the same shape as a Katana at a different length, and length does not survive the fixed frame.

Value lives in the pattern, not in the form. Same blade, different pattern, different rarity and value. That is the moment the game is built around, and it also means no form is inherently cheap or expensive.

Wear: a hidden 0..1 per item, shown as Fabrikneu ... Erbärmlich. Two identical finds, different value. Costs one number per item and no artwork.

Patterns are generated, not drawn: SVG patterns (stripes, camo, honeycomb, noise) laid over the grey base through a CSS mask. A new skin is then ten lines of CSS — which is what makes event crates affordable, because a new event costs a set of patterns instead of a set of images.

Season patterns are available for a limited window and never return. That is scarcity that can be controlled, unlike RNG rarity, and it is what would make trading interesting later.

Two production paths, matching the rarity tiers. Individually rendered, handmade pieces for Legendär, Mythisch and Ultraselten (roughly 30 items). Base plus pattern for everything below and for event supply. The top pieces looking visibly more elaborate is the point, not a flaw.

Base render conditions — these decide whether it reads as painted or as stickered:
1. Render on a light grey primer, not dark. The pattern goes on with multiply, which only darkens, so a dark base turns every colour muddy.
2. Leave barrel, sights and screws dark in the render. Brightness then acts as its own mask — light means paintable, dark means it stays steel — which avoids hand-painting a mask per form.
3. Put the highlights back on top with screen after the pattern. Without that the pattern smothers the specular and the result looks flat.

Open, to decide before building:
1. The three ultra-rares (Singularity, Solar Crown, Abyssal Relic) all land in the same family, because the kind is derived from the running index and they occupy positions 247-249. They should be assigned by hand instead.
2. Form and value are both derived from the running index and are therefore correlated. In the three lowest tiers the cheapest item of a tier is always the same family and the dearest always another; from Episch upwards the order flips. This directly contradicts "value lives in the pattern" and has to be decoupled — form and pattern drawn separately, not both from n.

Run: node server.cjs, then http://127.0.0.1:4180.
