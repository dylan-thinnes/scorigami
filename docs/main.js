import { rawGames as rawGamesNFL } from './raw-games-nfl.js';
import { rawGames as rawGamesCFL } from './raw-games-cfl.js';
import { rawGames as rawGamesNCAAF } from './raw-games-ncaaf.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
//import { chroma } from 'chroma-js';

window.chroma = chroma;

class Score {
  constructor (games) {
    this.games = games.toSorted(Games.compare);

    let idx = 1;
    for (let game of this.games) {
      game.nth_of_score = idx;
      idx++;
    }
  }

  get isEternal () {
    return this.games.length == 1;
  }

  get first () {
    return this.games[0];
  }

  get pts_win () { return this.first.pts_win; }
  get pts_lose () { return this.first.pts_lose; }

  allBefore (game) {
    return this.games.filter(g => Games.compare(g, game) < 1);
  }

  lastBefore (game) {
    if (game == null) return null;
    return this.games.findLast(g => g.nth_of_history <= game.nth_of_history);
  }

  firstAfter (game) {
    if (game == null) return this.games[0];
    return this.games.find(g => g.nth_of_history >= game.nth_of_history);
  }
}

class Games {
  static compare (game1, game2) {
    return game1.game_date == game2.game_date ? 0 : game1.game_date < game2.game_date ? -1 : 1;
  }

  static sameScore (game1, game2) {
    return game1.pts_win == game2.pts_win && game1.pts_lose == game2.pts_lose;
  }

  constructor (games) {
    let rawGamesCopy = JSON.parse(JSON.stringify(games)); // A dirty trick, but effective
    this.all = rawGamesCopy.sort(Games.compare);

    // Set up history index and pointers to prev/last
    let idx = 1;
    let lastGame = null;
    for (let game of this.all) {
      game.nth_of_history = idx;
      game.previous = lastGame;
      if (lastGame != null) lastGame.next = game;

      lastGame = game;
      idx++;
    }

    // Initialize scores array, queried via `score` method
    let scoreLists = {};
    for (let game of this.all) {
      if (scoreLists[game.boxscore_title] == null) {
        scoreLists[game.boxscore_title] = [];
      }
      scoreLists[game.boxscore_title].push(game);
    }

    this.scores = [];
    for (let [scoreTitle, scoreList] of Object.entries(scoreLists)) {
      this.scores[scoreTitle] = new Score(scoreList);
    }

    let highestSoFar = null;
    for (let score of Object.values(this.scores)) {
      if (highestSoFar == null
          || score.pts_win > highestSoFar.pts_win
          || score.pts_win == highestSoFar.pts_win && score.pts_lose > highestSoFar.pts_lose) {
        highestSoFar = score;
      }
    }
    this.highestWin = highestSoFar;

    highestSoFar = null;
    for (let score of Object.values(this.scores)) {
      if (highestSoFar == null
          || score.pts_lose > highestSoFar.pts_lose
          || score.pts_lose == highestSoFar.pts_lose && score.pts_win > highestSoFar.pts_win) {
        highestSoFar = score;
      }
    }
    this.highestLoss = highestSoFar;
  }

  score (pts_win, pts_lose) {
    return this.scores[`${winning}_${losing}`];
  }
};

const allGamesNFL = new Games(rawGamesNFL);
const allGamesCFL = new Games(rawGamesCFL);
const allGamesNCAAF = new Games(rawGamesNCAAF);

class PickHelper {
  constructor (ui) {
    this.ui = ui;
    this.raycaster = new THREE.Raycaster();
    this.pickedObject = null;
    this.pickedObjectSavedColor = 0;
  }

  pick (normalizedPosition) {
    // restore the color if there is a picked object
    if (this.pickedObject) {
      this.pickedObject.material.color.setHex(this.pickedObjectSavedColor);
      this.pickedObject = undefined;
    }

    // cast a ray through the frustum
    this.raycaster.setFromCamera(normalizedPosition, ui.camera);
    // get the list of objects the ray intersected
    const intersectedObjects = this.raycaster.intersectObjects(ui.scene.children).filter(intersection =>
      this.ui.scoreCubesToScores.get(intersection.object) != null);
    if (intersectedObjects.length > 0) {
      // pick the first object. It's the closest one
      this.pickedObject = intersectedObjects[0].object;
      // save its color
      this.pickedObjectSavedColor = this.pickedObject.material.color.getHex();
      // set its color to red
      this.pickedObject.material.color.setHex(0x888888);
    }
  }
}

class UI {
  get columnWidth () {
    return 1.0 - this.gaps * 2;
  }

