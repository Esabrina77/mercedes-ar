"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default function TestScene() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeCanvasRef = useRef<HTMLCanvasElement>(null);
  const [debugInfo, setDebugInfo] = useState<string>("En attente de détection...");

  // Ajout des états pour le jeu
  const [score, setScore] = useState(0);
  const [targets, setTargets] = useState<THREE.Mesh[]>([]);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !threeCanvasRef.current) {
      setDebugInfo("Erreur: Références non initialisées");
      return;
    }

    // Assurez-vous que le canvas est dimensionné correctement
    const resizeCanvas = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 1. Configuration basique Three.js
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({
      canvas: threeCanvasRef.current,
      alpha: true
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.position.z = 5;

    // Création des cibles
    const createTarget = () => {
      const geometry = new THREE.SphereGeometry(0.3);
      const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
      const target = new THREE.Mesh(geometry, material);
      
      // Position aléatoire
      target.position.set(
        Math.random() * 8 - 4,  // x entre -4 et 4
        Math.random() * 6 - 3,  // y entre -3 et 3
        -Math.random() * 5 - 2  // z entre -2 et -7
      );
      
      scene.add(target);
      setTargets(prev => [...prev, target]);
    };

    // Ajout de lumières
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 2);
    scene.add(directionalLight);

    // Créer quelques cibles initiales
    for (let i = 0; i < 5; i++) {
      createTarget();
    }

    // 3. Configuration MediaPipe
    const hands = new window.Hands({
      locateFile: (file: string) => {
        setDebugInfo(`Chargement du fichier: ${file}`);
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.3,
      minTrackingConfidence: 0.3
    });

    hands.onResults((results: any) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      // Sauvegarder le contexte avant la transformation
      ctx.save();
      
      // Inverser le contexte pour le texte uniquement
      ctx.setTransform(-1, 0, 0, 1, ctx.canvas.width, 0);

      // Afficher les instructions (maintenant dans le bon sens)
      ctx.font = '24px Arial';
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 4;
      ctx.textAlign = 'left';
      const margin = 50;
      ctx.strokeText('Levez l\'index et pliez les autres doigts pour tirer', margin, 50);
      ctx.fillText('Levez l\'index et pliez les autres doigts pour tirer', margin, 50);

      // Ajout d'un indicateur de geste
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const handLandmarks = results.multiHandLandmarks[0];
        
        // Détection du geste de tir : index levé, autres doigts pliés
        const indexTip = handLandmarks[8];  // Bout de l'index
        const indexBase = handLandmarks[5]; // Base de l'index
        const middleTip = handLandmarks[12]; // Bout du majeur
        const ringTip = handLandmarks[16];   // Bout de l'annulaire
        const pinkyTip = handLandmarks[20];  // Bout du petit doigt

        // Vérifier si l'index est levé et les autres doigts pliés
        const isShootingGesture = 
          indexTip.y < indexBase.y && // Index levé
          middleTip.y > indexBase.y && // Autres doigts pliés
          ringTip.y > indexBase.y &&
          pinkyTip.y > indexBase.y;

        // Dessiner le viseur
        const x = indexTip.x * ctx.canvas.width;
        const y = indexTip.y * ctx.canvas.height;

        // Viseur plus grand et plus visible
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, 2 * Math.PI);
        ctx.strokeStyle = isShootingGesture ? '#00FF00' : '#FF0000';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Croix du viseur
        if (isShootingGesture) {
          ctx.beginPath();
          ctx.moveTo(x - 10, y);
          ctx.lineTo(x + 10, y);
          ctx.moveTo(x, y - 10);
          ctx.lineTo(x, y + 10);
          ctx.strokeStyle = '#00FF00';
          ctx.stroke();

          // Logique de tir
          const adjustedX = 1 - indexTip.x; // Pour corriger l'inversion
          const adjustedY = indexTip.y;
          
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(
            new THREE.Vector2(
              (adjustedX * 2) - 1,
              -(adjustedY * 2) + 1
            ),
            camera
          );
          
          const intersects = raycaster.intersectObjects(targets);
          
          if (intersects.length > 0) {
            const hitTarget = intersects[0].object;
            scene.remove(hitTarget);
            setTargets(prev => prev.filter(t => t !== hitTarget));
            setScore(prev => prev + 100);
            
            // Effet visuel de tir
            ctx.beginPath();
            ctx.arc(x, y, 30, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
            ctx.fill();
            
            setTimeout(createTarget, 1000);
          }
        }

        // Dessiner le reste des points de la main...
        handLandmarks.forEach((landmark: any) => {
          ctx.beginPath();
          ctx.arc(
            landmark.x * ctx.canvas.width,
            landmark.y * ctx.canvas.height,
            3,
            0,
            2 * Math.PI
          );
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
        });

        // Ajout d'un indicateur de geste
        if (isShootingGesture) {
          ctx.fillStyle = '#00FF00';
          ctx.strokeText('✓ Geste correct !', margin, 90);
          ctx.fillText('✓ Geste correct !', margin, 90);
        } else {
          ctx.fillStyle = '#FF0000';
          ctx.strokeText('✗ Geste incorrect', margin, 90);
          ctx.fillText('✗ Geste incorrect', margin, 90);
        }
      }

      setDebugInfo(`Mains détectées: ${results.multiHandLandmarks?.length || 0}`);
    });

    const camera2 = new window.Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current) {
          try {
            await hands.send({ image: videoRef.current });
          } catch (error) {
            setDebugInfo(`Erreur détection: ${error.message}`);
          }
        }
      },
      width: 1280,
      height: 720,
      facingMode: "user"
    });

    // 5. Animation
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Animation des cibles
      targets.forEach(target => {
        target.rotation.y += 0.01;
        target.position.x += Math.sin(Date.now() * 0.001) * 0.02;
      });
      
      renderer.render(scene, camera);
    };

    // 6. Démarrage
    camera2.start()
      .then(() => {
        setDebugInfo("Caméra démarrée avec succès");
        animate();
      })
      .catch((error: any) => {
        setDebugInfo(`Erreur caméra: ${error.message}`);
      });

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      camera2.stop();
      hands.close();
    };
  }, []);

  const createVirtualUI = () => {
    // Panneau principal
    const geometry = new THREE.PlaneGeometry(1, 0.5);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x444444,
      transparent: true,
      opacity: 0.8 
    });
    const panel = new THREE.Mesh(geometry, material);
    panel.position.z = -1; // Positionné devant l'utilisateur
    
    // Boutons interactifs
    const buttonGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.02);
    const buttonMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
    button.position.set(-0.3, 0, -0.99);
    
    return { panel, button };
  };

  const checkFingerInteraction = (indexTip: any, objects: THREE.Object3D[]) => {
    const raycaster = new THREE.Raycaster();
    // Convertir la position du doigt en coordonnées normalisées (-1 à 1)
    const fingerPosition = new THREE.Vector2(
      (indexTip.x * 2) - 1,
      -(indexTip.y * 2) + 1
    );
    
    raycaster.setFromCamera(fingerPosition, camera);
    const intersects = raycaster.intersectObjects(objects);
    
    return intersects.length > 0 ? intersects[0].object : null;
  };

  const handleGestures = (handLandmarks: any, selectedObject: THREE.Object3D) => {
    const indexTip = handLandmarks[8];
    const middleTip = handLandmarks[12];
    
    // Détection de pincement (zoom)
    const pinchDistance = calculateDistance(indexTip, middleTip);
    if (pinchDistance < 0.1) {
      // Mode zoom
      selectedObject.scale.multiplyScalar(1.01);
    }
    
    // Rotation avec deux doigts
    if (pinchDistance > 0.1 && pinchDistance < 0.3) {
      selectedObject.rotation.y += 0.05;
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)'
        }}
        autoPlay
        playsInline
      />
      <canvas
        ref={threeCanvasRef}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          zIndex: 1,
          transform: 'scaleX(-1)'
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          zIndex: 2,
          pointerEvents: 'none',
          transform: 'scaleX(-1)'
        }}
      />
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        color: 'white',
        fontSize: '24px',
        zIndex: 3,
        textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: '10px',
        borderRadius: '5px'
      }}>
        Debug: {debugInfo}
      </div>
    </div>
  );
}
