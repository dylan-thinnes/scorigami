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

  allBefore (game) {
    return this.games.filter(g => Games.compare(g, game) < 1);
  }

  lastBefore (game) {
    return this.games.findLast(g => g.nth_of_history <= game.nth_of_history);
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
    let geometry = new THREE.BoxGeometry(1, 1, 1); // placeholder until updateScoreGeometry runs
    let material = new THREE.MeshPhongMaterial( { color: 0x44dd77 } );
    score.cube = new THREE.Mesh(geometry, material);

    this.updateScoreGeometry(score, this.columnWidth, score.games.length);
    this.disableScore(score);
  },

  makeColumn (width, height) {
    let geometry = new THREE.BoxGeometry(width, this.zScale * height, width);
    geometry.translate(
      geometry.parameters.width / 2,
      geometry.parameters.height / 2,
      geometry.parameters.depth / 2,
    );
    return geometry;
  },

  updateScoreGeometry (score, width, height) {
    if (score.cube.geometry.parameters.height == height && score.cube.geometry.parameters.width == width) {
      // Nothing to do
    } else {
      score.cube.geometry.dispose()
      score.cube.geometry = this.makeColumn(width, height);
      score.cube.position.x = score.games[0].pts_win + this.gaps;
      score.cube.position.z = score.games[0].pts_lose + this.gaps;
      this.enableScore(score);
    }
  },

  enableScore (score) { this.scene.add(score.cube); },
  disableScore (score) { this.scene.remove(score.cube); },

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
    for (let ii = 0; ii <= 73; ii++) {
      let material = this.makeTextTileMaterial(`${ii}`);
      let geometry = new THREE.BoxGeometry(1.0, 0, 1.0);

      let winAxisScoreBox = new THREE.Mesh(geometry, material);
      winAxisScoreBox.position.x = ii + 0.5;
      winAxisScoreBox.position.z = -0.5;
      this.winAxisScoreBoxes.push(winAxisScoreBox);
      Scene.scene.add(winAxisScoreBox);
    }

    this.loseAxisScoreBoxes = [];
    for (let ii = 0; ii <= 51; ii++) {
      let material = this.makeTextTileMaterial(`${ii}`);
      let geometry = new THREE.BoxGeometry(1.0, 0, 1.0);

      let loseAxisScoreBox = new THREE.Mesh(geometry, material);
      loseAxisScoreBox.position.x = 74.5;
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
    for (let pts_win = 0; pts_win < 51; pts_win++) {
      impossibleTilesPositions.push({ pts_win, pts_lose: pts_win + 1, length: 51 - pts_win });
    }

    this.impossibleTiles = [];
    for (let position of impossibleTilesPositions) {
      let material = new THREE.MeshPhongMaterial( { color: 0xeeeeee } );
      let geometry = new THREE.BoxGeometry(1.0, 0.1, position.length);

      let greyTile = new THREE.Mesh(geometry, material);
      greyTile.position.x = position.pts_win + 0.5;
      greyTile.position.y = -0.1;
      greyTile.position.z = position.pts_lose + position.length / 2;
      this.impossibleTiles.push(greyTile);
      Scene.scene.add(greyTile);
    }
  },

  lastCutoffGame: null,

  activateColumns (cutoff) {
    let cutoffGame = cutoff == 0 ? null : Games.all[cutoff - 1];
    if (cutoffGame != this.lastCutoffGame) {
      let gameInfoBox = document.getElementById("game");
      if (cutoffGame == null) {
        gameInfoBox.innerHTML = "No game."
      } else {
        gameInfoBox.innerHTML = `${cutoffGame.winner} v ${cutoffGame.loser}, ${cutoffGame.pts_win} - ${cutoffGame.pts_lose}, ${cutoffGame.game_date}${cutoffGame.nth_of_score === 1 ? " (SCORIGAMI)" : ""}`;
      }

      if (cutoffGame == null) {
        for (let score of Object.values(Games.scores)) {
          this.disableScore(score);
        }
        this.disableScore();
      } else {
        for (let score of Object.values(Games.scores)) {
          let lastGame = score.lastBefore(cutoffGame);
          if (lastGame == null) {
            this.disableScore(score);
          } else {
            if (lastGame == cutoffGame && lastGame.nth_of_score == 1) {
              this.enableCursor(cutoffGame.pts_win, 0, cutoffGame.pts_lose);
              this.disableScore(score);
            } else {
              let height = lastGame.nth_of_score;
              this.updateScoreGeometry(score, this.columnWidth, height);
              this.disableCursor();
            }
          }
        }
      }
    }
    this.lastCutoffGame = cutoffGame;
  }
}

Scene.initialize();

Scene.camera.position.x = -33;
Scene.camera.position.y = 164;
Scene.camera.position.z = 70;
Scene.controls.update();

let stepEl = document.getElementById('step');

let iteration = stepEl.value || 17950;
const pickHelper = new PickHelper();
function animate() {
  Scene.renderer.render(Scene.scene, Scene.camera);
  Scene.controls.update();
  pickHelper.pick(pickPosition, Scene.scene, Scene.camera);
  Scene.activateColumns(iteration);
}
Scene.renderer.setAnimationLoop( animate );

function roundToNearestScorigami(cutoff) {
  let roundedCutoff = cutoff;
  while ((roundedCutoff == 0 || Games.all[roundedCutoff - 1].nth_of_score != 1) && roundedCutoff < 17950) {
    roundedCutoff += 1;
  }
  return roundedCutoff;
}

stepEl.addEventListener('input', e => {
  let newIteration = parseInt(e.srcElement.value);
  if (!isNaN(newIteration)) {
    iteration = roundToNearestScorigami(newIteration);
    stepEl.value = iteration;
  }
});


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
