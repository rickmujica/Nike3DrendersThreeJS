import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Create canvas and renderer
const width = window.innerWidth;
const height = window.innerHeight;
const canvas = document.querySelector('canvas#threejs-canvas');
if (!canvas) {
  throw new Error('Canvas element not found');
}
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
});
renderer.setSize(width, height);

// Add camera
const fov = 75;
const aspect = width / height;
const near = 0.1;
const far = 10;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.z = 2;

// Add scene
const scene = new THREE.Scene();

const controls = new OrbitControls(camera, renderer.domElement);

// Create geometry and material for the main mesh
const geometry = new THREE.IcosahedronGeometry(.7, 5);
const material = new THREE.MeshStandardMaterial({
  color: 'cyan',
  flatShading: true,
});
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

// Add wireframe overlay to the main mesh
const wireMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  wireframe: true,
});
const wireMesh = new THREE.Mesh(geometry, wireMaterial);
wireMesh.scale.setScalar(1.001);
mesh.add(wireMesh);

// SECOND OBJECT

const geometry2 = new THREE.IcosahedronGeometry(.7, 0);
const material2 = new THREE.MeshStandardMaterial({
  color: 'magenta',
  flatShading: true,
});
const mesh2 = new THREE.Mesh(geometry2, material2);
scene.add(mesh2);

// Add wireframe overlay to the main mesh
const wireMaterial2 = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  wireframe: true,
});
const wireMesh2 = new THREE.Mesh(geometry2, wireMaterial2);
wireMesh2.scale.setScalar(1.001);
mesh2.add(wireMesh2);

// Position the meshes side by side
mesh.position.x = -0.7; // Move mesh to the left
mesh2.position.x = .7; // Move mesh2 to the right

// Add lighting to the scene
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
scene.add(hemiLight);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  mesh.rotation.x += 0.01;
  // mesh.rotation.y += 0.01;
  // mesh2.rotation.x += 0.01;
  mesh2.rotation.y += 0.01;
  renderer.render(scene, camera);
}

// Start animation
animate();