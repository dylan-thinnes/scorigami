import { rawGames } from './raw-games.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

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
    this.scores = {};
    for (let game of Games.all) {
      if (this.scores[game.boxscore_title] == null) {
        this.scores[game.boxscore_title] = {
          games: []
        };
      }
      let newLen = this.scores[game.boxscore_title].games.push(game);
      game.nth_of_score = newLen;
    }
  },

  score (winning, losing) {
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
  initialize () {
    this.scene = new THREE.Scene();
    const color = new THREE.Color().setHex( 0xdddddd );
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
  }
}

Scene.initialize();

function initializeThreeJS (score) {
  score.geometry = new THREE.BoxGeometry(0.8, score.games.length / 2, 0.8);
  score.geometry.translate(
    score.geometry.parameters.width / 2,
    score.geometry.parameters.height / 2,
    score.geometry.parameters.depth / 2,
  );

  score.material = new THREE.MeshPhongMaterial( { color: 0x44dd77 } );
  score.cube = new THREE.Mesh(score.geometry, score.material);

  score.cube.position.x += score.games[0].pts_win;
  score.cube.position.z += score.games[0].pts_lose;
}

for (let score of Object.values(Games.scores)) {
  initializeThreeJS(score);
}

let gameCursor = {};

gameCursor.geometry = new THREE.BoxGeometry(0.8, 100000 / 2, 0.8);
gameCursor.geometry.translate(
  gameCursor.geometry.parameters.width / 2,
  gameCursor.geometry.parameters.height / 2,
  gameCursor.geometry.parameters.depth / 2,
);

gameCursor.material = new THREE.MeshPhongMaterial( { color: 0x00ffff } );
gameCursor.cube = new THREE.Mesh(gameCursor.geometry, gameCursor.material);

let lastCutoffGame = null;
function activateColumns(cutoff) {
  let cutoffGame = cutoff == 0 ? null : Games.all[cutoff - 1];
  if (cutoffGame != lastCutoffGame) {
    let gameInfoBox = document.getElementById("game");
    if (cutoffGame == null) {
      gameInfoBox.innerHTML = "No game."
    } else {
      gameInfoBox.innerHTML = `${cutoffGame.winner} v ${cutoffGame.loser}, ${cutoffGame.pts_win} - ${cutoffGame.pts_lose}, ${cutoffGame.game_date}${cutoffGame.nth_of_score === 1 ? " (SCORIGAMI)" : ""}`;
    }
  }
  lastCutoffGame = cutoffGame;

  if (cutoffGame == null) {
    for (let score of Object.values(Games.scores)) {
      Scene.scene.remove(score.cube);
    }
    Scene.scene.remove(gameCursor.cube);
  } else {
    for (let score of Object.values(Games.scores)) {
      let lastMatchingGame = score.games.findLast(game => game.nth_of_history <= cutoffGame.nth_of_history);
      if (lastMatchingGame == null) {
        Scene.scene.remove(score.cube);
      } else {
        let height = lastMatchingGame.nth_of_score;
        if (Games.sameScore(lastMatchingGame, cutoffGame)) {
          height -= 1;

          if (lastMatchingGame.nth_of_score === 1) {
            gameCursor.cube.position.x = cutoffGame.pts_win;
            gameCursor.cube.position.y = height / 2;
            gameCursor.cube.position.z = cutoffGame.pts_lose;
            Scene.scene.add(gameCursor.cube);
          } else {
            Scene.scene.remove(gameCursor.cube);
          }
        }
        if (height / 2 != score.geometry.parameters.height) {
          score.geometry = new THREE.BoxGeometry(0.8, height / 2, 0.8);
          score.geometry.translate(
            score.geometry.parameters.width / 2,
            score.geometry.parameters.height / 2,
            score.geometry.parameters.depth / 2,
          );

          score.cube.geometry.dispose()
          score.cube.geometry = score.geometry;
        }
        Scene.scene.add(score.cube);
      }
    }
  }
}

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
  activateColumns(iteration);
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

for (let ii = 0; ii <= 73; ii++) {
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
  ctx.fillText(`${ii}`, 64, 64);

  let texture = new THREE.CanvasTexture(ctx.canvas);
  let material = new THREE.MeshBasicMaterial({ map: texture });
  material.map.minFilter = material.map.magFilter = THREE.LinearFilter;
  let geometry = new THREE.BoxGeometry(1.0, 0, 1.0);

  let winAxisScoreBox = new THREE.Mesh(geometry, material);
  winAxisScoreBox.position.x = ii + 0.5;
  winAxisScoreBox.position.z = -0.5;
  Scene.scene.add(winAxisScoreBox);
}

for (let ii = 0; ii <= 51; ii++) {
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
  ctx.fillText(`${ii}`, 64, 64);

  let texture = new THREE.CanvasTexture(ctx.canvas);
  let material = new THREE.MeshBasicMaterial({ map: texture });
  material.map.minFilter = material.map.magFilter = THREE.LinearFilter;
  let geometry = new THREE.BoxGeometry(1.0, 0, 1.0);

  let loseAxisScoreBox = new THREE.Mesh(geometry, material);
  loseAxisScoreBox.position.x = 74.5;
  loseAxisScoreBox.position.z = ii + 0.5;
  Scene.scene.add(loseAxisScoreBox);
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
