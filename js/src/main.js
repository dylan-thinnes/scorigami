import { allGames } from '/all-games.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

window.allGames = allGames;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const controls = new OrbitControls( camera, renderer.domElement );

let latestGame = 10000;
let gamesByBoxScore = {};
for (let game of allGames) {
  if (gamesByBoxScore[game.boxscore_title] == null) {
    gamesByBoxScore[game.boxscore_title] = [];
  }
  let boxscoreList = gamesByBoxScore[game.boxscore_title];
  boxscoreList.push(game);
}

for (let games of Object.values(gamesByBoxScore)) {
  const geometry = new THREE.BoxGeometry( 1, games.length / 2, 1 );
  const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
  const cube = new THREE.Mesh( geometry, material );
  cube.position.x += 1 / 2;
  cube.position.y += games.length / 2 / 2;
  cube.position.z += 1 / 2;
  cube.position.x += games[0].pts_win;
  cube.position.z += games[0].pts_lose;
  scene.add( cube );
}


camera.position.x = 100;
camera.position.y = 100;
camera.position.z = 100;
controls.update();

function animate() {
  //cube.rotation.x += 0.01;
  //cube.rotation.y += 0.01;
  //cube.position.x += 0.01;
  //cube.position.y += 0.01;
  renderer.render( scene, camera );
  controls.update();
}
renderer.setAnimationLoop( animate );
