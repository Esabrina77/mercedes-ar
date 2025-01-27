'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';

export default function ThreeARScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [detectionMessage, setDetectionMessage] = useState<string>('En attente de la détection du sol...');

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

    // Bouton AR
    const sessionInit = {
      requiredFeatures: ['hit-test'], // Détection de surface
    };
    const arButton = ARButton.createButton(renderer, sessionInit);
    document.body.appendChild(arButton);

    // Lumières
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    // Chargement du modèle 3D
    const loader = new GLTFLoader();
    let model: THREE.Group | null = null;
    loader.load(
      '/models/mercedes.glb',
      (gltf) => {
        model = gltf.scene;
        model.scale.set(20, 20, 20); // Ajustement de l'échelle pour AR
        console.log('Modèle chargé avec succès');
      },
      undefined,
      (error) => {
        console.error('Erreur de chargement du modèle :', error);
      }
    );

    // Gestion du hit-test
    let hitTestSource: XRHitTestSource | null = null;
    let hitTestSourceRequested = false;
    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    reticle.visible = false;
    scene.add(reticle);

    const onSelect = () => {
      if (reticle.visible && model) {
        const modelClone = model.clone();
        modelClone.position.copy(reticle.position);
        modelClone.rotation.copy(reticle.rotation);
        scene.add(modelClone);
      }
    };

    renderer.xr.addEventListener('sessionstart', () => {
      const session = renderer.xr.getSession();
      if (session) {
        session.addEventListener('select', onSelect);
      }
    });

    const animate = () => {
      renderer.setAnimationLoop((_, frame) => {
        if (frame) {
          const session = renderer.xr.getSession();
          if (session && !hitTestSourceRequested) {
            session
              .requestReferenceSpace('viewer')
              .then((referenceSpace) => {
                if (session.requestHitTestSource) {
                  return session.requestHitTestSource({ space: referenceSpace });
                }
                return null;
              })
              .then((source) => {
                if (source) hitTestSource = source;
              })
              .catch(console.error);
            hitTestSourceRequested = true;
          }

          if (hitTestSource) {
            const referenceSpace = renderer.xr.getReferenceSpace();
            if (referenceSpace) {
              const hitTestResults = frame.getHitTestResults(hitTestSource);
              if (hitTestResults.length > 0) {
                const hit = hitTestResults[0];
                const pose = hit.getPose(referenceSpace);
                if (pose) {
                  reticle.visible = true;
                  reticle.matrix.fromArray(pose.transform.matrix);
                  reticle.position.setFromMatrixPosition(reticle.matrix);
                }
              } else {
                reticle.visible = false;
              }
            }
          }
        }
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
      window.removeEventListener('resize', onResize);
      if (hitTestSource) hitTestSource.cancel();
      if (arButton) document.body.removeChild(arButton);
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <>
      <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
      }}>
        {detectionMessage}
      </div>
    </>
  );
}