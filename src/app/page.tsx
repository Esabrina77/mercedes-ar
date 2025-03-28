"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";

// Ajouter ces constantes en dehors du composant
const MOVEMENT_CONTROLS = {
  acceleration: 0.001,
  maxSpeed: 0.05,
  friction: 0.98,
  turningSpeed: 0.04
};

export default function ThreeARScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [detectionMessage, setDetectionMessage] = useState<string>("🔎 Détection du sol en cours...");
  const [controlMessage, setControlMessage] = useState<string>("");
  const [showUnsupportedModal, setShowUnsupportedModal] = useState<boolean>(false);

  let hitTestSource: XRHitTestSource | null = null;
  let hitTestSourceRequested = false;
  let reticle: THREE.Mesh;
  const carModelRef = useRef<THREE.Group | null>(null);
  const wheelsRef = useRef<THREE.Object3D[]>([]);
  let isCarPlaced = false;

  // Modifier la déclaration des variables de mouvement pour qu'elles persistent
  const velocityRef = useRef(0);
  const carDirectionRef = useRef(new THREE.Vector3());
  const keyStatesRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });

  // Mettre à jour updateKeyState pour utiliser la référence
  const updateKeyState = (key: string, state: boolean) => {
    if (key === "ArrowUp") {
      keyStatesRef.current.forward = state;
      setControlMessage(state ? "Avancer" : "");
    }
    if (key === "ArrowDown") {
      keyStatesRef.current.backward = state;
      setControlMessage(state ? "Reculer" : "");
    }
    if (key === "ArrowLeft") {
      keyStatesRef.current.left = state;
      setControlMessage(state ? "Gauche" : "");
    }
    if (key === "ArrowRight") {
      keyStatesRef.current.right = state;
      setControlMessage(state ? "Droite" : "");
    }
  };

  useEffect(() => {
    // Vérifier le support AR
    if (!navigator.xr) {
      setShowUnsupportedModal(true);
      return;
    }

    navigator.xr.isSessionSupported('immersive-ar')
      .then((supported) => {
        if (!supported) {
          setShowUnsupportedModal(true);
        }
      })
      .catch(() => {
        setShowUnsupportedModal(true);
      });

    if (!mountRef.current || !overlayRef.current) {
      console.error("❌ DOM Overlay introuvable !");
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    const loader = new GLTFLoader();
    loader.load(
      "/models/mercedes.glb",
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(15, 15, 15);
        model.visible = false;
        scene.add(model);
        carModelRef.current = model;
        console.log("✅ Modèle chargé avec succès");

        // ✅ Récupérer les roues
        wheelsRef.current = [
          model.getObjectByName("3DWheel_Front_L"),
          model.getObjectByName("3DWheel_Front_R"),
          model.getObjectByName("3DWheel_Rear_L"),
          model.getObjectByName("3DWheel_Rear_R"),
        ].filter(Boolean) as THREE.Object3D[];
      },
      undefined,
      (error) => {
        console.error("❌ Erreur de chargement du modèle :", error);
      }
    );

    reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.8 })
    );
    reticle.visible = false;
    scene.add(reticle);

    const sessionInit = {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay"],
      domOverlay: { root: overlayRef.current as HTMLElement },
    };
    const arButton = ARButton.createButton(renderer, sessionInit);
    document.body.appendChild(arButton);

    const onSelect = () => {
      if (reticle.visible && carModelRef.current && !isCarPlaced) {
        console.log("🚗 Placement de la voiture !");
        carModelRef.current.position.copy(reticle.position);
        carModelRef.current.rotation.copy(reticle.rotation);
        carModelRef.current.visible = true;
        isCarPlaced = true;
        setDetectionMessage("🚗 Voiture placée !");
      }
    };

    renderer.xr.addEventListener("sessionstart", () => {
      const session = renderer.xr.getSession();
      if (session) {
        session.addEventListener("select", onSelect);
      }
    });

    // ✅ Supprimer la déclaration de updateKeyState ici
    
    window.addEventListener("keydown", (event) => updateKeyState(event.key, true));
    window.addEventListener("keyup", (event) => updateKeyState(event.key, false));

    const animate = () => {
      renderer.setAnimationLoop((timestamp, frame) => {
        // Gestion du hit testing AR
        if (frame) {
          const session = renderer.xr.getSession();
          if (session && !hitTestSourceRequested) {
            session
              .requestReferenceSpace("viewer")
              .then((referenceSpace) => {
                if (session && referenceSpace) {
                  return session.requestHitTestSource?.({ space: referenceSpace }) || null;
                }
                return null;
              })
              .then((source) => {
                if (source) {
                  hitTestSource = source;
                  hitTestSourceRequested = true;
                }
              })
              .catch((error) => {
                console.error("Erreur lors de la configuration du hit testing:", error);
              });
          }

          if (hitTestSource) {
            const referenceSpace = renderer.xr.getReferenceSpace();
            if (referenceSpace) {
              const hitTestResults = frame.getHitTestResults(hitTestSource);
              if (hitTestResults.length) {
                const hit = hitTestResults[0];
                const pose = hit.getPose(referenceSpace);
                if (pose) {
                  reticle.visible = !isCarPlaced; // Cacher le reticule une fois la voiture placée
                  reticle.matrix.fromArray(pose.transform.matrix);
                  reticle.position.setFromMatrixPosition(reticle.matrix);
                }
              }
            }
          }
        }

        // Gestion des mouvements de la voiture
        if (carModelRef.current && isCarPlaced) {
          // Mise à jour de la vélocité
          if (keyStatesRef.current.forward) {
            velocityRef.current = Math.min(
              velocityRef.current + MOVEMENT_CONTROLS.acceleration,
              MOVEMENT_CONTROLS.maxSpeed
            );
          }
          if (keyStatesRef.current.backward) {
            velocityRef.current = Math.max(
              velocityRef.current - MOVEMENT_CONTROLS.acceleration,
              -MOVEMENT_CONTROLS.maxSpeed
            );
          }
          if (!keyStatesRef.current.forward && !keyStatesRef.current.backward) {
            velocityRef.current *= MOVEMENT_CONTROLS.friction;
          }

          // Rotation de la voiture
          if (keyStatesRef.current.left) {
            carModelRef.current.rotation.y += MOVEMENT_CONTROLS.turningSpeed;
          }
          if (keyStatesRef.current.right) {
            carModelRef.current.rotation.y -= MOVEMENT_CONTROLS.turningSpeed;
          }

          // Application du mouvement
          carDirectionRef.current.set(0, 0, -1).applyQuaternion(carModelRef.current.quaternion);
          carModelRef.current.position.addScaledVector(carDirectionRef.current, velocityRef.current);

          // Animation des roues
          wheelsRef.current.forEach((wheel) => {
            if (wheel) {
              wheel.rotation.x -= velocityRef.current * 10;
            }
          });

          // Debug des positions
          if (velocityRef.current !== 0) {
            setControlMessage(
              `Vitesse: ${velocityRef.current.toFixed(3)}, Position: ${
                carModelRef.current.position.x.toFixed(2)}, ${
                carModelRef.current.position.y.toFixed(2)}, ${
                carModelRef.current.position.z.toFixed(2)
              }`
            );
          }
        }

      renderer.render(scene, camera);
      });
    };

    animate();

    // Nettoyage
    return () => {
      window.removeEventListener("keydown", (event) => updateKeyState(event.key, true));
      window.removeEventListener("keyup", (event) => updateKeyState(event.key, false));
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

        {controlMessage && (
          <div
            style={{
              position: "absolute",
              top: "60px",
              left: "50%",
              transform: "translateX(-50%)",
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              color: "white",
              padding: "10px",
              borderRadius: "5px",
            }}
          >
            {controlMessage}
          </div>
        )}

        {/* Boutons de contrôle avec styles améliorés */}
        <div style={{ 
          position: "absolute", 
          bottom: "50px", 
          left: "50%", 
          transform: "translateX(-50%)", 
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "10px",
          padding: "10px",
          backgroundColor: "rgba(0, 0, 0, 0.3)",
          borderRadius: "10px"
        }}>
          <div></div> {/* Case vide pour l'alignement */}
          <button 
            style={{
              width: "60px",
              height: "60px",
              fontSize: "24px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "rgba(255, 255, 255, 0.8)"
            }}
            onTouchStart={() => updateKeyState("ArrowUp", true)} 
            onTouchEnd={() => updateKeyState("ArrowUp", false)}
          >⬆️</button>
          <div></div> {/* Case vide pour l'alignement */}
          <button 
            style={{
              width: "60px",
              height: "60px",
              fontSize: "24px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "rgba(255, 255, 255, 0.8)"
            }}
            onTouchStart={() => updateKeyState("ArrowLeft", true)} 
            onTouchEnd={() => updateKeyState("ArrowLeft", false)}
          >⬅️</button>
          <button 
            style={{
              width: "60px",
              height: "60px",
              fontSize: "24px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "rgba(255, 255, 255, 0.8)"
            }}
            onTouchStart={() => updateKeyState("ArrowDown", true)} 
            onTouchEnd={() => updateKeyState("ArrowDown", false)}
          >⬇️</button>
          <button 
            style={{
              width: "60px",
              height: "60px",
              fontSize: "24px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "rgba(255, 255, 255, 0.8)"
            }}
            onTouchStart={() => updateKeyState("ArrowRight", true)} 
            onTouchEnd={() => updateKeyState("ArrowRight", false)}
          >➡️</button>
        </div>
      </div>
      
      {showUnsupportedModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>😢 AR non supportée</h2>
            <p>Désolé, votre appareil ou navigateur ne supporte pas la réalité augmentée.</p>
            <p>Pour utiliser cette application, veuillez :</p>
            <ul>
              <li>📱 Utiliser un appareil mobile compatible AR</li>
              <li>🌐 Ouvrir l&apos;application dans un navigateur supportant WebXR (Chrome, Edge ou Safari)</li>
            </ul>
            <button 
              className="modal-button"
              onClick={() => setShowUnsupportedModal(false)}
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}
