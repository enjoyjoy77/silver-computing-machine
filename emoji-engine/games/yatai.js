(function () {
  "use strict";

  let S;

  const CUSTOMER_EMOJIS = ["😀", "😊", "🥰", "😋", "🤗", "😎", "🧑", "👦", "👧", "👵"];

  const UPGRADES = [
    {
      icon: "🔥",
      name: "コンロを増やす",
      effect: "同時調理数 +1",
      base: 120,
      mult: 2.9,
      max: 3
    },
    {
      icon: "🍥",
      name: "具を豪華に",
      effect: "1皿の単価 +6円",
      base: 80,
      mult: 2.3,
      max: Infinity
    },
    {
      icon: "🪑",
      name: "席を増やす",
      effect: "行列の上限 +2人",
      base: 60,
      mult: 2.3,
      max: 4
    },
    {
      icon: "🧑‍🍳",
      name: "バイトを雇う",
      effect: "調理時間 ×0.82",
      base: 150,
      mult: 2.9,
      max: 5
    }
  ];

  const DAY_TIME = 90;

  // 1日90秒 × 3日。設備と所持金は翌日へ引き継ぐ(初日の投資が後半で効く)
  const DAYS = [
    {
      label: "1日目",
      sub: "ふつうの日",
      arrivalBase: 1.2,
      waitTime: 10,
      quota: 800,
      waves: [{ start: 55, end: 70 }]
    },
    {
      label: "2日目",
      sub: "せっかちな客(待ってくれない)",
      arrivalBase: 1.05,
      waitTime: 7,
      quota: 2000,
      waves: [
        { start: 35, end: 50 },
        { start: 70, end: 85 }
      ]
    },
    {
      label: "3日目",
      sub: "大波の日(客足が止まらない)",
      arrivalBase: 0.9,
      waitTime: 7,
      quota: 4500,
      waves: [
        { start: 20, end: 35 },
        { start: 50, end: 65 },
        { start: 78, end: 90 }
      ]
    }
  ];

  function reset(g) {
    S = {
      scene: "title",
      money: 30,
      totalEarned: 0,
      dayEarned: 0,
      dayIndex: 0,
      quota: DAYS[0].quota,
      cleared: false,
      elapsed: 0,
      timeLimit: DAY_TIME,
      stoveCount: 1,
      cookTime: 2.0,
      pricePerDish: 10,
      queueMax: 4,
      waitTime: DAYS[0].waitTime,
      arrivalBase: DAYS[0].arrivalBase,
      arrivalTimer: DAYS[0].arrivalBase,
      queue: [],
      stoves: [{ progress: 0 }],
      upgradeCounts: [0, 0, 0, 0],
      dishesServed: 0,
      customersLost: 0,
      angry: [],
      flights: [],
      floats: [],
      message: "",
      messageTimer: 0,
      clickSeCooldown: 0,
      overTimer: 0,
      waves: DAYS[0].waves,
      activeWave: -1,
      startedWaves: [],
      endedWaves: [],
      digitHeld: [false, false, false, false]
    };
  }

  // 1日ぶんの店を開ける。設備(stoveCount/cookTime/pricePerDish/queueMax)と
  // 所持金・累計売上はそのまま引き継ぎ、その日ごとの条件だけ差し替える
  function startDay(index) {
    const day = DAYS[index];

    S.dayIndex = index;
    S.quota = day.quota;
    S.arrivalBase = day.arrivalBase;
    S.arrivalTimer = day.arrivalBase;
    S.waitTime = day.waitTime;
    S.waves = day.waves;
    S.startedWaves = day.waves.map(function () {
      return false;
    });
    S.endedWaves = day.waves.map(function () {
      return false;
    });
    S.activeWave = -1;
    S.elapsed = 0;
    S.timeLimit = DAY_TIME;
    S.dayEarned = 0;
    S.queue = [];
    S.stoves = [];
    for (let i = 0; i < S.stoveCount; i++) {
      S.stoves.push({ progress: 0 });
    }
    S.angry = [];
    S.flights = [];
    S.floats = [];
    S.message = "";
    S.messageTimer = 0;
    S.overTimer = 0;
    S.scene = "play";
  }

  function beginPlay(g) {
    reset(g);
    startDay(0);
  }

  function upgradePrice(index) {
    const u = UPGRADES[index];
    return Math.round(u.base * Math.pow(u.mult, S.upgradeCounts[index]));
  }

  function upgradeIsMax(index) {
    return S.upgradeCounts[index] >= UPGRADES[index].max;
  }

  function cardIndexAt(x, y) {
    if (y < 400 || y > 540 || x < 0 || x >= 960) return -1;
    return Math.floor(x / 240);
  }

  function queuePosition(index, count) {
    const usableWidth = 410;
    const spacing = count <= 1 ? 0 : Math.min(68, usableWidth / Math.max(1, count - 1));
    return {
      x: 510 + index * spacing,
      y: 235
    };
  }

  function isWaveActiveAt(time) {
    for (let i = 0; i < S.waves.length; i++) {
      if (time >= S.waves[i].start && time < S.waves[i].end) return i;
    }
    return -1;
  }

  function upcomingWaveAt(time) {
    for (let i = 0; i < S.waves.length; i++) {
      const until = S.waves[i].start - time;
      if (until > 0 && until <= 3) return i;
    }
    return -1;
  }

  function updateWaveState(g) {
    for (let i = 0; i < S.waves.length; i++) {
      if (!S.startedWaves[i] && S.elapsed >= S.waves[i].start) {
        S.startedWaves[i] = true;
        S.activeWave = i;
        g.se("boom");
      }
      if (!S.endedWaves[i] && S.elapsed >= S.waves[i].end) {
        S.endedWaves[i] = true;
        if (S.activeWave === i) S.activeWave = -1;
        g.se("clear");
      }
    }
    S.activeWave = isWaveActiveAt(S.elapsed);
  }

  function currentArrivalInterval() {
    return S.activeWave >= 0 ? S.arrivalBase / 3 : S.arrivalBase;
  }

  function addAngry(x, y) {
    S.angry.push({
      x: x,
      y: y,
      time: 0.8,
      maxTime: 0.8
    });
  }

  function customerArrives(g) {
    if (S.queue.length >= S.queueMax) {
      S.customersLost += 1;
      addAngry(920, 225);
      g.se("hit");
      return;
    }

    S.queue.push({
      emoji: g.pick(CUSTOMER_EMOJIS),
      wait: S.waitTime
    });
  }

  function updateArrivals(g, dt) {
    S.arrivalTimer -= dt;
    while (S.arrivalTimer <= 0) {
      customerArrives(g);
      S.arrivalTimer += currentArrivalInterval();
    }
  }

  function updateWaitingCustomers(g, dt) {
    const beforeCount = S.queue.length;
    const survivors = [];

    for (let i = 0; i < S.queue.length; i++) {
      const customer = S.queue[i];
      customer.wait -= dt;

      if (customer.wait <= 0) {
        const pos = queuePosition(i, beforeCount);
        S.customersLost += 1;
        addAngry(pos.x, pos.y);
        g.se("hit");
      } else {
        survivors.push(customer);
      }
    }

    S.queue = survivors;
  }

  function serveCustomer(g, stoveIndex) {
    if (S.queue.length <= 0) return false;

    const stoveX = 86;
    const stoveY = 115 + stoveIndex * 65;
    const target = queuePosition(0, S.queue.length);
    const earned = S.pricePerDish;

    S.queue = S.queue.filter(function (_, index) {
      return index !== 0;
    });

    S.money += earned;
    S.totalEarned += earned;
    S.dayEarned += earned;
    S.dishesServed += 1;
    S.flights.push({
      fromX: stoveX,
      fromY: stoveY,
      toX: target.x,
      toY: target.y,
      time: 0,
      duration: 0.3
    });
    S.floats.push({
      x: target.x,
      y: target.y - 42,
      text: "+" + earned,
      time: 0.8,
      maxTime: 0.8
    });
    g.se("coin");
    return true;
  }

  function advanceStove(g, stoveIndex, amount) {
    if (S.queue.length <= 0) return;

    const stove = S.stoves[stoveIndex];
    stove.progress += amount;

    while (stove.progress >= S.cookTime && S.queue.length > 0) {
      stove.progress -= S.cookTime;
      serveCustomer(g, stoveIndex);
    }

    if (S.queue.length <= 0) {
      stove.progress = 0;
    }
  }

  function updateCooking(g, dt) {
    if (S.queue.length <= 0) return;

    for (let i = 0; i < S.stoves.length; i++) {
      advanceStove(g, i, dt);
    }
  }

  function manualPlate(g) {
    if (S.queue.length <= 0 || S.stoves.length <= 0) return;

    let bestIndex = 0;
    for (let i = 1; i < S.stoves.length; i++) {
      if (S.stoves[i].progress > S.stoves[bestIndex].progress) {
        bestIndex = i;
      }
    }

    advanceStove(g, bestIndex, 0.30);

    if (S.clickSeCooldown <= 0) {
      g.se("click");
      S.clickSeCooldown = 0.08;
    }
  }

  function buyUpgrade(g, index) {
    if (index < 0 || index >= UPGRADES.length) return;
    if (upgradeIsMax(index)) return;

    const price = upgradePrice(index);
    if (S.money < price) {
      S.message = "お金が足りません";
      S.messageTimer = 1.2;
      g.se("hit");
      return;
    }

    S.money -= price;
    S.upgradeCounts[index] += 1;

    if (index === 0) {
      S.stoveCount += 1;
      S.stoves.push({ progress: 0 });
    } else if (index === 1) {
      S.pricePerDish += 6;
    } else if (index === 2) {
      S.queueMax += 2;
    } else if (index === 3) {
      S.cookTime *= 0.82;
      for (let i = 0; i < S.stoves.length; i++) {
        S.stoves[i].progress = Math.min(S.stoves[i].progress, S.cookTime);
      }
    }

    g.se("ping");
  }

  function updateDigitPurchases(g) {
    const keys = ["Digit1", "Digit2", "Digit3", "Digit4"];

    for (let i = 0; i < keys.length; i++) {
      const held = g.key(keys[i]);
      if (held && !S.digitHeld[i]) {
        buyUpgrade(g, i);
      }
      S.digitHeld[i] = held;
    }
  }

  function updateEffects(dt) {
    S.clickSeCooldown = Math.max(0, S.clickSeCooldown - dt);
    S.messageTimer = Math.max(0, S.messageTimer - dt);

    for (let i = 0; i < S.angry.length; i++) {
      S.angry[i].time -= dt;
      S.angry[i].y -= 18 * dt;
    }
    S.angry = S.angry.filter(function (a) {
      return a.time > 0;
    });

    for (let i = 0; i < S.flights.length; i++) {
      S.flights[i].time += dt;
    }
    S.flights = S.flights.filter(function (f) {
      return f.time < f.duration;
    });

    for (let i = 0; i < S.floats.length; i++) {
      S.floats[i].time -= dt;
      S.floats[i].y -= 28 * dt;
    }
    S.floats = S.floats.filter(function (f) {
      return f.time > 0;
    });
  }

  function updatePlay(g, dt) {
    S.elapsed = Math.min(S.timeLimit, S.elapsed + dt);
    updateWaveState(g);

    const clicked = g.pointer.justDown;
    const clickedCard = clicked ? cardIndexAt(g.pointer.x, g.pointer.y) : -1;

    if (clickedCard >= 0) {
      buyUpgrade(g, clickedCard);
    } else if (
      clicked &&
      g.pointer.x < 460 &&
      g.pointer.y >= 56 &&
      g.pointer.y < 400
    ) {
      manualPlate(g);
    }

    if (g.pressed("action")) {
      manualPlate(g);
    }

    updateDigitPurchases(g);
    updateArrivals(g, dt);
    updateWaitingCustomers(g, dt);
    updateCooking(g, dt);
    updateEffects(dt);

    if (S.elapsed >= S.timeLimit) {
      finishDay(g);
    }
  }

  function finishDay(g) {
    S.overTimer = 0;

    if (S.dayEarned < S.quota) {
      // ノルマ未達で閉店
      S.cleared = false;
      S.scene = "over";
      g.se("hit");
      return;
    }

    if (S.dayIndex >= DAYS.length - 1) {
      S.cleared = true;
      S.scene = "over";
      g.se("clear");
      return;
    }

    S.scene = "dayend";
    g.se("clear");
  }

  function drawTopBar(g) {
    g.rect(0, 0, 960, 56, "#100d19");
    g.text("💰 " + S.money + "円", 20, 35, 24, "#ffe28a", "left");
    g.text(
      "⏱ " + Math.max(0, Math.ceil(S.timeLimit - S.elapsed)) + "秒",
      250,
      35,
      24,
      "#ffffff",
      "left"
    );

    const reached = S.dayEarned >= S.quota;
    g.text(
      DAYS[S.dayIndex].label + " ノルマ " + S.dayEarned + "/" + S.quota + "円",
      380,
      35,
      21,
      reached ? "#7ee08f" : "#ffffff",
      "left"
    );

    if (S.activeWave >= 0) {
      const remaining = Math.max(0, Math.ceil(S.waves[S.activeWave].end - S.elapsed));
      g.text("🌊 大波! 残り" + remaining + "秒", 790, 35, 22, "#ffb347", "center");
    } else {
      const upcoming = upcomingWaveAt(S.elapsed);
      if (upcoming >= 0 && Math.floor(g.time * 4) % 2 === 0) {
        g.text("🌊 まもなく大波!", 790, 35, 22, "#ffd166", "center");
      }
    }

    g.text("rev5", 945, 22, 12, "#8f879f", "right");
  }

  function drawStoves(g) {
    g.rect(0, 56, 460, 344, "#21192d");
    g.text("🍜 絵文字屋台", 24, 87, 23, "#fff2c7", "left");
    g.text("クリックで盛り付け!", 436, 87, 18, "#ffcf70", "right");

    for (let i = 0; i < S.stoves.length; i++) {
      const y = 115 + i * 65;
      const ratio = g.clamp(S.stoves[i].progress / S.cookTime, 0, 1);

      g.rect(24, y - 23, 408, 54, "#30243e");
      g.emoji("🔥", 48, y + 3, 32);
      g.emoji("🍲", 86, y + 3, 36);
      g.text("コンロ " + (i + 1), 116, y - 4, 17, "#ffffff", "left");

      g.rect(116, y + 8, 288, 11, "#110e18");
      g.rect(116, y + 8, 288 * ratio, 11, "#ff8c42");

      if (S.queue.length <= 0) {
        g.text("客待ち", 260, y + 18, 14, "#b8adca", "center");
      } else {
        g.text(
          Math.min(S.cookTime, S.stoves[i].progress).toFixed(1) +
            " / " +
            S.cookTime.toFixed(1) +
            "秒",
          404,
          y - 4,
          13,
          "#d8cee5",
          "right"
        );
      }
    }
  }

  function drawQueue(g) {
    g.rect(460, 56, 500, 344, "#171c31");
    g.text(
      "行列 " + S.queue.length + "/" + S.queueMax,
      485,
      88,
      23,
      "#ffffff",
      "left"
    );
    g.text("先頭", 510, 125, 14, "#8fd3ff", "center");

    for (let i = 0; i < S.queue.length; i++) {
      const customer = S.queue[i];
      const pos = queuePosition(i, S.queue.length);
      const ratio = g.clamp(customer.wait / S.waitTime, 0, 1);
      const gaugeWidth = 46;
      const color = customer.wait <= 5 ? "#ff4d5a" : "#57d68d";

      g.rect(pos.x - gaugeWidth / 2, pos.y - 54, gaugeWidth, 5, "#3a3349");
      g.rect(pos.x - gaugeWidth / 2, pos.y - 54, gaugeWidth * ratio, 5, color);
      g.emoji(customer.emoji, pos.x, pos.y, 43);
      g.text(
        Math.ceil(customer.wait) + "秒",
        pos.x,
        pos.y + 39,
        12,
        customer.wait <= 5 ? "#ff7b84" : "#d8e9ff",
        "center"
      );
    }

    if (S.queue.length === 0) {
      g.text("お客さんを待っています", 710, 235, 20, "#777f9f", "center");
    }
  }

  function drawCards(g) {
    const cardWidth = 240;

    for (let i = 0; i < UPGRADES.length; i++) {
      const u = UPGRADES[i];
      const x = i * cardWidth;
      const isMax = upgradeIsMax(i);
      const price = upgradePrice(i);
      const affordable = S.money >= price;
      const bg = isMax ? "#26222c" : affordable ? "#3a2945" : "#211c29";
      const mainColor = isMax ? "#7c7482" : affordable ? "#ffffff" : "#81798a";
      const accent = isMax ? "#6e6874" : affordable ? "#ffd166" : "#746b7d";

      g.rect(x + 3, 403, cardWidth - 6, 134, bg);
      g.text((i + 1) + "", x + 14, 421, 13, accent, "left");
      g.emoji(u.icon, x + 33, 452, 36);
      g.text(u.name, x + 58, 449, 17, mainColor, "left");
      g.text(u.effect, x + 14, 482, 14, mainColor, "left");

      if (isMax) {
        g.text("MAX", x + cardWidth / 2, 519, 20, "#a49baa", "center");
      } else {
        g.text(price + "円", x + cardWidth / 2, 519, 20, accent, "center");
      }
    }
  }

  function drawEffects(g) {
    for (let i = 0; i < S.flights.length; i++) {
      const f = S.flights[i];
      const t = g.clamp(f.time / f.duration, 0, 1);
      const x = f.fromX + (f.toX - f.fromX) * t;
      const arc = Math.sin(t * Math.PI) * 45;
      const y = f.fromY + (f.toY - f.fromY) * t - arc;
      g.emoji("🍜", x, y, 32, { rot: t * 0.4 });
    }

    for (let i = 0; i < S.floats.length; i++) {
      const f = S.floats[i];
      g.text(
        f.text,
        f.x,
        f.y,
        21,
        "#ffe066",
        "center"
      );
    }

    for (let i = 0; i < S.angry.length; i++) {
      const a = S.angry[i];
      g.emoji("😠", a.x, a.y, 38, {
        alpha: g.clamp(a.time / a.maxTime, 0, 1)
      });
    }

    if (S.messageTimer > 0) {
      g.rect(330, 335, 300, 48, "#6b2637");
      g.text(S.message, 480, 367, 22, "#ffffff", "center");
    }
  }

  function drawWaveBorder(g) {
    if (S.activeWave < 0) return;

    const thickness = 7;
    g.rect(0, 0, 960, thickness, "#ff8c42");
    g.rect(0, 540 - thickness, 960, thickness, "#ff8c42");
    g.rect(0, 0, thickness, 540, "#ff8c42");
    g.rect(960 - thickness, 0, thickness, 540, "#ff8c42");
  }

  function drawTitle(g) {
    g.bg("#1b1626");
    g.rect(140, 70, 680, 390, "#251d33");
    g.emoji("🍜", 480, 145, 88);
    g.text("絵文字屋台", 480, 230, 48, "#fff2c7", "center");
    g.text(
      "増やすか、今さばくか。3分の屋台経営",
      480,
      278,
      23,
      "#d9cce8",
      "center"
    );
    g.text("設備を買って将来に備える", 480, 322, 20, "#ffcf70", "center");
    g.text("盛り付けを連打して今すぐ稼ぐ", 480, 352, 20, "#ffcf70", "center");
    g.text(
      "1日90秒 × 3日間。設備とお金は翌日へ引き継ぐ",
      480,
      388,
      19,
      "#9fe7c0",
      "center"
    );
    g.text("その日のノルマに届かないと閉店", 480, 414, 19, "#ff9aa6", "center");
    g.text("クリックで開店", 480, 448, 25, "#ffffff", "center");
    g.text("rev5", 945, 525, 12, "#665e73", "right");
  }

  function drawDayEnd(g) {
    const nextDay = DAYS[S.dayIndex + 1];

    g.bg("#1b1626");
    g.rect(160, 60, 640, 420, "#251d33");
    g.text(DAYS[S.dayIndex].label + " 終了!", 480, 118, 36, "#fff2c7", "center");
    g.emoji("🎉", 480, 178, 60);
    g.text(
      "本日の売上 " + S.dayEarned + "円(ノルマ " + S.quota + "円)",
      480,
      248,
      24,
      "#7ee08f",
      "center"
    );
    g.text("所持金 " + S.money + "円 は明日も使えます", 480, 288, 20, "#d9cce8", "center");
    g.text("明日 " + nextDay.label + ": " + nextDay.sub, 480, 340, 22, "#ffcf70", "center");
    g.text("明日のノルマ " + nextDay.quota + "円", 480, 374, 22, "#ffcf70", "center");
    g.text("クリックで翌日へ", 480, 440, 25, "#ffffff", "center");
    g.text("rev5", 945, 525, 12, "#665e73", "right");
  }

  function resultRank() {
    if (S.totalEarned >= 13500) return "🌟伝説の屋台";
    if (S.totalEarned >= 11500) return "🏆繁盛店";
    if (S.totalEarned >= 8000) return "😄人気屋台";
    if (S.totalEarned >= 3000) return "🙂ふつうの屋台";
    return "😢閑古鳥";
  }

  function drawOver(g) {
    g.bg("#1b1626");
    g.rect(180, 55, 600, 430, "#251d33");

    if (S.cleared) {
      g.text("3日間の営業をやりきった!", 480, 112, 32, "#fff2c7", "center");
    } else {
      g.text(
        DAYS[S.dayIndex].label + " ノルマ未達で閉店",
        480,
        112,
        32,
        "#ff9aa6",
        "center"
      );
    }

    g.emoji(S.cleared ? "🏮" : "🍜", 480, 172, 66);
    g.text(resultRank(), 480, 245, 37, "#ffd166", "center");

    if (!S.cleared) {
      g.text(
        "この日の売上 " + S.dayEarned + "円 / ノルマ " + S.quota + "円",
        480,
        282,
        19,
        "#c9bcd8",
        "center"
      );
    }

    g.text("総売上 " + S.totalEarned + "円", 480, 312, 27, "#ffffff", "center");
    g.text(
      "渡した皿の数 " + S.dishesServed + "皿",
      480,
      350,
      21,
      "#d9cce8",
      "center"
    );
    g.text(
      "帰らせた客の数 " + S.customersLost + "人",
      480,
      384,
      21,
      "#d9cce8",
      "center"
    );
    g.text("クリックで初日からもう一度", 480, 450, 23, "#ffcf70", "center");
    g.text("rev5", 945, 525, 12, "#665e73", "right");
  }

  EmojiEngine.register({
    id: "yatai",
    name: "絵文字屋台",
    icon: "🍜",
    desc: "増やすか、今さばくか。3日間の屋台経営",

    init(g) {
      reset(g);
      this._state = S;
    },

    update(g, dt) {
      if (S.scene === "title") {
        if (g.pointer.justDown || g.pressed("action")) {
          beginPlay(g);
          this._state = S;
        }
        return;
      }

      if (S.scene === "dayend") {
        // 連打で画面を読む前に翌日が始まらないよう1秒待つ
        S.overTimer += dt;
        if (S.overTimer >= 1.0 && (g.pointer.justDown || g.pressed("action"))) {
          startDay(S.dayIndex + 1);
        }
        return;
      }

      if (S.scene === "over") {
        // 終了直後の連打で結果を読む前にリスタートしないよう1秒待つ
        S.overTimer += dt;
        if (S.overTimer >= 1.0 && (g.pointer.justDown || g.pressed("action"))) {
          beginPlay(g);
          this._state = S;
        }
        return;
      }

      updatePlay(g, dt);
    },

    draw(g) {
      if (S.scene === "title") {
        drawTitle(g);
        return;
      }

      if (S.scene === "dayend") {
        drawDayEnd(g);
        return;
      }

      if (S.scene === "over") {
        drawOver(g);
        return;
      }

      g.bg("#1b1626");
      drawTopBar(g);
      drawStoves(g);
      drawQueue(g);
      drawCards(g);
      drawEffects(g);
      drawWaveBorder(g);
    }
  });
})();
