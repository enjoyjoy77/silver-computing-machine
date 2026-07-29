(function(){
"use strict";

let S;

const COLS = 6;
const ROWS = 4;
const TILE_W = 104;
const TILE_H = 87;
const TILE_X = 22;
const TILE_Y = 96;
const TERRAINS = [
  "plain","plain","plain","plain","plain","plain","plain","plain",
  "forest","forest","forest","forest","forest","forest",
  "mountain","mountain","mountain","mountain","mountain",
  "sea","sea","sea","sea","sea"
];
const TERRAIN_EMOJI = {
  plain: "🌾",
  forest: "🌲",
  mountain: "⛰️",
  sea: "🌊"
};
const TERRAIN_YIELD = {
  plain: { food: 3, production: 0, tech: 0 },
  forest: { food: 0, production: 3, tech: 0 },
  mountain: { food: 0, production: 2, tech: 1 },
  sea: { food: 2, production: 0, tech: 2 }
};
const ITEMS = [
  { id: "settler", emoji: "🚶", name: "開拓者", cost: 35, unlock: 0 },
  { id: "soldier", emoji: "⚔️", name: "兵", cost: 15, unlock: 0 },
  { id: "farm", emoji: "🌾", name: "畑", cost: 20, unlock: 40 },
  { id: "workshop", emoji: "🔨", name: "工房", cost: 30, unlock: 115 },
  { id: "temple", emoji: "🏛️", name: "神殿", cost: 50, unlock: 240 }
];

function shuffledTerrains(g) {
  const result = TERRAINS.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(g.rand(0, i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

function makeCity(index) {
  return {
    index: index,
    population: 1,
    food: 0,
    production: 0,
    producing: "settler",
    soldiers: 0,
    buildings: {
      farm: false,
      workshop: false,
      temple: false
    }
  };
}

function reset(g) {
  const terrains = shuffledTerrains(g);
  let startIndex = 8;

  if (terrains[startIndex] === "sea") {
    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < terrains.length; i++) {
      if (terrains[i] !== "sea") {
        const distance = Math.abs(i - 8);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }
    }
    startIndex = bestIndex;
  }

  S = {
    scene: "title",
    turn: 0,
    map: terrains,
    cities: [makeCity(startIndex)],
    selectedIndex: startIndex,
    tech: 0,
    settlers: 0,
    templeScore: 0,
    barbarians: [],
    nextRaidTurn: 8,
    lostCities: 0,
    raidWarning: false,
    logs: ["絵文字文明を始めよう", "30ターンで島を育てよう"],
    message: "",
    messageTimer: 0,
    overTimer: 0,
    result: null,
    pulse: 0
  };
}

function cityAt(index) {
  for (let i = 0; i < S.cities.length; i++) {
    if (S.cities[i].index === index) {
      return S.cities[i];
    }
  }
  return null;
}

function selectedCity() {
  return cityAt(S.selectedIndex) || S.cities[0];
}

function itemById(id) {
  for (let i = 0; i < ITEMS.length; i++) {
    if (ITEMS[i].id === id) {
      return ITEMS[i];
    }
  }
  return ITEMS[0];
}

function foodNeed(city) {
  return 14 + (city.population - 1) * 9;
}

function cityPenalty() {
  return 1 / (1 + (S.cities.length - 1) * 0.13);
}

function cityYield(city) {
  let food = 2;
  let production = 2;
  let tech = 2;
  const row = Math.floor(city.index / COLS);
  const col = city.index % COLS;
  const neighbors = [];

  if (row > 0) {
    neighbors.push(city.index - COLS);
  }
  if (row < ROWS - 1) {
    neighbors.push(city.index + COLS);
  }
  if (col > 0) {
    neighbors.push(city.index - 1);
  }
  if (col < COLS - 1) {
    neighbors.push(city.index + 1);
  }

  for (let i = 0; i < neighbors.length; i++) {
    const terrainYield = TERRAIN_YIELD[S.map[neighbors[i]]];
    food += terrainYield.food;
    production += terrainYield.production;
    tech += terrainYield.tech;
  }

  if (city.buildings.farm) {
    food += 4;
  }
  if (city.buildings.workshop) {
    production += 4;
  }

  const populationMultiplier = 0.6 + city.population * 0.4;
  const penalty = cityPenalty();

  // 都市を増やすブレーキは「食料(人口の伸び)」だけに掛ける。
  // 生産と技術は素直に増えるので、広げると建てられる物は増えるが、人は育ちにくくなる。
  return {
    food: Math.floor(food * populationMultiplier * penalty),
    production: Math.floor(production * populationMultiplier),
    tech: Math.floor(tech * populationMultiplier)
  };
}

function isItemAvailable(city, item) {
  if (item.id === "settler") {
    return true;
  }
  if (item.id === "soldier") {
    return city.soldiers < 3;
  }
  if (S.tech < item.unlock) {
    return false;
  }
  if (city.buildings[item.id]) {
    return false;
  }
  return true;
}

function normalizeProduction(city) {
  const current = itemById(city.producing);
  if (!isItemAvailable(city, current)) {
    city.producing = "settler";
  }
}

function addLog(line) {
  S.logs.unshift(line);
  S.logs = S.logs.slice(0, 2);
}

function completeItem(g, city, item) {
  if (item.id === "settler") {
    S.settlers += 1;
    addLog("🚶開拓者が完成! ストック+" + 1);
    g.se("clear");
    return;
  }

  if (item.id === "soldier") {
    city.soldiers += 1;
    addLog("⚔️兵ができた(この都市に" + city.soldiers + "人)");
    g.se("jump");
    return;
  }

  city.buildings[item.id] = true;

  if (item.id === "farm") {
    addLog("🌾畑が完成!");
  } else if (item.id === "workshop") {
    addLog("🔨工房が完成!");
  } else if (item.id === "temple") {
    S.templeScore += 50;
    addLog("🏛️神殿が完成! スコア+50");
  }

  city.producing = "settler";
  g.se("clear");
}


// ===== 蛮族(段階2) =====

function isEdgeTile(index) {
  const row = Math.floor(index / COLS);
  const col = index % COLS;
  return row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1;
}

function raidInterval() {
  if (S.turn >= 20) {
    return 2;
  }
  return 3;
}

function raidCount() {
  return 1 + Math.floor(S.cities.length / 3);
}

function spawnBarbarians(g) {
  if (S.cities.length === 0) {
    return;
  }

  const spots = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    if (isEdgeTile(i) && !cityAt(i)) {
      spots.push(i);
    }
  }
  if (spots.length === 0) {
    return;
  }

  const count = raidCount();
  for (let n = 0; n < count; n++) {
    const from = g.pick(spots);
    const target = g.pick(S.cities).index;
    S.barbarians.push({ index: from, target: target });
  }

  addLog("🗡️蛮族が" + count + "体あらわれた!");
  g.se("boom");
}

function stepToward(from, to) {
  const fr = Math.floor(from / COLS);
  const fc = from % COLS;
  const tr = Math.floor(to / COLS);
  const tc = to % COLS;

  if (Math.abs(tc - fc) >= Math.abs(tr - fr) && tc !== fc) {
    return from + (tc > fc ? 1 : -1);
  }
  if (tr !== fr) {
    return from + (tr > fr ? COLS : -COLS);
  }
  return from;
}

function attackCity(g, city) {
  if (city.soldiers > 0) {
    city.soldiers -= 1;
    addLog("⚔️兵が蛮族を追い返した(残り" + city.soldiers + "人)");
    g.se("ping");
    return;
  }

  // 人口1の都市は滅びない(蓄えを奪われるだけ)。事故で一発退場にしないため
  if (city.population <= 1) {
    city.food = 0;
    city.production = 0;
    addLog("🗡️蓄えを奪われた! (人口1の都市は滅びない)");
    g.se("hit");
    return;
  }

  city.population -= 1;
  city.production = 0;
  addLog("🗡️略奪された! 人口-1、つくりかけも失った");
  g.se("hit");

  if (city.population <= 0) {
    S.cities = S.cities.filter(function (c) { return c !== city; });
    S.lostCities += 1;
    addLog("💀都市がひとつ滅びた…");
    g.se("boom");
    if (S.selectedIndex === city.index && S.cities.length > 0) {
      S.selectedIndex = S.cities[0].index;
    }
  }
}

function updateBarbarians(g) {
  const survivors = [];

  for (let i = 0; i < S.barbarians.length; i++) {
    const b = S.barbarians[i];
    let targetCity = cityAt(b.target);

    // 目標の都市が消えていたら、いちばん近い都市を狙い直す
    if (!targetCity) {
      if (S.cities.length === 0) {
        continue;
      }
      targetCity = S.cities[0];
      b.target = targetCity.index;
    }

    b.index = stepToward(b.index, b.target);

    if (b.index === b.target) {
      attackCity(g, targetCity);
      continue;
    }
    survivors.push(b);
  }

  S.barbarians = survivors;
}

function advanceTurn(g) {
  if (S.scene !== "play" || S.turn >= 30) {
    return;
  }

  const yields = [];
  let totalFood = 0;
  let totalProduction = 0;
  let totalTech = 0;

  for (let i = 0; i < S.cities.length; i++) {
    const value = cityYield(S.cities[i]);
    yields.push(value);
    totalFood += value.food;
    totalProduction += value.production;
    totalTech += value.tech;
  }

  for (let i = 0; i < S.cities.length; i++) {
    const city = S.cities[i];
    const value = yields[i];
    city.food += value.food;
    city.production += value.production;
    S.tech += value.tech;

    let need = foodNeed(city);
    while (city.food >= need) {
      city.food -= need;
      city.population += 1;
      addLog("🏛️人口が" + city.population + "になった!");
      g.se("heal");
      need = foodNeed(city);
    }

    normalizeProduction(city);
    let item = itemById(city.producing);

    while (city.production >= item.cost && isItemAvailable(city, item)) {
      city.production -= item.cost;
      completeItem(g, city, item);
      normalizeProduction(city);
      item = itemById(city.producing);

      if (item.id !== "settler") {
        break;
      }
    }
  }

  // 蛮族: まず動いて攻撃、そのあと次の襲来が湧く
  updateBarbarians(g);

  S.turn += 1;

  if (S.cities.length > 0 && S.turn >= S.nextRaidTurn) {
    spawnBarbarians(g);
    S.nextRaidTurn = S.turn + raidInterval();
  }
  S.raidWarning = S.cities.length > 0 && S.nextRaidTurn - S.turn <= 1;

  S.pulse = 0.35;
  addLog("🌾食料+" + totalFood + " 🔨生産+" + totalProduction + " 🔬技術+" + totalTech);
  g.se("click");

  if (S.cities.length === 0) {
    addLog("文明は滅びた…");
    finishGame(g);
    return;
  }

  if (S.turn >= 30) {
    finishGame(g);
  }
}

function techStage() {
  let stage = 0;
  if (S.tech >= 40) {
    stage += 1;
  }
  if (S.tech >= 115) {
    stage += 1;
  }
  if (S.tech >= 240) {
    stage += 1;
  }
  return stage;
}

function finishGame(g) {
  let population = 0;
  let buildings = 0;

  for (let i = 0; i < S.cities.length; i++) {
    population += S.cities[i].population;
    if (S.cities[i].buildings.farm) {
      buildings += 1;
    }
    if (S.cities[i].buildings.workshop) {
      buildings += 1;
    }
    if (S.cities[i].buildings.temple) {
      buildings += 1;
    }
  }

  const stage = techStage();
  const baseScore =
    population * 20 +
    stage * 40;
  const score = baseScore + S.templeScore;
  let rank = "🌱小さな集落";

  if (S.cities.length === 0) {
    rank = "💀滅亡";
  } else if (score >= 1200) {
    rank = "🏛️黄金時代";
  } else if (score >= 800) {
    rank = "🌟栄えた文明";
  } else if (score >= 450) {
    rank = "🙂ふつうの文明";
  }

  S.result = {
    score: score,
    population: population,
    buildings: buildings,
    cities: S.cities.length,
    stage: stage,
    templeScore: S.templeScore,
    lostCities: S.lostCities,
    rank: rank
  };
  S.scene = "over";
  S.overTimer = 0;
  g.se("clear");
}

function pointIn(px, py, x, y, w, h) {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

function tilePos(index) {
  const row = Math.floor(index / COLS);
  const col = index % COLS;
  return { x: TILE_X + col * TILE_W, y: TILE_Y + row * TILE_H };
}

function mapIndexAt(px, py) {
  for (let i = 0; i < COLS * ROWS; i++) {
    const p = tilePos(i);
    if (pointIn(px, py, p.x, p.y, TILE_W - 5, TILE_H - 5)) {
      return i;
    }
  }
  return -1;
}

function handleMapClick(g, index) {
  const city = cityAt(index);

  if (city) {
    S.selectedIndex = index;
    g.se("click");
    return;
  }

  if (S.map[index] === "sea") {
    return;
  }

  if (S.settlers <= 0) {
    S.message = "開拓者がいません";
    S.messageTimer = 1.2;
    g.se("hit");
    return;
  }

  S.cities.push(makeCity(index));
  S.settlers -= 1;
  S.selectedIndex = index;
  addLog("🚶開拓者が新しい都市を建設!");
  g.se("clear");
}

function handlePlayClick(g) {
  const px = g.pointer.x;
  const py = g.pointer.y;
  const index = mapIndexAt(px, py);

  if (index >= 0) {
    handleMapClick(g, index);
    return;
  }

  const city = selectedCity();

  for (let i = 0; i < ITEMS.length; i++) {
    const buttonY = 248 + i * 43;
    if (pointIn(px, py, 690, buttonY, 258, 36)) {
      const item = ITEMS[i];
      if (isItemAvailable(city, item)) {
        city.producing = item.id;
        g.se("click");
      } else {
        g.se("hit");
      }
      return;
    }
  }

  if (pointIn(px, py, 690, 479, 248, 48)) {
    advanceTurn(g);
  }
}

function updateTitle(g) {
  if (g.pressed("action") || g.pointer.justDown) {
    S.scene = "play";
    g.se("click");
  }
}

function updatePlay(g, dt) {
  if (S.messageTimer > 0) {
    S.messageTimer = Math.max(0, S.messageTimer - dt);
  }
  if (S.pulse > 0) {
    S.pulse = Math.max(0, S.pulse - dt);
  }

  if (g.pointer.justDown) {
    handlePlayClick(g);
    return;
  }

  // スペース/Enter/Z でも1ターン進む(押した瞬間だけ)
  if (g.pressed("action")) {
    advanceTurn(g);
  }
}

function updateOver(g, dt) {
  S.overTimer += dt;

  if (S.overTimer >= 1.0 && (g.pointer.justDown || g.pressed("action"))) {
    reset(g);
    S.scene = "play";
    g.se("click");
  }
}

function drawBar(g, x, y, w, h, value, maximum, color) {
  g.rect(x, y, w, h, "#263847");
  const ratio = maximum > 0 ? g.clamp(value / maximum, 0, 1) : 0;
  g.rect(x, y, w * ratio, h, color);
}

function drawTitle(g) {
  g.bg("#16202b");
  g.emoji("🏛️", 480, 145, 105, { rot: Math.sin(g.time * 1.2) * 0.035 });
  g.text("絵文字文明", 480, 245, 54, "#f6d873", "center");
  g.text("30ターンで島を文明にする。広げるか、深めるか", 480, 304, 23, "#d4e1e8", "center");
  g.rect(300, 365, 360, 68, "#31495b");
  g.text("クリックして始める", 480, 408, 27, "#ffffff", "center");
  g.text("開拓者・畑・工房・神殿で島を育てよう", 480, 474, 18, "#94aebe", "center");
  g.text("rev17", 936, 522, 12, "#6f8796", "right");
}

function drawTop(g) {
  const city = selectedCity();
  const value = cityYield(city);
  const needFood = foodNeed(city);
  const item = itemById(city.producing);

  g.rect(0, 0, 960, 90, "#1d2c38");
  g.text("🗓️ " + S.turn + "/30ターン", 20, 31, 21, "#ffffff", "left");

  g.text("🌾食料 " + city.food + "/" + needFood, 190, 22, 16, "#f4e7a1", "left");
  drawBar(g, 190, 31, 205, 13, city.food, needFood, "#d9bd52");
  g.text("産出 +" + value.food, 395, 43, 12, "#adbec8", "right");

  g.text("🔨生産 " + city.production + "/" + item.cost + " (" + item.name + ")", 190, 62, 15, "#e7d7c4", "left");
  drawBar(g, 190, 70, 205, 13, city.production, item.cost, "#d78d52");
  g.text("産出 +" + value.production, 395, 83, 12, "#adbec8", "right");

  g.text("🔬技術 " + S.tech, 430, 28, 20, "#b9e4ff", "left");
  g.text(
    "解禁 " +
    (S.tech >= 40 ? "🌾" : "▫") +
    (S.tech >= 115 ? "🔨" : "▫") +
    (S.tech >= 240 ? "🏛️" : "▫"),
    430,
    57,
    17,
    "#d6e5ec",
    "left"
  );
  g.text("次: " + nextUnlockText(), 430, 79, 12, "#93aab8", "left");

  g.text("🚶開拓者 " + S.settlers, 592, 31, 17, "#ffffff", "right");
  g.text("都市 " + S.cities.length, 592, 57, 16, "#cddce4", "right");

  const untilRaid = S.nextRaidTurn - S.turn;
  if (S.barbarians.length > 0) {
    g.text("🗡️蛮族 " + S.barbarians.length + "体 接近中!", 668, 31, 17, "#ff9b9b", "left");
  } else if (untilRaid <= 1) {
    g.text("🗡️次のターンに襲来!", 668, 31, 16, "#ffbc6b", "left");
  } else {
    g.text("🗡️襲来まで " + untilRaid + "ターン", 668, 31, 15, "#9fb3bf", "left");
  }
  g.text("rev17", 944, 18, 11, "#758c99", "right");
}

function nextUnlockText() {
  if (S.tech < 40) {
    return "技術40で畑";
  }
  if (S.tech < 115) {
    return "技術115で工房";
  }
  if (S.tech < 240) {
    return "技術240で神殿";
  }
  return "すべて解禁済み";
}

function drawMap(g) {
  for (let i = 0; i < COLS * ROWS; i++) {
    const p = tilePos(i);
    const x = p.x;
    const y = p.y;
    const w = TILE_W - 5;
    const h = TILE_H - 5;
    const terrain = S.map[i];
    const city = cityAt(i);
    let tileColor = "#263947";

    if (terrain === "plain") {
      tileColor = "#384838";
    } else if (terrain === "forest") {
      tileColor = "#244238";
    } else if (terrain === "mountain") {
      tileColor = "#3d4148";
    } else if (terrain === "sea") {
      tileColor = "#213f57";
    }

    g.rect(x, y, w, h, tileColor);

    if (city) {
      const borderColor = city.index === S.selectedIndex ? "#f6da62" : "#dcebf0";
      g.rect(x, y, w, 4, borderColor);
      g.rect(x, y + h - 4, w, 4, borderColor);
      g.rect(x, y, 4, h, borderColor);
      g.rect(x + w - 4, y, 4, h, borderColor);
    }

    g.emoji(TERRAIN_EMOJI[terrain], x + w / 2, y + h / 2, 44, {
      alpha: city ? 0.38 : 0.90
    });

    if (city) {
      g.emoji("🏛️", x + w / 2 - 4, y + h / 2 - 3, 40);
      g.rect(x + w - 28, y + h - 26, 24, 22, "#15212a");
      g.text(String(city.population), x + w - 16, y + h - 9, 16, "#ffffff", "center");

      if (city.soldiers > 0) {
        g.text("⚔️".repeat(city.soldiers), x + 6, y + 18, 13, "#ffffff", "left");
      }

      let buildingText = "";
      if (city.buildings.farm) {
        buildingText += "🌾";
      }
      if (city.buildings.workshop) {
        buildingText += "🔨";
      }
      if (city.buildings.temple) {
        buildingText += "🏛️";
      }
      if (buildingText) {
        g.text(buildingText, x + 6, y + h - 8, 13, "#ffffff", "left");
      }
    }
  }

  for (let i = 0; i < S.barbarians.length; i++) {
    const b = S.barbarians[i];
    const p = tilePos(b.index);
    const wob = Math.sin(g.time * 6 + i) * 3;
    g.emoji("🗡️", p.x + (TILE_W - 5) / 2, p.y + 20 + wob, 34);
    const tp = tilePos(b.target);
    g.text("→", (p.x + tp.x) / 2 + 40, (p.y + tp.y) / 2 + 40, 15, "#ff8080", "center");
  }
}

function drawPanel(g) {
  const city = selectedCity();
  const value = cityYield(city);
  const current = itemById(city.producing);

  g.rect(672, 90, 288, 380, "#1b2934");
  g.text("選択中の都市", 700, 119, 18, "#f6d873", "left");
  g.text("🏛️ 人口 " + city.population + "   ⚔️ 兵 " + city.soldiers, 700, 148, 21, "#ffffff", "left");
  g.text("産出  🌾" + value.food + "  🔨" + value.production + "  🔬" + value.tech, 700, 178, 18, "#d7e5ec", "left");
  g.text("食料は都市数で " + Math.round(cityPenalty() * 100) + "% に", 700, 201, 13, "#91a8b5", "left");
  g.text("今つくっているもの", 700, 226, 15, "#9eb5c1", "left");
  g.text(current.emoji + " " + current.name, 700, 250, 21, "#ffffff", "left");

  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i];
    const y = 248 + i * 43;
    const available = isItemAvailable(city, item);
    const active = city.producing === item.id;
    let color = "#314858";

    if (!available) {
      color = "#252e34";
    } else if (active) {
      color = "#765f25";
    }

    g.rect(690, y, 258, 36, color);
    g.text(item.emoji + " " + item.name, 700, y + 24, 16, available ? "#ffffff" : "#69767d", "left");
    g.text(String(item.cost), 940, y + 24, 14, available ? "#d8e4ea" : "#69767d", "right");

    if (!available) {
      if (item.id === "soldier") {
        g.text("上限3人", 862, y + 24, 12, "#737f85", "right");
      } else if (city.buildings[item.id]) {
        g.text("建設済み", 862, y + 24, 12, "#737f85", "right");
      } else {
        g.text("技術" + item.unlock, 862, y + 24, 12, "#737f85", "right");
      }
    }
  }
}

function drawBottom(g) {
  g.rect(0, 470, 960, 70, "#111b23");
  g.text(S.logs[0] || "", 20, 493, 16, "#dce8ed", "left");
  g.text(S.logs[1] || "", 20, 518, 14, "#8fa5b1", "left");

  const buttonColor = S.pulse > 0 ? "#d0a53e" : "#496a47";
  g.rect(690, 479, 248, 48, buttonColor);
  g.text("▶ 次のターン", 814, 511, 24, "#ffffff", "center");

  if (S.messageTimer > 0) {
    g.rect(210, 205, 240, 42, "#7b3535");
    g.text(S.message, 330, 233, 20, "#ffffff", "center");
  }
}

function drawPlay(g) {
  g.bg("#16202b");
  drawTop(g);
  drawMap(g);
  drawPanel(g);
  drawBottom(g);
}

function drawOver(g) {
  const result = S.result;
  g.bg("#16202b");
  g.emoji("🏛️", 480, 85, 72);
  g.text("30ターン終了", 480, 147, 34, "#f6d873", "center");
  g.text(result.rank, 480, 198, 31, "#ffffff", "center");
  g.text("スコア " + result.score, 480, 252, 43, "#f6d873", "center");

  g.rect(285, 282, 390, 155, "#21313d");
  g.text("人口合計  " + result.population + " × 20", 320, 315, 19, "#dce8ed", "left");
  g.text("技術段階  " + result.stage + " × 40", 320, 345, 19, "#dce8ed", "left");
  g.text("建物数    " + result.buildings + "(人口に効いています)", 320, 375, 17, "#9db2bd", "left");
  g.text("滅んだ都市 " + result.lostCities, 320, 402, 17, "#c98d8d", "left");
  g.text("都市数    " + result.cities + "(人口に効いています)", 320, 405, 17, "#9db2bd", "left");
  g.text("神殿ボーナス +" + result.templeScore, 640, 405, 16, "#f0d77b", "right");

  if (S.overTimer >= 1.0) {
    g.text("クリックでもう一度", 480, 488, 23, "#ffffff", "center");
  }
  g.text("rev17", 936, 522, 12, "#6f8796", "right");
}

EmojiEngine.register({
  id: "bunmei",
  name: "絵文字文明",
  icon: "🏛️",
  desc: "30ターンで島を文明にする。広げるか、深めるか",

  init(g) {
    reset(g);
    this._state = S;
  },

  update(g, dt) {
    if (S.scene === "title") {
      updateTitle(g);
    } else if (S.scene === "play") {
      updatePlay(g, dt);
    } else if (S.scene === "over") {
      updateOver(g, dt);
    }

    this._state = S;
  },

  draw(g) {
    if (S.scene === "title") {
      drawTitle(g);
    } else if (S.scene === "play") {
      drawPlay(g);
    } else if (S.scene === "over") {
      drawOver(g);
    }
  }
});
})();
