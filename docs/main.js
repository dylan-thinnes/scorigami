import { allGames } from './all-games.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

window.allGames = allGames;

class PickHelper {
  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.pickedObject = null;
    this.pickedObjectSavedColor = 0;
  }
  pick(normalizedPosition, scene, camera) {
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

const scene = new THREE.Scene();
const color = new THREE.Color().setHex( 0xdddddd );
scene.background = color;

const light = new THREE.PointLight(0xFFFFFF, 50000);
light.position.set(-100, 100, 50);
scene.add(light);

const light2 = new THREE.PointLight(0xFFFFFF, 25000);
light2.position.set(100, -100, -100);
scene.add(light2);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
renderer.setPixelRatio(window.devicePixelRatio);

const controls = new OrbitControls( camera, renderer.domElement );

allGames.sort((a, b) => a.game_date == b.game_date ? 0 : a.game_date < b.game_date ? -1 : 1);
let idx = 1;
for (let game of allGames) {
  game.nth_of_history = idx;
  idx++;
}

let boxscores = {};
for (let game of allGames) {
  if (boxscores[game.boxscore_title] == null) {
    boxscores[game.boxscore_title] = {
      games: []
    };
  }
  let newLen = boxscores[game.boxscore_title].games.push(game);
  game.nth_of_score = newLen;
}
window.boxscores = boxscores;

function initializeThreeJS (boxscore) {
  boxscore.geometry = new THREE.BoxGeometry(0.8, boxscore.games.length / 2, 0.8);
  boxscore.geometry.translate(
    boxscore.geometry.parameters.width / 2,
    boxscore.geometry.parameters.height / 2,
    boxscore.geometry.parameters.depth / 2,
  );

  boxscore.material = new THREE.MeshPhongMaterial( { color: 0x44dd77 } );
  boxscore.cube = new THREE.Mesh(boxscore.geometry, boxscore.material);

  boxscore.cube.position.x += boxscore.games[0].pts_win;
  boxscore.cube.position.z += boxscore.games[0].pts_lose;
}

for (let boxscore of Object.values(boxscores)) {
  initializeThreeJS(boxscore);
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
  let cutoffGame = cutoff == 0 ? null : allGames[cutoff - 1];
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
    for (let boxscore of Object.values(boxscores)) {
      scene.remove(boxscore.cube);
    }
    scene.remove(gameCursor.cube);
  } else {
    for (let boxscore of Object.values(boxscores)) {
      let lastMatchingGame = boxscore.games.findLast(game => game.nth_of_history <= cutoffGame.nth_of_history);
      if (lastMatchingGame == null) {
        scene.remove(boxscore.cube);
      } else {
        let height = lastMatchingGame.nth_of_score;
        if (lastMatchingGame.boxscore_title == cutoffGame.boxscore_title) {
          height -= 1;

          if (lastMatchingGame.nth_of_score === 1) {
            gameCursor.cube.position.x = cutoffGame.pts_win;
            gameCursor.cube.position.y = height / 2;
            gameCursor.cube.position.z = cutoffGame.pts_lose;
            scene.add(gameCursor.cube);
          } else {
            scene.remove(gameCursor.cube);
          }
        }
        if (height / 2 != boxscore.geometry.parameters.height) {
          boxscore.geometry = new THREE.BoxGeometry(0.8, height / 2, 0.8);
          boxscore.geometry.translate(
            boxscore.geometry.parameters.width / 2,
            boxscore.geometry.parameters.height / 2,
            boxscore.geometry.parameters.depth / 2,
          );

          boxscore.cube.geometry.dispose()
          boxscore.cube.geometry = boxscore.geometry;
        }
        scene.add(boxscore.cube);
      }
    }
  }
}

window.camera = camera;
camera.position.x = -33;
camera.position.y = 164;
camera.position.z = 70;
controls.update();

let stepEl = document.getElementById('step');

let iteration = stepEl.value || 17950;
const pickHelper = new PickHelper();
function animate() {
  renderer.render(scene, camera);
  controls.update();
  pickHelper.pick(pickPosition, scene, camera);
  activateColumns(iteration);
}
renderer.setAnimationLoop( animate );

function roundToNearestScorigami(cutoff) {
  let roundedCutoff = cutoff;
  while ((roundedCutoff == 0 || allGames[roundedCutoff - 1].nth_of_score != 1) && roundedCutoff < 17950) {
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
  scene.add(winAxisScoreBox);

  let loseAxisScoreBox = new THREE.Mesh(geometry, material);
  loseAxisScoreBox.position.x = 74.5;
  loseAxisScoreBox.position.z = ii + 0.5;
  scene.add(loseAxisScoreBox);
}

const pickPosition = {x: 0, y: 0};
clearPickPosition();

function getCanvasRelativePosition(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * renderer.domElement.width  / rect.width,
    y: (event.clientY - rect.top ) * renderer.domElement.height / rect.height,
  };
}
 
function setPickPosition(event) {
  const pos = getCanvasRelativePosition(event);
  pickPosition.x = (pos.x / renderer.domElement.width ) *  2 - 1;
  pickPosition.y = (pos.y / renderer.domElement.height) * -2 + 1;  // note we flip Y
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
