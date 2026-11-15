# Hearthvale art slots

Each slot is one image (PNG, transparent background). Sizes are suggestions at 2× (the game halves them on screen); tools/trim.py scales to the width shown. The image's bottom centre sits on the ground point unless the manifest gives an anchor.

Any slot can also have: `/<season>` (spring, summer, autumn, winter) for a seasonal version · `<slot>-snow` drawn on top in winter · `<slot>-night` drawn on top after dusk (lit windows).

## Ground

| slot | size (px) | ground point | note |
|---|---|---|---|
| `ground/grass` | 128×64 | tile centre | add /spring … /winter for seasons; several variants in one sheet with "random": true |
| `ground/sand` | 128×64 | tile centre |  |
| `ground/water` | 128×64 | tile centre | a few frames for a shimmer |
| `ground/road` | 128×64 | tile centre | drawn over the ground tile |

## Nature

| slot | size (px) | ground point | note |
|---|---|---|---|
| `node/tree` | 96×128 | base of the trunk | add /spring … /winter; variants with "random": true |
| `node/sapling` | 96×128 | base of the trunk | drawn small and grows to full size |
| `node/stone` | 96×80 | bottom centre | stages: /0 full, /1 half, /2 nearly gone |
| `node/gold` | 96×80 | bottom centre | stages: /0 full, /1 half, /2 nearly gone |
| `node/clay` | 96×80 | bottom centre | stages: /0 full, /1 half, /2 nearly gone |
| `node/berry` | 96×80 | bottom centre | stages: /0 full, /1 half, /2 nearly gone |
| `node/fish` | 96×48 | tile centre (bottom of the image) | a ripple; a few frames |

## Buildings

| slot | size (px) | ground point | note |
|---|---|---|---|
| `building/campfire/0` | 128×205 | front point of the footprint | Campfire (Campfire) |
| `building/campfire/1` | 128×205 | front point of the footprint | Fire circle |
| `building/campfire/2` | 128×205 | front point of the footprint | Lantern green |
| `building/tc` | 256×282 | front point of the footprint | Town center |
| `building/house/0` | 128×205 | front point of the footprint | Hut (House) |
| `building/house/1` | 128×205 | front point of the footprint | Cottage |
| `building/house/2` | 128×205 | front point of the footprint | Cozy cottage |
| `building/house/3` | 128×205 | front point of the footprint | Timber house |
| `building/house/4` | 128×205 | front point of the footprint | Fine timber house |
| `building/house/5` | 128×205 | front point of the footprint | Stone house |
| `building/house/6` | 128×205 | front point of the footprint | Fine stone house |
| `building/house/7` | 128×205 | front point of the footprint | Manor |
| `building/house/8` | 128×205 | front point of the footprint | Grand manor |
| `building/store/0` | 192×211 | front point of the footprint | Storehouse (Storehouse) |
| `building/store/1` | 192×211 | front point of the footprint | Large storehouse |
| `building/store/2` | 192×211 | front point of the footprint | Grand storehouse |
| `building/lumbermill` | 256×282 | front point of the footprint | Lumber mill |
| `building/farm` | 256×282 | front point of the footprint | Vegetable field |
| `building/wheatfield` | 256×282 | front point of the footprint | Wheat field |
| `building/grange/0` | 256×282 | front point of the footprint | Grange (Grange) |
| `building/grange/1` | 256×282 | front point of the footprint | Large grange |
| `building/grange/2` | 256×282 | front point of the footprint | Great grange |
| `building/granary` | 256×282 | front point of the footprint | Granary |
| `building/farmhouse/0` | 256×282 | front point of the footprint | Farmhouse (Farmhouse) |
| `building/farmhouse/1` | 256×282 | front point of the footprint | Large farmhouse |
| `building/farmhouse/2` | 256×282 | front point of the footprint | Manor farm |
| `building/mill` | 128×205 | front point of the footprint | Mill |
| `building/bakery` | 128×205 | front point of the footprint | Bakery |
| `building/brewery` | 128×205 | front point of the footprint | Brewery |
| `building/well/0` | 128×205 | front point of the footprint | Well (Well) |
| `building/well/1` | 128×205 | front point of the footprint | Fountain |
| `building/well/2` | 128×205 | front point of the footprint | Water tower |
| `building/flowerbed` | 128×205 | front point of the footprint | Flower bed |
| `building/bench` | 128×205 | front point of the footprint | Bench |
| `building/path/0` | 128×205 | front point of the footprint | Stone path (Path) |
| `building/path/1` | 128×205 | front point of the footprint | Gravel lane |
| `building/path/2` | 128×205 | front point of the footprint | Cobbled road |
| `building/statue` | 128×205 | front point of the footprint | Statue |
| `building/garden` | 128×205 | front point of the footprint | Garden |
| `building/arbor` | 128×205 | front point of the footprint | Rose arbor |
| `building/fireflylamp` | 128×205 | front point of the footprint | Firefly lantern |
| `building/tavern` | 256×282 | front point of the footprint | Tavern |
| `building/lodge` | 256×282 | front point of the footprint | Lodge |
| `building/market/0` | 256×282 | front point of the footprint | Trading post (Trading post) |
| `building/market/1` | 256×282 | front point of the footprint | Market |
| `building/market/2` | 256×282 | front point of the footprint | General store |
| `building/fiberfield` | 256×282 | front point of the footprint | Fiber field |
| `building/shop/0` | 128×205 | front point of the footprint | Stall (Stall) |
| `building/shop/1` | 128×205 | front point of the footprint | Shop |
| `building/shop/2` | 128×205 | front point of the footprint | Emporium |
| `building/potter` | 128×205 | front point of the footprint | Potter's workshop |
| `building/carpenter/0` | 128×205 | front point of the footprint | Carpenter's bench (Furniture maker) |
| `building/carpenter/1` | 128×205 | front point of the footprint | Joinery |
| `building/carpenter/2` | 128×205 | front point of the footprint | Furniture workshop |
| `building/weaver` | 128×205 | front point of the footprint | Weaver's cottage |
| `building/quarry` | 256×282 | front point of the footprint | Stone quarry |
| `building/claypit` | 256×282 | front point of the footprint | Clay quarry |
| `building/goldmine` | 256×282 | front point of the footprint | Gold mine |
| `building/jeweler` | 128×205 | front point of the footprint | Jeweler's workshop |
| `building/school` | 128×205 | front point of the footprint | Schoolhouse |
| `building/studio` | 128×205 | front point of the footprint | Artist's studio |
| `building/theater` | 256×282 | front point of the footprint | Theater |
| `building/monument` | 256×282 | front point of the footprint | Monument |
| `building/church` | 256×282 | front point of the footprint | Church |
| `building/library` | 256×282 | front point of the footprint | Library |
| `building/playground` | 256×282 | front point of the footprint | Playground |
| `building/coop` | 128×205 | front point of the footprint | Chicken coop |
| `building/sheepfold` | 256×282 | front point of the footprint | Sheep pasture |
| `building/pasture` | 256×282 | front point of the footprint | Dairy pasture |
| `building/dairy` | 128×205 | front point of the footprint | Dairy |
| `building/apiary` | 128×205 | front point of the footprint | Beehives |
| `building/chandler` | 128×205 | front point of the footprint | Chandler |
| `site/1x1` | 128×128 | front point of the footprint | under construction (or site/<kind> for one building) |
| `site/2x1` | 192×192 | front point of the footprint | under construction (or site/<kind> for one building) |
| `site/2x2` | 256×256 | front point of the footprint | under construction (or site/<kind> for one building) |

