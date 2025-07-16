import { rawGames } from './raw-games.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

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

const Games = {
  compare (game1, game2) {
    return game1.game_date == game2.game_date ? 0 : game1.game_date < game2.game_date ? -1 : 1;
  },

  sameScore (game1, game2) {
    return game1.pts_win == game2.pts_win && game1.pts_lose == game2.pts_lose;
  },

  initialize () {
    let rawGamesCopy = JSON.parse(JSON.stringify(rawGames)); // A dirty trick, but effective
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
    for (let game of Games.all) {
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
  },

  score (pts_win, pts_lose) {
    return this.scores[`${winning}_${losing}`];
  }
};

Games.initialize();
window.Games = Games;

class PickHelper {
  constructor () {
    this.raycaster = new THREE.Raycaster();
    this.pickedObject = null;
    this.pickedObjectSavedColor = 0;
  }

  pick (normalizedPosition, scene, camera) {
    // restore the color if there is a picked object
    if (this.pickedObject) {
      this.pickedObject.material.color.setHex(this.pickedObjectSavedColor);
      this.pickedObject = undefined;
    }

    // cast a ray through the frustum
    this.raycaster.setFromCamera(normalizedPosition, camera);
    // get the list of objects the ray intersected
    const intersectedObjects = this.raycaster.intersectObjects(scene.children);
    if (intersectedObjects.length > 0) {
      // pick the first object. It's the closest one
      this.pickedObject = intersectedObjects[0].object;
      // save its color
      this.pickedObjectSavedColor = this.pickedObject.material.color.getHex();
      // set its color to red
      this.pickedObject.material.color.setHex(0xFF0000);
    }
  }
}

const Scene = {
  gaps: 0.1,
  zScale: 0.25,

  get columnWidth () {
    return 1.0 - this.gaps * 2;
  },

  initializeScore (score) {
    let geometry = new THREE.BoxGeometry(1, 1, 1); // placeholder until updateScoreHeight runs
    let material = new THREE.MeshPhongMaterial( { color: 0x44dd77, opacity: 0.9, transparent: true } );
    score.cube = new THREE.Mesh(geometry, material);

    this.updateScoreHeight(score, score.games.length);
    this.disableScore(score);
  },

  makeColumn (height) {
    let geometry = new THREE.BoxGeometry(this.columnWidth, this.zScale * height, this.columnWidth);
    geometry.translate(
      geometry.parameters.width / 2,
      geometry.parameters.height / 2,
      geometry.parameters.depth / 2,
    );
    return geometry;
  },

  updateScoreHeight (score, height) {
    if (score.lastSetHeight == height) {
      // Nothing to do
    } else {
      score.lastSetHeight = height;
      score.cube.geometry.dispose()
      score.cube.geometry = this.makeColumn(height);
      score.cube.position.x = score.games[0].pts_win + this.gaps;
      score.cube.position.z = score.games[0].pts_lose + this.gaps;
    }
    this.scene.add(score.cube);
  },

  disableScore (score) {
    score.lastSetHeight = null;
    this.scene.remove(score.cube);
  },

  enableCursor (x, y, z) {
    this.gameCursor.cube.position.x = x;
    this.gameCursor.cube.position.y = y;
    this.gameCursor.cube.position.z = z;
    this.scene.add(this.gameCursor.cube);
  },
  disableCursor () { this.scene.remove(this.gameCursor.cube); },

  makeTextTileMaterial (text) {
      let ctx = document.createElement("canvas").getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.canvas.width = 128;
      ctx.canvas.height = 128;
      ctx.fillStyle = "#FF0";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = "#000";
      ctx.font = "bold 60px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 64, 64);

      let texture = new THREE.CanvasTexture(ctx.canvas);
      let material = new THREE.MeshBasicMaterial({ map: texture });
      material.map.minFilter = material.map.magFilter = THREE.LinearFilter;
      return material;
  },

  initialize () {
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

    for (let score of Object.values(Games.scores)) {
      Scene.initializeScore(score);
    }

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

    this.winAxisScoreBoxes = [];
    for (let ii = 0; ii <= Games.highestWin.pts_win; ii++) {
      let material = this.makeTextTileMaterial(`${ii}`);
      let geometry = new THREE.BoxGeometry(1.0, 0, 1.0);

      let winAxisScoreBox = new THREE.Mesh(geometry, material);
      winAxisScoreBox.position.x = ii + 0.5;
      winAxisScoreBox.position.z = -0.5;
      this.winAxisScoreBoxes.push(winAxisScoreBox);
      Scene.scene.add(winAxisScoreBox);
    }

    this.loseAxisScoreBoxes = [];
    for (let ii = 0; ii <= Games.highestLoss.pts_lose; ii++) {
      let material = this.makeTextTileMaterial(`${ii}`);
      let geometry = new THREE.BoxGeometry(1.0, 0, 1.0);

      let loseAxisScoreBox = new THREE.Mesh(geometry, material);
      loseAxisScoreBox.position.x = Games.highestWin.pts_win + 1.5;
      loseAxisScoreBox.position.z = ii + 0.5;
      this.loseAxisScoreBoxes.push(loseAxisScoreBox);
      Scene.scene.add(loseAxisScoreBox);
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
    for (let ii = 0; ii < Games.highestLoss.pts_lose; ii++) {
      impossibleTilesPositions.push({ pts_win: ii, pts_lose: ii + 1, length: Games.highestLoss.pts_lose - ii });
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
      Scene.scene.add(greyTile);
    }
  },

  lastUpperGame: null,
  lastLowerGame: null,
  lastShowHeight: null,

  activateColumns (cutoff, showHeight) {
    let lowerGame = cutoff[0] == 0 ? null : Games.all[cutoff[0] - 1];
    let upperGame = cutoff[1] == 0 ? null : Games.all[cutoff[1] - 1];

    if (upperGame != this.lastUpperGame || lowerGame != this.lastLowerGame || this.lastShowHeight != showHeight) {
      this.disableCursor();

      let gameInfoBox = document.getElementById("game");
      if (upperGame == null) {
        gameInfoBox.innerHTML = "No game.";
      } else {
        gameInfoBox.innerHTML = `${upperGame.winner} v ${upperGame.loser}, ${upperGame.pts_win} - ${upperGame.pts_lose}, ${upperGame.game_date}${upperGame.nth_of_score === 1 ? " (SCORIGAMI)" : ""}`;
      }

      for (let score of Object.values(Games.scores)) {
        let firstGame = score.firstAfter(lowerGame);
        let lastGame = score.lastBefore(upperGame);
        let gamesBetween = firstGame == null || lastGame == null ? 0 : lastGame.nth_of_score - firstGame.nth_of_score + 1;

        if (gamesBetween <= 0) {
          this.disableScore(score);
        } else {
          let height = showHeight ? gamesBetween : 1;
          this.updateScoreHeight(score, height);
        }
      }
    }

    this.lastUpperGame = upperGame;
    this.lastLowerGame = lowerGame;
    this.lastShowHeight = showHeight;
  }
}

Scene.initialize();
window.Scene = Scene;

Scene.camera.position.x = -33;
Scene.camera.position.y = 164;
Scene.camera.position.z = 70;
Scene.controls.update();

function defaultBounds () { return [0, Games.all.length]; }

let sliderEl = $('#slider');
sliderEl.slider({
  range: true,
  min: defaultBounds()[0],
  max: defaultBounds()[1],
  values: defaultBounds(),
});

function sliderBounds () {
  return sliderEl.slider("option", "values") || defaultBounds;
}

let showHeightEl = document.getElementById('showHeight');
let shouldShowHeight = showHeightEl.checked || true;
showHeightEl.addEventListener('change', e => {
  shouldShowHeight = e.srcElement.checked;
});

const pickHelper = new PickHelper();
function animate() {
  Scene.renderer.render(Scene.scene, Scene.camera);
  Scene.controls.update();
  pickHelper.pick(pickPosition, Scene.scene, Scene.camera);
  Scene.activateColumns(sliderBounds(), shouldShowHeight);
}
Scene.renderer.setAnimationLoop( animate );

function roundToNearestScorigami(cutoff) {
  let roundedCutoff = cutoff;
  while ((roundedCutoff == 0 || Games.all[roundedCutoff - 1].nth_of_score != 1) && roundedCutoff < Games.all.length) {
    roundedCutoff += 1;
  }
  return roundedCutoff;
}

const pickPosition = {x: 0, y: 0};
clearPickPosition();

function getCanvasRelativePosition(event) {
  const rect = Scene.renderer.domElement.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * Scene.renderer.domElement.width  / rect.width,
    y: (event.clientY - rect.top ) * Scene.renderer.domElement.height / rect.height,
  };
}
 
function setPickPosition(event) {
  const pos = getCanvasRelativePosition(event);
  pickPosition.x = (pos.x / Scene.renderer.domElement.width ) *  2 - 1;
  pickPosition.y = (pos.y / Scene.renderer.domElement.height) * -2 + 1;  // note we flip Y
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
})
