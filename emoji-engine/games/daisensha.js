/* =====================================================
   サンプルゲーム6: 大戦車バトル (rev81: 投げ捨てた玉を地面に残す/大砲近くは向き不問で装填/メタルをミニマップに表示)
   参考: スラもり2/3 Rocket Slime の大戦車バトル画面(ユーザー提供スクショ)
   配置: 上画面=戦場(味方戦車 左 / 敵戦車 右 / HP数字+ゲージ / ダメージ数字)
        下画面=戦車の中(下のベルトから弾🪨が流れる → 拾って → 右の縦2門の砲へ投げる)
   芯: スラもりの運搬(拾う→運ぶ→投げる)がそのまま戦闘。今回はスライム1体。
       上の砲=やまなり(攻め・威力大・敵弾を越える)/ 下の砲=まっすぐ(守り・敵弾を相殺)。
   rev25: (1)砲に近づかないと投げられない(LOAD_RANGE=150)=砲まで運ぶ意味を作った
          (2)投げると弾がスライム→砲へ山なりに飛ぶ投げモーション(tosses)、着弾で発射
          (3)弾速をもっと遅く(まっすぐvx240/やまなりvx340,vy-300,ARC_GRAV330)
   rev26: 発射される弾をさらに遅く(まっすぐvx175/やまなりvx260,vy-216,ARC_GRAV166/敵弾155-215)。
          やまなりは弾速を落としても敵の高さ(BATTLE_Y)へ戻って命中するよう放物線を再計算。
          投げの有効射程を拡大(LOAD_RANGE 150→300)=砲まで近づかなくても投げやすく。
   rev27: (1)投げの連打をキビキビに(待ち時間 fireCd 0.45→0.06、投げモーション dur 0.22→0.12)
              =連打すればどんどん投げられる(「1つずつ遅い」を解消)。
          (2)投げの有効射程をさらに拡大(LOAD_RANGE 300→900)=下画面のほぼどこからでも投げられる。
          (3)砲弾を全部もっと遅く(まっすぐvx130/やまなりvx210,vy-174,ARC_GRAV108/敵弾120-170)。
              やまなりは放物線を再計算し、遅くても敵の高さへ戻って命中。
   rev28: (1)有効射程を「広すぎ↔狭すぎ」の中間に(LOAD_RANGE 900→500)。
          (2)砲弾を全部ベルトコンベア並みにゆっくり(まっすぐvx55/やまなりvx85,vy-66,ARC_GRAV16/敵弾48-72)。
              ベルトの弾はvx34。やまなりは超スロー放物線を再計算(頂点y≒18で画面内・敵の高さへ戻って命中)。
          (3)投げモーションの「びゅんびゅん」を落ち着かせる(dur 0.12→0.20)。連打の速さ(fireCd 0.06)は据え置き。
   rev29: (1)敵弾が多すぎ→発射間隔を大幅に空けた(fireInterval 1.7/1.25/0.95→5.0/4.0/3.2)。
              弾が超低速で画面に溜まる(常時8〜10発)のを常時2〜3発に。
          (2)【駆け引き復活】敵も「まっすぐ弾🔴」と「やまなり弾🟠」を撃ち分ける(50%ずつ)。
              相殺は同じ高さ同士のみ=まっすぐは➡️まっすぐ砲、やまなりは↗️やまなり砲でしか防げない。
              →やまなり一辺倒だと敵のまっすぐが素通りするので、撃ち分けが必然に(一方的な勝ちを解消)。
          (3)有効射程をほんの少し短く(LOAD_RANGE 500→450)。
   rev30: ボスが弾数少なすぎて弱かった→1→2→3で順当に強くなるよう発射間隔を段階化(fireInterval 5.0/4.0/3.2→5.0/3.2/2.0)。
          rev29は弾速up(48/60/72)と相殺し画面の弾密度がほぼ横ばい(実測2.1/2.4/2.2)だった。→常時弾数を約2.2/3.0/4.4発の階段に。
   rev32: (1)敵の弾を雑魚2ラウンドでさらに減らす(fireInterval 5.0/3.2→6.0/4.2)、ボスだけ少し増やす(2.0→1.8)。
          (2)味方の弾=ベルト上の弾を減らす(5→3個)。(3)代わりにベルトの流れを速く(vx 34→46)=弾は少ないが早く回る。
   rev33: (1)敵の弾数を少しずつ増やして難易度up(fireInterval 6.0/4.2/1.8→4.2/2.9/1.7)。常時弾数を約2.1/3.0/5.1発の階段に。
          (2)ベルトの流れをもう少し速く(vx 46→60)。
   rev37: 撃ち分けが飾りだった問題を根治(AIテストプレイ+桜井メソッドでコーチング)。相殺を高さ判定→種類判定に(a.type===b.type)。
          撃ちまくりの攻撃弾が敵弾を偶然消す穴を塞ぎ、守り=まっすぐ砲/攻め=やまなり砲の撃ち分けが必要に。敵HPは据え置き(上げると防御必須化で戦闘が長すぎ=逆効果だった)。
   rev38: 「ゆるすぎ」(実機FB)→強度up。敵の発射間隔 4.2/2.9/1.7→2.6/1.9/1.2(玉の数)・弾速 48/60/72→100/125/150(ペース)・ベルト 60→85・ベルト弾 3→4。
   rev39: 【デザイン添削の実装】見た目・手応えの改善(ロジックのバランス値は無変更)。
          (1)弾の見分けを「形=種類・色=敵味方」に統一: 自分🔵まっすぐ/🟦やまなり・敵🔴まっすぐ/🟥やまなり(旧🔵🟡/🔴🟠は黄橙が紛らわしく2画面で不一致だった)。砲にも同じ形チップを表示。
          (2)相殺(撃ち分け成功)に「✨ふせいだ!」＋明るい音(coin)=被弾のhit音と耳で区別。(3)命中・被弾にヒットストップ(S.freeze)。
          (4)タイトルを3段の階層に。(5)結果画面はゲーム中UIを隠し、成績(残りHP・撃破数・最高)を表示。(6)砲に台座、下画面に内装ディテール。
   rev40: 【玉の種類を6種に】ベルトに色々な玉が流れてくる→拾って砲に投げると玉の性能で撃つ(BALL_TYPES)。
          🪨ふつう(標準) / 🛡️がんじょう(激遅・威力0・耐久3=敵弾を3回受け止める壁) / ⚡すばやい(速い・弱い) /
          ⚙️てっきゅう(遅い・威力2倍=やまなりで40・耐久2) / 💣ばくだん(命中で周りの敵弾も消すsplash) / 🪞はねかえし(敵弾を敵へ返すreflect・耐久2)。
          各玉: spd=速さ倍率 / dmgMult=威力倍率(基準まっすぐ10・やまなり20) / hp=耐久 / special / weight=出やすさ(強い玉ほどレア)。
          玉種と砲(まっすぐ/やまなり)は独立=例 がんじょうをまっすぐ砲に入れると「敵まっすぐを3回止める壁」。
          やまなり弾は vx/vy/重力を(k, k, k^2)倍で拡縮し、速さを変えても着弾点(敵の高さ)を保つ。飛翔中の見た目は🔵/🟦のまま(耐久>1は残数表示)、玉の種類はベルト/持ち玉/トスで見える。
   rev41: (1)飛んでいる自分の弾を「投げた玉そのまま」の見た目に(🔵/🟦→玉の絵文字🪨🛡️⚡⚙️💣🪞)=何を投げたか一目で分かる。まっすぐ/やまなりは軌道(低い直線/高い弧)で判別。
          (2)敵の弾を読みやすく: 🟥やまなり→🔻(三角)に。🔴まっすぐ(丸)と形をハッキリ分けた。砲チップも受ける敵弾(🔴/🔻)に変更、タイトル凡例も更新。
          (3)弾速の全体倍率 SPEED_SCALE=0.8 を追加(全部の弾を一律に遅く。調整用の1つのつまみ)。やまなりは軌道保持。
   rev42: (1)玉に「強さ①②③」を追加(BALL_TYPESにstr。normal1/swift1/bomb2/mirror2/guard3/iron3)。飛翔中・ベルト・持ち玉に数字表示。
          (2)敵も強さ①②③の攻撃玉(⚫)を投げてくる。敵弾の威力=round別enemyDmg×強さ倍率(1:0.55/2:1.0/3:1.6)、強さ抽選50/35/15。強いほど痛い＆レア→優先して受ける駆け引き。
          (3)色分けをやめ、向きで敵味方を区別(右=自分の玉絵文字 / 左=敵の⚫)。敵弾の🔴/🔻・砲の色チップを撤去。まっすぐ/やまなりは軌道で読む。タイトル凡例更新。
   rev43: (1)rev42の「玉ごとランダムな強さ数字」を撤去(ユーザー本意=強さは"3体の敵"で分ける、の意)。玉の数字表示・pickEnemyStr・強さ倍率を全削除。
          (2)敵の玉の強さ=どの敵か。威力は round別enemyDmg(18/22/26)のまま＋見た目を敵で大きく(⚫サイズ つの団24/きば団30/ボス36)=強い敵ほど大きい玉。
          (3)鉄球⚙️を「重いロマン砲」に: spd 0.55→0.40(もっと遅く)/dmgMult 2.0→3.0(まっすぐ30・やまなり60)/hp 2→1(耐久1)。
          (4)相殺の「✨ふせいだ!」の文字をやめ、打ち落とし音(coin)だけに(文字の連発が邪魔だった)。弾が消える＋明るい音で"打ち落とした"が分かる。
   rev44: (1)【敵も自分と同じ6種の玉を使う】敵の⚫をやめ、ベルトと同じ抽選で🪨🛡️⚡⚙️💣🪞を投げる。敵弾も 速さ(spd)/耐久(hp)/特殊(splash/reflect) を持つ=対称な撃ち合い。威力=round別enemyDmg×min(dmgMult,1.5)(守り/はねかえしは0)。敵弾は少し大きめ34+round*4(向きと大きさで味方30と区別)。
          (2)相殺ループを"双方対称"に改修: 味方はねかえし→敵弾を右へ返す/敵はねかえし→味方弾を左へ返す、味方ばくだん→敵弾を範囲消し/敵ばくだん→味方弾を範囲消し、通常は双方hp-1。splashClear→splashShots(配列を渡す形)に一般化。
          (3)打ち落とし/跳ね返しの音を coin→新SE「ping(ピキーン)」に(emoji-engine.htmlのSEに追加)。「ふせいだ/はねかえし」等の文字popupは廃止(音だけ)。被弾はhit音のまま=耳で区別。
   rev45: (1)はねかえし(mirror)の耐久 2→1(強すぎた=2回跳ね返せたのを1回に)。(2)はねかえしの音を別音に=通常の打ち落とし「ping(ピキーン)」/はねかえし「bounce(ビヨーン)」で区別(engine SEにbounce追加)。
   rev46: (1)はねかえし(mirror)の弾速を盾(guard)と同じ spd0.45 に(1.1→0.45)。(2)盾/鏡/鉄球の出現率↓(weight guard16→8・iron8→4・mirror6→3)=強い玉をレアに。(3)全弾速をもっと遅く(SPEED_SCALE 0.8→0.6)。
   rev47: (1)弾速をさらに遅く(SPEED_SCALE 0.6→0.45)。(2)遅くしたぶん画面に弾が溜まるので発射間隔を空けて数を戻す(fireInterval 2.6/1.9/1.2→5.0/4.0/3.0)=遅いまま・密度は適正に(ボス過密の解消)。※rev47は別チャットの作業。
   rev48: (1)弾速をさらに遅く(SPEED_SCALE 0.45→0.40)。(2)【味方NPC=相棒スライム🟠を追加】自分で玉を拾って砲へ運んで投げる(移動240/投げ間隔0.8)。迎撃したい敵弾(いちばん自陣に近い弾)の種類の砲へ投げて撃ち落とす=**守り専門(ally:true→敵戦車ダメージ0)**。強すぎ(相棒だけでボスまで撃破)を防ぎ、攻撃はプレイヤーの仕事に。相棒は増えた敵弾を捌く盾役。まっすぐ守り専門化+cd1.3。
   rev49: (1)まっすぐ/やまなりの威力差をなくす(DMG_STRAIGHT 10→20=両方20)。(2)相棒NPCを遅く・弱く(ASPD 240→180・投げ間隔cd 1.3→1.8=動き早すぎ/強すぎの解消)。※次段: 玉供給を「ベルト常時」→「滑り台から一定間隔供給→運ぶ」に(DS版準拠。実装方法を提案中)。
   rev50: 【玉の供給をDS版どおり滑り台方式に】ベルト常時4個→左上の滑り台(CHUTE)から一定間隔(SUPPLY_INTERVAL=[1.8,1.5,1.2]秒/ボスほど速く)で1個ドロップ→左下のたまり場(REST_X0/REST_DX、最大SUPPLY_MAX=5)に滑って溜まる→取りに行って右の砲へ運ぶ。拾っても即湧きしない=弾切れの緊張＆往復フェイズ。開始3個作り置き。滑走中は拾えない。相棒はプレイヤーぶんを1個残す(待機2個以上で取りに行く)。※重要: この機能は別チャットと同時実装して定数が二重宣言→構文エラーで壊れていたのを、当チャットが重複ブロックを削除して復旧・検証した(同時編集の事故)。
   rev51: 【球探しフィールドを広げる】DS版の広い部屋に寄せる。上の戦場TOP_H 258→204(BATTLE_Y148・やまなり軌道はそのまま=apex8<TOP_H-10で影響なし)、下の戦車の中BOXを y0 282→218・y1 528→536(高さ246→318px)に拡張。地面描画の開始も180に。広がったぶん要素を離す: やまなり砲y340→310・まっすぐ砲y452→466・たまり場REST_Y498→510・投げボタンy470→492。
   rev53: 【多部屋マップ+2Dスクロール】(ユーザー手描きマップ: たま部屋/エンジン部屋/大砲部屋を廊下でつなぐDS版戦車内部)。BOX(1部屋)を廃止し ROOMS[]（歩ける四角の集合=ワールド座標。この配列でマップの形が決まる）に。当たり判定 clampToRooms(近い部屋の縁へ寄せる=廊下で詰まらない)、カメラ updateCamera(自分に追従・WORLD外接矩形でクランプ)、S.cam を追加。移動/相棒/pointerをワールド座標＆部屋クランプに。描画は戦車内部を _ctx.clip(表示窓)+translate(-cam)で囲みワールド座標で部屋床・滑り台・大砲・玉・スライムを描く→restoreで画面固定UI(案内・投げボタン・**ミニマップ**=部屋全体+自分/相棒/砲/玉/視野枠)。CHUTE/REST/CANNONをワールド座標へ移設(たま部屋/大砲部屋)、開始位置は左上たま部屋。※ctxは document.querySelector('#cv') で取得(engineと同一)。★形の微調整はROOMS配列と要素座標(定数)を編集するだけ=実機を見て寄せていく。
   rev79: 【被弾を穏やかに＋効果音とBGMの音量バランス(ユーザー「効果音がBGMに対してでかすぎ／岩で25・スピード玉で8食らう」)】(1)敵の威力enemyDmg 18/22/20→12/13/14(全ラウンド)。玉のdmgMultは不変。敵弾ダメージ=enemyDmg×玉dmgMult=岩12〜14・速3.6〜4.2に(被弾25/8→穏やかに)。※プレイヤーの玉の威力(DMG20×dmgMult=岩20・速6)は不変。(2)音量: BGMを上げ(bass0.05→0.09・mel0.028→0.05・kick0.04→0.06)、頻繁な効果音を下げ(jump0.2→0.13・hit0.2→0.16・boom0.3→0.2)=効果音がBGMを潰さないように。※engine(emoji-engine.html)側の変更。
   rev78: 【3ステージ目(ボス)を弱く＋投げをスラもり風の"進行方向ぽいっと"に】(ユーザー「3ステージ目強すぎ・玉の攻撃力は変えないで／投げボタンでスラもり風に進行方向へぽいっと・要らない回復玉を捨てたい」)。(1)ボスだけ弱く: enemyDmg 26→20・fireInterval 1.5→1.9(玉のdmgMultは不変=攻撃力いじらず敵側だけ)。(2)投げをp.face(進行方向)基準に: 進行方向の先(内積>0.2)にLOAD_RANGE以内の砲があればそこへ装填、なければ進行方向へ投げて"捨てる"(discardトス=着弾で発射せず消える)。=要らない回復玉等を処分できる。p.faceは移動時に更新・reset/startRoundで右初期化。案内文更新。※旧throwBall(最寄り砲へ自動装填・遠いと近づけ)は廃止。
   rev76: 【いがぐりを遅く＋メタルの動きを自然化】(1)🌰いがぐり spd 0.7→0.5(遅く)。(2)★メタルの fly を「往復パトロール(不自然)」→「戦車から前へまっすぐ飛んでいく」に変更(METAL_FLY_SPD70)。敵弾に当たれば反射して落下、反射せず敵陣近く(METAL_MAXX430→740)まで飛び切ったらそこで落下。=止まる/往復せず、ちゃんと飛んでから戻る自然な動きに。※勇者の剣・メタルキングの盾(1バトル1回)はCodexが別途追加。
   rev75: 【新玉6種】🌰いがぐり(低速・低威力・耐久2)、🎭モシャス(相殺した敵弾の見た目/specialを一度だけコピー)、🧿ルカニ(次の1発だけ1.4倍)、🚀ロケット(鈍足から加速)、🐍へび(蛇行して敵前で収束)、🪃ブーメラン(命中後に帰還し帰路で敵弾を1発迎撃)を追加。複雑な5種は敵抽選から除外。
   rev74: 【バグ2＋調整3(ユーザー)】(1)★ミラー反射のバグ修正: reflectEnemyToMy/reflectMyToEnemy が やまなり弾の縦速度を残し"変な方向へ飛んで地面で消える"→まっすぐ右/左の直線(90*SPEED_SCALE)で返す(絵文字・威力は元のまま)。(2)★メタルが"中心で止まる"対策: fly中に前で止まって待つ→METAL_LAUNCH+16〜METAL_MAXXを62px/秒でゆっくり往復パトロール(反射した時だけ落下は維持)。relaunchでdirリセット。(3)ボスの弾速が速すぎ不平等→shotSpeed 150→125。(4)装填(供給)速すぎ→SUPPLY_INTERVAL 1.0/0.8/0.6→1.6/1.3/1.0。(5)主人公の足 350→400。※玉6種(ルカニ/いがぐり/モシャス/ロケット/へび/ブーメラン)はCodexが別途追加。
   rev73: 【スピード玉を弱く＋供給の"ぴっぴっ"音を廃止＋戦闘BGM追加】(1)⚡swiftの攻撃力が高すぎ→dmgMult 0.5→0.3(速いぶん弱い玉に)。(2)玉の供給ごとに鳴っていた `g.se("click")`(=ぴっぴっ音。供給が速く連続でうるさい)を廃止。(3)戦闘BGM: エンジン(emoji-engine.html)に内蔵シンセのBGMループ機構を追加(`g.bgm("battle")`で開始/`g.bgm(false)`で停止。Am系オスティナート16ステップ+控えめメロ+軽いキック)。daisenshaはstartRoundで開始・敗北/全クリアで停止・engineのbackToMenuでも停止。
   rev72: 【芝生の入口を"たま(下)部屋の右端(右下)"へ付け替え】rev71は芝生を大砲部屋(右上)に直結させていたのが誤り(ユーザー指摘「大砲部屋に直結させてどうする。右下に作れ」)。芝生を たま(下) x[1070,1120]・y[690,900]重ねで地続きに移動(x1070..2300,y690..900)。TANK_DOOR(1130,795)/ENEMY_TANK(2210,790)も右下へ。playerOutside判定を INTERIOR.x1超え→芝生部屋の中に居るか(GRASS)に修正。ミニマップINTERIOR基準・外バー・段階1メタルは無変更。
   rev71: 【芝生・段階2＝プレイヤーが歩ける＋ミニマップをINTERIOR基準に】大砲部屋の右へ地続きの芝生を追加し、敵戦車の入口まで歩けるようにした。ミニマップ本体は戦車内部だけの縮尺を維持し、芝生上の位置は直下の「外(芝生)」バーに表示。
   rev70: 【外フィールド・上画面方式】メタルの戻りを fly→fall→walkOutside(上画面の芝生を左へ歩く)→walkInside(既存の入口・通路から大砲へ)に分割。芝生は既存の上画面の丘を使い、味方戦車の右横に入口ドアを追加。ROOMS/WORLD/カメラ/ミニマップは変更せず、プレイヤーの外出は未実装。fallは引き続き反射した時だけ。
   rev69: 【メタルの戻りを"戦車の中(プレイヤーの玉運びと同じ部屋・通路)を歩いて大砲へ"に修正＋跳ね返してないのに落ちるバグ修正(ユーザー: 入り口は別(外)でなく中に・玉運ぶのと同じエリア・入り口→通路→大砲を歩いて自分から発射・歩き遅く)】(1)★fallは「跳ね返した時だけ」(rev65-68はflyT>9s等の時間切れでも落ちていた=跳ね返してないのに撃ち落されるバグ→撤去。maxXでは止まって敵弾を待つ)。(2)rev68の"外の芝生を歩く"＋戦場の入口ドアを廃止→戻りは戦車の中: fall後に中の入り口METAL_ENTRANCE(たま上左上160,100)へ→WAYPOINTS_METAL(入口→たま上→上廊下→中央→大砲の5点=プレイヤーの玉運びと同じ部屋・通路)を METAL_ROOM_SPD52(遅く)で歩いて大砲へ→自分から発射。入口の目印/ミニマップ点も中に。METAL_GROUND_Y/METAL_WALK_SPD/METAL_DOOR/METAL_FLY_TMAX 廃止。fly/fall=戦場・walk=下の部屋。
   rev68: 【メタルの戻りを"戦車の外=芝生に落ちて芝生を歩いて戻る"に修正(ユーザー実機スクショ+指摘: 縦シャフトは廃止。入り口から大戦車の外=緑の芝生に出られるようにしたかった)】rev67のシャフト(ROOMS「大砲下」)を削除。メタルの戻りは下の部屋を一切通らず、すべて上画面(戦場)で完結: fly(ミラー速でそっと出て反射)→fall(撃ち落とされ少し右へ弾かれ"芝生"METAL_GROUND_Y190へ落下)→walk(芝生をMETAL_WALK_SPD62でゆっくり左へ歩き戦車の入り口METAL_DOORへ=この戻り歩きが見せ場)→入り口で中へ入りまた発射。戦場に「入口」ドア(戦車右下・芝生に面する)を描画。下の部屋のメタル描画/入口目印/ミニマップ点は撤去。room/loadモード・METAL_ENTRANCE/WAYPOINTS_METAL/METAL_ROOM_SPD/METAL_LOAD_WAIT を全廃。
   rev67: 【メタルの戻りを"大砲部屋の下の別部屋(シャフト)から歩いて上がる"に修正＋装填のため撤去(ユーザー: 装填じゃなく戻ってくる歩きのアニメが肝)】ROOMSに「大砲下」縦シャフト(1150..1330, 330..760・大砲部屋とy330-360重ね)を追加。METAL_ENTRANCEをシャフトの底(1240,705)に、WAYPOINTS_METALを 底→シャフト中→大砲(1250,250)の3点=歩いて上がる。room到着で即発射(rev66のload=装填ためモードは撤去=ユーザー明確に不要)。撃ち落とされ落下→シャフト底の入口→シャフトを歩いて大砲へ上がり→発射の"戻り歩き"を見せる。戻りが下から長い(≒6s)ぶん出ずっぱりも抑わり緊迫感も自然に確保。入口目印/ミニマップもシャフト底へ。
   rev66: 【メタルの入り口を"大砲部屋の下"へ移動＋爆弾に爆破エフェクト＋爆弾は盾の耐久無視で撃ち落とす(ユーザー3点)】(1)メタルの戻り: 入り口を たま上上部(250,110)→**大砲部屋の下(METAL_ENTRANCE 1250,352)**へ。撃ち落とされ落下→大砲部屋の下の入り口から入り、WAYPOINTS_METAL(入口→大砲1250,250の2点)を歩いて大砲まで戻り、また発射。長い迷路巡回をやめ大砲直下から入る自然な戻りに(ROOM_SPD70)。入口の目印も大砲部屋の下へ。(2)**ばくだんの爆破エフェクト**: splashShotsにS.explosions push追加(💥+🔶が膨らんで消える0.45秒)。update/draw/init追加。全splash箇所(戦車直撃・空中相殺)で出る。(3)**ばくだんは相手の耐久を無視して撃ち落とす**: 相殺の通常分岐で、当たった相手がsplashなら相手をb.dead/a.dead=true(盾hp3でも一発)＋音をboomに。(4)入り口移動で戻りが短くなりメタルが出ずっぱり→守り鉄壁(被弾0)に戻ったので、大砲での「装填のため」load モード(METAL_LOAD_WAIT6秒・この間は守らない)を追加=出ずっぱり抑制。__dbg実測: 被弾 rev64:0→rev65:36→load無:0→load8s:63→load6s:54(緊迫感復活・丁度良い範囲)。装填の秒で守りの厚みを調整可。「装填中」表示・ミニマップ対応。
   rev65: 【メタルの弾速をミラーと同じ遅さに＋戻りを"下の部屋の入り口→大砲"経由でゆっくりに(ユーザー3点)】(1)飛び出す速さを固定300→ミラー玉と同じ(55×BALL_DEF.mirror.spd0.45×SPEED_SCALE≒15px/s)=そっと出る。出っぱなし防止にMETAL_FLY_TMAX9秒と控えめmaxX430。(2)戻り: 従来「戦場の地面を歩いて戦車へ」→「撃ち落とされたら戦場下端から"下の部屋の入り口"(METAL_ENTRANCE=たま上上部250,110)へ吸い込まれ、WAYPOINTS_METALで大砲部屋までMETAL_ROOM_SPD90=ゆっくり戻り、到着で再発射」。=戻り時間が長くなり守り過剰も緩和。状態: fly/fall(上画面スクリーン座標)→room(下の部屋ワールド座標)。描画は fly/fall=戦場、room=部屋ビュー内(カメラ変換内)で めたる を描き、入口の目印(rect+「⚪入口」)とミニマップ(入口=灰点・戻り中メタル=銀点)も追加。init/resetのS.metalをmode"fly"開始・wp/flyT保持に。
   rev64: 【メタルを"自分から飛び出す反射役"に作り替え＋はねかえしの見た目修正(ユーザー2点)】(1)メタルを相棒配列(玉運び)から外しS.metalで別管理=戦場(上画面スクリーン座標)の反射エンティティに。updateMetalの状態機械: wait(戦車の砲口で待機・METAL_INTERVAL3秒)→fly(まっすぐ飛び出しBATTLE_Yで敵弾を1発ミラー反射)→fall(撃ち落とされヒューンと落下・くるくる回る)→walk(地面METAL_GROUND_Yを戦車へ歩いて帰る)→wait。描画は めたる の見た目でNPCと分かる。**これで守り過剰(rev63で無操作被弾0)を解消**=常時守るのでなく定期反射に。(2)はねかえしの反射を「矢印の謎玉(↪️/↩️にREFLECT_DMG)」→「元の玉のまま向きだけ反転(同じ絵文字e・種類type・威力dmg)」に。共通ヘルパ reflectEnemyToMy/reflectMyToEnemy を新設し、相殺ループのreflectとメタルの反射の両方で使用。REFLECT_DMGは不使用に(定数は残置)。
   rev63: 【3体目のNPC=メタルスライム追加(ユーザー「npcもう1人増やす。個性ほしい。すらもり2準拠」→AskUserQuestionで俊足メタルを選択)】ALLY_DEFSに3体目: e"めたる"(⚪+👀+✨=銀色キラリ)、sta2(下たま)、WAYPOINTS_C(下たま→下廊下→中央→大砲の巡回路7点)、cap1、**spd320(全員で最速=俊足)**、**flex:true**(=固定砲を持たず、投げる瞬間に今いちばん多い敵弾の種類の砲=手薄な方へ投げて両方の穴を埋める遊撃役)。updateAllyの運搬フェーズでdef.flex時はS.enemyShotsのstraight/arc数を数えて多い方の砲/tTypeを選ぶ。末尾wpは両砲の中間(1250,250)でどちらもLOAD_RANGE内。描画/ミニマップ/reset/startRoundは配列ループ済みで自動対応(ミニマップ色は銀#d0d0d8)。タイトル説明を相棒3体に更新。★注意: 俊足の守りが増える=rev61で出した緊迫感が薄まる可能性→要実機確認(薄まれば敵弾さらに増orメタルを少し遅く)。
   rev62: 【でか玉を調整(ユーザー「でか玉の絵文字ぴんとこない/もっと速度ごく遅くしないと強すぎる/エフェクトはいい感じ」)】big玉を: 絵文字🎳→🌑(重い砲弾。ユーザー選択)、spd 0.9→0.3(=特大ダメージ80が強すぎたので弾速をごく遅く=当てるのに時間がかかる弱点で釣り合わせる。横断はSPEED_SCALE0.60でも約68秒級=撃ったら長く待つロマン砲)。dmgMult4.0/splashは維持。タイトル凡例も🌑・「超スロー」に。回復演出(rev61)は好評=変更なし。
   rev61: 【回復の演出＋敵弾増＋NPC全体的に遅く(ユーザー3点)】(1)🌿かいふくの演出: fireCannon heal時に S.healFx を作り、緑💚が戦車の周りをくるっと1周(前半60%)→半透明の大きな💚がふわっと膨らんで消える(後半)。「+N」ポップは1周後(60%)に出す。音は engine SEに新規"heal"(ホイミ風=きらきら上昇+やわらか高音)を追加し g.se("heal")。healFxはstartRound/resetで初期化・updateでタイマー進行。(2)敵弾が少なく緊迫感がない→fireInterval 5.0/4.0/3.0→2.8/2.1/1.5(弾速up済みで横断が速く溜まりにくいので増やせる)。(3)NPCを全体的に遅く: ALLY_DEFS spd A250→175・B140→100(守りが手薄→敵弾が抜けやすく緊迫感。敵弾増と相乗)。
   rev60: 【敵のかいふく撃ちを修正＋弾速を少し速く(ユーザー「相手がかいふくをそのまま玉として撃ってる」「弾速もう少し速め」)】(1)敵の弾抽選を pickEnemyBall(=BALL_TYPESからspecial"heal"を除外したENEMY_BALL_TYPES)に。敵は自分を回復できず🌿は0ダメージのただの玉に見えて変だった→敵は🌿を撃たない(プレイヤー/相棒の供給は全種のまま)。(2)SPEED_SCALE 0.40→0.60(全弾一律に約1.5倍速)。0.40は横断約30秒で攻めが冗長だった。密度=横断時間÷発射間隔なので速い方が画面の弾数も減り読みやすい。まだ遅ければ0.7〜0.8へ。
   rev59: 【球の種類を追加(ユーザー「球の種類もっと増やす。すらもり準拠」)】BALL_TYPESに4種追加(6→10): 🌿heal(かいふく=前に撃たず自分の戦車をHEAL_AMOUNT22回復。fireCannonでspecial"heal"を早期処理しmyShotを出さない)、🎳big(でか玉=spd0.5・dmgMult4.0・splash=超遅い特大の一撃)、☠️poison(どく=命中でS.enemyPoison=POISON_TIME4秒、update毎にPOISON_DPS6/秒で敵HP減)、❄️ice(こおり=命中でS.enemyTimer+=FREEZE_DELAY3秒=敵の次弾を遅らせる)。poison/freezeは味方の攻撃弾(s.dmg>0=プレイヤーのみ)で発動=守り相棒(dmg0)では出ない。敵の毒は描画で☠️点滅。S.enemyPoisonをstartRound/resetで初期化。タイトルの玉凡例を2行に更新。★enemyもこれらを抽選するが、heal=dmg0のdud/poison/iceは敵→味方向きは効果未実装(基礎ダメージのみ)=guard/mirror同様の許容範囲。
   rev58: 【相棒の守る弾を分担(ユーザー「青はやまなり専用、オレンジはまっすぐにしよう」)】ALLY_DEFSにcannon(投げる砲)/tType(弾種)を追加。A(オレンジ)=CANNON_S/straight(まっすぐ弾を守る=従来通り)、B(青)=CANNON_A/arc(やまなり弾を守る=新)。updateAllyの投げをdef.cannon/def.tTypeに(従来CANNON_S/"straight"固定)。WAYPOINTS_B末尾を(1250,300)→(1250,210)=やまなり砲(y200)寄りに。fireCannonは既にally時arcもdmg0で撃てる=味方やまなり弾が敵やまなり弾を種類一致で相殺。タイトル説明を「🟠まっすぐ守り/🔵やまなり守り」に。→敵の2種を2体で分担=プレイヤーは攻め特化に。★守り過剰は継続課題(rev57メモ参照)。
   rev57: 【相棒2体の性格分け＋供給高速化(ユーザー「2個たまらなくても取りに行っておk。1人は1個しか持てない代わり速く、もう1人は3つ持てる代わり遅く。玉の供給もっと速く」)】(1)相棒の拾い条件を≥2→≥1に(1個でも即取りに行く。プレイヤーぶんを残す制約を撤廃=下たまsta2がプレイヤー専用なので可)。(2)ALLY_DEFSにcap(持てる数)/spd(速度)を追加し性格分け: 相棒A(オレンジ)=cap1・spd250(速い・1個ずつ) / 相棒B(青)=cap3・spd140(遅い・3個まとめ運び)。updateAllyを積み込みフェーズ(wp0で満杯or玉切れまで拾ってから出発)対応に再構成、末尾で1個ずつ投げる(投げ間隔1.8→0.8で居座り短縮)。(3)供給間隔を速く(3.0/2.5/2.0→1.0/0.8/0.6)。__dbg実測: 両相棒t=1移動・停止0%・A速B遅の差・B最大3個持ち確認。
   rev56: 【相棒NPCが「動かない」の修正(ユーザー実機「npcたち なんも動かん」)】原因=相棒は担当部屋に玉が"2個以上"たまってから拾いに動く設計で、rev54で供給を遅くしたため開始直後は各部屋1個しかなく、相棒A約3秒/相棒B約7秒じっと突っ立っていた(実機で数秒見ると「動かない」に見える)。対策2点: (1)startRoundで各供給場所に開始時"2個ずつ"置く(1→2)=開始から≥2で即拾える。(2)相棒2体は開始時から玉を1個持って出発(carry初期値=🪨normal)=最初のコマから大砲へ運び始め突っ立ち時間ゼロ。※閾値≥2(プレイヤーぶき1個残す)は維持。__dbg実測: t=1で両相棒とも移動開始を確認。
   rev55: 【相棒NPCを2体に(ユーザー「npcもう1体増やそうか」→役割は"守りをもう1体"を選択)】単一のS.ally/updateAlly/WAYPOINTSを一般化: ALLY_DEFS[](e見た目/sta担当玉部屋/wps巡回路/初期位置/mcミニマップ色)＋S.allies配列に。updateAllies(g,dt)が全員を updateAlly(g,dt,al,def) で回す。相棒A=オレンジ(既存/sta0左上たま→上廊下→中央→大砲)、相棒B=青🔵(新/sta1左下エンジン→左廊下→たま上→上廊下→中央→大砲=WAYPOINTS_B)。両者とも守り専門(まっすぐ砲・ダメージ0)なので敵は倒せない=プレイヤーの攻めの出番は残る(バランス維持)。各相棒は担当staの玉だけ拾い、プレイヤーぶん1個残す(≥2)。下たま(sta2)はどの相棒も拾わない=プレイヤー専用。描画/ミニマップも配列ループ・色分け。タイトル説明を「🟠🔵相棒2体が守りを手伝う」に。※弾速・強さの再調整は継続宿題。
   rev54: 【玉の供給を3箇所に+供給スピード減+相棒の"固まって動かない"バグ修正】(1)単一のCHUTE/REST_X0/REST_Yを廃止しSUPPLIES[](chute/rx0/ry×3=左上たま・左下エンジン・下たま)に。玉に sta(供給場所0..2)を持たせ slotPos/freeSlot/supplyBall/描画を場所別に。供給タイマーは1回1個・場所を順番に回す(supplyIdx)。(2)供給間隔を遅く(SUPPLY_INTERVAL 1.8/1.5/1.2→3.0/2.5/2.0=場所が増えたぶんゆっくり)。(3)★相棒NPCが動かないバグ=rev53の多部屋化で相棒が目標へ直線移動し壁に詰まっていた。WAYPOINTS[](廊下沿いの巡回路5点)を追加し、空なら先頭(左上たま)へ戻って玉を拾い→持てば末尾(大砲部屋)へ運んでまっすぐ砲へ守り投げ、と巡回路をたどるように全面書き換え(al.wp=現在地)。相棒が拾うのは左上たま(sta0)のみ・プレイヤーぶん1個残す。※弾速(SPEED_SCALE 0.40=やや遅い)と相棒の強さの再調整はマップ確定後に。
===================================================== */
(function(){
"use strict";

EmojiEngine.defineEmoji("スライム", [
  { e: "🟢", s: 1.0 },
  { e: "👀", dy: -14, s: 0.42 },
]);
EmojiEngine.defineEmoji("あいぼう", [   // rev48: 味方NPC=相棒スライム(オレンジ)。プレイヤー(緑)と見分ける
  { e: "🟠", s: 1.0 },
  { e: "👀", dy: -14, s: 0.42 },
]);
EmojiEngine.defineEmoji("あいぼう2", [  // rev55: 2体目の相棒スライム(青)。相棒A(オレンジ)と見分ける
  { e: "🔵", s: 1.0 },
  { e: "👀", dy: -14, s: 0.42 },
]);
EmojiEngine.defineEmoji("めたる", [    // rev63: 3体目=メタルスライム(銀色・キラリ)。スラもり2準拠。俊足の遊撃役
  { e: "⚪", s: 1.0 },
  { e: "👀", dy: -14, s: 0.42 },
  { e: "✨", dx: 26, dy: -22, s: 0.42 },
]);

// ---- 上画面(戦場) ----
const TOP_H    = 204;       // rev51: 上画面(戦場)を低く(258→204)して、下の「戦車の中(球探しフィールド)」を広げる
const BATTLE_Y = 148;       // まっすぐ弾が飛ぶ高さ
const MY_TANK  = { x: 112, y: 150 };
const ENEMY_X  = 852;
const ARC_GRAV = 16;    // rev28: やまなり弾の重力。vx85/vy-66に合わせ超スロー放物線を再計算(敵の高さBATTLE_Yへ戻って命中)

// ---- 下画面(戦車の中): rev53 DS版どおり「多部屋マップ+2Dスクロール」 ----
const VIEW_TOP = TOP_H + 14;                 // 戦車の中の表示領域の上端(画面座標)。ここから下がスクロール窓
const VIEW_W = 960, VIEW_H = 540 - VIEW_TOP; // スクロール窓の大きさ(画面上)
// 歩ける部屋(四角の集合=ワールド座標)。★この配列を書き換えれば部屋の形を自由に変えられる(手描きマップに寄せる用)
// ★接続部は「辺で接する」でなく必ず重ねる(マージン14の2倍以上=50px重ね)。でないと隙間で渡れない
const ROOMS = [
  { x0: 80,   y0: 60,  x1: 470,  y1: 340, name: "たま(上)" },   // 左上「たま」部屋: 玉の滑り台+たまり場
  { x0: 420,  y0: 160, x1: 720,  y1: 300, name: "廊下(上)" },   // 上の廊下(たま部屋→中央) ※たまと x[420,470]重ね
  { x0: 670,  y0: 80,  x1: 1080, y1: 390, name: "中央" },       // 中央部屋 ※廊下(上)と x[670,720]重ね
  { x0: 1030, y0: 120, x1: 1440, y1: 360, name: "大砲" },       // 右上「大砲」部屋 ※中央と x[1030,1080]重ね
  { x0: 170,  y0: 290, x1: 370,  y1: 680, name: "廊下(左)" },   // 左の縦廊下 ※たまと y[290,340]重ね
  { x0: 50,   y0: 620, x1: 470,  y1: 950, name: "エンジン" },   // 左下「エンジン」部屋 ※廊下(左)と y[620,680]重ね
  { x0: 800,  y0: 340, x1: 1000, y1: 700, name: "廊下(下)" },   // 中央→下の縦廊下 ※中央と y[340,390]重ね
  { x0: 350,  y0: 640, x1: 1120, y1: 950, name: "たま(下)" },   // 下「たま」部屋 ※廊下(下)と y[640,700]・エンジンと x[350,470]重ね
  // rev72: 芝生の入口を「たま(下)部屋の右端(右下)」に付け替え(大砲部屋直結は誤り)。たま下と x[1070,1120]・y[690,900]を重ねて地続きに
  { x0: 1070, y0: 690, x1: 2300, y1: 900, name: "芝生", grass: true },
];
const WORLD = ROOMS.reduce((w, r) => ({ x0: Math.min(w.x0, r.x0), y0: Math.min(w.y0, r.y0), x1: Math.max(w.x1, r.x1), y1: Math.max(w.y1, r.y1) }),
                          { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 });   // ワールド外接矩形(カメラのクランプ用)
// rev71: ミニマップ用の「戦車の中だけ」の外接矩形。WORLD/カメラは芝生を含む従来計算のまま
const INTERIOR = ROOMS.filter(r => !r.grass)
  .reduce((w, r) => ({ x0: Math.min(w.x0, r.x0), y0: Math.min(w.y0, r.y0), x1: Math.max(w.x1, r.x1), y1: Math.max(w.y1, r.y1) }),
          { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 });
const TANK_DOOR = { x: 1130, y: 795 };    // rev72: 自分の戦車の入口=たま(下)部屋の右端(右下)。ここから芝生へ出る
const ENEMY_TANK = { x: 2210, y: 790 };   // rev72: 芝生右端の敵戦車と入口(敵戦車の中は作らない)
const GRASS = ROOMS.find(r => r.grass);   // rev72: 芝生の部屋(プレイヤーが外に居るかの判定用)

const CANNON_A = { x: 1300, y: 200, r: 46, type: "arc" };      // やまなり砲(攻め)= 右上の大砲部屋(ワールド座標)
const CANNON_S = { x: 1300, y: 300, r: 46, type: "straight" }; // まっすぐ砲(守り)
const THROW_BTN = { x: 70, y: 502, r: 40 };                   // なげるボタン(画面固定UI・左下)
const SWORD_BTN = { x: 155, y: 502, r: 32 };                  // rev77: 勇者の剣(画面固定UI)
const SHIELD_BTN = { x: 235, y: 502, r: 32 };                 // rev77: メタルキングの盾(画面固定UI)
const LOAD_RANGE = 260;   // rev53: 砲部屋に入って砲の近くで投げる距離(部屋が広くなったので実質「砲部屋で投げる」)
const CANNON_NEAR = 230;  // rev80: この距離まで砲に近ければ、進行方向がずれていても装填する(近くはストレス軽減で今まで通り発射)

// ---- 玉の供給(rev50/53): 左上「たま」部屋の滑り台から供給→たまり場に溜まる→取りに行って運ぶ ----
// rev54: 玉の供給場所を3箇所に(左上たま・左下エンジン・下たま)。そのぶん供給はゆっくり(下のSUPPLY_INTERVAL)
const SUPPLIES = [
  { chute: { x: 150, y: 110 }, rx0: 120, ry: 300 },   // 左上「たま」部屋
  { chute: { x: 150, y: 690 }, rx0: 100, ry: 885 },   // 左下「エンジン」部屋
  { chute: { x: 480, y: 700 }, rx0: 440, ry: 905 },   // 下「たま」部屋
];
const REST_DX = 46, SUPPLY_MAX = 4;                // 1箇所あたりの待機スロット数
const SUPPLY_INTERVAL = [1.6, 1.3, 1.0];           // rev74: 装填(供給)が速すぎ→1.0/0.8/0.6を少し遅く。1回につき1箇所へ1個・場所は順番に回す
// rev54/55: 相棒(NPC)の巡回路。迷路を直線移動で詰まるのを防ぐため、廊下沿いの点を順にたどる。末尾=大砲部屋(まっすぐ砲の近く)
const WAYPOINTS_A = [   // 相棒A(オレンジ): 左上たま(sta0)→上廊下→中央→大砲
  { x: 200, y: 300 },   // 0: 左上たま(玉を拾う)
  { x: 320, y: 230 },   // 1
  { x: 570, y: 230 },   // 2: 上の廊下
  { x: 880, y: 240 },   // 3: 中央
  { x: 1250, y: 300 },  // 4: 大砲部屋
];
const WAYPOINTS_B = [   // rev55: 相棒B(青): 左下エンジン(sta1)→左廊下→たま上→上廊下→中央→大砲
  { x: 250, y: 870 },   // 0: 左下エンジン(玉を拾う)
  { x: 270, y: 650 },   // 1: 左廊下の下端(エンジンと重なる所)
  { x: 270, y: 400 },   // 2: 左廊下
  { x: 270, y: 315 },   // 3: 左廊下↔たま上の重なり
  { x: 350, y: 230 },   // 4: たま上
  { x: 570, y: 230 },   // 5: 上の廊下
  { x: 880, y: 240 },   // 6: 中央
  { x: 1250, y: 210 },  // 7: 大砲部屋(rev58: やまなり砲CANNON_A y200の近くへ。まっすぐ砲は下y300)
];
// 各相棒の設定: e=見た目, sta=担当の玉供給場所, wps=巡回路, x0/y0=初期位置, mc=ミニマップ色, cap=持てる数, spd=移動速度, cannon=投げる砲, tType=撃つ弾の種類
// rev57: 性格分け(A=速い/1個, B=遅い/3個)。rev58: 守る弾の種類も分担 — A(オレンジ)=まっすぐ砲でまっすぐ弾を守る / B(青)=やまなり砲でやまなり弾を守る
// ※rev63で3体目メタルを玉運びで足したが、rev64でメタルは「戦車から自分で飛び出す反射役」に作り替え=相棒配列から外しS.metalで別管理(下の updateMetal)
const ALLY_DEFS = [
  // rev61: NPCを全体的に遅く(A 250→175, B 140→100)。守りが手薄になり敵弾が抜けやすくなる=緊迫感が出る(敵弾増と合わせて)
  { e: "あいぼう",  sta: 0, wps: WAYPOINTS_A, x0: 300, y0: 300, mc: "#ff9800", cap: 1, spd: 175, cannon: CANNON_S, tType: "straight" },
  { e: "あいぼう2", sta: 1, wps: WAYPOINTS_B, x0: 250, y0: 870, mc: "#29b6f6", cap: 3, spd: 100, cannon: CANNON_A, tType: "arc" },
];
// rev70: メタルスライムの自機反射。飛翔/落下/芝生歩きは上画面(戦場スクリーン座標)、入口から大砲までは下の部屋(ワールド座標)
const METAL_LAUNCH = { x: MY_TANK.x + 34, y: BATTLE_Y };   // 発射位置(戦車の砲口・戦場スクリーン座標)
const METAL_MAXX = 740;          // rev76: 前へ飛んでいく到達点(敵陣近く)。反射せずここまで来たら落下(飛び切ったので不自然でない)
const METAL_FLY_SPD = 70;        // rev76: 前へまっすぐ飛ぶ速さ(止まる/往復はやめた)
const METAL_LAND_X = 700;        // rev70: 撃ち落とされて芝生に着地する上画面x(敵側寄り)
const METAL_GRASS_Y = 190;       // rev70: 上画面の芝生(緑の丘)を歩くy
const METAL_WALK_SPD = 60;       // rev70: 芝生を左へ歩く速さ(px/秒)。戻り歩きを見せるため遅め
const METAL_DOOR_X = 152;        // rev70: 味方戦車の入口の上画面x。ここまで歩いたら中へ入る
// rev69: 撃ち落とされたら戦車の中(プレイヤーが玉を運ぶのと同じ部屋・通路)へ戻る。入り口も中に作る。入り口→通路→大砲まで"歩いて"戻り自分で発射。歩きは遅く
//   walkInsideは下の部屋(ワールド座標)。★fallは「跳ね返した時だけ」(時間切れで勝手に落ちない)
const METAL_ROOM_SPD = 52;       // rev69: 中を大砲へ歩いて戻る速さ(遅く)。この戻り歩きが見せ場
const METAL_ENTRANCE = { x: 160, y: 100 };  // rev69: 入り口=戦車の中「たま(上)」部屋の左上(ワールド座標)。撃ち落とされたらここから入り、通路を通って大砲へ
const WAYPOINTS_METAL = [        // rev69: 入り口→通路→大砲(プレイヤーの玉運びと同じ部屋・通路)。歩いて戻るアニメが肝
  { x: 160,  y: 100 },  // 0: 入り口(たま上・左上)
  { x: 320,  y: 220 },  // 1: たま上
  { x: 570,  y: 230 },  // 2: 上の廊下(通路)
  { x: 880,  y: 240 },  // 3: 中央
  { x: 1250, y: 250 },  // 4: 大砲(ここまで歩いたら自分から入って発射)
];

// HPは数字が見えるよう大きめの値に。ダメージも「10」「20」と出る
const ROUNDS = [
  // rev79: 被弾が大きすぎ(岩で25・スピード玉で8食らう)→敵の威力enemyDmgを下げて数字を穏やかに(玉のdmgMultは不変)。敵弾ダメージ=enemyDmg×玉のdmgMult(岩1.0/速0.3)。目安 岩12〜14・速3.6〜4.2
  { name: "つの団",   enemyHp: 100, fireInterval: 2.8, shotSpeed: 100, enemyDmg: 12 },  // 岩12・速3.6
  { name: "きば団",   enemyHp: 150, fireInterval: 2.1, shotSpeed: 125, enemyDmg: 13 },  // 岩13・速3.9
  { name: "ボス戦車", enemyHp: 200, fireInterval: 1.9, shotSpeed: 125, enemyDmg: 14 },  // 岩14・速4.2(rev78で威力26→20、rev79でさらに14へ)
];
const ENEMY_ARC = { vx: -80, vy: -65 };   // rev29: 敵のやまなり弾。ARC_GRAV=16でBATTLE_Yへ戻り味方戦車に命中(頂点y≒16で画面内)
const DMG_STRAIGHT = 20, DMG_ARC = 20;   // rev49: まっすぐ/やまなりの威力差をなくす(両方20)。玉のdmgMultを掛ける基準値
const SWORD_DMG = 60, SHIELD_DUR = 4;     // rev77: 各ラウンド1回の必殺技
const SPEED_SCALE = 0.60;  // rev60: 弾速の全体倍率を少し速く(0.40→0.60)。0.40は横断30秒級で当たらず攻めが冗長だった=ユーザー「弾速もう少し速め」。全弾一律。やまなりは vx/vy を倍率・重力を倍率^2で拡縮し軌道(着弾点)を保つ。まだ遅ければ0.7〜0.8へ

// ---- 玉の種類(rev40): ベルトに色々な玉が流れてくる。拾って砲に投げると、その玉の性能で撃つ ----
// spd=速さ倍率(基準 まっすぐ55/やまなり85) / dmgMult=威力倍率(基準10/20) / hp=耐久(敵弾を何回受け止めて生き残るか) / special=特殊 / weight=出やすさ
const BALL_TYPES = [
  { key: "normal", e: "🪨", spd: 1.0,  dmgMult: 1.0, hp: 1, special: null,      weight: 44, label: "🪨ふつう" },
  { key: "guard",  e: "🛡️", spd: 0.35, dmgMult: 0.0, hp: 3, special: null,      weight: 8,  label: "🛡️守り3発(遅い)" },   // rev46: 出現率↓(16→8) / rev80: もっと遅く(0.45→0.35)
  { key: "swift",  e: "⚡", spd: 2.3,  dmgMult: 0.3, hp: 1, special: null,      weight: 20, label: "⚡速い" },   // rev73: 攻撃力高すぎ→dmgMult 0.5→0.3(速いぶん弱い玉に)
  { key: "iron",   e: "⚙️", spd: 0.40, dmgMult: 3.0, hp: 1, special: null,      weight: 4,  label: "⚙️重い一撃" },  // rev43:重いロマン砲 / rev46:出現率↓(8→4)
  { key: "bomb",   e: "💣", spd: 0.75, dmgMult: 1.0, hp: 1, special: "splash",  weight: 6,  label: "💣ばくだん" },
  { key: "mirror", e: "🪞", spd: 0.45, dmgMult: 0.0, hp: 1, special: "reflect", weight: 3,  label: "🪞はねかえし" },  // rev45:耐久2→1 / rev46:弾速を盾と同じ0.45・出現率↓(6→3)
  // rev59: スラもり準拠で球を追加(拾って投げると個性が出る)
  { key: "heal",   e: "🌿", spd: 0.7,  dmgMult: 0.0, hp: 1, special: "heal",    weight: 6,  label: "🌿かいふく(自分の戦車を回復)" }, // 投げると敵に当てずに自分の戦車のHPを回復
  { key: "big",    e: "🌑", spd: 0.3,  dmgMult: 4.0, hp: 1, special: "splash",  weight: 4,  label: "🌑でか玉(特大の一撃＋周りの敵弾を巻き込む／ごく遅い)" }, // rev62: 特大ダメージ(dmgMult4=80)が強すぎたので弾速をごく遅く(0.9→0.3)=当てるのに時間がかかる弱点で釣り合わせる。絵文字🎳→🌑(重い砲弾)
  { key: "poison", e: "☠️", spd: 0.9,  dmgMult: 0.5, hp: 1, special: "poison",  weight: 5,  label: "☠️どく(当たると敵がじわじわ減る)" },   // 命中で毒=一定時間HPが減り続ける
  { key: "ice",    e: "❄️", spd: 0.9,  dmgMult: 0.5, hp: 1, special: "freeze",  weight: 5,  label: "❄️こおり(当たると敵の次の一発が遅れる)" }, // 命中で敵の発射を足止め
  // rev75: 新玉6種。強すぎ防止のため低〜中威力・低weight。複雑なspecialは下のENEMY_BALL_TYPESで敵抽選から外す
  { key: "chestnut",  e: "🌰", spd: 0.5,  dmgMult: 0.7,  hp: 2, special: null,        weight: 6, label: "🌰いがぐり(攻守万能・耐久2・ゆっくり)" },   // rev76: 速度 0.7→0.5(遅く)
  { key: "copy",      e: "🎭", spd: 0.8,  dmgMult: 0.45, hp: 1, special: "copy",      weight: 3, label: "🎭モシャス(敵弾を一度だけコピー)" },
  { key: "sap",       e: "🧿", spd: 0.55, dmgMult: 0.25, hp: 1, special: "sap",       weight: 3, label: "🧿ルカニ(当てると敵が次に食らう1発が2倍)" },
  { key: "rocket",    e: "🚀", spd: 1.8,  dmgMult: 0.8,  hp: 1, special: "accel",     weight: 4, label: "🚀ロケット(徐々に加速)" },
  { key: "snake",     e: "🐍", spd: 0.8,  dmgMult: 0.7,  hp: 1, special: "snake",     weight: 4, label: "🐍へび(蛇行して収束)" },
  { key: "boomerang", e: "🪃", spd: 0.65, dmgMult: 0.6,  hp: 1, special: "boomerang", weight: 3, label: "🪃ブーメラン(8の字に飛ぶ)" },
];
const BALL_DEF = {}; BALL_TYPES.forEach(t => { BALL_DEF[t.key] = t; });
const BALL_WEIGHT = BALL_TYPES.reduce((s, t) => s + t.weight, 0);
const REFLECT_DMG = 15;   // はねかえし玉が敵弾を跳ね返して敵に当てたときの威力
const SPLASH_R = 130;     // ばくだん玉が周りの敵弾を巻き込む半径
// rev59: 追加した球の効果量
const HEAL_AMOUNT = 22;   // 🌿かいふく: 自分の戦車のHP回復量
const POISON_DPS = 6;     // ☠️どく: 毒の1秒あたりダメージ
const POISON_TIME = 4;    // ☠️どく: 毒の持続秒数(命中でこの長さにリセット)
const FREEZE_DELAY = 6.0; // ❄️こおり: 命中したとき敵の次の発射を遅らせる秒数(rev80: 3→6でもっと止める)
const SAP_TIME = 5.0;     // 🧿ルカニ: 次弾被ダメージ増加の有効時間(非重複)
const SAP_MULT = 2.0, SAP_MAX_MULT = 2.0; // 🧿ルカニ: 当てた相手が次に受ける1発だけ2倍(rev80: 1.4→2.0)
const ROCKET_START = 0.25, ROCKET_ACCEL = 0.45; // 🚀: 最高速の25%から毎秒45%ずつ加速。最高spd1.8は⚡swift2.3未満
const SNAKE_AMP = 40, SNAKE_WAVE = 0.09, SNAKE_CONVERGE = 160; // 🐍: 蛇行幅・波長・敵前で収束(rev80: 幅18→40・波長0.075→0.09でもっと激しく)
const BOOM_AMP = 32, BOOM_FREQ = 6.0, BOOM_FWD = 70; // 🪃rev80: 8の字に動きながら前進(帰還・迎撃は廃止)。振れ幅・周期・前進速度
// rev43: 玉の「強さ」は敵ごと(つの団=1/きば団=2/ボス=3)。ダメージは round別 enemyDmg、見た目は敵が進むほど玉を大きく(下のENEMY_BALL_SIZE)

let S;

function pickBallType(g){
  // 出やすさ(weight)で1種類を抽選(プレイヤー/味方の供給用=全種)
  let r = g.rand(0, BALL_WEIGHT);
  for (const t of BALL_TYPES){ if (r < t.weight) return t; r -= t.weight; }
  return BALL_TYPES[0];
}
// rev75: 敵は従来の単純玉＋いがぐりだけ。敵側で破綻しうる複雑な新specialと、従来どおり回復を抽選から外す
// rev80: 敵が撃たない玉(キーで指定)。薬草(回復)・複雑special・特大威力(重い一撃/でか玉)は敵は使わない
const ENEMY_EXCLUDED_KEYS = new Set(["heal", "copy", "sap", "rocket", "snake", "boomerang", "iron", "big"]);
const ENEMY_BALL_TYPES = BALL_TYPES.filter(t => !ENEMY_EXCLUDED_KEYS.has(t.key));
const ENEMY_BALL_WEIGHT = ENEMY_BALL_TYPES.reduce((s, t) => s + t.weight, 0);
function pickEnemyBall(g){
  let r = g.rand(0, ENEMY_BALL_WEIGHT);
  for (const t of ENEMY_BALL_TYPES){ if (r < t.weight) return t; r -= t.weight; }
  return ENEMY_BALL_TYPES[0];
}

// rev54: 玉の供給(滑り台方式・3箇所)。sta=供給場所(0..2), slot=その場所の待機スロット番号。※st は玉のスライド経過時間(別物)なので混同注意
function slotPos(sta, slot){ const s = SUPPLIES[sta]; return { x: s.rx0 + slot * REST_DX, y: s.ry }; }
function freeSlot(sta){                           // 供給場所staの空きスロット番号(無ければ-1=満杯)
  const used = {};
  for (const b of S.balls){ if (!b.taken && b.sta === sta && b.slot != null) used[b.slot] = 1; }
  for (let i = 0; i < SUPPLY_MAX; i++){ if (!used[i]) return i; }
  return -1;
}
// 玉を1個作る。atRest=true=たまり場に直置き(開始時) / false=滑り台の口から出してスロットへ滑らせる
function supplyBall(g, sta, slot, atRest){
  const t = pickBallType(g), rp = slotPos(sta, slot), ch = SUPPLIES[sta].chute;
  if (atRest) return { x: rp.x, y: rp.y, r: 18, e: t.e, bt: t.key, sta: sta, slot: slot, sliding: false };
  return { x: ch.x, y: ch.y, r: 18, e: t.e, bt: t.key, sta: sta, slot: slot, sliding: true, sx: ch.x, sy: ch.y, tx: rp.x, ty: rp.y, st: 0, sdur: 0.5 };
}

function popup(x, y, text, color){ S.popups.push({ x, y, text, color, life: 0.9 }); }

// ばくだん玉: 中心xの半径内にある弾(渡された配列=味方でも敵でも)を巻き込んで消す。rev44: 敵味方どちらのばくだんにも使えるよう一般化
function splashShots(shots, x){
  // rev66: ばくだんの爆破エフェクト(💥が膨らんで消える)を出す。範囲内の相手の弾を巻き込む
  if (S.explosions) S.explosions.push({ x: x, y: BATTLE_Y, t: 0, dur: 0.45 });
  for (const s of shots){
    if (!s.dead && Math.hypot(s.x - x, s.y - BATTLE_Y) < SPLASH_R) s.dead = true;
  }
}
// rev64: はねかえし=「同じ玉のまま向きだけ変える」(旧: ↪️/↩️の矢印の謎玉を新規生成していたのをやめる)。
//   敵弾b→味方の弾(右向き)/味方弾a→敵の弾(左向き)。絵文字(e)・種類(type)・威力(dmg)はそのまま。特殊は消して無限反射を防ぐ
// rev74: 反射はまっすぐの直線で返す(敵弾→味方は右へ/味方弾→敵は左へ)。旧はやまなり弾の縦速度をそのまま残していて"変な方向へ飛んで地面で消える"バグだった。絵文字(e)・威力(dmg)は元のまま
function reflectEnemyToMy(b){
  return { x: b.x, y: BATTLE_Y, vx: 90 * SPEED_SCALE, vy: 0, type: "straight", r: 13, dmg: b.dmg, hp: 1, special: null, e: b.e, copyLocked: b.copyLocked || b.special === "copy" };
}
function reflectMyToEnemy(a){
  return { x: a.x, y: BATTLE_Y, vx: -90 * SPEED_SCALE, vy: 0, type: "straight", r: 13, dmg: a.dmg, hp: 1, special: null, e: a.e, copyLocked: a.copyLocked || a.special === "copy" };
}

// rev53: 多部屋マップの当たり判定。どれかの部屋(四角)の中ならそのまま、外なら「いちばん近い部屋の縁」へ寄せる(廊下でつながっているので詰まらない)
function clampToRooms(x, y, m){
  m = m || 14;   // 壁からのマージン(スライムの半径ぶん)
  for (const r of ROOMS){ if (x >= r.x0+m && x <= r.x1-m && y >= r.y0+m && y <= r.y1-m) return { x, y }; }
  let best = null, bd = 1e18;
  for (const r of ROOMS){
    const cx = Math.max(r.x0+m, Math.min(x, r.x1-m)), cy = Math.max(r.y0+m, Math.min(y, r.y1-m));
    const d = (cx-x)*(cx-x) + (cy-y)*(cy-y);
    if (d < bd){ bd = d; best = { x: cx, y: cy }; }
  }
  return best || { x, y };
}
// カメラを自分に追従(ワールド外接矩形の中でクランプ)。camは「表示窓の左上に来るワールド座標」
function updateCamera(){
  const tx = S.player.x - VIEW_W/2, ty = S.player.y - VIEW_H/2;
  S.cam.x = g_clamp(tx, WORLD.x0, Math.max(WORLD.x0, WORLD.x1 - VIEW_W));
  S.cam.y = g_clamp(ty, WORLD.y0, Math.max(WORLD.y0, WORLD.y1 - VIEW_H));
}
function g_clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }

function startRound(g, idx){
  const r = ROUNDS[idx];
  S.round = idx;
  S.enemyMaxHp = r.enemyHp; S.enemyHp = r.enemyHp;
  S.myMaxHp = 100; S.myHp = 100;
  // rev56: 開始時に各供給場所へ2個ずつ置く(相棒は「2個以上たまってから」拾う設計→1個だと開始数秒じっとして「動かない」に見えた対策)
  S.balls = []; for (let sta = 0; sta < SUPPLIES.length; sta++) for (let slot = 0; slot < 2; slot++) S.balls.push(supplyBall(g, sta, slot, true));
  S.supplyTimer = SUPPLY_INTERVAL[idx] || 2.5; S.supplyIdx = 0;   // rev54: 供給場所を順番に回すための番号
  S.myShots = []; S.enemyShots = []; S.popups = []; S.tosses = [];
  S.player.carry = []; S.player.x = 250; S.player.y = 250; S.player.face = { dx: 1, dy: 0 };   // rev53/78: 左上「たま」部屋からスタート・初期向きは右
  // rev56: 相棒2体は開始時から玉を1個持って出発(=最初のコマから大砲へ運び始める。突っ立ち時間ゼロ)
  S.allies = ALLY_DEFS.map(d => ({ x: d.x0, y: d.y0, r: 22, carry: [{ e: BALL_DEF.normal.e, bt: "normal" }], cd: 0, wp: 0 }));
  S.metal = { mode: "fly", x: METAL_LAUNCH.x, y: BATTLE_Y, vx: 0, vy: 0, flyT: 0, wp: 0, reflected: false };   // rev64/65/69: メタル反射役(開始は発射から)
  S.explosions = [];   // rev66: ばくだんの爆破エフェクト
  S.swordUsed = false; S.shieldUsed = false; S.shieldTime = 0; S.swordFx = 0;   // rev77: 必殺技はラウンドごとにリセット
  S.enemyTimer = r.fireInterval; S.fireCd = 0; S.throwFlash = null; S.enemyFlash = 0; S.tooFar = 0;
  S.freeze = 0; S.enemyPoison = 0; S.enemySapTime = 0; S.enemySapPending = false; S.healFx = null;   // rev59: どく / rev75: ルカニ / rev61: 回復演出
  S.scene = "play";
  g.bgm("battle");   // rev73: 戦闘BGM開始(内蔵シンセのループ)
  updateCamera();   // rev53: カメラを開始位置へ
}

function reset(g){
  S = {
    scene: "title", round: 0,
    player: { x: 250, y: 250, r: 22, carry: [], face: { dx: 1, dy: 0 } },   // rev78: face=進行方向(投げる向き)
    allies: ALLY_DEFS.map(d => ({ x: d.x0, y: d.y0, r: 22, carry: [], cd: 0, wp: 0 })),   // rev48/54/55: 味方NPC=相棒スライム2体(wp=巡回路の現在地)
    metal: { mode: "fly", x: METAL_LAUNCH.x, y: BATTLE_Y, vx: 0, vy: 0, flyT: 0, wp: 0, reflected: false },   // rev64/65/69: メタル反射役
    explosions: [],   // rev66: ばくだんの爆破エフェクト
    swordUsed: false, shieldUsed: false, shieldTime: 0, swordFx: 0,   // rev77: 必殺技
    cam: { x: 0, y: 0 },   // rev53: スクロールカメラ(表示窓の左上ワールド座標)
    supplyIdx: 0,   // rev54: 供給場所の順番
    myHp: 100, myMaxHp: 100, enemyHp: 100, enemyMaxHp: 100,
    balls: [], myShots: [], enemyShots: [], popups: [], tosses: [],
    enemyTimer: 2, fireCd: 0, throwFlash: null, enemyFlash: 0, tooFar: 0, freeze: 0, enemyPoison: 0, enemySapTime: 0, enemySapPending: false, healFx: null,
    supplyTimer: 0,   // rev50: 玉の供給タイマー
    best: S ? S.best : 0,
  };
}

// 砲が発射: 上画面の味方戦車から弾を撃つ(トスが砲に届いた瞬間に呼ぶ)。rev40: 玉の種類(bt)ごとに速さ/威力/耐久/特殊を反映
function fireCannon(g, type, cx, cy, bt, ally){
  const def = BALL_DEF[bt] || BALL_DEF.normal;
  // rev59: 🌿かいふく玉は前に撃たず、自分の戦車のHPを回復して終わり(スラもりの回復アイテム)
  if (def.special === "heal"){
    const before = S.myHp; S.myHp = Math.min(S.myMaxHp, S.myHp + HEAL_AMOUNT);
    const healed = Math.round(S.myHp - before);
    // rev61: 回復の演出。緑ハートが戦車の周りを1周→半透明ハートがふわっと+ホイミ風の音。数字ポップは1周後に出す(healFx.doneで)
    S.healFx = { t: 0, dur: 0.85, cx: MY_TANK.x - 8, cy: BATTLE_Y + 4, amount: healed, popped: false };
    S.throwFlash = { x: cx, y: cy, t: 0.3 }; g.se("heal");
    return;
  }
  // rev48: 相棒(ally)の弾は「守り専門」=敵戦車ダメージ0(敵弾の相殺だけ担当)。攻撃はプレイヤーの仕事
  const dmg = ally ? 0 : Math.round((type === "straight" ? DMG_STRAIGHT : DMG_ARC) * def.dmgMult);
  const k = def.spd * SPEED_SCALE;   // 玉の速さ倍率 × 全体倍率
  // rev75: special固有の飛翔状態。モシャスは生成時だけcopyReady=trueで、コピー後は再コピー不可
  const extra = {
    copyReady: def.special === "copy",
    copyLocked: false,
    accelScale: def.special === "accel" ? ROCKET_START : 1,
    pathY: BATTLE_Y,
  };
  // rev41: 飛翔中の弾に玉の絵文字(e)を持たせる=投げた玉がそのまま飛んで見える
  if (type === "straight"){
    S.myShots.push({ x: MY_TANK.x + 30, y: BATTLE_Y, vx: 55 * k, vy: 0, type: "straight", r: 13, dmg, hp: def.hp, special: def.special, e: def.e, ...extra });
  } else {
    // やまなり: vx/vy/重力を同じ倍率系(vx*k, vy*k, grav*k^2)で拡縮すると、着弾点(敵の高さ)を保ったまま速さだけ変わる
    S.myShots.push({ x: MY_TANK.x + 30, y: BATTLE_Y, vx: 85 * k, vy: -66 * k, grav: 16 * k * k, type: "arc", r: 13, dmg, hp: def.hp, special: def.special, e: def.e, ...extra });
  }
  S.throwFlash = { x: cx, y: cy, t: 0.3 };
  g.se("boom");
}

// 相棒スライム(味方NPC): rev54 迷路対応=巡回路沿いに動く。★rev53で直線移動が壁に詰まり「固まって動かない」バグだった
//   空なら先頭(担当の玉部屋)へ戻って玉を拾い、持っていれば末尾(大砲部屋)へ運んでまっすぐ砲へ守り投げ。役割は「まっすぐ弾だけ守る(ダメージ0)」
// rev55: 相棒を2体に→ al(状態)とdef(設定=担当玉部屋sta・巡回路wps)を受け取る共通処理に。updateAlliesで全員回す
function updateAllies(g, dt){
  for (let i = 0; i < S.allies.length; i++) updateAlly(g, dt, S.allies[i], ALLY_DEFS[i]);
}
function updateAlly(g, dt, al, def){
  if (al.cd > 0) al.cd -= dt;
  const ASPD = def.spd, cap = def.cap;   // rev57: 移動速度・持てる数は相棒ごと(A=速い/1個, B=遅い/3個)
  const wps = def.wps, last = wps.length - 1;
  const moveTo = (tx, ty, stop) => { const ex = tx - al.x, ey = ty - al.y, d = Math.hypot(ex, ey) || 1; if (d > (stop || 6)){ al.x += ex/d * ASPD * dt; al.y += ey/d * ASPD * dt; } return d; };
  if (al.wp === 0){
    // 先頭(担当の玉部屋)= 積み込みフェーズ。rev57: 1個でも即拾う(≥2待ちをやめた)。満杯まで拾い、満杯 or 玉切れで出発
    const near = S.balls.filter(b => !b.taken && !b.sliding && b.sta === def.sta);
    if (al.carry.length < cap && near.length >= 1){
      let ball = null, best = 1e9;
      for (const b of near){ const dd = Math.hypot(b.x - al.x, b.y - al.y); if (dd < best){ best = dd; ball = b; } }
      moveTo(ball.x, ball.y, 6);
      if (g.hit(al, ball)){ ball.taken = true; al.carry.push({ e: ball.e, bt: ball.bt }); }
    } else if (al.carry.length >= 1){
      al.wp = 1;   // 満杯 or もう玉がない → 大砲へ出発
    }
    // 手ぶら＆玉なし → その場で待つ(供給が速いのですぐ来る)
  } else if (al.carry.length > 0){
    // 運搬フェーズ: 巡回路を末尾(大砲)へ。末尾で持っている玉を1個ずつ担当砲へ投げる(rev58: A=まっすぐ砲 / B=やまなり砲)
    const cannon = def.cannon;
    const d = moveTo(wps[al.wp].x, wps[al.wp].y, 24);
    if (d <= 24 && al.wp < last) al.wp++;
    if (al.wp === last && al.cd <= 0 && Math.hypot(cannon.x - al.x, cannon.y - al.y) < LOAD_RANGE){
      const held = al.carry.pop();
      S.tosses.push({ x: al.x, y: al.y - 26, x0: al.x, y0: al.y - 26, cx: cannon.x, cy: cannon.y, t: 0, dur: 0.20, type: def.tType, e: held.e, bt: held.bt, ally: true });
      al.cd = 0.8;   // rev57: 投げ間隔を詰めて(1.8→0.8)まとめ持ちでも大砲に長く居座らない
    }
  } else {
    // 空で大砲側 → 巡回路を先頭(担当の玉部屋)へ戻る
    const d = moveTo(wps[al.wp].x, wps[al.wp].y, 24);
    if (d <= 24) al.wp--;
  }
  const ac = clampToRooms(al.x, al.y, 14);   // 念のため部屋内に(巡回路は廊下沿いなので普通は当たらない)
  al.x = ac.x; al.y = ac.y;
}

// rev70: メタルスライム=自分から弾丸になって飛び出す反射役
//   fly(★反射した時だけ撃ち落とされる)→fall→walkOutside(上画面の芝生)→walkInside(中の入口・通路→大砲)→fly
//   ※walkInsideへの切替時に m.x,m.y をスクリーン座標からワールド座標へ入れ替える
function updateMetal(g, dt){
  const m = S.metal;
  if (m.mode === "fly"){
    // rev76: 往復パトロール(不自然)をやめ、戦車から前へまっすぐ飛んでいく。敵弾に当たったら反射して撃ち落とされる。反射せず敵陣近く(METAL_MAXX)まで飛び切ったらそこで落下(=ちゃんと飛んだ後なので不自然でない)
    m.x += METAL_FLY_SPD * dt; m.y = BATTLE_Y;   // まっすぐ弾と同じ高さで受け止めながら前進
    for (const b of S.enemyShots){
      if (b.dead) continue;
      if (Math.abs(b.x - m.x) < 26 && Math.abs(b.y - m.y) < 30){
        b.dead = true; S.myShots.push(reflectEnemyToMy(b));   // 同じ玉のまま敵へ返す(ミラーと同じ)
        m.reflected = true; g.se("bounce"); break;
      }
    }
    if (m.reflected || m.x >= METAL_MAXX){ m.mode = "fall"; m.vy = -80; }   // 反射した/飛び切った時に落下
  } else if (m.mode === "fall"){
    m.vy += 460 * dt; m.y += m.vy * dt;   // ヒューンと落ちる
    if (m.y >= METAL_GRASS_Y){             // 上画面の芝生へ着地
      m.mode = "walkOutside"; m.x = METAL_LAND_X; m.y = METAL_GRASS_Y;
    }
  } else if (m.mode === "walkOutside"){
    m.x -= METAL_WALK_SPD * dt;
    m.y = METAL_GRASS_Y;
    if (m.x <= METAL_DOOR_X){
      m.mode = "walkInside"; m.x = METAL_ENTRANCE.x; m.y = METAL_ENTRANCE.y; m.wp = 0;
    }
  } else if (m.mode === "walkInside"){
    const w = WAYPOINTS_METAL[m.wp];
    const ex = w.x - m.x, ey = w.y - m.y, d = Math.hypot(ex, ey) || 1;
    if (d > 10){ m.x += ex/d * METAL_ROOM_SPD * dt; m.y += ey/d * METAL_ROOM_SPD * dt; }
    else if (m.wp < WAYPOINTS_METAL.length - 1){ m.wp++; }
    else { m.mode = "fly"; m.x = METAL_LAUNCH.x; m.y = BATTLE_Y; m.flyT = 0; m.reflected = false; m.dir = 1; g.se("jump"); }   // 大砲に到着→また発射
  }
}

// rev78: 投げは「スラもり風=進行方向へぽいっと」。進行方向の先(内積>0.2)に砲がLOAD_RANGE以内であればその砲へ装填、なければ進行方向へ投げて"捨てる"(要らない回復玉などを処分できる)
function throwBall(g){
  const p = S.player;
  if (p.carry.length === 0 || S.fireCd > 0) return;
  const f = (p.face && (p.face.dx || p.face.dy)) ? p.face : { dx: 1, dy: 0 };   // 進行方向(なければ右)
  // 進行方向の先にある砲を探す(向いている＆射程内)。両砲のうち近い方
  let target = null, tType = null, tBest = 1e9;
  for (const cn of [CANNON_A, CANNON_S]){
    const ax = cn.x - p.x, ay = cn.y - p.y, d = Math.hypot(ax, ay) || 1;
    const near = d <= CANNON_NEAR;                                   // rev80: 近ければ向きは不問(今まで通り発射)
    const aimed = d <= LOAD_RANGE && (ax/d * f.dx + ay/d * f.dy) > 0.2;  // 少し遠いときは進行方向の先にある砲だけ
    if ((near || aimed) && d < tBest){ target = cn; tType = cn.type; tBest = d; }
  }
  const held = p.carry.pop();   // rev40: 投げる玉の種類を持ち回す
  if (target){
    // 砲へ装填(山なりトス→着弾で発射)
    S.tosses.push({ x: p.x, y: p.y - 30, x0: p.x, y0: p.y - 30, cx: target.x, cy: target.y, t: 0, dur: 0.20, type: tType, e: held.e, bt: held.bt });
  } else {
    // 進行方向へぽいっと置く(砲に入らない)。rev80: 消さずその場に残す=拾い直せる(要らない玉を一時的に脇へ置ける)
    const dist = 190;
    S.tosses.push({ x: p.x, y: p.y - 30, x0: p.x, y0: p.y - 30, cx: p.x + f.dx * dist, cy: p.y + f.dy * dist, t: 0, dur: 0.28, e: held.e, bt: held.bt, discard: true });
  }
  S.fireCd = 0.06;   // rev27: 連投の待ち時間を短く=連打でどんどん投げられる
  g.se("jump");
}

EmojiEngine.register({
  id: "daisensha",
  name: "大戦車バトル",
  icon: "🚂",
  desc: "弾を運んで砲に投げ入れ、敵戦車と撃ち合う",

  init(g){ reset(g); this._state = S; },

  update(g, dt){
    if (S.scene === "title"){
      if (g.pressed("action") || g.pointer.justDown){ startRound(g, 0); g.se("click"); }
      return;
    }
    if (S.scene === "roundclear"){
      if (g.pressed("action") || g.pointer.justDown){ startRound(g, S.round + 1); g.se("click"); }
      return;
    }
    if (S.scene === "win" || S.scene === "over"){
      if (g.pressed("action") || g.pointer.justDown){ reset(g); startRound(g, 0); this._state = S; }
      return;
    }

    // ---- 戦闘中 ----
    const p = S.player;
    if (S.shieldTime > 0) S.shieldTime = Math.max(0, S.shieldTime - dt);
    if (S.swordFx > 0) S.swordFx = Math.max(0, S.swordFx - dt);
    if (S.freeze > 0){ S.freeze -= dt; return; }   // ヒットストップ中は更新を止める(描画だけ続く=手応え)
    if (S.fireCd > 0) S.fireCd -= dt;
    if (S.throwFlash){ S.throwFlash.t -= dt; if (S.throwFlash.t <= 0) S.throwFlash = null; }
    if (S.enemyFlash > 0) S.enemyFlash -= dt;
    if (S.tooFar > 0) S.tooFar -= dt;
    // rev59: ☠️どく=一定時間、敵HPがじわじわ減る(毒中は敵を薄紫に点滅させる)
    if (S.enemyPoison > 0 && S.enemyHp > 0){
      S.enemyHp -= POISON_DPS * dt; S.enemyPoison -= dt;
      if (S.enemyHp < 0) S.enemyHp = 0;
    }
    // rev75: 🧿ルカニは重複せず、5秒以内の次の1発だけを増幅
    if (S.enemySapTime > 0){
      S.enemySapTime -= dt;
      if (S.enemySapTime <= 0){ S.enemySapTime = 0; S.enemySapPending = false; }
    }
    // rev61: 回復演出のタイマー。1周(60%)したところで「+N」を出す→終わったら消す
    if (S.healFx){
      S.healFx.t += dt;
      if (!S.healFx.popped && S.healFx.t >= S.healFx.dur * 0.6){
        S.healFx.popped = true;
        if (S.healFx.amount > 0) popup(MY_TANK.x + 20, 96, "+" + S.healFx.amount, "#7CFC98");
      }
      if (S.healFx.t >= S.healFx.dur) S.healFx = null;
    }

    // 移動(部屋の中)。投げボタン(画面固定)を押している間は移動しない
    const onBtn = g.pointer.down && Math.hypot(g.pointer.x - THROW_BTN.x, g.pointer.y - THROW_BTN.y) < THROW_BTN.r;
    const onSwordBtn = g.pointer.down && Math.hypot(g.pointer.x - SWORD_BTN.x, g.pointer.y - SWORD_BTN.y) < SWORD_BTN.r;
    const onShieldBtn = g.pointer.down && Math.hypot(g.pointer.x - SHIELD_BTN.x, g.pointer.y - SHIELD_BTN.y) < SHIELD_BTN.r;
    const onFixedBtn = onBtn || onSwordBtn || onShieldBtn;
    const speed = 400;   // rev74: 主人公の足を少し速く(350→400)
    let dx = g.stickX(), dy = g.stickY();
    if (g.pointer.down && !onFixedBtn && g.pointer.y > VIEW_TOP){
      // rev53: 指/マウスは画面座標→カメラ分を足してワールド座標に直してから向きを取る
      const pwx = g.pointer.x + S.cam.x, pwy = (g.pointer.y - VIEW_TOP) + S.cam.y;
      const ax = pwx - p.x, ay = pwy - p.y, d = Math.hypot(ax, ay);
      if (d > 8){ dx = ax / d; dy = ay / d; }
    }
    const len = Math.hypot(dx, dy);
    if (len > 0){
      p.face = { dx: dx/len, dy: dy/len };   // rev78: 進行方向(投げる向きに使う)。止まっても最後の向きを保つ
      const c = clampToRooms(p.x + dx/len * speed * dt, p.y + dy/len * speed * dt, 14);   // rev53: 部屋の中だけ動ける
      p.x = c.x; p.y = c.y;
    }
    updateCamera();   // rev53: カメラを自分に追従

    // 投げる: スペース(action) か 👊ボタンのタップ
    if (g.pressed("action") || (g.pointer.justDown && onBtn)) throwBall(g);
    // rev77: 画面ボタンで各ラウンド1回だけ発動。剣は即時60ダメージ、盾は4秒無敵
    if (g.pointer.justDown && onSwordBtn && !S.swordUsed){
      S.swordUsed = true; S.swordFx = 0.45; S.enemyHp -= SWORD_DMG; S.enemyFlash = 0.35;
      popup(ENEMY_X - 10, 96, String(SWORD_DMG), "#fff2a0"); g.se("boom");
    }
    if (g.pointer.justDown && onShieldBtn && !S.shieldUsed){
      S.shieldUsed = true; S.shieldTime = SHIELD_DUR; g.se("ping");
    }

    // 相棒NPC(味方・rev55で2体): 自分で拾って砲へ投げて手伝う
    updateAllies(g, dt);
    updateMetal(g, dt);   // rev64: 3体目メタル=戦車から飛び出す反射役

    // トス(弾がスライム→砲へ山なりに飛ぶ)。砲に届いたら発射
    for (const t of S.tosses){
      t.t += dt;
      const pr = Math.min(t.t / t.dur, 1);
      t.x = t.x0 + (t.cx - t.x0) * pr;
      t.y = t.y0 + (t.cy - t.y0) * pr - 60 * Math.sin(pr * Math.PI);
      if (t.t >= t.dur){
        t.done = true;
        if (!t.discard) fireCannon(g, t.type, t.cx, t.cy, t.bt, t.ally);   // rev78: 砲へ装填→発射
        // rev80: 投げ捨てた玉は消さず、その場に「拾い直せる玉」として残す(スラもり風に置ける)。少しの間は自分で拾えない
        else S.balls.push({ x: t.cx, y: t.cy, r: 18, e: t.e, bt: t.bt, taken: false, sliding: false, noPickT: 0.6 });
      }
    }
    S.tosses = S.tosses.filter(t => !t.done);

    // rev54: 玉の供給(滑り台・3箇所)。一定間隔ごとに1個。供給場所は順番に回し、空きのある場所へ落とす
    S.supplyTimer -= dt;
    if (S.supplyTimer <= 0){
      let placed = false;
      for (let k = 0; k < SUPPLIES.length; k++){
        const sta = (S.supplyIdx + k) % SUPPLIES.length, slot = freeSlot(sta);
        if (slot >= 0){ S.balls.push(supplyBall(g, sta, slot, false)); S.supplyIdx = (sta + 1) % SUPPLIES.length; placed = true; break; }   // rev73: 供給ごとの「click」音(=ぴっぴっ音)は供給が速く連続でうるさいので廃止
      }
      S.supplyTimer = placed ? (SUPPLY_INTERVAL[S.round] || 2.5) : 0.4;   // どこも満杯なら少し待って再チェック
    }
    // 玉: 滑り中はスロットへ滑る/待機中はそこで待つ。触れたら拾う(最大3つ)
    for (const b of S.balls){
      if (b.sliding){
        b.st += dt; const pr = Math.min(b.st / b.sdur, 1);
        b.x = b.sx + (b.tx - b.sx) * pr;
        b.y = b.sy + (b.ty - b.sy) * pr;
        if (b.st >= b.sdur){ b.sliding = false; b.x = b.tx; b.y = b.ty; }
      }
      if (b.noPickT > 0) b.noPickT -= dt;   // rev80: 投げ捨て直後の自動拾い直し防止
      if (p.carry.length < 3 && !b.taken && !b.sliding && !(b.noPickT > 0) && g.hit(p, b)){   // rev50: 滑走中は拾えない(たまり場で待機した玉だけ)
        b.taken = true; p.carry.push({ e: b.e, bt: b.bt }); g.se("coin");   // rev40: 玉の種類も持つ
      }
    }
    S.balls = S.balls.filter(b => !b.taken);

    // 自分の弾: 敵戦車に当たったらHPを削る + ダメージ数字
    for (const s of S.myShots){
      if (s.special === "boomerang"){
        // rev80: 🪃は中心を前進させつつ、その周りを8の字(∞)に回りながら敵へ向かう。帰還・迎撃は廃止
        s.boomT = (s.boomT || 0) + dt;
        s.boomBaseX = (s.boomBaseX == null ? s.x : s.boomBaseX) + BOOM_FWD * dt;
        s.x = s.boomBaseX + BOOM_AMP * Math.sin(2 * s.boomT * BOOM_FREQ);   // 横は倍の周期→8の字
        s.y = BATTLE_Y + BOOM_AMP * Math.sin(s.boomT * BOOM_FREQ);          // 縦
      } else {
        // rev75: 🚀は軌道上の時間だけを徐々に速めるため、やまなりの着弾点を保ったまま加速する
        let moveDt = dt;
        if (s.special === "accel"){
          s.accelScale = Math.min(1, (s.accelScale || ROCKET_START) + ROCKET_ACCEL * dt);
          moveDt *= s.accelScale;
        }
        s.x += s.vx * moveDt;
        if (s.type === "arc"){
          s.vy += (s.grav || ARC_GRAV) * moveDt;
          if (s.special === "snake"){
            s.pathY += s.vy * moveDt;
          } else {
            s.y += s.vy * moveDt;
          }
        }
        // 🐍は基準軌道(pathY)の上下を蛇行し、敵戦車の手前SNAKE_CONVERGE pxで中央へ絞る
        if (s.special === "snake"){
          const fade = g_clamp((ENEMY_X - 70 - s.x) / SNAKE_CONVERGE, 0, 1);
          s.y = s.pathY + Math.sin((s.x - MY_TANK.x) * SNAKE_WAVE) * SNAKE_AMP * fade;
        }
      }
      if (!s.dead && s.x > ENEMY_X - 34){
        s.dead = true;
        if (s.special === "splash") splashShots(S.enemyShots, s.x);   // ばくだんは敵の手前でも炸裂
        if (s.dmg > 0){
          // 既にルカニ中なら今回の1発だけ1.4倍(上限もSAP_MULT)。この命中で必ず消費する
          let dealt = s.dmg;
          if (S.enemySapPending && S.enemySapTime > 0){
            dealt = Math.round(s.dmg * Math.min(SAP_MULT, SAP_MAX_MULT));
            S.enemySapPending = false; S.enemySapTime = 0;
          }
          S.enemyHp -= dealt; S.enemyFlash = 0.25; S.freeze = Math.max(S.freeze, 0.06);   // 命中の瞬間に一瞬止める(手応え)
          popup(ENEMY_X - 10, 96, String(dealt), "#ffdb4d"); g.se("boom");
          // rev59: 味方の攻撃弾(dmg>0=プレイヤー)の特殊効果。守り相棒の弾(dmg0)では発動しない
          if (s.special === "poison"){ S.enemyPoison = POISON_TIME; popup(ENEMY_X + 24, 74, "どく!", "#b06cff"); }
          if (s.special === "freeze"){ S.enemyTimer += FREEZE_DELAY; popup(ENEMY_X + 24, 74, "こおり!", "#7fd4ff"); }
          if (s.special === "sap"){ S.enemySapPending = true; S.enemySapTime = SAP_TIME; popup(ENEMY_X + 24, 74, "ルカニ!", "#9d8cff"); }
        }
      }
      if (!s.dead && s.special !== "boomerang" && s.y > TOP_H - 10) s.dead = true;   // やまなりが届かず落ちた(🪃は上下に振れるので除外)
    }
    // 敵の発射(まっすぐ弾🔴 と やまなり弾🟠 を撃ち分ける=同じ種類の砲でしか相殺できない駆け引き)
    S.enemyTimer -= dt;
    if (S.enemyTimer <= 0){
      S.enemyTimer = ROUNDS[S.round].fireInterval;
      // rev80【大原則】玉の威力は敵味方共通・ステージで変化なし。敵弾も 基本威力×dmgMult(味方と同じ計算)
      const eb = pickEnemyBall(g);
      const ek = eb.spd * SPEED_SCALE;   // 玉の速さ×全体倍率
      const edmg = Math.round(DMG_STRAIGHT * eb.dmgMult);
      if (g.rand(0, 1) < 0.5){
        // やまなり弾: 高く弧を描いて味方の低いまっすぐ弾を越える。速さ倍率ekでも vx/vy*ek・grav*ek^2 で着弾点(味方の高さ)を保つ
        S.enemyShots.push({ x: ENEMY_X - 30, y: BATTLE_Y, vx: ENEMY_ARC.vx * ek, vy: ENEMY_ARC.vy * ek, grav: ARC_GRAV * ek * ek, type: "arc", r: 13, e: eb.e, hp: eb.hp, dmg: edmg, special: eb.special });
      } else {
        S.enemyShots.push({ x: ENEMY_X - 30, y: BATTLE_Y, vx: -ROUNDS[S.round].shotSpeed * ek, vy: 0, type: "straight", r: 13, e: eb.e, hp: eb.hp, dmg: edmg, special: eb.special });
      }
    }
    for (const s of S.enemyShots){
      s.x += s.vx * dt;
      if (s.type === "arc"){ s.vy += (s.grav || ARC_GRAV) * dt; s.y += s.vy * dt; }   // rev41: 玉ごとの重力(速さ倍率に対応)
      if (!s.dead && s.x < MY_TANK.x + 30){
        let hurt = (s.dmg != null) ? s.dmg : ROUNDS[S.round].enemyDmg;   // rev44: 威力は玉ごと(敵ごとenemyDmg×dmgMult)。守り/はねかえし玉は0
        s.dead = true;
        if (s.special === "splash") splashShots(S.myShots, s.x);   // 敵ばくだんが味方の陣前で炸裂→味方の弾を巻き込む
        if (S.shieldTime > 0){ hurt = 0; g.se("ping"); }
        if (hurt > 0){
          S.myHp -= hurt;
          S.freeze = Math.max(S.freeze, 0.05);   // 被弾も一瞬止める
          popup(MY_TANK.x + 20, 96, "-" + hurt, "#ff6a6a"); g.se("hit");
        }
      }
      if (!s.dead && s.type === "arc" && s.y > TOP_H - 10) s.dead = true;   // 万一届かず落ちたら消す
    }
    // 相殺: 同じ種類の弾どうしだけ(rev37の撃ち分けの根幹)。rev44: 敵も自分と同じ玉を使うので、双方の耐久(hp)と特殊(ばくだん=範囲/はねかえし=返す)を対称に処理。
    const spawnedMy = [], spawnedEnemy = [];
    for (const a of S.myShots){
      if (a.dead) continue;
      for (const b of S.enemyShots){
        if (b.dead) continue;
        if (a.type === b.type && Math.abs(a.x - b.x) < 22 && Math.abs(a.y - b.y) < 28){
          const mx = (a.x + b.x) / 2;
          let snd = "ping";   // 通常の打ち落とし=ピキーン。はねかえしだけ別音(bounce)
          if (a.special === "copy" && a.copyReady && b.special !== "copy" && !b.copyLocked){
            // rev75: 🎭モシャスは敵弾を消して一度だけ見た目/specialをコピー。威力は自分の基礎値を維持し、コピー後hp=1
            b.dead = true; a.e = b.e; a.special = b.special; a.hp = 1; a.copyReady = false; a.copyLocked = true;
          } else if (a.special === "reflect" && b.special !== "reflect"){
            // 味方はねかえし: 敵弾を「同じ玉のまま向きだけ変えて」敵へ返す(rev64)。味方玉は耐久を1消費して残る
            b.dead = true;
            spawnedMy.push(reflectEnemyToMy(b));
            a.hp -= 1; if (a.hp <= 0) a.dead = true;
            snd = "bounce";
          } else if (b.special === "reflect" && a.special !== "reflect"){
            // 敵はねかえし: 味方弾を「同じ玉のまま向きだけ変えて」味方へ返す(rev64)。敵玉は耐久を1消費して残る
            a.dead = true;
            spawnedEnemy.push(reflectMyToEnemy(a));
            b.hp -= 1; if (b.hp <= 0) b.dead = true;
            snd = "bounce";
          } else {
            // 通常の相殺: 耐久を1ずつ消費(頑丈な玉は複数回受け止める)。ばくだんは周りの"相手の"弾も巻き込む
            // rev66: ばくだんが当たった相手は「耐久を無視して」撃ち落とす(盾hp3でも一発)＋爆破エフェクト＋爆発音
            const aSplash = a.special === "splash", bSplash = b.special === "splash";
            if (aSplash){ splashShots(S.enemyShots, mx); b.dead = true; }
            if (bSplash){ splashShots(S.myShots, mx); a.dead = true; }
            if (aSplash || bSplash) snd = "boom";
            a.hp -= 1; if (a.hp <= 0) a.dead = true;
            b.hp -= 1; if (b.hp <= 0) b.dead = true;
          }
          g.se(snd);   // rev45: 打ち落とし=ピキーン / はねかえし=ビヨーン(別音)。文字は出さない
          break;
        }
      }
    }
    if (spawnedMy.length) S.myShots.push(...spawnedMy);
    if (spawnedEnemy.length) S.enemyShots.push(...spawnedEnemy);
    S.myShots = S.myShots.filter(s => !s.dead && s.x < g.W + 40);
    S.enemyShots = S.enemyShots.filter(s => !s.dead && s.x > -40);

    // rev66: 爆破エフェクトの時間経過
    for (const ex of S.explosions) ex.t += dt;
    S.explosions = S.explosions.filter(ex => ex.t < ex.dur);
    // ダメージ数字の上昇・消滅
    for (const pu of S.popups){ pu.y -= 42 * dt; pu.life -= dt; }
    S.popups = S.popups.filter(pu => pu.life > 0);

    // 勝敗
    if (S.enemyHp <= 0){
      S.enemyHp = 0; S.best = Math.max(S.best, S.round + 1);
      S.scene = (S.round >= ROUNDS.length - 1) ? "win" : "roundclear";
      g.se("clear");
      if (S.scene === "win") g.bgm(false);   // rev73: 全クリアで戦闘BGM停止(次ラウンドは続行なので鳴らしたまま)
    } else if (S.myHp <= 0){
      S.myHp = 0; S.scene = "over"; g.se("boom"); g.bgm(false);   // rev73: 敗北で戦闘BGM停止
    }
  },

  draw(g){
    const p = S.player;
    // 2画面: 上=戦場(空)、下=戦車の中。あいだに黒帯(DSのヒンジ)
    g.bg("#8fd3f0");                                   // 空
    g.rect(0, 180, g.W, TOP_H - 180, "#6db24a");       // 戦場の地面(緑の丘)。rev51: TOP_H縮小に合わせ地面の開始も上げる
    g.rect(0, TOP_H, g.W, 14, "#000");                 // ヒンジ
    g.rect(0, TOP_H + 14, g.W, g.H - TOP_H - 14, "#14121a");  // rev53: 戦車の中の背景(部屋の外=暗い。部屋の床は下でカメラ内に描く)

    if (S.scene === "title"){
      g.rect(0, 0, g.W, g.H, "#101a2a");
      g.emoji("🚂", g.W/2 - 170, 150, 96);
      g.emoji("🚂", g.W/2 + 170, 150, 96, { flipX: true });
      g.emoji("💥", g.W/2, 150, 60);
      g.text("大戦車バトル", g.W/2, 224, 44);
      // 目的を大きく1行(一番大事)
      g.text("弾を拾って 右の砲に投げて 敵戦車を撃て!", g.W/2, 266, 24, "#ffe08a");
      // 玉がそのまま飛ぶ=右が自分・左が敵。敵は進むほど強い(玉が大きく＆痛く)
      g.text("同じ玉を撃ち合う（右→自分 ／ 左→敵＝大きめの玉）。敵は先へ進むほど強い", g.W/2, 300, 18, "#cfe");
      // 守り方(このゲームの肝): 敵の弾と同じ軌道の砲で受ける
      g.text("敵の弾 まっすぐ(低い)→➡️まっすぐ砲 ／ やまなり(高い弧)→↗️やまなり砲 で受けて相殺!", g.W/2, 326, 15, "#ffd");
      // 玉の種類(左の滑り台から供給される)
      g.text("出てくる玉: 🪨ふつう ⚡速い 🛡️守り3発 ⚙️重い一撃 💣ばくだん 🪞はねかえし", g.W/2, 344, 15, "#cbb6e0");
      g.text("🌑でか玉 ☠️どく ❄️こおり 🌿かいふく ／ 🌰いがぐり 🎭モシャス 🧿ルカニ", g.W/2, 364, 15, "#a8e6b0");
      g.text("🚀ロケット(加速) 🐍へび(蛇行) 🪃ブーメラン(命中後に帰還・帰路で1発迎撃)", g.W/2, 384, 15, "#ffd59a");
      g.text("🗡️勇者の剣／🛡️メタルキングの盾は、1ラウンドに1回ずつ使える必殺技", g.W/2, 402, 15, "#fff2a0");
      g.text("← → ↑ ↓ で移動 ／ スペースか👊で投げる ／ 相棒: 🟠まっすぐ守り ・ 🔵やまなり守り ・ ⚪メタル反射", g.W/2, 422, 15, "#9fb4c9");
      // 始め方を一番目立たせる(点滅の👆で誘導)
      g.text("▶ クリック か スペース でスタート", g.W/2, 446, 26, "#fff");
      g.emoji("👆", g.W/2 + 176, 450, 30, { alpha: 0.5 + 0.5 * Math.sin(g.time * 5) });
      return;
    }

    // ===== 上画面: 戦場 =====
    // 味方戦車(左)・敵戦車(右)。砲身を内側へ
    g.rect(MY_TANK.x + 20, BATTLE_Y - 6, 60, 12, "#556");   // 味方の砲身
    g.emoji("🚂", MY_TANK.x - 20, BATTLE_Y + 10, 82);
    // rev77: 盾の効果中は味方戦車を光るリングと盾で包む
    if (S.shieldTime > 0){
      const pulse = 0.65 + 0.35 * Math.abs(Math.sin(g.time * 9));
      g.emoji("⭕", MY_TANK.x + 8, BATTLE_Y + 4, 112, { alpha: pulse });
      g.emoji("🛡️", MY_TANK.x + 8, BATTLE_Y - 38, 42, { alpha: pulse });
    }
    // rev70: 上画面の芝生から戦車の中へ入る入口。メタルはここまで歩いて中へ消える
    g.rect(METAL_DOOR_X - 18, METAL_GRASS_Y - 24, 36, 28, "#20202a");
    g.rect(METAL_DOOR_X - 18, METAL_GRASS_Y - 24, 36, 4, "#666672");
    g.text("入口", METAL_DOOR_X, METAL_GRASS_Y - 10, 11, "#f0f0f4", "center");
    // rev61: 回復の演出。緑ハートが戦車の周りをくるっと1周→半透明ハートがふわっと膨らんで消える
    if (S.healFx){
      const f = S.healFx, pr = f.t / f.dur;
      const orbP = Math.min(pr / 0.6, 1);                 // 前半60%で1周
      const ang = orbP * Math.PI * 2 - Math.PI / 2;       // 上から時計回りに1周
      const R = 48;
      g.emoji("💚", f.cx + R * Math.cos(ang), f.cy + R * Math.sin(ang), 26, { alpha: 0.9 });
      if (pr > 0.45){                                      // 後半で半透明ハートがふわっと(膨らみながらフェード)
        const hp = Math.min((pr - 0.45) / 0.55, 1);
        g.emoji("💚", f.cx, f.cy - 8, 40 + hp * 26, { alpha: 0.45 * Math.sin(hp * Math.PI) });
      }
    }
    g.rect(ENEMY_X - 80, BATTLE_Y - 6, 60, 12, "#655");     // 敵の砲身
    const eShake = S.enemyFlash > 0 ? g.rand(-4, 4) : 0;
    g.emoji("🚂", ENEMY_X + 22 + eShake, BATTLE_Y + 10, 86, { flipX: true });
    if (S.swordFx > 0){
      const a = g.clamp(S.swordFx / 0.45, 0, 1);
      g.emoji("⚔️", ENEMY_X + 8, BATTLE_Y - 18, 112, { alpha: a });
      g.emoji("✨", ENEMY_X - 30, BATTLE_Y - 58, 64, { alpha: a });
    }
    // rev59/75: 状態表示 — どく中は☠️、ルカニ待機中は🧿が点滅
    if (S.enemyPoison > 0) g.emoji("☠️", ENEMY_X + 22, BATTLE_Y - 42, 30, { alpha: 0.5 + 0.5 * Math.abs(Math.sin(g.time * 8)) });
    if (S.enemySapPending && S.enemySapTime > 0) g.emoji("🧿", ENEMY_X + 56, BATTLE_Y - 42, 30, { alpha: 0.55 + 0.45 * Math.abs(Math.sin(g.time * 7)) });

    // HP(数字+ゲージ)。結果画面では隠す(ゲーム中UIを消して締める)
    if (S.scene === "play"){
      g.rect(20, 24, 260, 22, "#00000055"); g.rect(20, 24, 260 * g.clamp(S.myHp/S.myMaxHp,0,1), 22, "#4ea0ff");
      g.text("味方 " + Math.ceil(S.myHp) + " / " + S.myMaxHp, 26, 35, 18, "#fff", "left");
      g.rect(g.W - 280, 24, 260, 22, "#00000055"); g.rect(g.W - 280, 24, 260 * g.clamp(S.enemyHp/S.enemyMaxHp,0,1), 22, "#ff5a5a");
      g.text(ROUNDS[S.round].name + " " + Math.ceil(S.enemyHp) + " / " + S.enemyMaxHp, g.W - 26, 35, 18, "#fff", "right");
      g.text((S.round + 1) + " / 3 台目", g.W/2, 32, 18, "#123", "center");
    }

    // 弾(飛翔中): 色分けはやめ、向きで敵味方が分かる(右=自分/左=敵)。まっすぐ/やまなりは軌道(低い直線/高い弧)で分かる
    // 自分の弾=投げた玉そのままの絵文字
    for (const s of S.myShots){
      if (s.special === "boomerang") g.emoji(s.e, s.x, s.y, 30, { rot: g.time * 12 });   // rev80: くるくる回して8の字を強調
      else g.emoji(s.e || (s.type === "arc" ? "🟦" : "🔵"), s.x, s.y, 30);
    }
    // 敵の弾=自分と同じ玉(左へ飛ぶ)。rev44: 敵の玉は少し大きめ＋敵が進むほど大きい(34/38/42)=向きと大きさで味方(30)と区別＆強い敵ほど大きい玉
    const eSize = 34 + S.round * 4;
    for (const s of S.enemyShots) g.emoji(s.e || "⚫", s.x, s.y, eSize);
    // rev70: fly/fall/芝生歩きは上画面に描き、プレイヤーの位置に関係なく常に見せる
    { const m = S.metal; if (m && (m.mode === "fly" || m.mode === "fall" || m.mode === "walkOutside")){ const spin = (m.mode === "fall") ? g.time * 12 : 0; g.emoji("めたる", m.x, m.y, 42, { rot: spin }); } }
    // rev66: ばくだんの爆破エフェクト(💥が膨らみながら消える。オレンジの閃光も重ねて派手に)
    for (const ex of S.explosions){
      const p = ex.t / ex.dur;
      g.emoji("💥", ex.x, ex.y, 54 + p * 90, { alpha: 1 - p });
      g.emoji("🔶", ex.x, ex.y, 30 + p * 70, { alpha: (1 - p) * 0.5 });
    }
    // ダメージ数字
    for (const pu of S.popups) g.text(pu.text, pu.x, pu.y, 34, pu.color, "center");
    // 命中の爆発
    if (S.enemyFlash > 0) g.emoji("💥", ENEMY_X - 6, BATTLE_Y - 20, 70, { alpha: g.clamp(S.enemyFlash/0.25,0,1) });

    // ===== 下画面: 戦車の中(多部屋・カメラ追従スクロール) rev53 =====
    // 表示窓(VIEW_TOPから下)だけにクリップし、カメラ分ずらして「ワールド座標」で描く
    const _ctx = document.querySelector("#cv").getContext("2d");
    _ctx.save();
    _ctx.beginPath(); _ctx.rect(0, VIEW_TOP, VIEW_W, VIEW_H); _ctx.clip();
    _ctx.translate(-S.cam.x, VIEW_TOP - S.cam.y);
    // --- 以下すべてワールド座標 ---
    // 部屋の床(この配列がマップの形)
    for (const r of ROOMS){
      g.rect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, r.grass ? "#3d6b34" : "#3a3242");
      g.rect(r.x0, r.y0, r.x1 - r.x0, 6, r.grass ? "#4f8a44" : "#4a4356");   // 芝生の縁／戦車内部の天井の縁
      if (r.grass){
        for (let gy = r.y0 + 42, row = 0; gy < r.y1 - 14; gy += 62, row++){
          for (let gx = r.x0 + 42 + (row % 2) * 34; gx < r.x1 - 22; gx += 104) g.emoji("🌿", gx, gy, 20, { alpha: 0.38 });
        }
      }
    }
    // rev71: 下世界の芝生にある、自分の戦車の入口と敵戦車の入口の目印
    g.rect(TANK_DOOR.x - 10, TANK_DOOR.y - 22, 22, 44, "#20202a");
    g.rect(TANK_DOOR.x - 10, TANK_DOOR.y - 22, 22, 5, "#55555f");
    g.text("入口", TANK_DOOR.x + 1, TANK_DOOR.y + 36, 12, "#d0d0d8", "center");
    g.emoji("🚂", ENEMY_TANK.x, ENEMY_TANK.y, 92, { flipX: true });
    g.rect(ENEMY_TANK.x - 60, ENEMY_TANK.y - 12, 26, 40, "#20202a");
    g.text("敵の入口", ENEMY_TANK.x - 47, ENEMY_TANK.y + 44, 12, "#ffb0b0", "center");
    // 玉の滑り台+たまり場(rev54: 3箇所=左上たま/左下エンジン/下たま)
    for (const s of SUPPLIES){
      g.rect(s.chute.x - 46, s.chute.y - 34, 92, 34, "#4a4356"); g.emoji("📦", s.chute.x, s.chute.y - 14, 26);
      g.rect(s.rx0 - 26, s.ry + 15, SUPPLY_MAX*REST_DX + 20, 7, "#3f3a4a");
      g.text("玉の供給", s.chute.x, s.chute.y - 44, 14, "#cbb6e0", "center");
    }
    // 大砲(右上「大砲」部屋)
    g.rect(CANNON_A.x - 42, CANNON_A.y - 28, 84, 56, "#2a2630"); g.rect(CANNON_A.x - 42, CANNON_A.y - 28, 84, 5, "#544c5e");
    g.emoji("↗️", CANNON_A.x - 4, CANNON_A.y, 56); g.text("やまなり(攻)", CANNON_A.x, CANNON_A.y - 40, 15, "#fc9");
    g.rect(CANNON_S.x - 42, CANNON_S.y - 28, 84, 56, "#2a2630"); g.rect(CANNON_S.x - 42, CANNON_S.y - 28, 84, 5, "#544c5e");
    g.emoji("➡️", CANNON_S.x - 4, CANNON_S.y, 56); g.text("まっすぐ(守)", CANNON_S.x, CANNON_S.y + 40, 15, "#9cf");
    // エンジン部屋の飾り(左下)
    g.emoji("⚙️", 250, 810, 64); g.text("エンジン", 250, 756, 15, "#9aa2ad");
    // rev69: メタルが撃ち落とされて戻ってくる「入り口」(戦車の中・たま上の左上)
    g.rect(METAL_ENTRANCE.x - 26, METAL_ENTRANCE.y - 12, 52, 20, "#20202a");
    g.rect(METAL_ENTRANCE.x - 26, METAL_ENTRANCE.y - 12, 52, 4, "#55555f");
    g.text("⚪入口", METAL_ENTRANCE.x, METAL_ENTRANCE.y + 2, 12, "#d0d0d8", "center");
    if (S.throwFlash) g.emoji("💥", S.throwFlash.x, S.throwFlash.y, 68, { alpha: g.clamp(S.throwFlash.t/0.3,0,1) });
    for (const b of S.balls) g.emoji(b.e, b.x, b.y, 34);                    // たまり場/滑走中の玉
    S.allies.forEach((al, i) => {                                          // 相棒(rev55: 2体)
      g.emoji(ALLY_DEFS[i].e, al.x, al.y, 44);
      al.carry.forEach((b) => g.emoji(b.e, al.x, al.y - 42, 26));
    });
    if (S.metal && S.metal.mode === "walkInside") g.emoji("めたる", S.metal.x, S.metal.y, 42);   // rev70: 中の通路を歩いて大砲へ戻るメタル
    g.emoji("スライム", p.x, p.y, 48);                                     // 自分
    p.carry.forEach((b, i) => { const n = p.carry.length; g.emoji(b.e, p.x + (i - (n-1)/2) * 26, p.y - 46, 30); });
    if (p.carry.length > 0) g.text("×" + p.carry.length, p.x + 34, p.y - 46, 18, "#fff", "left");
    for (const t of S.tosses) g.emoji(t.e, t.x, t.y, 30);                  // トス中の玉
    if (S.tooFar > 0) g.text("砲に近づいて投げろ!", p.x, p.y + 46, 16, "#ff8", "center");
    _ctx.restore();   // ← カメラ解除。以降は画面固定UI

    // 画面固定UI(プレイ中のみ): 案内・なげるボタン・ミニマップ
    if (S.scene === "play"){
      g.text(p.carry.length > 0 ? ("弾 " + p.carry.length + "/3 → 大砲に向かって投げると装填／別の方へ投げるとその場に置く(拾い直せる)") : "左上の「たま」部屋で玉を拾おう",
             g.W/2, VIEW_TOP + 16, 17, p.carry.length > 0 ? "#ffe08a" : "#cfe", "center");
      g.emoji("⚪", THROW_BTN.x, THROW_BTN.y, THROW_BTN.r * 2, { alpha: 0.35 });
      g.emoji("👊", THROW_BTN.x, THROW_BTN.y - 8, 34); g.text("なげる", THROW_BTN.x, THROW_BTN.y + 26, 13, "#fff");
      // rev77: 使用済みは暗い円と低いalphaでグレーアウト
      const swordAlpha = S.swordUsed ? 0.28 : 1, shieldAlpha = S.shieldUsed ? 0.28 : 1;
      g.emoji("⚪", SWORD_BTN.x, SWORD_BTN.y, SWORD_BTN.r * 2, { alpha: S.swordUsed ? 0.12 : 0.42 });
      g.emoji("🗡️", SWORD_BTN.x, SWORD_BTN.y - 5, 35, { alpha: swordAlpha });
      g.text(S.swordUsed ? "使用済" : "必殺", SWORD_BTN.x, SWORD_BTN.y + 24, 12, S.swordUsed ? "#777" : "#fff2a0");
      g.emoji("⚪", SHIELD_BTN.x, SHIELD_BTN.y, SHIELD_BTN.r * 2, { alpha: S.shieldUsed ? 0.12 : 0.42 });
      g.emoji("🛡️", SHIELD_BTN.x, SHIELD_BTN.y - 5, 35, { alpha: shieldAlpha });
      g.text(S.shieldUsed ? "使用済" : (S.shieldTime > 0 ? S.shieldTime.toFixed(1) : "必殺"), SHIELD_BTN.x, SHIELD_BTN.y + 24, 12, S.shieldUsed ? "#777" : "#bfe8ff");
      // rev71: ミニマップ本体は芝生を除くINTERIOR基準。外は直下の細いバーで別表示する
      const mmW = 148, sc = mmW / (INTERIOR.x1 - INTERIOR.x0), mmH = (INTERIOR.y1 - INTERIOR.y0) * sc, mmX = g.W - mmW - 16, mmY = VIEW_TOP + 10;
      const MX = wx => mmX + (wx - INTERIOR.x0) * sc, MY = wy => mmY + (wy - INTERIOR.y0) * sc;
      g.rect(mmX - 5, mmY - 5, mmW + 10, mmH + 10, "#000000aa");
      for (const r of ROOMS) if (!r.grass) g.rect(MX(r.x0), MY(r.y0), (r.x1 - r.x0) * sc, (r.y1 - r.y0) * sc, "#5a5468");
      // カメラが芝生へ進んでも、ミニマップ本体から視野枠をはみ出させない
      const vx0 = Math.max(S.cam.x, INTERIOR.x0), vy0 = Math.max(S.cam.y, INTERIOR.y0);
      const vx1 = Math.min(S.cam.x + VIEW_W, INTERIOR.x1), vy1 = Math.min(S.cam.y + VIEW_H, INTERIOR.y1);
      if (vx1 > vx0 && vy1 > vy0) g.rect(MX(vx0), MY(vy0), (vx1 - vx0) * sc, (vy1 - vy0) * sc, "#ffffff33");
      for (const b of S.balls) if (!b.sliding) g.rect(MX(b.x) - 2, MY(b.y) - 2, 4, 4, "#cbb6e0");
      g.rect(MX(CANNON_A.x) - 3, MY(CANNON_A.y) - 3, 6, 6, "#5b8def"); g.rect(MX(CANNON_S.x) - 3, MY(CANNON_S.y) - 3, 6, 6, "#5b8def");
      S.allies.forEach((al, i) => g.rect(MX(al.x) - 3, MY(al.y) - 3, 6, 6, ALLY_DEFS[i].mc));   // 相棒2体(色分け)
      g.rect(MX(METAL_ENTRANCE.x) - 2, MY(METAL_ENTRANCE.y) - 2, 4, 4, "#888");   // rev69: メタル入口
      if (S.metal && S.metal.mode === "walkInside") g.rect(MX(S.metal.x) - 3, MY(S.metal.y) - 3, 6, 6, "#d0d0d8");   // rev80: 中を戻るメタル(銀)。※旧"walk"は誤りでミニマップに出ていなかった
      const playerOutside = GRASS && S.player.x >= GRASS.x0 && S.player.x <= GRASS.x1 && S.player.y >= GRASS.y0 && S.player.y <= GRASS.y1;   // rev72: 芝生部屋の中に居るか
      if (!playerOutside) g.rect(MX(S.player.x) - 3, MY(S.player.y) - 3, 6, 6, "#57d75a");

      // 外(芝生)バー: 左=自分の戦車、右=敵戦車。芝生にいる時だけ現在xを緑の点で示す
      const barY = mmY + mmH + 18, barX0 = mmX + 12, barX1 = mmX + mmW - 12;
      g.text("外(芝生)", mmX + mmW / 2, barY - 10, 11, playerOutside ? "#b9ef9f" : "#77906f", "center");
      g.rect(barX0, barY - 3, barX1 - barX0, 6, playerOutside ? "#4f8a44" : "#3d6b3455");
      g.text("自戦車", barX0, barY + 12, 10, "#d0d0d8", "center");
      g.text("敵戦車", barX1, barY + 12, 10, "#ffb0b0", "center");
      if (playerOutside){
        const outsidePr = g.clamp((S.player.x - TANK_DOOR.x) / (ENEMY_TANK.x - TANK_DOOR.x), 0, 1);
        const playerBarX = barX0 + (barX1 - barX0) * outsidePr;
        g.rect(playerBarX - 4, barY - 4, 8, 8, "#57d75a");
      }
    }

    if (S.scene === "roundclear"){
      g.rect(0, 0, g.W, g.H, "#00000099");
      g.text("🎉 敵戦車を撃破!", g.W/2, 200, 44);
      g.text("つぎの相手: " + ROUNDS[S.round + 1].name, g.W/2, 262, 24, "#ffe08a");
      g.text((S.round + 1) + " 台撃破!  残りHP " + Math.ceil(S.myHp) + " / " + S.myMaxHp, g.W/2, 306, 20, "#cfe");
      g.text("クリック か スペース で次の戦車へ", g.W/2, 352, 20, "#ccc");
    }
    if (S.scene === "win"){
      g.rect(0, 0, g.W, g.H, "#00000099");
      g.text("🏆 全戦車を撃破!", g.W/2, 205, 46);
      g.text("3台すべて撃破!  残りHP " + Math.ceil(S.myHp) + " / " + S.myMaxHp, g.W/2, 268, 22, "#ffe08a");
      g.text("クリック か スペース でもう一回", g.W/2, 322, 22, "#ccc");
    }
    if (S.scene === "over"){
      g.rect(0, 0, g.W, g.H, "#00000099");
      g.text("💥 味方戦車が大破…", g.W/2, 200, 42, "#f88");
      g.text(ROUNDS[S.round].name + " に敗れた", g.W/2, 258, 22, "#fcc");
      g.text("この戦いで " + S.round + " 台撃破 ／ 最高記録 " + S.best + " 台", g.W/2, 302, 20, "#cfe");
      g.text("クリック か スペース で最初から", g.W/2, 350, 20, "#ccc");
    }
  },
});
})();
