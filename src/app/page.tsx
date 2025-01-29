"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";

export default function ThreeARScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [detectionMessage, setDetectionMessage] = useState<string>("🔎 Détection du sol en cours...");
  
  let hitTestSource: XRHitTestSource | null = null;
  let hitTestSourceRequested = false;
  let reticle: THREE.Mesh;
  const carModelRef = useRef<THREE.Group | null>(null); // ✅ Stocke la voiture dans une ref

  useEffect(() => {
    if (!mountRef.current || !overlayRef.current) {
      console.error("❌ DOM Overlay introuvable !");
      return;
    }

    // ✅ Création de la scène
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    // ✅ Lumière principale
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    // ✅ Chargement du modèle de voiture
    const loader = new GLTFLoader();
    loader.load(
      "/models/mercedes.glb",
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(10, 10, 10);
        model.visible = false; // ✅ Masquer avant le placement
        scene.add(model);
        carModelRef.current = model; // ✅ Stocker la voiture dans une ref pour l'accès global
        console.log("✅ Modèle chargé avec succès");
      },
      undefined,
      (error) => {
        console.error("❌ Erreur de chargement du modèle :", error);
      }
    );

    // ✅ Création du réticule (indicateur de placement)
    reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.8 })
    );
    reticle.visible = false;
    scene.add(reticle);

    // ✅ Bouton AR avec DOM Overlay
    const sessionInit = {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay"],
      domOverlay: { root: overlayRef.current as HTMLElement },
    };
    const arButton = ARButton.createButton(renderer, sessionInit);
    document.body.appendChild(arButton);

    // ✅ Placement de la voiture sur le réticule
    const onSelect = () => {
      if (reticle.visible && carModelRef.current) {
        console.log("🚗 Placement de la voiture !");
        carModelRef.current.position.copy(reticle.position);
        carModelRef.current.rotation.copy(reticle.rotation);
        carModelRef.current.visible = true;
        setDetectionMessage("🚗 Voiture placée !");
      } else {
        console.error("❌ La voiture est introuvable ou le réticule n'est pas visible !");
      }
    };

    renderer.xr.addEventListener("sessionstart", () => {
      const session = renderer.xr.getSession();
      if (session) {
        session.addEventListener("select", onSelect);
      }
    });

    const animate = () => {
      renderer.setAnimationLoop((_, frame) => {
        if (frame) {
          const session = renderer.xr.getSession();
          if (session && !hitTestSourceRequested) {
            session
              .requestReferenceSpace("viewer")
              .then((referenceSpace) => session.requestHitTestSource?.({ space: referenceSpace }))
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
                  setDetectionMessage("✔️ Sol détecté ! Appuyez pour placer la voiture.");
                }
              } else {
                reticle.visible = false;
                setDetectionMessage("🔎 Détection du sol en cours...");
              }
            }
          }
        }
        renderer.render(scene, camera);
      });
    };
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      if (hitTestSource) hitTestSource.cancel();
      if (arButton) document.body.removeChild(arButton);
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <>
      <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />
      <div ref={overlayRef} style={{ position: "absolute", top: "0", left: "0", width: "100%", height: "100%" }}>
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            color: "white",
            padding: "10px",
            borderRadius: "5px",
          }}
        >
          {detectionMessage}
        </div>

        {/* ✅ Ajout des flèches de direction en overlay */}
        <div
          style={{
            position: "absolute",
            bottom: "100px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "10px",
            zIndex: "1000",
            pointerEvents: "auto",
          }}
        >
          <button
            style={{
              background: "rgba(255, 255, 255, 0.8)",
              padding: "15px",
              borderRadius: "50%",
            }}
            onClick={() => console.log("⬅️ Gauche")}
          >
            ⬅️
          </button>
          <button
            style={{
              background: "rgba(255, 255, 255, 0.8)",
              padding: "15px",
              borderRadius: "50%",
            }}
            onClick={() => console.log("⬆️ Avancer")}
          >
            ⬆️
          </button>
          <button
            style={{
              background: "rgba(255, 255, 255, 0.8)",
              padding: "15px",
              borderRadius: "50%",
            }}
            onClick={() => console.log("➡️ Droite")}
          >
            ➡️
          </button>
        </div>
      </div>
    </>
  );
}
 