  initializeScore (score) {
    let scoreScene = {}
    this.scoreScenes.set(score, scoreScene);

    // placeholder geometry & material until updateScoreHeight runs
    let geometry = new THREE.BoxGeometry(1, 1, 1);
    let material = new THREE.MeshPhongMaterial({ color: 0x44dd77, opacity: 0.9, transparent: true });
    scoreScene.cube = new THREE.Mesh(geometry, material);
    this.scoreCubesToScores.set(scoreScene.cube, score)

    this.updateScoreHeight(score, score.games.length, score.games.length, x => "#44dd77");
    this.disableScore(score);
  }

  makeColumn (height) {
    let geometry = new THREE.BoxGeometry(this.columnWidth, height, this.columnWidth);
    geometry.translate(
      geometry.parameters.width / 2,
      geometry.parameters.height / 2,
      geometry.parameters.depth / 2,
    );
    return geometry;
  }

  updateScoreHeight (score, height, games, toColor) {
    let scoreScene = this.scoreScenes.get(score);
    scoreScene.cube.geometry.dispose();
    scoreScene.cube.geometry = this.makeColumn(height);
    scoreScene.cube.material.dispose();
    scoreScene.cube.material = new THREE.MeshPhongMaterial({ color: toColor(games), opacity: 0.9, transparent: true });
    scoreScene.cube.position.x = score.games[0].pts_win + this.gaps;
    scoreScene.cube.position.z = score.games[0].pts_lose + this.gaps;
    this.scene.add(scoreScene.cube);
  }

  disableScore (score) {
    let scoreScene = this.scoreScenes.get(score);
    scoreScene.lastSetHeight = null;
    this.scene.remove(scoreScene.cube);
  }

  enableCursor (x, y, z) {
    this.gameCursor.cube.position.x = x;
    this.gameCursor.cube.position.y = y;
    this.gameCursor.cube.position.z = z;
    this.scene.add(this.gameCursor.cube);
  }
  disableCursor () { this.scene.remove(this.gameCursor.cube); }

  makeTextTileMaterial (text) {
      let ctx = document.createElement("canvas").getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.canvas.width = 128;
      ctx.canvas.height = 128;
      ctx.fillStyle = "#ddd";
      ctx.font = "bold 60px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 64, 64);

      let texture = new THREE.CanvasTexture(ctx.canvas);
      let material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
      material.map.minFilter = material.map.magFilter = THREE.LinearFilter;
      return material;
  }

  constructor () {
    this.gaps = 0.1;
    this.lastZScale = null;
    this.zScale = 0.25;

    this.lastCutoff = [null, null];

    this.scene = new THREE.Scene();
    const color = new THREE.Color().setHex(0xdddddd);
    this.scene.background = color;

    const light = new THREE.PointLight(0xFFFFFF, 50000);
    light.position.set(-100, 100, 50);
    this.scene.add(light);

    const light2 = new THREE.PointLight(0xFFFFFF, 25000);
    light2.position.set(100, -100, -100);
    this.scene.add(light2);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    this.gameCursor = {};

    this.gameCursor.geometry = new THREE.BoxGeometry(
      this.columnWidth,
      100000 / 2,
      this.columnWidth
    );
    this.gameCursor.geometry.translate(
      this.gameCursor.geometry.parameters.width / 2,
      this.gameCursor.geometry.parameters.height / 2,
      this.gameCursor.geometry.parameters.depth / 2,
    );

    this.gameCursor.material = new THREE.MeshPhongMaterial( { color: 0x00ffff } );
    this.gameCursor.cube = new THREE.Mesh(
      this.gameCursor.geometry,
      this.gameCursor.material
    );

    this.zScaleSlider = new DualHRangeBar("zScale", {
      size: 'default',
      lowerBound: 0,
      upperBound: 1,
      lower: 0.25,
      upper: 0.25,
      sliderColor: '#1ac360',
      sliderActiveColor: '#00aa49',
      rangeColor: '#44dd77',
      rangeActiveColor: '#00aa49',
      bgColor: '#44dd77',
      minSpan: 0.0001,
      maxSpan: 0.0001,
    });

    this.zScaleSlider.container.addEventListener("update", () => {
      this.zScale = this.zScaleSlider.lower;
    });
  }

