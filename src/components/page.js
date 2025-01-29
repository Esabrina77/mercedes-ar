"use client";
import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

export default function ARPage() {
  const [xrSession, setXRSession] = useState(null);
  const [carModel, setCarModel] = useState(null);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Chargement du modèle...");

  useEffect(() => {
    // ✅ Charger le modèle au démarrage
    const loader = new GLTFLoader();
    loader.load(
      "/models/mercedes.glb",
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(1.5, 1.5, 1.5);
        model.position.set(0, 0, -2); // ✅ Placement initial à 2m devant
        setCarModel(model);
        setAssetsLoaded(true);
        setStatusMessage("Modèle chargé ! Prêt pour l'AR.");
        console.log("✅ Modèle chargé !");
      },
      undefined,
      (error) => {
        console.error("❌ Erreur lors du chargement du modèle :", error);
      }
    );
  }, []);

  async function startARSession() {
    if (!assetsLoaded || !carModel) {
      alert("Veuillez patienter, le modèle 3D est encore en cours de chargement.");
      return;
    }

    console.log("🟢 Démarrage de la session AR...");

    if (!navigator.xr) {
      alert("WebXR is not supported in this browser.");
      return;
    }

    const isSupported = await navigator.xr.isSessionSupported("immersive-ar");
    if (!isSupported) {
      alert("Immersive AR is not supported on this device.");
      return;
    }

    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    const gl = canvas.getContext("webgl2", { xrCompatible: true });

    if (!gl) {
      alert("WebGL 2 is not supported in this browser.");
      return;
    }
    alert("WebGL 2 is supported in this browser.");

    const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true });
    renderer.xr.enabled = true;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    scene.add(camera);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 5, 5);
    scene.add(light);

    // ✅ Ajout direct du modèle dans la scène
    scene.add(carModel);
    carModel.visible = true;
    console.log("🚗 Voiture placée dans la scène AR.");
    alert("Voiture placée dans la scène AR.");

    console.log("🟢 Activation de WebXR...");
    alert("Activation de WebXR...");
    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["local"],
    });

    setXRSession(session);

    session.addEventListener("end", () => {
      console.log("🔴 Session WebXR terminée.");
      document.body.removeChild(canvas);
      setXRSession(null);
      setStatusMessage("Modèle chargé ! Prêt pour l'AR.");
    });

    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });

    const referenceSpace = await session.requestReferenceSpace("local");

    function onXRFrame(t, frame) {
      let session = frame.session;
      session.requestAnimationFrame(onXRFrame);

      const pose = frame.getViewerPose(referenceSpace);
      if (pose) {
        camera.matrix.fromArray(pose.transform.matrix);
        camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
      }

      renderer.render(scene, camera);
    }

    session.requestAnimationFrame(onXRFrame);
  }

  return (
    <>
      <button 
        onClick={startARSession} 
        disabled={!assetsLoaded}
        style={{
          backgroundColor: '#4CAF50',
          border: 'none',
          color: 'white',
          padding: '15px 32px',
          textAlign: 'center',
          textDecoration: 'none',
          display: 'inline-block',
          fontSize: '16px',
          margin: '4px 2px',
          cursor: 'pointer',
          borderRadius: '4px',
          opacity: assetsLoaded ? 1 : 0.6
        }}
      >
        {assetsLoaded ? "Enter AR" : "Chargement..."}
      </button>
    </>
  );
}
