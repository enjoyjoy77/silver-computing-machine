(function(){
"use strict";

let S;

const TERRAINS = ["plain","plain","plain","plain","forest","forest","forest","mountain","mountain","mountain","sea","sea"];
const TERRAIN_EMOJI = {
  plain: "🌾",
  forest: "🌲",
  mountain: "⛰️",
  sea: "🌊"
};
const TERRAIN_YIELD = {
  plain: { food: 2, production: 0, tech: 0 },
  forest: { food: 0, production: 2, tech: 0 },
  mountain: { food: 0, production: 1, tech: 1 },
  sea: { food: 1, production: 0, tech: 1 }
};
const ITEMS = [
  { id: "settler", emoji: "🚶", name: "開拓者", cost: 35, unlock: 0 },
  { id: "farm", emoji: "🌾", name: "畑", cost: 20, unlock: 30 },
  { id: "workshop", emoji: "🔨", name: "工房", cost: 30, unlock: 90 },
  { id: "temple", emoji: "🏛️", name: "神殿", cost: 50, unlock: 180 }
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
    buildings: {
      farm: false,
      workshop: false,
      temple: false
    }
  };
}

function reset(g) {
  const terrains = shuffledTerrains(g);
  let startIndex = 5;

  if (terrains[startIndex] === "sea") {
    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < terrains.length; i++) {
      if (terrains[i] !== "sea") {
        const distance = Math.abs(i - 5);
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
  return 20 + (city.population - 1) * 14;
}

function cityPenalty() {
  return Math.max(0.5, 1 - (S.cities.length - 1) * 0.12);
}

function cityYield(city) {
  let food = 1;
  let production = 1;
  let tech = 1;
  const row = Math.floor(city.index / 4);
  const col = city.index % 4;
  const neighbors = [];

  if (row > 0) {
    neighbors.push(city.index - 4);
  }
  if (row < 2) {
    neighbors.push(city.index + 4);
  }
  if (col > 0) {
    neighbors.push(city.index - 1);
  }
  if (col < 3) {
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

  city.buildings[item.id] = true;

  if (item.id === "farm") {
    addLog("🌾畑が完成!");
  } else if (item.id === "workshop") {
    addLog("🔨工房が完成!");
  } else if (item.id === "temple") {
    S.templeScore += 40;
    addLog("🏛️神殿が完成! スコア+40");
  }

  city.producing = "settler";
  g.se("clear");
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

  S.turn += 1;
  S.pulse = 0.35;
  addLog("🌾食料+" + totalFood + " 🔨生産+" + totalProduction + " 🔬技術+" + totalTech);
  g.se("click");

  if (S.turn >= 30) {
    finishGame(g);
  }
}

function techStage() {
  let stage = 0;
  if (S.tech >= 30) {
    stage += 1;
  }
  if (S.tech >= 90) {
    stage += 1;
  }
  if (S.tech >= 180) {
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
    population * 12 +
    buildings * 30 +
    stage * 25;
  const score = baseScore + S.templeScore;
  let rank = "🌱小さな集落";

  if (score >= 420) {
    rank = "🏛️黄金時代";
  } else if (score >= 300) {
    rank = "🌟栄えた文明";
  } else if (score >= 180) {
    rank = "🙂ふつうの文明";
  }

  S.result = {
    score: score,
    population: population,
    buildings: buildings,
    cities: S.cities.length,
    stage: stage,
    templeScore: S.templeScore,
    rank: rank
  };
  S.scene = "over";
  S.overTimer = 0;
  g.se("clear");
}

function pointIn(px, py, x, y, w, h) {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

function mapIndexAt(px, py) {
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const x = 30 + col * 155;
      const y = 105 + row * 118;
      if (pointIn(px, py, x, y, 145, 108)) {
        return row * 4 + col;
      }
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
    const buttonY = 258 + i * 47;
    if (pointIn(px, py, 700, buttonY, 238, 39)) {
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
  g.text("rev7", 936, 522, 12, "#6f8796", "right");
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
    (S.tech >= 30 ? "🌾" : "▫") +
    (S.tech >= 90 ? "🔨" : "▫") +
    (S.tech >= 180 ? "🏛️" : "▫"),
    430,
    57,
    17,
    "#d6e5ec",
    "left"
  );
  g.text("次: " + nextUnlockText(), 430, 79, 12, "#93aab8", "left");

  g.text("🚶開拓者 " + S.settlers, 592, 31, 17, "#ffffff", "right");
  g.text("都市 " + S.cities.length, 592, 57, 16, "#cddce4", "right");
  g.text("rev7", 944, 18, 11, "#758c99", "right");
}

function nextUnlockText() {
  if (S.tech < 30) {
    return "技術30で畑";
  }
  if (S.tech < 90) {
    return "技術90で工房";
  }
  if (S.tech < 180) {
    return "技術180で神殿";
  }
  return "すべて解禁済み";
}

function drawMap(g) {
  for (let i = 0; i < 12; i++) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const x = 30 + col * 155;
    const y = 105 + row * 118;
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

    g.rect(x, y, 145, 108, tileColor);

    if (city) {
      const borderColor = city.index === S.selectedIndex ? "#f6da62" : "#dcebf0";
      g.rect(x, y, 145, 5, borderColor);
      g.rect(x, y + 103, 145, 5, borderColor);
      g.rect(x, y, 5, 108, borderColor);
      g.rect(x + 140, y, 5, 108, borderColor);
    }

    g.emoji(TERRAIN_EMOJI[terrain], x + 72, y + 54, 60, {
      alpha: city ? 0.42 : 0.90
    });

    if (city) {
      g.emoji("🏛️", x + 67, y + 51, 52);
      g.rect(x + 104, y + 70, 31, 27, "#15212a");
      g.text(String(city.population), x + 119, y + 91, 19, "#ffffff", "center");

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
        g.text(buildingText, x + 9, y + 98, 16, "#ffffff", "left");
      }
    }
  }
}

function drawPanel(g) {
  const city = selectedCity();
  const value = cityYield(city);
  const current = itemById(city.producing);

  g.rect(680, 90, 280, 380, "#1b2934");
  g.text("選択中の都市", 700, 119, 18, "#f6d873", "left");
  g.text("🏛️ 人口 " + city.population, 700, 148, 22, "#ffffff", "left");
  g.text("産出  🌾" + value.food + "  🔨" + value.production + "  🔬" + value.tech, 700, 178, 18, "#d7e5ec", "left");
  g.text("食料は都市数で " + Math.round(cityPenalty() * 100) + "% に", 700, 201, 13, "#91a8b5", "left");
  g.text("今つくっているもの", 700, 226, 15, "#9eb5c1", "left");
  g.text(current.emoji + " " + current.name, 700, 250, 21, "#ffffff", "left");

  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i];
    const y = 258 + i * 47;
    const available = isItemAvailable(city, item);
    const active = city.producing === item.id;
    let color = "#314858";

    if (!available) {
      color = "#252e34";
    } else if (active) {
      color = "#765f25";
    }

    g.rect(700, y, 238, 39, color);
    g.text(item.emoji + " " + item.name, 710, y + 26, 17, available ? "#ffffff" : "#69767d", "left");
    g.text(String(item.cost), 925, y + 25, 15, available ? "#d8e4ea" : "#69767d", "right");

    if (!available) {
      if (item.id !== "settler" && city.buildings[item.id]) {
        g.text("建設済み", 852, y + 25, 12, "#737f85", "right");
      } else {
        g.text("技術" + item.unlock, 852, y + 25, 12, "#737f85", "right");
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
    g.rect(233, 417, 240, 42, "#7b3535");
    g.text(S.message, 353, 445, 20, "#ffffff", "center");
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
  g.text("人口合計  " + result.population + " × 12", 320, 315, 19, "#dce8ed", "left");
  g.text("建物数    " + result.buildings + " × 30", 320, 345, 19, "#dce8ed", "left");
  g.text("技術段階  " + result.stage + " × 25", 320, 375, 19, "#dce8ed", "left");
  g.text("都市数    " + result.cities + "(人口に効いています)", 320, 405, 17, "#9db2bd", "left");
  g.text("神殿ボーナス +" + result.templeScore, 640, 405, 16, "#f0d77b", "right");

  if (S.overTimer >= 1.0) {
    g.text("クリックでもう一度", 480, 488, 23, "#ffffff", "center");
  }
  g.text("rev7", 936, 522, 12, "#6f8796", "right");
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
