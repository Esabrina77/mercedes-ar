'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';

export default function ThreeARScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Création de la scène
    const scene = new THREE.Scene();

    // Caméra
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    // Rendu
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    mountRef.current!.appendChild(renderer.domElement);

    // Vérifiez si l'AR est supporté avant d'ajouter le bouton
    let arButton: HTMLElement | null = null;
    if ('xr' in navigator) {
      arButton = ARButton.createButton(renderer);
      document.body.appendChild(arButton);
    } else {
      console.warn('WebXR n\'est pas supporté dans ce navigateur');
    }

    // Lumières (pour la visualisation en mode AR)
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    // Chargement du modèle 3D
    const loader = new GLTFLoader();
    let model: THREE.Group | null = null;

    loader.load(
      '/models/mercedes.glb',
      (gltf) => {
        model = gltf.scene;
        model.scale.set(0.1, 0.1, 0.1);
        console.log('Modèle chargé avec succès');
      },
      undefined,
      (error) => {
        console.error('Erreur de chargement du modèle :', error);
      }
    );

    // Contrôles orbitaux (optionnels, utiles en mode non-AR)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Gestionnaire de tap sur l'écran
    const onSelect = (event: XRInputSourceEvent) => {
      if (model && renderer.xr.isPresenting) {
        const modelClone = model.clone();
        
        // Obtenir la position du contrôleur AR ou utiliser la position de la caméra
        if ('frame' in event) {
          const xrEvent = event as XRInputSourceEvent;
          const frame = xrEvent.frame;
          const referenceSpace = renderer.xr.getReferenceSpace();
          
          if (frame && referenceSpace) {
            const pose = frame.getPose(xrEvent.inputSource.targetRaySpace, referenceSpace);
            if (pose) {
              const matrix = new THREE.Matrix4();
              matrix.fromArray(pose.transform.matrix);
              
              modelClone.position.setFromMatrixPosition(matrix);
              modelClone.quaternion.setFromRotationMatrix(matrix);
            }
          }
        }
        
        scene.add(modelClone);
        console.log('Modèle cloné ajouté à la scène');
      }
    };

    // Écouter l'événement select sur la session XR
    renderer.xr.addEventListener('sessionstart', () => {
      const session = renderer.xr.getSession();
      if (session) {
        session.addEventListener('select', onSelect);
      }
    });

    // Animation
    const animate = () => {
      renderer.setAnimationLoop(() => {
        controls.update();
        renderer.render(scene, camera);
      });
    };
    animate();

    // Gestion de la fenêtre responsive
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // Nettoyage
    return () => {
      const session = renderer.xr.getSession();
      if (session) {
        session.removeEventListener('select', onSelect);
      }
      mountRef.current?.removeChild(renderer.domElement);
      if (arButton) document.body.removeChild(arButton);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <>
      <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />
      <p>Hello</p>
    </>
  );
}
