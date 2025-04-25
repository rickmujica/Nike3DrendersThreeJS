import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// Agrega luces
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
scene.add(hemiLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Define los modelos disponibles
const models = {
  nike_pegasus: "/assets/nike_air_zoom_pegasus_36/scene.gltf",
  fake_jordan: "/assets/nike_air_jordan/scene.gltf",
  ricks_jordan: "/assets/Ricks_Jordan.glb",
  nike_hoodie: "/assets/nike_hoodie/scene.gltf",
};

let currentModel = null;

// Add this at the top of your file after the imports
const loaderContainer = document.querySelector('.loader-container');

// Modify your loadModel function
function loadModel(modelPath) {
    // Show loader
    loaderContainer.style.display = 'flex';

    if (currentModel) {
        scene.remove(currentModel);
    }
  
    loader.load(modelPath, 
        // Success callback
        function (gltf) {
            currentModel = gltf.scene;
  
            if (modelPath.includes('Ricks_Jordan.glb')) {
                currentModel.position.y = -0.6;
            }
  
            scene.add(currentModel);
  
            const boundingBox = new THREE.Box3().setFromObject(currentModel);
            const center = boundingBox.getCenter(new THREE.Vector3());
            const size = boundingBox.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            const cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
      
            camera.position.set(center.x, center.y, cameraZ * 0.8);
            camera.lookAt(center);
            controls.update();

            // Hide loader when model is ready
            loaderContainer.style.display = 'none';
        },
        // Progress callback
        function (xhr) {
            // Optional: You can show loading progress
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        // Error callback
        function (error) {
            console.error(error);
            // Hide loader even if there's an error
            loaderContainer.style.display = 'none';
        }
    );
}

// Event listeners para los botones
document
  .getElementById("nike_pegasus")
  .addEventListener("click", () => loadModel(models.nike_pegasus));
document
  .getElementById("fake_jordan")
  .addEventListener("click", () => loadModel(models.fake_jordan));
document
  .getElementById("ricks_jordan")
  .addEventListener("click", () => loadModel(models.ricks_jordan));
document
  .getElementById("nike_hoodie")
  .addEventListener("click", () => loadModel(models.nike_hoodie));

// Carga el modelo inicial
loadModel(models.nike_pegasus);

// Bucle de animación
function animate() {
  requestAnimationFrame(animate);
  // Añade rotación automática si hay un modelo cargado
    if (currentModel) {
        currentModel.rotation.y += 0.01;
    }
  controls.update();
  renderer.render(scene, camera);
}
animate();