  initialize (games) {
    this.games = games;

    if (this.scoreScenes != null) {
      for (let scoreScene of this.scoreScenes) {
        this.scene.remove(scoreScene[1].cube);
      }
    }

    this.scoreScenes = new Map();
    this.scoreCubesToScores = new Map();
    for (let score of Object.values(this.games.scores)) {
      this.initializeScore(score);
    }

    if (this.winAxisScoreBoxes != null) {
      for (let scoreBox of this.winAxisScoreBoxes) {
        this.scene.remove(scoreBox);
      }
    }
    this.winAxisScoreBoxes = [];
    for (let ii = 0; ii <= this.games.highestWin.pts_win; ii++) {
      let material = this.makeTextTileMaterial(`${ii}`);
      let geometry = new THREE.BoxGeometry(1.0, 0, 1.0);

      let winAxisScoreBox = new THREE.Mesh(geometry, material);
      winAxisScoreBox.position.x = ii + 0.5;
      winAxisScoreBox.position.z = -0.5;
      this.winAxisScoreBoxes.push(winAxisScoreBox);
      this.scene.add(winAxisScoreBox);
    }

    if (this.loseAxisScoreBoxes != null) {
      for (let scoreBox of this.loseAxisScoreBoxes) {
        this.scene.remove(scoreBox);
      }
    }
    this.loseAxisScoreBoxes = [];
    for (let ii = 0; ii <= this.games.highestLoss.pts_lose; ii++) {
      let material = this.makeTextTileMaterial(`${ii}`);
      let geometry = new THREE.BoxGeometry(1.0, 0, 1.0);

      let loseAxisScoreBox = new THREE.Mesh(geometry, material);
      loseAxisScoreBox.position.x = ii - 0.5; // this.games.highestWin.pts_win + 1.5;
      loseAxisScoreBox.position.z = ii + 0.5;
      this.loseAxisScoreBoxes.push(loseAxisScoreBox);
      this.scene.add(loseAxisScoreBox);
    }

    let impossibleTilesPositions = [
      { pts_win: 1, pts_lose: 0, length: 1 },
      { pts_win: 1, pts_lose: 1, length: 1 },
      { pts_win: 2, pts_lose: 1, length: 1 },
      { pts_win: 3, pts_lose: 1, length: 1 },
      { pts_win: 4, pts_lose: 1, length: 1 },
      { pts_win: 5, pts_lose: 1, length: 1 },
      { pts_win: 7, pts_lose: 1, length: 1 },
    ];
    for (let ii = -1; ii < this.games.highestLoss.pts_lose; ii++) {
      impossibleTilesPositions.push({ pts_win: ii, pts_lose: ii + 1, length: this.games.highestLoss.pts_lose - ii });
    }
    for (let ii = 0; ii <= this.games.highestWin.pts_win; ii++) {
      impossibleTilesPositions.push({ pts_win: ii, pts_lose: -1, length: 1 });
    }

    if (this.impossibleTiles != null) {
      for (let impossibleTile of this.impossibleTiles) {
        this.scene.remove(impossibleTile);
      }
    }
    this.impossibleTiles = [];
    for (let position of impossibleTilesPositions) {
      let material = new THREE.MeshBasicMaterial( { color: 0x333333 } );
      let geometry = new THREE.BoxGeometry(1.0, 0.1, position.length);

      let greyTile = new THREE.Mesh(geometry, material);
      greyTile.position.x = position.pts_win + 0.5;
      greyTile.position.y = -0.1;
      greyTile.position.z = position.pts_lose + position.length / 2;
      this.impossibleTiles.push(greyTile);
      this.scene.add(greyTile);
    }

    let sliderContainer = document.getElementById("sliderContainer");
    if (this.sliderEl != null) {
      sliderContainer.removeChild(this.sliderEl);
    }
    this.sliderEl = document.createElement("div");
    this.sliderEl.id = "slider";
    sliderContainer.appendChild(this.sliderEl);

    this.slider = new DualVRangeBar("slider", {
      size: 'default',
      lowerBound: this.defaultBounds()[0],
      upperBound: this.defaultBounds()[1],
      sliderColor: '#1ac360',
      sliderActiveColor: '#00aa49',
      rangeColor: '#44dd77',
      rangeActiveColor: '#00aa49',
      minSpan: 0,
    });

    this.cutoff = this.sliderBounds();
    this.sliderEl.addEventListener("update", () => {
      this.cutoff = this.sliderBounds();
    });
  }

  defaultBounds () {
    return [0, this.games.all.length];
  }

  sliderBounds () {
    return [
      Math.round(this.defaultBounds()[1] - this.slider.upper),
      Math.round(this.defaultBounds()[1] - this.slider.lower)
    ];
  }