## Villagers

| slot | size (px) | ground point | note |
|---|---|---|---|
| `villager/idle` | 40×64 | feet |  |
| `villager/walk` | 40×64 | feet | facing right; 4 frames |
| `villager/work` | 40×64 | feet | 2–4 frames |
| `villager/carry` | 40×64 | feet |  |

## Animals

| slot | size (px) | ground point | note |
|---|---|---|---|
| `critter/firefly` | 24×24 | its centre | ✨ facing right |
| `critter/moth` | 24×24 | its centre | 🦋 facing right |
| `critter/frog` | 24×24 | its centre | 🐸 facing right |
| `critter/owl` | 24×24 | its centre | 🦉 facing right |
| `critter/fox` | 52×40 | feet | 🦊 facing right |
| `critter/raccoon` | 52×40 | feet | 🦝 facing right |
| `critter/wolf` | 52×40 | feet | 🐺 facing right |
| `critter/bear` | 72×56 | feet | 🐻 facing right |

## Festivals

| slot | size (px) | ground point | note |
|---|---|---|---|
| `seasonal/egg` | 20×24 | bottom centre | pattern /0 … /4 |
| `seasonal/bunny` | 40×48 | bottom centre | facing right |
| `seasonal/pumpkin` | 32×28 | bottom centre | and pumpkin-lit for night |
| `seasonal/pumpkin-lit` | 32×28 | bottom centre |  |
| `seasonal/scarecrow` | 48×80 | bottom centre |  |
| `seasonal/leaves` | 32×16 | bottom centre |  |
| `seasonal/bat` | 40×20 | bottom centre | flying |
| `seasonal/tree` | 80×140 | bottom centre | the Christmas tree |
| `seasonal/snowman` | 40×80 | bottom centre |  |
| `seasonal/santa` | 40×90 | bottom centre | facing right |
| `seasonal/sleigh` | 64×48 | bottom centre |  |
| `seasonal/parasol` | 56×64 | bottom centre | beach day |
