/*! klattsch engine (bundled for file:// use)
 * https://github.com/tgies/klattsch
 * MIT License / Copyright (c) 2026 Tony Gies
 * 元のESモジュールを1枚のふつうのスクリプトに連結したもの。中身は無改変。
 * 束ね方は ツールボックス\libs\klattsch\開発メモ.md
 */
(function (global) {
'use strict';
/* ---- banks/bundled.js ---- */
// Auto-generated from src/engine/banks/*.json by tools/build-banks.js.
// Do not edit by hand. Re-run the generator when banks change.

const bundled = {
  "ja-hecko-2026": {
    "schemaVersion": 1,
    "name": "ja-hecko-2026",
    "displayName": "Japanese (.hecko, 2026)",
    "language": "ja-JP",
    "license": "MIT",
    "extends": "klatt1980-en",
    "source": "Vowel formant values contributed by .hecko on the klattsch Discord, May 2026.",
    "phonemes": {
      "I": {
        "voicing": 1,
        "F1": 350,
        "F2": 2000,
        "F3": 3000,
        "BW1": 60,
        "BW2": 130,
        "BW3": 140,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "ipa": "i",
        "example": "[i]ru"
      },
      "E": {
        "voicing": 1,
        "F1": 500,
        "F2": 1700,
        "F3": 2300,
        "BW1": 60,
        "BW2": 100,
        "BW3": 250,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "ipa": "e̞",
        "example": "[e]ki"
      },
      "A": {
        "voicing": 1,
        "F1": 750,
        "F2": 1250,
        "F3": 2250,
        "BW1": 180,
        "BW2": 110,
        "BW3": 220,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "ipa": "ä",
        "example": "[a]ru"
      },
      "O": {
        "voicing": 1,
        "F1": 500,
        "F2": 850,
        "F3": 2250,
        "BW1": 60,
        "BW2": 110,
        "BW3": 130,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "ipa": "o̞",
        "example": "[o]ni"
      },
      "U": {
        "voicing": 1,
        "F1": 450,
        "F2": 1250,
        "F3": 2150,
        "BW1": 50,
        "BW2": 120,
        "BW3": 130,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "ipa": "ɯᵝ",
        "example": "[u]nagi"
      },
      "DX": {
        "voicing": 0.6,
        "F1": 255,
        "F2": 1325,
        "F3": 2740,
        "BW1": 55,
        "BW2": 100,
        "BW3": 225,
        "A1": 0.65,
        "A2": 0.55,
        "A3": 0.5,
        "isStop": true,
        "ipa": "ɾ",
        "example": "koko[r]o"
      }
    }
  },
  "ja-mokhtari-2000": {
    "schemaVersion": 1,
    "name": "ja-mokhtari-2000",
    "displayName": "Japanese (Mokhtari & Tanaka 2000)",
    "language": "ja-JP",
    "license": "MIT",
    "extends": "klatt1980-en",
    "source": "\"A Corpus of Japanese Vowel Formant Patterns.\" Bulletin of the Electrotechnical Laboratory (ETL), Vol. 64, Special Issue, 57-66. Raw data file: https://web.archive.org/web/20240811224814/https://isd.pu-toyama.ac.jp/~parham/documents/formantsETL/MokhtariTanaka2000_ETLformantdata.txt . Frequencies and bandwidths rounded to the nearest Hz. Mokhtari & Tanaka covers vowels only; the alveolar tap (DX) is reproduced from the ja-hecko-2026 bank with credit to .hecko on the klattsch Discord.",
    "phonemes": {
      "I": {
        "voicing": 1,
        "F1": 298,
        "F2": 2083,
        "F3": 2954,
        "BW1": 67,
        "BW2": 130,
        "BW3": 145,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "ipa": "i",
        "example": "[i]ru"
      },
      "E": {
        "voicing": 1,
        "F1": 480,
        "F2": 1857,
        "F3": 2437,
        "BW1": 65,
        "BW2": 97,
        "BW3": 257,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "ipa": "e̞",
        "example": "[e]ki"
      },
      "A": {
        "voicing": 1,
        "F1": 744,
        "F2": 1240,
        "F3": 2426,
        "BW1": 182,
        "BW2": 117,
        "BW3": 222,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "ipa": "ä",
        "example": "[a]ru"
      },
      "O": {
        "voicing": 1,
        "F1": 460,
        "F2": 857,
        "F3": 2405,
        "BW1": 61,
        "BW2": 114,
        "BW3": 134,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "ipa": "o̞",
        "example": "[o]ni"
      },
      "U": {
        "voicing": 1,
        "F1": 355,
        "F2": 1282,
        "F3": 2233,
        "BW1": 55,
        "BW2": 129,
        "BW3": 135,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "ipa": "ɯᵝ",
        "example": "[u]nagi"
      },
      "DX": {
        "voicing": 0.6,
        "F1": 255,
        "F2": 1325,
        "F3": 2740,
        "BW1": 55,
        "BW2": 100,
        "BW3": 225,
        "A1": 0.65,
        "A2": 0.55,
        "A3": 0.5,
        "isStop": true,
        "ipa": "ɾ",
        "example": "koko[r]o",
        "source": "Reproduced from ja-hecko-2026 (RAYTRAC3R PR #59 / .hecko)."
      }
    }
  },
  "klatt1980-en": {
    "schemaVersion": 1,
    "name": "klatt1980-en",
    "displayName": "English (Klatt 1980)",
    "language": "en-US",
    "license": "MIT",
    "extends": null,
    "source": "Klatt, D.H. (1980). \"Software for a cascade/parallel formant synthesizer.\" J. Acoust. Soc. Am. 67(3), Tables II (vowels) and III (consonants). Bandwidths and frequencies are verbatim from Klatt; amplitudes are approximated for our 3-formant parallel synth (Klatt uses six formants plus a bypass path for fricative spectra). Where Klatt places fricative energy in A3-A6 (~3-5 kHz parallel formants), we move our F3 channel up into that band to capture the hiss.",
    "phonemes": {
      "IY": {
        "voicing": 1,
        "F1": 310,
        "F2": 2020,
        "F3": 2960,
        "BW1": 45,
        "BW2": 200,
        "BW3": 400,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "glideTo": {
          "F1": 290,
          "F2": 2070,
          "F3": 2960
        }
      },
      "IH": {
        "voicing": 1,
        "F1": 400,
        "F2": 1800,
        "F3": 2570,
        "BW1": 50,
        "BW2": 100,
        "BW3": 140,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "glideTo": {
          "F1": 470,
          "F2": 1600,
          "F3": 2600
        }
      },
      "EH": {
        "voicing": 1,
        "F1": 530,
        "F2": 1680,
        "F3": 2500,
        "BW1": 60,
        "BW2": 90,
        "BW3": 200,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "glideTo": {
          "F1": 620,
          "F2": 1530,
          "F3": 2530
        }
      },
      "AE": {
        "voicing": 1,
        "F1": 620,
        "F2": 1660,
        "F3": 2430,
        "BW1": 70,
        "BW2": 150,
        "BW3": 320,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "glideTo": {
          "F1": 650,
          "F2": 1490,
          "F3": 2470
        }
      },
      "AA": {
        "voicing": 1,
        "F1": 700,
        "F2": 1220,
        "F3": 2600,
        "BW1": 130,
        "BW2": 70,
        "BW3": 160,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7
      },
      "AO": {
        "voicing": 1,
        "F1": 600,
        "F2": 990,
        "F3": 2570,
        "BW1": 90,
        "BW2": 100,
        "BW3": 80,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "glideTo": {
          "F1": 630,
          "F2": 1040,
          "F3": 2600
        }
      },
      "AH": {
        "voicing": 1,
        "F1": 620,
        "F2": 1220,
        "F3": 2550,
        "BW1": 80,
        "BW2": 50,
        "BW3": 140,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7
      },
      "UH": {
        "voicing": 1,
        "F1": 450,
        "F2": 1100,
        "F3": 2350,
        "BW1": 80,
        "BW2": 100,
        "BW3": 80,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "glideTo": {
          "F1": 500,
          "F2": 1180,
          "F3": 2390
        }
      },
      "UW": {
        "voicing": 1,
        "F1": 350,
        "F2": 1250,
        "F3": 2200,
        "BW1": 65,
        "BW2": 110,
        "BW3": 140,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "glideTo": {
          "F1": 320,
          "F2": 900,
          "F3": 2200
        }
      },
      "ER": {
        "voicing": 1,
        "F1": 470,
        "F2": 1270,
        "F3": 1540,
        "BW1": 100,
        "BW2": 60,
        "BW3": 110,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "glideTo": {
          "F1": 420,
          "F2": 1310,
          "F3": 1540
        }
      },
      "AY": {
        "voicing": 1,
        "F1": 660,
        "F2": 1200,
        "F3": 2550,
        "BW1": 100,
        "BW2": 70,
        "BW3": 200,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "glideTo": {
          "F1": 400,
          "F2": 1880,
          "F3": 2500
        }
      },
      "AW": {
        "voicing": 1,
        "F1": 640,
        "F2": 1230,
        "F3": 2550,
        "BW1": 80,
        "BW2": 70,
        "BW3": 140,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "glideTo": {
          "F1": 420,
          "F2": 940,
          "F3": 2350
        }
      },
      "EY": {
        "voicing": 1,
        "F1": 480,
        "F2": 1720,
        "F3": 2520,
        "BW1": 70,
        "BW2": 100,
        "BW3": 200,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "glideTo": {
          "F1": 330,
          "F2": 2020,
          "F3": 2600
        }
      },
      "OW": {
        "voicing": 1,
        "F1": 540,
        "F2": 1100,
        "F3": 2300,
        "BW1": 80,
        "BW2": 70,
        "BW3": 70,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "glideTo": {
          "F1": 450,
          "F2": 900,
          "F3": 2300
        }
      },
      "OY": {
        "voicing": 1,
        "F1": 550,
        "F2": 960,
        "F3": 2400,
        "BW1": 80,
        "BW2": 50,
        "BW3": 130,
        "A1": 1,
        "A2": 0.9,
        "A3": 0.7,
        "glideTo": {
          "F1": 360,
          "F2": 1820,
          "F3": 2450
        }
      },
      "W": {
        "voicing": 1,
        "F1": 290,
        "F2": 610,
        "F3": 2150,
        "BW1": 50,
        "BW2": 80,
        "BW3": 60,
        "A1": 0.8,
        "A2": 0.7,
        "A3": 0.5
      },
      "Y": {
        "voicing": 1,
        "F1": 260,
        "F2": 2070,
        "F3": 3020,
        "BW1": 40,
        "BW2": 250,
        "BW3": 500,
        "A1": 0.8,
        "A2": 0.7,
        "A3": 0.5
      },
      "R": {
        "voicing": 1,
        "F1": 310,
        "F2": 1060,
        "F3": 1380,
        "BW1": 70,
        "BW2": 100,
        "BW3": 120,
        "A1": 0.8,
        "A2": 0.7,
        "A3": 0.5
      },
      "L": {
        "voicing": 1,
        "F1": 310,
        "F2": 1050,
        "F3": 2880,
        "BW1": 50,
        "BW2": 100,
        "BW3": 280,
        "A1": 0.8,
        "A2": 0.7,
        "A3": 0.5
      },
      "M": {
        "voicing": 1,
        "F1": 270,
        "F2": 1270,
        "F3": 2130,
        "BW1": 40,
        "BW2": 200,
        "BW3": 200,
        "A1": 0.7,
        "A2": 0.18,
        "A3": 0.1
      },
      "N": {
        "voicing": 1,
        "F1": 270,
        "F2": 1340,
        "F3": 2470,
        "BW1": 40,
        "BW2": 300,
        "BW3": 300,
        "A1": 0.7,
        "A2": 0.2,
        "A3": 0.12
      },
      "NG": {
        "voicing": 1,
        "F1": 270,
        "F2": 2000,
        "F3": 2700,
        "BW1": 40,
        "BW2": 300,
        "BW3": 300,
        "A1": 0.7,
        "A2": 0.2,
        "A3": 0.12
      },
      "F": {
        "voicing": 0,
        "F1": 340,
        "F2": 1100,
        "F3": 2080,
        "BW1": 200,
        "BW2": 200,
        "BW3": 1000,
        "A1": 0,
        "A2": 0.1,
        "A3": 0.15
      },
      "TH": {
        "voicing": 0,
        "F1": 320,
        "F2": 1290,
        "F3": 2540,
        "BW1": 200,
        "BW2": 200,
        "BW3": 1000,
        "A1": 0,
        "A2": 0.08,
        "A3": 0.18
      },
      "S": {
        "voicing": 0,
        "F1": 320,
        "F2": 1390,
        "F3": 5500,
        "BW1": 200,
        "BW2": 200,
        "BW3": 1000,
        "A1": 0,
        "A2": 0,
        "A3": 0.95
      },
      "SH": {
        "voicing": 0,
        "F1": 300,
        "F2": 1840,
        "F3": 2750,
        "BW1": 200,
        "BW2": 200,
        "BW3": 1000,
        "A1": 0,
        "A2": 0.55,
        "A3": 0.65
      },
      "V": {
        "voicing": 0.45,
        "F1": 220,
        "F2": 1100,
        "F3": 2080,
        "BW1": 80,
        "BW2": 100,
        "BW3": 800,
        "A1": 0.4,
        "A2": 0.12,
        "A3": 0.18
      },
      "DH": {
        "voicing": 0.45,
        "F1": 270,
        "F2": 1290,
        "F3": 2540,
        "BW1": 80,
        "BW2": 100,
        "BW3": 800,
        "A1": 0.4,
        "A2": 0.1,
        "A3": 0.2
      },
      "Z": {
        "voicing": 0.45,
        "F1": 240,
        "F2": 1390,
        "F3": 5500,
        "BW1": 80,
        "BW2": 100,
        "BW3": 800,
        "A1": 0.4,
        "A2": 0,
        "A3": 0.65
      },
      "ZH": {
        "voicing": 0.45,
        "F1": 270,
        "F2": 1840,
        "F3": 2750,
        "BW1": 80,
        "BW2": 100,
        "BW3": 800,
        "A1": 0.4,
        "A2": 0.45,
        "A3": 0.55
      },
      "HH": {
        "voicing": 0,
        "F1": 500,
        "F2": 1500,
        "F3": 2500,
        "BW1": 300,
        "BW2": 200,
        "BW3": 300,
        "A1": 0.4,
        "A2": 0.4,
        "A3": 0.3
      },
      "P": {
        "voicing": 0,
        "F1": 400,
        "F2": 1100,
        "F3": 2150,
        "BW1": 300,
        "BW2": 150,
        "BW3": 220,
        "A1": 0.1,
        "A2": 0.2,
        "A3": 0.25,
        "isStop": true
      },
      "B": {
        "voicing": 0.6,
        "F1": 200,
        "F2": 1100,
        "F3": 2150,
        "BW1": 60,
        "BW2": 110,
        "BW3": 130,
        "A1": 0.5,
        "A2": 0.2,
        "A3": 0.2,
        "isStop": true
      },
      "T": {
        "voicing": 0,
        "F1": 400,
        "F2": 1600,
        "F3": 2600,
        "BW1": 300,
        "BW2": 120,
        "BW3": 250,
        "A1": 0,
        "A2": 0.3,
        "A3": 0.55,
        "isStop": true
      },
      "D": {
        "voicing": 0.6,
        "F1": 200,
        "F2": 1600,
        "F3": 2600,
        "BW1": 60,
        "BW2": 100,
        "BW3": 170,
        "A1": 0.5,
        "A2": 0.4,
        "A3": 0.5,
        "isStop": true
      },
      "K": {
        "voicing": 0,
        "F1": 300,
        "F2": 1990,
        "F3": 2850,
        "BW1": 250,
        "BW2": 160,
        "BW3": 330,
        "A1": 0,
        "A2": 0.5,
        "A3": 0.4,
        "isStop": true
      },
      "G": {
        "voicing": 0.6,
        "F1": 200,
        "F2": 1990,
        "F3": 2850,
        "BW1": 60,
        "BW2": 150,
        "BW3": 280,
        "A1": 0.5,
        "A2": 0.5,
        "A3": 0.4,
        "isStop": true
      },
      "CH": {
        "voicing": 0,
        "F1": 350,
        "F2": 1800,
        "F3": 2820,
        "BW1": 200,
        "BW2": 90,
        "BW3": 300,
        "A1": 0,
        "A2": 0.4,
        "A3": 0.55,
        "isStop": true
      },
      "JH": {
        "voicing": 0.5,
        "F1": 260,
        "F2": 1800,
        "F3": 2820,
        "BW1": 60,
        "BW2": 80,
        "BW3": 270,
        "A1": 0.4,
        "A2": 0.4,
        "A3": 0.5,
        "isStop": true
      },
      "_": {
        "voicing": 0,
        "F1": 500,
        "F2": 1500,
        "F3": 2500,
        "BW1": 80,
        "BW2": 120,
        "BW3": 160,
        "A1": 0,
        "A2": 0,
        "A3": 0
      }
    }
  }
};

/* ---- banks/index.js ---- */
// Phoneme bank registry, layering, and resolved-bank lookup.

const DEFAULT_BANK = 'klatt1980-en';

const registry = new Map();
const resolvedCache = new Map();

for (const [name, bank] of Object.entries(bundled)) {
  registry.set(name, bank);
}

function resolveInternal(name, visiting) {
  if (visiting.has(name)) {
    const path = [...visiting, name].join(' -> ');
    throw new Error(`bank extends cycle detected: ${path}`);
  }
  const bank = registry.get(name);
  if (!bank) {
    throw new Error(`unknown bank: ${name}`);
  }

  let phonemes = {};
  if (bank.extends) {
    const parent = resolveInternal(bank.extends, new Set([...visiting, name]));
    phonemes = { ...parent.phonemes };
  }

  for (const [code, entry] of Object.entries(bank.phonemes || {})) {
    if (entry === null) {
      delete phonemes[code];
    } else {
      phonemes[code] = entry;
    }
  }

  return {
    schemaVersion: bank.schemaVersion,
    name: bank.name,
    displayName: bank.displayName ?? bank.name,
    language: bank.language ?? null,
    license: bank.license ?? null,
    source: bank.source ?? null,
    extends: null,
    phonemes,
  };
}

function get(name) {
  if (resolvedCache.has(name)) return resolvedCache.get(name);
  if (!registry.has(name)) return undefined;
  const resolved = resolveInternal(name, new Set());
  resolvedCache.set(name, resolved);
  return resolved;
}

function list() {
  return [...registry.keys()];
}

const banks = { list, get, defaultName: DEFAULT_BANK };

function registerBank(bank) {
  if (!bank || typeof bank !== 'object') {
    throw new Error('registerBank: bank must be an object');
  }
  if (!bank.name || typeof bank.name !== 'string') {
    throw new Error('registerBank: bank.name is required');
  }
  if (bank.schemaVersion !== 1) {
    throw new Error(
      `registerBank: unsupported schemaVersion ${bank.schemaVersion} (expected 1)`,
    );
  }
  registry.set(bank.name, bank);
  resolvedCache.clear();
}

// Accepts a name string, a ResolvedBank, a raw bank object, or null (default).
function resolveBank(bank, reg = banks) {
  if (bank == null) {
    return reg.get(DEFAULT_BANK);
  }
  if (typeof bank === 'string') {
    const resolved = reg.get(bank);
    if (!resolved) throw new Error(`unknown bank: ${bank}`);
    return resolved;
  }
  if (typeof bank === 'object') {
    if (bank.extends == null && bank.phonemes) {
      return bank;
    }
    if (bank.name && registry.has(bank.name)) {
      return banks.get(bank.name);
    }
    if (bank.name) {
      registerBank(bank);
      return banks.get(bank.name);
    }
  }
  throw new Error('resolveBank: unsupported bank value');
}

/* ---- dsp.js ---- */
// Low-level DSP primitives used by the formant synth core.

// Constant-skirt-gain bandpass biquad (RBJ Audio EQ Cookbook)
// Coefficients are recomputed only when frequency or bandwidth changes
class BandpassBiquad {
  constructor() {
    this.x1 = 0; this.x2 = 0;
    this.y1 = 0; this.y2 = 0;
    this.b0 = 0; this.b1 = 0; this.b2 = 0;
    this.a1 = 0; this.a2 = 0;
    this.lastF = -1; this.lastBW = -1;
  }
  setFreq(f, bw, sr) {
    if (f === this.lastF && bw === this.lastBW) return;
    this.lastF = f; this.lastBW = bw;
    f = Math.max(40, Math.min(sr * 0.45, f));
    bw = Math.max(20, bw);
    const w0 = 2 * Math.PI * f / sr;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const Q = f / bw;
    const alpha = sinw0 / (2 * Q);
    const a0 = 1 + alpha;
    this.b0 =  alpha / a0;
    this.b1 =  0;
    this.b2 = -alpha / a0;
    this.a1 = -2 * cosw0 / a0;
    this.a2 = (1 - alpha) / a0;
  }
  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2
            - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x;
    this.y2 = this.y1; this.y1 = y;
    return y;
  }
  reset() {
    this.x1 = 0; this.x2 = 0;
    this.y1 = 0; this.y2 = 0;
  }
}

// Derivative of the Rosenberg glottal pulse. Phase normalized to [0, 1).
// Peak |value| is pi / (2·Tn) ~= 9.82, so we divide by 10 to keep amplitude
// near unity.
//
// `effort` (0..1) controls the pulse shape: 0 is lax/breathy (longer Tp,
// gentler closure), 1 is tense (shorter Tp, sharper closure)
function glottalPulse(phase, effort = 0.5) {
  const e = effort < 0 ? 0 : effort > 1 ? 1 : effort;
  const Tp = 0.5 - e * 0.2;     // 0.5 (lax) -> 0.3 (tense)
  const Tn = 0.25 - e * 0.17;   // 0.25 (lax) -> 0.08 (tense)
  const NORM = 0.1;
  if (phase < Tp) {
    return NORM * 0.5 * (Math.PI / Tp) * Math.sin(Math.PI * phase / Tp);
  }
  if (phase < Tp + Tn) {
    return -NORM * (Math.PI / (2 * Tn)) * Math.sin(Math.PI * (phase - Tp) / (2 * Tn));
  }
  return 0;
}

// 32-bit xorshift LFSR
function xorshift(state) {
  let x = state | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x | 0;
}

// Soft-clip with a linear region up to ±0.85 and a smooth knee
function softClip(x) {
  const T = 0.85;
  const a = x < 0 ? -x : x;
  if (a <= T) return x;
  const sign = x < 0 ? -1 : 1;
  const excess = a - T;
  return sign * (T + (1 - T) * excess / (excess + 1));
}

/* ---- phonemes.js ---- */
// Backward-compatible re-export of the default English bank for legacy
// importers. New code should pass `opts.bank` to the compiler.

const englishBank = banks.get(banks.defaultName);

const phonemes = Object.freeze(englishBank.phonemes);

const PHONEME_KEYS = Object.keys(phonemes).filter(
  (k) => !k.startsWith('_'),
);

/* ---- synth-core.js ---- */
// FormantSynth: the klattsch synthesis engine, free of any audio-API dependency.
//
// Usage:
//
//   import { FormantSynth } from './synth-core.js';
//   const synth = new FormantSynth({ sampleRate: 48000, schedule });
//   const buf = new Float32Array(48000 * 2);  // 2 seconds
//   synth.process(buf);
//
// `schedule` is an array of { atMs, target, transitionMs } events; the synth
// applies them in time order. Or drive it live with setTarget()

const PARAMS = [
  'F0', 'voicing',
  'F1', 'BW1', 'A1',
  'F2', 'BW2', 'A2',
  'F3', 'BW3', 'A3',
  'gain',
  'vibratoDepth',   // Hz peak deviation
  'vibratoRate',    // Hz LFO rate
  'tremoloDepth',   // 0..1 amplitude modulation depth
  'tremoloRate',    // Hz tremolo LFO rate
  'aspiration',     // 0..1 noise mixed into voiced source (breathiness)
  'tilt',           // -0.95..0.95 spectral tilt (positive = brighter)
  'effort',         // 0..1 glottal pulse shape (0=lax, 1=tense)
];

const DEFAULT = {
  F0: 120, voicing: 0,
  F1: 500, BW1: 80,  A1: 0,
  F2: 1500, BW2: 120, A2: 0,
  F3: 2500, BW3: 160, A3: 0,
  gain: 3.5,
  vibratoDepth: 0,
  vibratoRate: 5,
  tremoloDepth: 0,
  tremoloRate: 5,
  aspiration: 0,
  tilt: 0,
  effort: 0.5,
};

class FormantSynth {
  constructor({ sampleRate, initialTarget, schedule } = {}) {
    if (!sampleRate || sampleRate <= 0) {
      throw new Error('FormantSynth requires a positive sampleRate');
    }
    this.sr = sampleRate;
    const init = initialTarget ?? {};
    this.current = { ...DEFAULT, ...init };
    this.target = { ...this.current };
    this.increment = {};
    for (const k of PARAMS) this.increment[k] = 0;
    this.transitionSamples = 0;
    this.glottalPhase = 0;
    this.lfsr = 0xACE1ACE1 | 0;
    this.vibratoPhase = 0;
    this.tremoloPhase = 0;
    this.tiltPrev = 0;
    this.bp1 = new BandpassBiquad();
    this.bp2 = new BandpassBiquad();
    this.bp3 = new BandpassBiquad();

    this.schedule = (schedule ?? []).map(e => ({
      atSample: Math.floor((e.atMs ?? 0) * this.sr / 1000),
      target: e.target,
      transitionSamples: Math.max(1, Math.floor((e.transitionMs ?? 30) * this.sr / 1000)),
    }));
    this.scheduleIdx = 0;
    this.sampleCounter = 0;
  }

  // Schedule a new target. transitionMs samples are linearly interpolated
  // from current state to the new target
  setTarget(target, transitionMs = 30) {
    const N = Math.max(1, Math.floor(transitionMs * this.sr / 1000));
    this.transitionSamples = N;
    for (const k of PARAMS) {
      if (k in target) this.target[k] = target[k];
      this.increment[k] = (this.target[k] - this.current[k]) / N;
    }
  }

  // startCounter presets the schedule clock: negative delays the first event,
  // positive drains already-past events on the first process() call.
  queueSchedule(events, startCounter = 0) {
    this.schedule = events.map(e => ({
      atSample: Math.floor((e.atMs ?? 0) * this.sr / 1000),
      target: e.target,
      transitionSamples: Math.max(1, Math.floor((e.transitionMs ?? 30) * this.sr / 1000)),
    }));
    this.scheduleIdx = 0;
    this.sampleCounter = startCounter;
  }

  reset(initialTarget) {
    this.glottalPhase = 0;
    this.vibratoPhase = 0;
    this.tremoloPhase = 0;
    this.lfsr = 0xACE1ACE1 | 0;
    this.tiltPrev = 0;
    this.bp1.reset();
    this.bp2.reset();
    this.bp3.reset();
    const init = initialTarget ?? {};
    this.current = { ...DEFAULT, ...init };
    this.target = { ...this.current };
    for (const k of PARAMS) this.increment[k] = 0;
    this.transitionSamples = 0;
    this.schedule = [];
    this.scheduleIdx = 0;
    this.sampleCounter = 0;
  }

  // Render `out.length` samples into the given Float32Array
  process(out) {
    const cur = this.current;
    for (let i = 0; i < out.length; i++) {
      // Drain any baked-in schedule events whose time has arrived
      while (this.scheduleIdx < this.schedule.length
          && this.schedule[this.scheduleIdx].atSample <= this.sampleCounter) {
        const evt = this.schedule[this.scheduleIdx++];
        const N = evt.transitionSamples;
        this.transitionSamples = N;
        for (const k of PARAMS) {
          if (k in evt.target) this.target[k] = evt.target[k];
          this.increment[k] = (this.target[k] - this.current[k]) / N;
        }
      }
      this.sampleCounter++;

      if (this.transitionSamples > 0) {
        for (const k of PARAMS) cur[k] += this.increment[k];
        this.transitionSamples--;
        if (this.transitionSamples === 0) {
          for (const k of PARAMS) cur[k] = this.target[k];
        }
      }

      // Vibrato LFO modulates F0 around its target value
      this.vibratoPhase += 2 * Math.PI * cur.vibratoRate / this.sr;
      this.vibratoPhase -= 2 * Math.PI * Math.floor(this.vibratoPhase / (2 * Math.PI));
      const effF0 = cur.F0 + cur.vibratoDepth * Math.sin(this.vibratoPhase);

      // Tremolo LFO modulates output amplitude
      this.tremoloPhase += 2 * Math.PI * cur.tremoloRate / this.sr;
      this.tremoloPhase -= 2 * Math.PI * Math.floor(this.tremoloPhase / (2 * Math.PI));
      const tremoloMod = 1 - cur.tremoloDepth * (0.5 + 0.5 * Math.sin(this.tremoloPhase));

      const v = cur.voicing < 0 ? 0 : cur.voicing > 1 ? 1 : cur.voicing;
      this.lfsr = xorshift(this.lfsr);
      const noiseSample = this.lfsr / 2147483648;
      const pulseVal = glottalPulse(this.glottalPhase, cur.effort);
      const voicedGain = 1 - cur.aspiration * 0.85;
      const exc = v * pulseVal * voicedGain
                + (1 - v) * noiseSample * 0.35
                + cur.aspiration * noiseSample * 0.5;
      this.glottalPhase += effF0 / this.sr;
      this.glottalPhase -= Math.floor(this.glottalPhase);

      this.bp1.setFreq(cur.F1, cur.BW1, this.sr);
      this.bp2.setFreq(cur.F2, cur.BW2, this.sr);
      this.bp3.setFreq(cur.F3, cur.BW3, this.sr);

      const y = (this.bp1.process(exc) * cur.A1
              +  this.bp2.process(exc) * cur.A2
              +  this.bp3.process(exc) * cur.A3) * cur.gain * tremoloMod;

      const tilted = y - cur.tilt * this.tiltPrev;
      this.tiltPrev = y;

      out[i] = softClip(tilted);
    }
  }
}

// Convenience: render a complete utterance offline
function renderToBuffer({ sampleRate = 48000, schedule, totalMs, initialTarget } = {}) {
  if (totalMs == null) {
    if (!schedule || !schedule.length) throw new Error('renderToBuffer needs totalMs or a non-empty schedule');
    totalMs = schedule[schedule.length - 1].atMs + 200;
  }
  const samples = Math.ceil(totalMs * sampleRate / 1000);
  const buf = new Float32Array(samples);
  const synth = new FormantSynth({ sampleRate, initialTarget, schedule });
  synth.process(buf);
  return buf;
}

/* ---- sequencer.js ---- */
// Phoneme-string parser and schedule compiler

const PAUSE_MS = { ',': 100, ';': 200, '.': 300 };

// Convert note names like "C4", "C#5", "Db3", "A-1" to Hz.
const NOTE_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteToHz(name) {
  const m = name.match(/^([A-G])([b#]?)(-?\d+)$/);
  if (!m) return null;
  const [, letter, accidental, octaveStr] = m;
  let semi = NOTE_SEMITONES[letter];
  if (accidental === '#') semi += 1;
  else if (accidental === 'b') semi -= 1;
  const octave = parseInt(octaveStr, 10);
  const midi = (octave + 1) * 12 + semi;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const DEFAULTS = Object.freeze({
  baseF0: 120,
  rate: 110,                  // ms per phoneme
  stressDurationFactor: 1.5,
  stressF0Lift: 8,            // Hz
  stopBurstMs: 25,
  defaultTransitionMs: 35,
  sentenceFinalHoldMs: 0,
  fadeOutMs: 100,
  trailOffMs: 150,
});

const HOMOGLYPH_MAP = {
  // Greek uppercase that look like Latin uppercase
  'Α':'A', 'Β':'B', 'Ε':'E', 'Η':'H', 'Ι':'I', 'Κ':'K',
  'Μ':'M', 'Ν':'N', 'Ο':'O', 'Ρ':'P', 'Τ':'T', 'Υ':'Y', 'Ζ':'Z',
  // Cyrillic uppercase that look like Latin uppercase
  'А':'A', 'В':'B', 'С':'C', 'Е':'E', 'Н':'H', 'К':'K',
  'М':'M', 'О':'O', 'Р':'P', 'Т':'T',
  // Cyrillic lowercase
  'а':'a', 'с':'c', 'е':'e', 'о':'o', 'р':'p',
};
const HOMOGLYPH_RE = new RegExp('[' + Object.keys(HOMOGLYPH_MAP).join('') + ']', 'g');
const ZERO_WIDTH_RE = new RegExp(
  '[' + [0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF].map(c => String.fromCharCode(c)).join('') + ']',
  'g',
);

function normalize(input) {
  return input
    .normalize('NFKC')
    .replace(ZERO_WIDTH_RE, '')
    .replace(HOMOGLYPH_RE, ch => HOMOGLYPH_MAP[ch] ?? ch);
}

function classifyPart(part) {
  if (part === '(') return { type: 'syllable_open' };
  if (part === ')') return { type: 'syllable_close' };
  if (part in PAUSE_MS) return { type: 'pause', ms: PAUSE_MS[part] };
  if (part === '!' || part === "'") return { type: 'stress_mark' };

  const bankSwitch = part.match(/^\[bank=([A-Za-z0-9_.\-]+)\]$/);
  if (bankSwitch) return { type: 'bank_switch', name: bankSwitch[1] };
  if (part === '[bank]') return { type: 'bank_reset' };

  const engineSwitch = part.match(/^\[engine=([A-Za-z0-9_.\-]+)\]$/);
  if (engineSwitch) return { type: 'engine_switch', name: engineSwitch[1] };
  if (part === '[engine]') return { type: 'engine_reset' };

  const bracket = part.match(/^\[(\w+)=(-?\d+(?:\.\d+)?)\]$/);
  if (bracket) {
    return { type: 'directive', key: bracket[1], value: Number(bracket[2]), relative: false };
  }

  // Bare uppercase bracket resets an extended (engine-specific) directive to its
  // default, e.g. `[FNZ]`. The value form `[FNZ=450]` is caught by the generic
  // bracket above; lowercase brackets are not directives.
  const bracketReset = part.match(/^\[([A-Z]\w*)\]$/);
  if (bracketReset) return { type: 'directive', key: bracketReset[1], reset: true };

  const noteForm = part.match(/^(b)(=)?([A-G][b#]?-?\d+)$/);
  if (noteForm) {
    const hz = noteToHz(noteForm[3]);
    if (hz != null) return { type: 'directive', key: 'base', value: hz, relative: false };
  }

  const compact = part.match(/^([a-z])(?:(=)?(([+-])?\d+(?:\.\d+)?))?$/);
  if (compact) {
    const [, letter, eq, full, sign] = compact;
    const keyMap = {
      b: 'base', r: 'rate', p: 'pause', s: 'scale',
      v: 'vibrato', w: 'vibratoRate',
      m: 'tremolo', n: 'tremoloRate',
      h: 'aspiration', t: 'tilt', g: 'effort',
    };
    const key = keyMap[letter];
    if (key) {
      if (full === undefined) {
        // Bare letter reset to initial value, drop bare `p`
        if (key !== 'pause') return { type: 'directive', key, reset: true };
        return null;
      }
      const value = Number(full);
      const relative = !eq && (sign === '+' || sign === '-');
      return { type: 'directive', key, value, relative };
    }
  }

  const phoneme = part.match(/^([A-Z]+)(['!])?(?:\(([+-]\d+(?:\.\d+)?)\)|([+-]\d+(?:\.\d+)?))?$/);
  if (phoneme) {
    const transientDelta = phoneme[3] !== undefined ? Number(phoneme[3]) : null;
    const stickyDelta = phoneme[4] !== undefined ? Number(phoneme[4]) : null;
    return {
      type: 'phoneme',
      code: phoneme[1],
      stressed: phoneme[2] !== undefined,
      pitchDelta: transientDelta ?? stickyDelta ?? 0,
      transient: transientDelta !== null,
    };
  }

  return { type: 'unknown', text: part };
}

function tokenize(rawInput) {
  const source = normalize(rawInput);
  const len = source.length;
  const tokens = [];
  let i = 0;

  const findBlockEnd = (start) => {
    const end = source.indexOf('*/', start + 2);
    return end === -1 ? len : end + 2;
  };

  while (i < len) {
    const c = source[i];
    if (/\s/.test(c)) { i++; continue; }
    // Line comment: # only at boundary (start of input or after whitespace).
    if (c === '#' && (i === 0 || /\s/.test(source[i - 1]))) {
      while (i < len && source[i] !== '\n') i++;
      continue;
    }
    // Block comment
    if (c === '/' && source[i + 1] === '*') {
      i = findBlockEnd(i);
      continue;
    }

    const srcStart = i;
    let part = '';
    while (i < len && !/\s/.test(source[i])) {
      if (source[i] === '/' && source[i + 1] === '*') {
        i = findBlockEnd(i);
        continue;
      }
      part += source[i];
      i++;
    }
    const srcEnd = i;
    if (!part) continue;

    const tok = classifyPart(part);
    if (!tok) continue;
    tok.srcStart = srcStart;
    tok.srcEnd = srcEnd;

    if (tok.type === 'stress_mark') {
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].type === 'phoneme') { tokens[j].stressed = true; break; }
      }
      continue;
    }
    tokens.push(tok);
  }

  return { tokens, source };
}

// Compile one voice section (a run of tokens with no [voice=N] marker) into a
// standalone schedule. Each section derives its initial state from opts.
function compileSection(tokens, opts = {}, source = '', sectionSrcStart = 0) {
  const initialBaseF0      = opts.baseF0 ?? DEFAULTS.baseF0;
  const initialRate        = opts.rate ?? DEFAULTS.rate;
  const initialScale       = opts.scale ?? 1.0;
  const initialVibrato     = opts.vibratoDepth ?? 0;
  const initialVibratoRate = opts.vibratoRate ?? 5;
  const initialTremolo     = opts.tremoloDepth ?? 0;
  const initialTremoloRate = opts.tremoloRate ?? 5;
  const initialAspiration  = opts.aspiration ?? 0;
  const initialTilt        = opts.tilt ?? 0;
  const initialEffort      = opts.effort ?? 0.5;
  const registry           = opts.registry ?? banks;
  const initialPhonemes    = resolveBank(opts.bank, registry).phonemes;
  let phonemes             = initialPhonemes;
  let f0           = initialBaseF0;
  let rate         = initialRate;
  let scale        = initialScale;
  let vibrato      = initialVibrato;
  let vibratoRate  = initialVibratoRate;
  let tremolo      = initialTremolo;
  let tremoloRate  = initialTremoloRate;
  let aspiration   = initialAspiration;
  let tilt         = initialTilt;
  let effort       = initialEffort;
  // Bare `b` / `r` / `s` / `v` / `h` / `t` / `g` reset to opts values
  let engine       = opts.engine ?? null;
  // Extended engine-specific directives (uppercase bracket forms like [OQ=0.6]).
  // klattsch does not interpret these; they ride into every subsequent schedule
  // target for a consuming engine to read.
  const extras = { ...(opts.extras ?? {}) };
  const schedule = [];
  const warnings = [];
  const phrases = [];
  let timeMs = 0;
  // phrase covers [phraseSrcStart .. token.srcEnd) of source and time
  // [phraseTimeStart .. timeMs] when the next sound finishes
  let phraseSrcStart = sectionSrcStart;
  let phraseTimeStart = 0;
  const emitPhrase = (t) => {
    phrases.push({
      srcStart: phraseSrcStart,
      srcEnd: t.srcEnd,
      // the audible token
      tokenSrcStart: t.srcStart,
      tStartMs: phraseTimeStart,
      tEndMs: timeMs,
      kind: t.type,
      phoneme: t.type === 'phoneme' ? t.code : null,
    });
    phraseSrcStart = t.srcEnd;
    phraseTimeStart = timeMs;
  };

  // Apply the running formant scale to a phoneme parameter set.
  // `glideTo` overrides the formant fields for diphthong endpoints
  const scaled = (p, f0Hz, glideTo = null) => {
    const src = glideTo ? { ...p, ...glideTo } : p;
    const out = {
      ...p, ...glideTo,
      F0: f0Hz,
      F1: src.F1 * scale, F2: src.F2 * scale, F3: src.F3 * scale,
      BW1: src.BW1 * scale, BW2: src.BW2 * scale, BW3: src.BW3 * scale,
    };
    // Scale any higher formant fields a bank defines (F4/BW4 and up) so an
    // engine reading them tracks the running formant scale like F1-3 do.
    for (const k of Object.keys(src)) {
      if (/^(F|BW)[4-9]$/.test(k)) out[k] = src[k] * scale;
    }
    return out;
  };

  const renderPhoneme = (t, slotMs) => {
    const p = phonemes[t.code];
    if (!p) {
      warnings.push(`unknown phoneme: ${t.code}`);
      return 0;
    }
    const startF0 = t.stressed ? f0 + DEFAULTS.stressF0Lift : f0;
    const endF0 = startF0 + t.pitchDelta;
    if (p.isStop) {
      const burstMs = Math.min(DEFAULTS.stopBurstMs, slotMs * 0.3);
      const silenceMs = slotMs - burstMs;
      silence(Math.min(20, silenceMs * 0.4));
      timeMs += silenceMs;
      emit(scaled(p, startF0), Math.min(5, burstMs * 0.2));
      timeMs += burstMs;
      return slotMs;
    } else if (p.glideTo) {
      const onset = slotMs * 0.25, glide = slotMs * 0.50, offset = slotMs * 0.25;
      emit(scaled(p, startF0), Math.min(20, onset));
      timeMs += onset;
      emit(scaled(p, endF0, p.glideTo), glide);
      timeMs += glide + offset;
      return slotMs;
    } else if (t.pitchDelta !== 0) {
      emit(scaled(p, startF0), Math.min(25, slotMs * 0.25));
      timeMs += slotMs * 0.25;
      emit(scaled(p, endF0), slotMs * 0.6);
      timeMs += slotMs * 0.75;
      return slotMs;
    } else {
      const trans = Math.min(DEFAULTS.defaultTransitionMs, slotMs * 0.4);
      emit(scaled(p, startF0), trans);
      timeMs += slotMs;
      return slotMs;
    }
  };

  let inSyllable = false;
  let syllableQueue = [];
  const flushSyllable = () => {
    if (!syllableQueue.length) { inSyllable = false; return; }
    const slot = rate / syllableQueue.length;
    for (const t of syllableQueue) {
      renderPhoneme(t, slot);
      emitPhrase(t);
      if (!t.transient) f0 += t.pitchDelta;
    }
    syllableQueue = [];
    inSyllable = false;
  };

  const stateExtras = () => ({
    vibratoDepth: vibrato,
    vibratoRate,
    tremoloDepth: tremolo,
    tremoloRate,
    aspiration,
    tilt,
    effort,
  });

  const emit = (target, transitionMs) => {
    schedule.push({
      atMs: timeMs,
      target: { ...target, ...extras, ...stateExtras() },
      transitionMs,
    });
  };
  const silence = (transitionMs = 30) => emit({ A1: 0, A2: 0, A3: 0 }, transitionMs);

  for (const t of tokens) {
    if (t.type === 'unknown') {
      warnings.push(`unknown token: ${t.text}`);
      continue;
    }

    if (t.type === 'bank_switch') {
      const target = registry.get(t.name);
      if (!target) {
        warnings.push(`unknown bank: ${t.name}`);
        continue;
      }
      phonemes = target.phonemes;
      continue;
    }
    if (t.type === 'bank_reset') {
      phonemes = initialPhonemes;
      continue;
    }

    if (t.type === 'engine_switch') {
      engine = t.name;
      continue;
    }
    if (t.type === 'engine_reset') {
      engine = opts.engine ?? null;
      continue;
    }

    if (t.type === 'syllable_open') {
      if (inSyllable) {
        warnings.push('nested ( ignored');
        continue;
      }
      inSyllable = true;
      syllableQueue = [];
      continue;
    }
    if (t.type === 'syllable_close') {
      if (!inSyllable) {
        warnings.push('unmatched )');
        continue;
      }
      flushSyllable();
      continue;
    }

    if (t.type === 'directive') {
      switch (t.key) {
        case 'base':
        case 'pitch':
          if (t.reset) f0 = initialBaseF0;
          else if (t.relative) f0 += t.value;
          else f0 = t.value;
          break;
        case 'rate':
          if (t.reset) rate = initialRate;
          else if (t.relative) rate += t.value;
          else rate = t.value;
          break;
        case 'scale':
          if (t.reset) scale = initialScale;
          else if (t.relative) scale += t.value;
          else scale = t.value;
          break;
        case 'vibrato':
          if (t.reset) vibrato = initialVibrato;
          else if (t.relative) vibrato += t.value;
          else vibrato = t.value;
          break;
        case 'vibratoRate':
          if (t.reset) vibratoRate = initialVibratoRate;
          else if (t.relative) vibratoRate += t.value;
          else vibratoRate = t.value;
          break;
        case 'tremolo':
          if (t.reset) tremolo = initialTremolo;
          else if (t.relative) tremolo += t.value;
          else tremolo = t.value;
          break;
        case 'tremoloRate':
          if (t.reset) tremoloRate = initialTremoloRate;
          else if (t.relative) tremoloRate += t.value;
          else tremoloRate = t.value;
          break;
        case 'aspiration':
          if (t.reset) aspiration = initialAspiration;
          else if (t.relative) aspiration += t.value;
          else aspiration = t.value;
          break;
        case 'tilt':
          if (t.reset) tilt = initialTilt;
          else if (t.relative) tilt += t.value;
          else tilt = t.value;
          break;
        case 'effort':
          if (t.reset) effort = initialEffort;
          else if (t.relative) effort += t.value;
          else effort = t.value;
          break;
        case 'pause':
          silence();
          timeMs += Math.abs(t.value);
          emitPhrase(t);
          break;
        default:
          // Uppercase directive keys (e.g. [OQ=0.6], [FNZ=450]) are extended,
          // engine-specific state. Accumulate them into `extras` so they ride
          // into every subsequent target; a bare [OQ] clears the override.
          if (/^[A-Z]/.test(t.key)) {
            if (t.reset) delete extras[t.key];
            else extras[t.key] = t.value;
          } else {
            warnings.push(`unknown directive: ${t.key}`);
          }
      }
      continue;
    }

    if (t.type === 'pause') {
      silence();
      timeMs += t.ms;
      emitPhrase(t);
      continue;
    }

    // phoneme: defer to the group buffer if inside (...), otherwise render
    // straight to the schedule
    if (inSyllable) {
      syllableQueue.push(t);
      continue;
    }

    const phoneRate = t.stressed ? rate * DEFAULTS.stressDurationFactor : rate;
    renderPhoneme(t, phoneRate);
    emitPhrase(t);

    if (!t.transient) f0 += t.pitchDelta;
  }

  if (inSyllable) {
    warnings.push('unclosed (');
    flushSyllable();
  }

  timeMs += DEFAULTS.sentenceFinalHoldMs;
  silence(DEFAULTS.fadeOutMs);
  timeMs += DEFAULTS.trailOffMs;

  // Hold the final phrase highlighted
  if (phrases.length) phrases[phrases.length - 1].tEndMs = timeMs;

  return { schedule, totalMs: timeMs, warnings, phrases, source, engine };
}

function compile(parsed, opts = {}) {
  // accept { tokens, source } shape from tokenize(), fallback to legacy array
  const tokens = Array.isArray(parsed) ? parsed : parsed.tokens;
  const source = Array.isArray(parsed) ? '' : (parsed.source ?? '');

  // Partition tokens into voice sections at each [voice=N] marker. Sections are
  // positional. Text before the first marker is voice 0. Each section compiles
  // independently.
  const sections = [[]];
  const sectionStarts = [0];
  for (const t of tokens) {
    if (t.type === 'directive' && t.key === 'voice') {
      sections.push([]);
      sectionStarts.push(t.srcEnd ?? 0);
      continue;
    }
    sections[sections.length - 1].push(t);
  }

  const voices = sections.map((toks, i) => compileSection(toks, opts, source, sectionStarts[i]));

  // Backward-compatible top level: schedule/phrases are voice 0, totalMs is the
  // max across sections, warnings are merged.
  return {
    schedule: voices[0].schedule,
    totalMs: Math.max(...voices.map(v => v.totalMs)),
    warnings: voices.flatMap(v => v.warnings),
    phrases: voices[0].phrases,
    engine: voices[0].engine,
    source,
    voices: voices.map(v => ({ schedule: v.schedule, totalMs: v.totalMs, phrases: v.phrases, engine: v.engine })),
  };
}

function compileString(input, opts) {
  return compile(tokenize(input), opts);
}

/* ---- wav.js ---- */
// Minimal RIFF/WAVE encoder w/ normalization. Optionally embeds a LIST INFO
// chunk after the data chunk with ISFT (software identifier) and ICMT (free-form
// comment, used here to round-trip the source utterance string).

function buildInfoChunk(metadata) {
  const enc = new TextEncoder();
  const subs = [];
  if (metadata.software) subs.push({ id: 'ISFT', data: enc.encode(metadata.software) });
  if (metadata.comment)  subs.push({ id: 'ICMT', data: enc.encode(metadata.comment) });
  if (!subs.length) return null;
  // LIST payload = 'INFO' fourcc (4 bytes) + each sub-chunk (8-byte header
  // + data + 1 byte of padding to keep chunks word-aligned when odd-sized).
  let payloadSize = 4;
  for (const s of subs) payloadSize += 8 + s.data.length + (s.data.length % 2);
  const out = new Uint8Array(8 + payloadSize);
  const dv = new DataView(out.buffer);
  let o = 0;
  out.set([0x4C, 0x49, 0x53, 0x54], o); o += 4;
  dv.setUint32(o, payloadSize, true); o += 4;
  out.set([0x49, 0x4E, 0x46, 0x4F], o); o += 4;
  for (const s of subs) {
    for (let i = 0; i < 4; i++) out[o + i] = s.id.charCodeAt(i);
    o += 4;
    dv.setUint32(o, s.data.length, true); o += 4;
    out.set(s.data, o);
    o += s.data.length + (s.data.length % 2);
  }
  return out;
}

function encodeWav(float32, sampleRate, { peakNormalize = 0.95, metadata = null } = {}) {
  let gain = 1;
  if (peakNormalize) {
    let peak = 0;
    for (let i = 0; i < float32.length; i++) {
      const a = float32[i] < 0 ? -float32[i] : float32[i];
      if (a > peak) peak = a;
    }
    if (peak > 0) gain = peakNormalize / peak;
  }

  const dataBytes = float32.length * 2;
  const infoBytes = metadata ? buildInfoChunk(metadata) : null;
  const totalSize = 44 + dataBytes + (infoBytes ? infoBytes.length : 0);
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);

  view.setUint32(0,  0x52494646, false);     // "RIFF"
  view.setUint32(4,  totalSize - 8, true);
  view.setUint32(8,  0x57415645, false);     // "WAVE"
  view.setUint32(12, 0x666d7420, false);     // "fmt "
  view.setUint32(16, 16, true);              // PCM fmt chunk size
  view.setUint16(20, 1, true);               // format = PCM
  view.setUint16(22, 1, true);               // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false);     // "data"
  view.setUint32(40, dataBytes, true);

  const offset = 44;
  for (let i = 0; i < float32.length; i++) {
    let s = float32[i] * gain;
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    view.setInt16(offset + i * 2, Math.round(s * 32767), true);
  }

  if (infoBytes) u8.set(infoBytes, 44 + dataBytes);

  return { bytes: new Uint8Array(buf), gain };
}

/* ---- kana.js ---- */
/**
 * Japanese kana/romaji to klattsch phoneme conversion.
 *
 * import { kanaToPhonemes, romajiToPhonemes } from 'klattsch/kana';
 * kanaToPhonemes('こんにちは')  // [{code:'K'},{code:'O'},{code:'N'},{code:'N'},{code:'I'},{code:'CH'},{code:'I'},{code:'HH'},{code:'A'}]
 * romajiToPhonemes('konnichiha') // same
 */

const KANA_MAP = {
  'あ': ['A'], 'い': ['I'], 'う': ['U'], 'え': ['E'], 'お': ['O'],
  'か': ['K','A'], 'き': ['K','I'], 'く': ['K','U'], 'け': ['K','E'], 'こ': ['K','O'],
  'さ': ['S','A'], 'し': ['SH','I'], 'す': ['S','U'], 'せ': ['S','E'], 'そ': ['S','O'],
  'た': ['T','A'], 'ち': ['CH','I'], 'つ': ['T','S','U'], 'て': ['T','E'], 'と': ['T','O'],
  'な': ['N','A'], 'に': ['N','I'], 'ぬ': ['N','U'], 'ね': ['N','E'], 'の': ['N','O'],
  'は': ['HH','A'], 'ひ': ['HH','I'], 'ふ': ['F','U'], 'へ': ['HH','E'], 'ほ': ['HH','O'],
  'ま': ['M','A'], 'み': ['M','I'], 'む': ['M','U'], 'め': ['M','E'], 'も': ['M','O'],
  'や': ['Y','A'], 'ゆ': ['Y','U'], 'よ': ['Y','O'],
  'ら': ['DX','A'], 'り': ['DX','I'], 'る': ['DX','U'], 'れ': ['DX','E'], 'ろ': ['DX','O'],
  'わ': ['W','A'], 'を': ['O'], 'ん': ['N'],

  // dakuten
  'が': ['G','A'], 'ぎ': ['G','I'], 'ぐ': ['G','U'], 'げ': ['G','E'], 'ご': ['G','O'],
  'ざ': ['Z','A'], 'じ': ['JH','I'], 'ず': ['Z','U'], 'ぜ': ['Z','E'], 'ぞ': ['Z','O'],
  'だ': ['D','A'], 'ぢ': ['JH','I'], 'づ': ['Z','U'], 'で': ['D','E'], 'ど': ['D','O'],
  'ば': ['B','A'], 'び': ['B','I'], 'ぶ': ['B','U'], 'べ': ['B','E'], 'ぼ': ['B','O'],

  // handakuten
  'ぱ': ['P','A'], 'ぴ': ['P','I'], 'ぷ': ['P','U'], 'ぺ': ['P','E'], 'ぽ': ['P','O'],

  // yoon (combo kana)
  'きゃ': ['K','Y','A'], 'きゅ': ['K','Y','U'], 'きょ': ['K','Y','O'],
  'しゃ': ['SH','A'], 'しゅ': ['SH','U'], 'しょ': ['SH','O'],
  'ちゃ': ['CH','A'], 'ちゅ': ['CH','U'], 'ちょ': ['CH','O'],
  'にゃ': ['N','Y','A'], 'にゅ': ['N','Y','U'], 'にょ': ['N','Y','O'],
  'ひゃ': ['HH','Y','A'], 'ひゅ': ['HH','Y','U'], 'ひょ': ['HH','Y','O'],
  'みゃ': ['M','Y','A'], 'みゅ': ['M','Y','U'], 'みょ': ['M','Y','O'],
  'りゃ': ['DX','Y','A'], 'りゅ': ['DX','Y','U'], 'りょ': ['DX','Y','O'],
  'ぎゃ': ['G','Y','A'], 'ぎゅ': ['G','Y','U'], 'ぎょ': ['G','Y','O'],
  'じゃ': ['JH','A'], 'じゅ': ['JH','U'], 'じょ': ['JH','O'],
  'びゃ': ['B','Y','A'], 'びゅ': ['B','Y','U'], 'びょ': ['B','Y','O'],
  'ぴゃ': ['P','Y','A'], 'ぴゅ': ['P','Y','U'], 'ぴょ': ['P','Y','O'],

  // small tsu (geminate) handled separately
  'っ': ['_GEMINATE'],

  // long vowel
  'ー': ['_LONG'],
};

// katakana: shift codepoint range to hiragana
function kataToHira(ch) {
  const cp = ch.codePointAt(0);
  if (cp >= 0x30A1 && cp <= 0x30F6) return String.fromCodePoint(cp - 0x60);
  if (cp === 0x30FC) return 'ー';
  return ch;
}

function kanaToPhonemes(text) {
  const hira = [...text].map(kataToHira).join('');
  const result = [];
  let i = 0;

  while (i < hira.length) {
    // try 2-char yoon first
    if (i + 1 < hira.length) {
      const pair = hira[i] + hira[i + 1];
      if (KANA_MAP[pair]) {
        result.push(...KANA_MAP[pair].map(code => ({ code, stressed: false })));
        i += 2;
        continue;
      }
    }

    const ch = hira[i];
    if (KANA_MAP[ch]) {
      const codes = KANA_MAP[ch];
      if (codes[0] === '_GEMINATE') {
        // double the next consonant (add a pause)
        result.push({ code: '_', stressed: false });
      } else if (codes[0] === '_LONG') {
        // extend the previous vowel
        if (result.length) {
          const prev = result[result.length - 1];
          result.push({ code: prev.code, stressed: false });
        }
      } else {
        result.push(...codes.map(code => ({ code, stressed: false })));
      }
    }
    // skip unknown characters (spaces, punctuation)
    i++;
  }

  return result.length ? result : null;
}

// Romaji to phoneme mapping
const ROMAJI_MAP = {
  'a': ['A'], 'i': ['I'], 'u': ['U'], 'e': ['E'], 'o': ['O'],
  'ka': ['K','A'], 'ki': ['K','I'], 'ku': ['K','U'], 'ke': ['K','E'], 'ko': ['K','O'],
  'sa': ['S','A'], 'shi': ['SH','I'], 'si': ['SH','I'], 'su': ['S','U'], 'se': ['S','E'], 'so': ['S','O'],
  'ta': ['T','A'], 'chi': ['CH','I'], 'ti': ['CH','I'], 'tsu': ['T','S','U'], 'tu': ['T','S','U'], 'te': ['T','E'], 'to': ['T','O'],
  'na': ['N','A'], 'ni': ['N','I'], 'nu': ['N','U'], 'ne': ['N','E'], 'no': ['N','O'],
  'ha': ['HH','A'], 'hi': ['HH','I'], 'fu': ['F','U'], 'hu': ['F','U'], 'he': ['HH','E'], 'ho': ['HH','O'],
  'ma': ['M','A'], 'mi': ['M','I'], 'mu': ['M','U'], 'me': ['M','E'], 'mo': ['M','O'],
  'ya': ['Y','A'], 'yu': ['Y','U'], 'yo': ['Y','O'],
  'ra': ['DX','A'], 'ri': ['DX','I'], 'ru': ['DX','U'], 're': ['DX','E'], 'ro': ['DX','O'],
  'wa': ['W','A'], 'wo': ['O'], 'nn': ['N'], "n'": ['N'],
  'ga': ['G','A'], 'gi': ['G','I'], 'gu': ['G','U'], 'ge': ['G','E'], 'go': ['G','O'],
  'za': ['Z','A'], 'ji': ['JH','I'], 'zi': ['JH','I'], 'zu': ['Z','U'], 'ze': ['Z','E'], 'zo': ['Z','O'],
  'da': ['D','A'], 'di': ['JH','I'], 'du': ['Z','U'], 'de': ['D','E'], 'do': ['D','O'],
  'ba': ['B','A'], 'bi': ['B','I'], 'bu': ['B','U'], 'be': ['B','E'], 'bo': ['B','O'],
  'pa': ['P','A'], 'pi': ['P','I'], 'pu': ['P','U'], 'pe': ['P','E'], 'po': ['P','O'],
  'kya': ['K','Y','A'], 'kyu': ['K','Y','U'], 'kyo': ['K','Y','O'],
  'sha': ['SH','A'], 'shu': ['SH','U'], 'sho': ['SH','O'],
  'cha': ['CH','A'], 'chu': ['CH','U'], 'cho': ['CH','O'],
  'nya': ['N','Y','A'], 'nyu': ['N','Y','U'], 'nyo': ['N','Y','O'],
  'hya': ['HH','Y','A'], 'hyu': ['HH','Y','U'], 'hyo': ['HH','Y','O'],
  'mya': ['M','Y','A'], 'myu': ['M','Y','U'], 'myo': ['M','Y','O'],
  'rya': ['DX','Y','A'], 'ryu': ['DX','Y','U'], 'ryo': ['DX','Y','O'],
  'gya': ['G','Y','A'], 'gyu': ['G','Y','U'], 'gyo': ['G','Y','O'],
  'ja': ['JH','A'], 'ju': ['JH','U'], 'jo': ['JH','O'],
  'bya': ['B','Y','A'], 'byu': ['B','Y','U'], 'byo': ['B','Y','O'],
  'pya': ['P','Y','A'], 'pyu': ['P','Y','U'], 'pyo': ['P','Y','O'],
};

// Sort by length descending for greedy matching
const ROMAJI_KEYS = Object.keys(ROMAJI_MAP).sort((a, b) => b.length - a.length);

function romajiToPhonemes(text) {
  const lower = text.toLowerCase().replace(/\s+/g, '');
  const result = [];
  let i = 0;

  while (i < lower.length) {
    // nn = syllabic N + next syllable starting with n
    if (lower[i] === 'n' && lower[i + 1] === 'n') {
      result.push({ code: 'N', stressed: false });
      i++;
      continue;
    }

    // geminate: doubled consonant (not nn)
    if (i + 1 < lower.length && lower[i] === lower[i + 1] && !/[aeioun]/.test(lower[i])) {
      result.push({ code: '_', stressed: false });
      i++;
      continue;
    }

    // n before consonant or end (not followed by a vowel or y)
    if (lower[i] === 'n' && i + 1 < lower.length && !/[aeiouny]/.test(lower[i + 1])) {
      result.push({ code: 'N', stressed: false });
      i++;
      continue;
    }
    if (lower[i] === 'n' && i + 1 === lower.length) {
      result.push({ code: 'N', stressed: false });
      i++;
      continue;
    }

    let matched = false;
    for (const key of ROMAJI_KEYS) {
      if (lower.startsWith(key, i)) {
        result.push(...ROMAJI_MAP[key].map(code => ({ code, stressed: false })));
        i += key.length;
        matched = true;
        break;
      }
    }
    if (!matched) i++;
  }

  return result.length ? result : null;
}

function isKana(text) {
  return /[぀-ゟ゠-ヿ]/.test(text);
}

function japaneseToPhonemes(text) {
  if (isKana(text)) return kanaToPhonemes(text);
  if (/^[a-z']+$/i.test(text.replace(/\s/g, ''))) return romajiToPhonemes(text);
  return kanaToPhonemes(text);
}

global.klattsch = {
    compileString: (typeof compileString !== 'undefined' ? compileString : undefined),
    tokenize: (typeof tokenize !== 'undefined' ? tokenize : undefined),
    compile: (typeof compile !== 'undefined' ? compile : undefined),
    renderToBuffer: (typeof renderToBuffer !== 'undefined' ? renderToBuffer : undefined),
    FormantSynth: (typeof FormantSynth !== 'undefined' ? FormantSynth : undefined),
    encodeWav: (typeof encodeWav !== 'undefined' ? encodeWav : undefined),
    banks: (typeof banks !== 'undefined' ? banks : undefined),
    resolveBank: (typeof resolveBank !== 'undefined' ? resolveBank : undefined),
    registerBank: (typeof registerBank !== 'undefined' ? registerBank : undefined),
    phonemes: (typeof phonemes !== 'undefined' ? phonemes : undefined),
    PHONEME_KEYS: (typeof PHONEME_KEYS !== 'undefined' ? PHONEME_KEYS : undefined),
    DEFAULT: (typeof DEFAULT !== 'undefined' ? DEFAULT : undefined),
    PARAMS: (typeof PARAMS !== 'undefined' ? PARAMS : undefined),
    kanaToPhonemes: (typeof kanaToPhonemes !== 'undefined' ? kanaToPhonemes : undefined),
    romajiToPhonemes: (typeof romajiToPhonemes !== 'undefined' ? romajiToPhonemes : undefined),
    japaneseToPhonemes: (typeof japaneseToPhonemes !== 'undefined' ? japaneseToPhonemes : undefined),
    isKana: (typeof isKana !== 'undefined' ? isKana : undefined)
};
})(typeof window !== 'undefined' ? window : globalThis);