  activateColumns () {
    let [lastLowerCutoff, lastUpperCutoff] = this.lastCutoff;
    let [lowerCutoff, upperCutoff] = this.cutoff;

    let lowerCutoffChanged = lastLowerCutoff != lowerCutoff;
    let upperCutoffChanged = lastUpperCutoff != upperCutoff;
    let zScaleChanged = this.lastZScale != this.zScale;

    if (lowerCutoffChanged || upperCutoffChanged || zScaleChanged) {
      let lowerGame = this.cutoff[0] == 0 ? null : this.games.all[this.cutoff[0] - 1];
      let upperGame = this.cutoff[1] == 0 ? null : this.games.all[this.cutoff[1] - 1];

      this.lastCutoff = [lowerCutoff, upperCutoff];
      this.lastZScale = this.zScale;

      this.disableCursor();

      let gameInfoBox = document.getElementById("game");
      if (upperGame == null) {
        gameInfoBox.innerHTML = "No game.";
      } else {
        gameInfoBox.innerHTML = `${upperGame.winner} v ${upperGame.loser}, ${upperGame.pts_win} - ${upperGame.pts_lose}, ${upperGame.game_date}${upperGame.nth_of_score === 1 ? " (SCORIGAMI)" : ""}`;
      }

      for (let score of Object.values(this.games.scores)) {
        let firstGame = score.firstAfter(lowerGame);
        let lastGame = score.lastBefore(upperGame);
        let gamesBetween = firstGame == null || lastGame == null ? 0 : lastGame.nth_of_score - firstGame.nth_of_score + 1;
        let scoreScene = this.scoreScenes.get(score);
        scoreScene.gamesBetween = gamesBetween;
      }

      let allGamesBetween = Object.values(this.games.scores).map(score => this.scoreScenes.get(score).gamesBetween).filter(g => g != 0);
      let maxGamesBetween = allGamesBetween.reduce((x, y) => Math.max(x, y), 0);
      let limits = chroma.limits(allGamesBetween, 'q', 4);
      let toColor = games => chroma.scale(['blue', 'cyan', 'lime', 'yellow', 'red']).domain(limits)(games).hex();

      for (let score of Object.values(this.games.scores)) {
        let scoreScene = this.scoreScenes.get(score);
        if (scoreScene.gamesBetween <= 0) {
          this.disableScore(score);
        } else {
          let scoreScene = this.scoreScenes.get(score);
          if (scoreScene.lastSetHeight != scoreScene.gamesBetween || zScaleChanged) {
            scoreScene.lastSetHeight = scoreScene.gamesBetween;
            this.updateScoreHeight(score, this.zScale == 0 ? 0.01 : scoreScene.gamesBetween * this.zScale, scoreScene.gamesBetween, toColor);
          }
        }
      }
    }
  }
}

const ui = new UI();
window.ui = ui;

ui.camera.position.x = -23;
ui.camera.position.y = 75;
ui.camera.position.z = 40;
ui.controls.target.set(37.48, 34.29, 6.73);

let leagues = {
  'league-nfl': allGamesNFL,
  'league-cfl': allGamesCFL,
  'league-ncaaf': allGamesNCAAF,
};
let currentLeague = 'league-nfl';
ui.initialize(leagues[currentLeague]);
let leagueEls = [...document.getElementsByClassName('league-radio')];
for (let leagueEl of leagueEls) {
  leagueEl.checked = leagueEl.id == "league-nfl";
  leagueEl.addEventListener('change', e => {
    if (e.srcElement.checked && e.srcElement.id != currentLeague) {
      currentLeague = e.srcElement.id;
      ui.initialize(leagues[currentLeague]);
    }
  });
}

const pickHelper = new PickHelper(ui);
function animate() {
  ui.renderer.render(ui.scene, ui.camera);
  ui.controls.update();
  pickHelper.pick(pickPosition);
  ui.activateColumns();
}
ui.renderer.setAnimationLoop( animate );

function roundToNearestScorigami(cutoff) {
  let roundedCutoff = cutoff;
  while ((roundedCutoff == 0 || allGamesCFL.all[roundedCutoff - 1].nth_of_score != 1) && roundedCutoff < allGamesCFL.all.length) {
    roundedCutoff += 1;
  }
  return roundedCutoff;
}

const pickPosition = {x: 0, y: 0};
clearPickPosition();

function getCanvasRelativePosition(event) {
  const rect = ui.renderer.domElement.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * ui.renderer.domElement.width  / rect.width,
    y: (event.clientY - rect.top ) * ui.renderer.domElement.height / rect.height,
  };
}
 
function setPickPosition(event) {
  const pos = getCanvasRelativePosition(event);
  pickPosition.x = (pos.x / ui.renderer.domElement.width ) *  2 - 1;
  pickPosition.y = (pos.y / ui.renderer.domElement.height) * -2 + 1;  // note we flip Y
}
 
function clearPickPosition() {
  // unlike the mouse which always has a position
  // if the user stops touching the screen we want
  // to stop picking. For now we just pick a value
  // unlikely to pick something
  pickPosition.x = -100000;
  pickPosition.y = -100000;
}

window.addEventListener('mousemove', setPickPosition);
window.addEventListener('mouseout', clearPickPosition);
window.addEventListener('mouseleave', clearPickPosition);

document.getElementById('settings-toggler').addEventListener('click', () => {
  document.getElementById('settings-box').classList.toggle('open');
});
