import { allGames } from './all-games.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

window.allGames = allGames;

const scene = new THREE.Scene();
const color = new THREE.Color().setHex( 0xdddd88 );
scene.background = color;

const light = new THREE.PointLight(0xFFFFFF, 50000);
light.position.set(-100, 100, 100);
scene.add(light);

const light2 = new THREE.PointLight(0xFFFFFF, 25000);
light2.position.set(100, -100, -100);
scene.add(light2);

const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

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
  boxscore.geometry = new THREE.BoxGeometry(1, boxscore.games.length / 2, 1);
  boxscore.geometry.translate(
    boxscore.geometry.parameters.width / 2,
    boxscore.geometry.parameters.height / 2,
    boxscore.geometry.parameters.depth / 2,
  );

  boxscore.material = new THREE.MeshPhongMaterial( { color: 0x88ff88 } );
  boxscore.cube = new THREE.Mesh(boxscore.geometry, boxscore.material);

  boxscore.cube.position.x += boxscore.games[0].pts_win;
  boxscore.cube.position.z += boxscore.games[0].pts_lose;
}

for (let boxscore of Object.values(boxscores)) {
  initializeThreeJS(boxscore);
}

function activateColumns(cutoff) {
  for (let boxscore of Object.values(boxscores)) {
    let lastMatchingGame = boxscore.games.findLast(game => game.nth_of_history <= cutoff);
    if (lastMatchingGame == null) {
      if (boxscore.cube != null) {
        scene.remove(boxscore.cube);
      }
    } else {
      let height = lastMatchingGame.nth_of_score;
      if (height / 2 != boxscore.geometry.parameters.height) {
        boxscore.geometry = new THREE.BoxGeometry(1, height / 2, 1);
        boxscore.geometry.translate(
          boxscore.geometry.parameters.width / 2,
          boxscore.geometry.parameters.height / 2,
          boxscore.geometry.parameters.depth / 2,
        );

        boxscore.cube.geometry.dispose()
        boxscore.cube.geometry = boxscore.geometry;

        scene.add(boxscore.cube);
      }
    }
  }
}

window.camera = camera;
camera.position.x = -33;
camera.position.y = 164;
camera.position.z = 70;
camera.lookAt(0,100,0);
controls.update();

let stepEl = document.getElementById('step');

let iteration = 17590;
function animate() {
  renderer.render( scene, camera );
  controls.update();
  activateColumns(iteration);
}
renderer.setAnimationLoop( animate );

document.addEventListener('keypress', e => {
  iteration = 0;
});
stepEl.addEventListener('input', e => {
  let newIteration = parseInt(e.srcElement.value);
  if (!isNaN(newIteration)) iteration = newIteration;
});
