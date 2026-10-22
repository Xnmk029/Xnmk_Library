/**
 * USP Match Retro Low-Poly Disassembly/Assembly 3D Demo
 * Style: PS1 / Half-Life 90s Low-Poly Aesthetics with Procedural Textures
 * Target Engine: Three.js r147
 * Workspace: F:\benchmark\ws-usp\
 */

(function() {
  'use strict';

  // Math helper functions
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function smoothstep(min, max, x) {
    var t = clamp((x - min) / (max - min), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function smootherstep(min, max, x) {
    var t = clamp((x - min) / (max - min), 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  // ---------------------------------------------------------
  // Procedural Canvas Texture Generators (Pixelated Retro Style)
  // ---------------------------------------------------------

  // 1. Noise Texture for Metal Slide & Components (64x64)
  function createNoiseTexture(width, height, baseColorHex, noiseAmp) {
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');

    // Parse base color
    var c = new THREE.Color(baseColorHex);
    var r = Math.floor(c.r * 255);
    var g = Math.floor(c.g * 255);
    var b = Math.floor(c.b * 255);

    var imgData = ctx.createImageData(width, height);
    var data = imgData.data;

    for (var i = 0; i < data.length; i += 4) {
      var n = (Math.random() - 0.5) * noiseAmp * 255;
      data[i] = clamp(r + n, 0, 255);
      data[i + 1] = clamp(g + n, 0, 255);
      data[i + 2] = clamp(b + n, 0, 255);
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    var texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  // 2. Polymer Grip Stipple Texture (32x32)
  function createStippleTexture(width, height) {
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1b1c20';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#2a2c33';
    for (var y = 0; y < height; y += 2) {
      for (var x = (y % 4 === 0 ? 0 : 2); x < width; x += 4) {
        ctx.fillRect(x, y, 1, 1);
      }
    }

    ctx.fillStyle = '#111215';
    for (var y1 = 1; y1 < height; y1 += 2) {
      for (var x1 = (y1 % 4 === 1 ? 2 : 0); x1 < width; x1 += 4) {
        ctx.fillRect(x1, y1, 1, 1);
      }
    }

    var texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  // 3. Radial Glow Sprite Texture for Fiber Optic Sights (32x32)
  function createGlowTexture(colorHex) {
    var canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    var ctx = canvas.getContext('2d');

    var grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, colorHex);
    grad.addColorStop(0.7, colorHex);
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    var texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  // 4. Soft Ground Radial Shadow Texture (64x64)
  function createGroundShadowTexture() {
    var canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    var ctx = canvas.getContext('2d');

    var grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.5)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    var texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  // ---------------------------------------------------------
  // Main Factory function USPMatchDemo.create
  // ---------------------------------------------------------
  function createUSPMatchDemo(container, opts) {
    opts = opts || {};

    // Create Scene
    var scene = new THREE.Scene();
    scene.background = new THREE.Color('#d9dbdd');

    // Camera setup - Orthographic Camera (1 unit = 1mm)
    var aspect = (container.clientWidth || 800) / (container.clientHeight || 600);
    var frustumHeight = 320; // ~320mm vertical view span
    var frustumWidth = frustumHeight * aspect;

    var camera = new THREE.OrthographicCamera(
      -frustumWidth / 2,
      frustumWidth / 2,
      frustumHeight / 2,
      -frustumHeight / 2,
      1,
      2000
    );

    // Initial camera position (3/4 top-left-front view)
    var viewTarget = new THREE.Vector3(45, -20, 0);
    camera.position.set(220, 150, 220);
    camera.lookAt(viewTarget);

    // Renderer setup (Three.js r147 compatibility)
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    var domElement = renderer.domElement;
    container.appendChild(domElement);

    // ---------------------------------------------------------
    // Lighting (Studio 3-Point Lights)
    // ---------------------------------------------------------
    var ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    // Main Light (Top-Left-Front)
    var mainLight = new THREE.DirectionalLight(0xffffff, 1.1);
    mainLight.position.set(-150, 280, 200);
    scene.add(mainLight);

    // Fill Light (Right Side)
    var fillLight = new THREE.DirectionalLight(0xdce6f0, 0.5);
    fillLight.position.set(200, 100, -150);
    scene.add(fillLight);

    // Rim / Key Light (Top-Rear-Right)
    var rimLight = new THREE.DirectionalLight(0xfff0db, 0.85);
    rimLight.position.set(100, 250, -250);
    scene.add(rimLight);

    // ---------------------------------------------------------
    // Procedural Textures & Materials
    // ---------------------------------------------------------
    var slideNoiseTex = createNoiseTexture(64, 64, '#383b40', 0.08);
    slideNoiseTex.repeat.set(4, 2);

    var polymerTex = createNoiseTexture(32, 32, '#17181b', 0.06);
    polymerTex.repeat.set(2, 2);

    var stippleTex = createStippleTexture(32, 32);
    stippleTex.repeat.set(3, 6);

    var greenGlowTex = createGlowTexture('#00ff55');
    var redGlowTex = createGlowTexture('#ff1133');
    var groundShadowTex = createGroundShadowTexture();

    // Materials (ALL using flatShading: true as required by spec)
    var polyMat = new THREE.MeshStandardMaterial({
      color: 0x17181b,
      roughness: 0.75,
      metalness: 0.1,
      map: polymerTex,
      flatShading: true
    });

    var gripPanelMat = new THREE.MeshStandardMaterial({
      color: 0x1f2126,
      roughness: 0.8,
      metalness: 0.05,
      map: stippleTex,
      flatShading: true
    });

    var slideMat = new THREE.MeshStandardMaterial({
      color: 0x383b40,
      roughness: 0.45,
      metalness: 0.65,
      map: slideNoiseTex,
      flatShading: true
    });

    var barrelMat = new THREE.MeshStandardMaterial({
      color: 0xc9ced4,
      roughness: 0.3,
      metalness: 0.9,
      flatShading: true
    });

    var compMat = new THREE.MeshStandardMaterial({
      color: 0x26282d,
      roughness: 0.5,
      metalness: 0.75,
      flatShading: true
    });

    var compRecessMat = new THREE.MeshStandardMaterial({
      color: 0x0c0d0e,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true
    });

    var magBodyMat = new THREE.MeshStandardMaterial({
      color: 0x222428,
      roughness: 0.4,
      metalness: 0.75,
      flatShading: true
    });

    var magBaseMat = new THREE.MeshStandardMaterial({
      color: 0x17181b,
      roughness: 0.75,
      metalness: 0.1,
      flatShading: true
    });

    var magFollowerMat = new THREE.MeshStandardMaterial({
      color: 0xd65a11,
      roughness: 0.5,
      metalness: 0.1,
      flatShading: true
    });

    var cartridgeBrassMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.35,
      metalness: 0.85,
      flatShading: true
    });

    var cartridgeBulletMat = new THREE.MeshStandardMaterial({
      color: 0xb86d29,
      roughness: 0.4,
      metalness: 0.8,
      flatShading: true
    });

    var leverMat = new THREE.MeshStandardMaterial({
      color: 0x2b2d32,
      roughness: 0.5,
      metalness: 0.6,
      flatShading: true
    });

    var frontSightOpticMat = new THREE.MeshBasicMaterial({
      color: 0x00ff55
    });

    var rearSightOpticMat = new THREE.MeshBasicMaterial({
      color: 0xff1133
    });

    var frontGlowSpriteMat = new THREE.SpriteMaterial({
      map: greenGlowTex,
      color: 0x00ff55,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false
    });

    var rearGlowSpriteMat = new THREE.SpriteMaterial({
      map: redGlowTex,
      color: 0xff1133,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false
    });

    var shadowMat = new THREE.MeshBasicMaterial({
      map: groundShadowTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });

    // Track resources for complete dispose()
    var geometriesToDispose = [];
    var materialsToDispose = [
      polyMat, gripPanelMat, slideMat, barrelMat, compMat, compRecessMat,
      magBodyMat, magBaseMat, magFollowerMat, cartridgeBrassMat, cartridgeBulletMat,
      leverMat, frontSightOpticMat, rearSightOpticMat, frontGlowSpriteMat,
      rearGlowSpriteMat, shadowMat
    ];
    var texturesToDispose = [
      slideNoiseTex, polymerTex, stippleTex, greenGlowTex, redGlowTex, groundShadowTex
    ];

    function trackGeometry(geo) {
      geometriesToDispose.push(geo);
      return geo;
    }

    // Root Group
    var rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // Ground Shadow Plane
    var shadowGeo = trackGeometry(new THREE.PlaneGeometry(360, 180));
    var shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.set(40, -115, 0);
    scene.add(shadowMesh);

    // ---------------------------------------------------------
    // 1. Lower Receiver & Grip Assembly (frameGroup - Fixed)
    // ---------------------------------------------------------
    var frameGroup = new THREE.Group();
    rootGroup.add(frameGroup);

    // Dust cover / front frame block
    var dustCoverGeo = trackGeometry(new THREE.BoxGeometry(110, 22, 26));
    var dustCoverMesh = new THREE.Mesh(dustCoverGeo, polyMat);
    dustCoverMesh.position.set(65, -2, 0);
    frameGroup.add(dustCoverMesh);

    // Beveled front bottom of dust cover
    var dustBevelGeo = trackGeometry(new THREE.BoxGeometry(30, 12, 26));
    var dustBevelMesh = new THREE.Mesh(dustBevelGeo, polyMat);
    dustBevelMesh.position.set(105, -7, 0);
    dustBevelMesh.rotation.z = -0.3;
    frameGroup.add(dustBevelMesh);

    // Picatinny / USP Accessory Rail Notches
    for (var r = 0; r < 4; r++) {
      var railSlotGeo = trackGeometry(new THREE.BoxGeometry(4, 3, 26.4));
      var railSlotMesh = new THREE.Mesh(railSlotGeo, compRecessMat);
      railSlotMesh.position.set(40 + r * 16, -12, 0);
      frameGroup.add(railSlotMesh);
    }

    // Rear frame receiver body
    var rearFrameGeo = trackGeometry(new THREE.BoxGeometry(60, 24, 26));
    var rearFrameMesh = new THREE.Mesh(rearFrameGeo, polyMat);
    rearFrameMesh.position.set(-20, -1, 0);
    frameGroup.add(rearFrameMesh);

    // Pistol Grip Main Body (Tilted 15 degrees backwards)
    var gripAngleRad = 15 * (Math.PI / 180); // 0.2618 rad
    var gripGroup = new THREE.Group();
    gripGroup.position.set(0, -10, 0);
    gripGroup.rotation.z = -gripAngleRad;
    frameGroup.add(gripGroup);

    var gripBoxGeo = trackGeometry(new THREE.BoxGeometry(38, 92, 25));
    var gripBoxMesh = new THREE.Mesh(gripBoxGeo, polyMat);
    gripBoxMesh.position.set(-8, -45, 0);
    gripGroup.add(gripBoxMesh);

    // Grip Textured Side Panels (Left & Right)
    var panelGeo = trackGeometry(new THREE.BoxGeometry(34, 70, 1.5));

    var panelLeft = new THREE.Mesh(panelGeo, gripPanelMat);
    panelLeft.position.set(-8, -45, 12.8);
    gripGroup.add(panelLeft);

    var panelRight = new THREE.Mesh(panelGeo, gripPanelMat);
    panelRight.position.set(-8, -45, -12.8);
    gripGroup.add(panelRight);

    // Grip Rear Backstrap Cushion
    var backstrapGeo = trackGeometry(new THREE.CylinderGeometry(8, 12, 85, 6));
    var backstrapMesh = new THREE.Mesh(backstrapGeo, polyMat);
    backstrapMesh.position.set(-24, -45, 0);
    backstrapMesh.scale.set(0.6, 1, 1.2);
    gripGroup.add(backstrapMesh);

    // Magwell Flared Bottom Opening
    var magwellLipGeo = trackGeometry(new THREE.BoxGeometry(42, 6, 28));
    var magwellLipMesh = new THREE.Mesh(magwellLipGeo, polyMat);
    magwellLipMesh.position.set(-8, -92, 0);
    gripGroup.add(magwellLipMesh);

    // Trigger Guard Assembly (Polygonal USP style loop)
    var tgTopGeo = trackGeometry(new THREE.BoxGeometry(45, 4, 14));
    var tgTopMesh = new THREE.Mesh(tgTopGeo, polyMat);
    tgTopMesh.position.set(40, -14, 0);
    frameGroup.add(tgTopMesh);

    var tgFrontGeo = trackGeometry(new THREE.BoxGeometry(4, 24, 14));
    var tgFrontMesh = new THREE.Mesh(tgFrontGeo, polyMat);
    tgFrontMesh.position.set(62, -24, 0);
    tgFrontMesh.rotation.z = -0.2;
    frameGroup.add(tgFrontMesh);

    var tgBottomGeo = trackGeometry(new THREE.BoxGeometry(44, 4, 14));
    var tgBottomMesh = new THREE.Mesh(tgBottomGeo, polyMat);
    tgBottomMesh.position.set(42, -35, 0);
    tgBottomMesh.rotation.z = 0.08;
    frameGroup.add(tgBottomMesh);

    // Trigger (Pivoting Lever)
    var triggerGroup = new THREE.Group();
    triggerGroup.position.set(42, -14, 0);
    frameGroup.add(triggerGroup);

    var triggerBladeGeo = trackGeometry(new THREE.BoxGeometry(4, 16, 6));
    var triggerBladeMesh = new THREE.Mesh(triggerBladeGeo, leverMat);
    triggerBladeMesh.position.set(-2, -8, 0);
    triggerBladeMesh.rotation.z = -0.35;
    triggerGroup.add(triggerBladeMesh);

    // Magazine Release Paddle Buttons (At base of trigger guard)
    var magReleaseLeftGeo = trackGeometry(new THREE.BoxGeometry(10, 4, 4));
    var magReleaseLeft = new THREE.Mesh(magReleaseLeftGeo, leverMat);
    magReleaseLeft.position.set(20, -32, 8);
    magReleaseLeft.rotation.z = -0.2;
    frameGroup.add(magReleaseLeft);

    var magReleaseRight = new THREE.Mesh(magReleaseLeftGeo, leverMat);
    magReleaseRight.position.set(20, -32, -8);
    magReleaseRight.rotation.z = -0.2;
    frameGroup.add(magReleaseRight);

    // Frame Safety / Decocker Lever (Left Side Rear)
    var safetyLeverGeo = trackGeometry(new THREE.BoxGeometry(16, 6, 4));
    var safetyLeverMesh = new THREE.Mesh(safetyLeverGeo, leverMat);
    safetyLeverMesh.position.set(-32, 6, 14.5);
    safetyLeverMesh.rotation.z = -0.15;
    frameGroup.add(safetyLeverMesh);

    // Slide Guide Rails (Top of Frame)
    var frameRailGeo = trackGeometry(new THREE.BoxGeometry(140, 3, 3));
    var frameRailLeft = new THREE.Mesh(frameRailGeo, barrelMat);
    frameRailLeft.position.set(25, 9.5, 12.5);
    frameGroup.add(frameRailLeft);

    var frameRailRight = new THREE.Mesh(frameRailGeo, barrelMat);
    frameRailRight.position.set(25, 9.5, -12.5);
    frameGroup.add(frameRailRight);

    // ---------------------------------------------------------
    // 2. Slide Stop Lever Assembly (Interactive with Slide)
    // ---------------------------------------------------------
    var slideStopGroup = new THREE.Group();
    slideStopGroup.position.set(15, 6, 14.2);
    frameGroup.add(slideStopGroup);

    var stopLeverBarGeo = trackGeometry(new THREE.BoxGeometry(32, 5, 3));
    var stopLeverBarMesh = new THREE.Mesh(stopLeverBarGeo, leverMat);
    stopLeverBarMesh.position.set(-10, 0, 0);
    slideStopGroup.add(stopLeverBarMesh);

    var stopLeverPadGeo = trackGeometry(new THREE.BoxGeometry(12, 8, 4));
    var stopLeverPadMesh = new THREE.Mesh(stopLeverPadGeo, leverMat);
    stopLeverPadMesh.position.set(-2, -3, 1);
    slideStopGroup.add(stopLeverPadMesh);

    var stopLeverPinGeo = trackGeometry(new THREE.BoxGeometry(4, 6, 4));
    var stopLeverPinMesh = new THREE.Mesh(stopLeverPinGeo, barrelMat);
    stopLeverPinMesh.position.set(4, 4, -1);
    slideStopGroup.add(stopLeverPinMesh);

    // ---------------------------------------------------------
    // 3. Barrel & Chamber Assembly (barrelGroup - Fixed)
    // ---------------------------------------------------------
    var barrelGroup = new THREE.Group();
    rootGroup.add(barrelGroup);

    // Breech / Chamber Lock Block
    var chamberBlockGeo = trackGeometry(new THREE.BoxGeometry(34, 22, 23));
    var chamberBlockMesh = new THREE.Mesh(chamberBlockGeo, barrelMat);
    chamberBlockMesh.position.set(17, 18, 0);
    barrelGroup.add(chamberBlockMesh);

    // Ejection Port Hood Detail
    var hoodGeo = trackGeometry(new THREE.BoxGeometry(32, 3, 22.8));
    var hoodMesh = new THREE.Mesh(hoodGeo, barrelMat);
    hoodMesh.position.set(17, 28.5, 0);
    barrelGroup.add(hoodMesh);

    // Cylindrical Barrel Tube (14.5mm outer diameter, low-poly 8 segments)
    var barrelTubeGeo = trackGeometry(new THREE.CylinderGeometry(7.25, 7.25, 155, 8));
    var barrelTubeMesh = new THREE.Mesh(barrelTubeGeo, barrelMat);
    barrelTubeMesh.rotation.z = -Math.PI / 2;
    barrelTubeMesh.position.set(110, 18, 0);
    barrelGroup.add(barrelTubeMesh);

    // Barrel Inner Muzzle Bore Recess
    var boreGeo = trackGeometry(new THREE.CylinderGeometry(4.5, 4.5, 6, 8));
    var boreMesh = new THREE.Mesh(boreGeo, compRecessMat);
    boreMesh.rotation.z = -Math.PI / 2;
    boreMesh.position.set(186, 18, 0);
    barrelGroup.add(boreMesh);

    // ---------------------------------------------------------
    // 4. Match Weight / Compensator Assembly (compensatorGroup - Fixed)
    // ---------------------------------------------------------
    var compensatorGroup = new THREE.Group();
    rootGroup.add(compensatorGroup);

    // Main Weight Block Body
    var compBodyGeo = trackGeometry(new THREE.BoxGeometry(62, 45, 27));
    var compBodyMesh = new THREE.Mesh(compBodyGeo, compMat);
    compBodyMesh.position.set(156, 8, 0);
    compensatorGroup.add(compBodyMesh);

    // Lower Front Weight Extension Taper
    var compLowerTaperGeo = trackGeometry(new THREE.BoxGeometry(30, 14, 27));
    var compLowerTaperMesh = new THREE.Mesh(compLowerTaperGeo, compMat);
    compLowerTaperMesh.position.set(170, -18, 0);
    compLowerTaperMesh.rotation.z = 0.25;
    compensatorGroup.add(compLowerTaperMesh);

    // Side Ported Vent Slots (Left & Right 3 Openings)
    for (var sv = 0; sv < 3; sv++) {
      var slotX = 142 + sv * 14;
      var ventGeo = trackGeometry(new THREE.BoxGeometry(8, 12, 27.4));

      var ventLeft = new THREE.Mesh(ventGeo, compRecessMat);
      ventLeft.position.set(slotX, 16, 0);
      compensatorGroup.add(ventLeft);
    }

    // Bottom Mounting Rails Attachment Bracket
    var compBracketGeo = trackGeometry(new THREE.BoxGeometry(34, 16, 26.6));
    var compBracketMesh = new THREE.Mesh(compBracketGeo, compMat);
    compBracketMesh.position.set(110, -5, 0);
    compensatorGroup.add(compBracketMesh);

    // "MATCH" Low-Poly Stylized Side Plate Badge
    var matchBadgeGeo = trackGeometry(new THREE.BoxGeometry(36, 8, 1));
    var matchBadgeLeft = new THREE.Mesh(matchBadgeGeo, compRecessMat);
    matchBadgeLeft.position.set(156, -6, 13.6);
    compensatorGroup.add(matchBadgeLeft);

    var matchBadgeRight = new THREE.Mesh(matchBadgeGeo, compRecessMat);
    matchBadgeRight.position.set(156, -6, -13.6);
    compensatorGroup.add(matchBadgeRight);

    // ---------------------------------------------------------
    // 5. Slide Assembly (slideGroup - Animates along X)
    // ---------------------------------------------------------
    var slideGroup = new THREE.Group();
    rootGroup.add(slideGroup);

    // Lower Slide Main Box (Length 180mm: X from -50 to +130)
    var slideLowerGeo = trackGeometry(new THREE.BoxGeometry(180, 16, 27));
    var slideLowerMesh = new THREE.Mesh(slideLowerGeo, slideMat);
    slideLowerMesh.position.set(40, 17, 0);
    slideGroup.add(slideLowerMesh);

    // Upper Slide Tapered Roof Box
    var slideUpperGeo = trackGeometry(new THREE.BoxGeometry(180, 10, 21));
    var slideUpperMesh = new THREE.Mesh(slideUpperGeo, slideMat);
    slideUpperMesh.position.set(40, 29, 0);
    slideGroup.add(slideUpperMesh);

    // Beveled Front Nose Chamfer
    var slideNoseGeo = trackGeometry(new THREE.BoxGeometry(20, 12, 26.8));
    var slideNoseMesh = new THREE.Mesh(slideNoseGeo, slideMat);
    slideNoseMesh.position.set(122, 27, 0);
    slideNoseMesh.rotation.z = -0.3;
    slideGroup.add(slideNoseMesh);

    // Front Cocking Serrations (4 angled cut slots)
    for (var fs = 0; fs < 4; fs++) {
      var fsGeo = trackGeometry(new THREE.BoxGeometry(2.5, 14, 27.4));

      var fsMesh = new THREE.Mesh(fsGeo, compRecessMat);
      fsMesh.position.set(92 + fs * 6, 20, 0);
      fsMesh.rotation.z = -0.2;
      slideGroup.add(fsMesh);
    }

    // Rear Cocking Serrations (7 angled cut slots)
    for (var rs = 0; rs < 7; rs++) {
      var rsGeo = trackGeometry(new THREE.BoxGeometry(2.5, 18, 27.4));

      var rsMesh = new THREE.Mesh(rsGeo, compRecessMat);
      rsMesh.position.set(-38 + rs * 5, 20, 0);
      rsMesh.rotation.z = -0.2;
      slideGroup.add(rsMesh);
    }

    // Ejection Port Cutout Exposing Barrel Chamber Block
    var ejectPortCutGeo = trackGeometry(new THREE.BoxGeometry(34, 14, 14));
    var ejectPortCutMesh = new THREE.Mesh(ejectPortCutGeo, compRecessMat);
    ejectPortCutMesh.position.set(17, 26, 7);
    slideGroup.add(ejectPortCutMesh);

    // Extractor (Right side near ejection port)
    var extractorGeo = trackGeometry(new THREE.BoxGeometry(18, 4, 3));
    var extractorMesh = new THREE.Mesh(extractorGeo, leverMat);
    extractorMesh.position.set(32, 21, 13.2);
    slideGroup.add(extractorMesh);

    // Slide Locking Notch (For Slide Stop Lever)
    var slideNotchGeo = trackGeometry(new THREE.BoxGeometry(6, 6, 4));
    var slideNotchMesh = new THREE.Mesh(slideNotchGeo, compRecessMat);
    slideNotchMesh.position.set(15, 10, 13);
    slideGroup.add(slideNotchMesh);

    // ---------------------------------------------------------
    // 6. Fiber Optic Sights (High Contrast - Fixed to Slide)
    // ---------------------------------------------------------

    // Front Sight Base (On top front of slide)
    var frontSightBaseGeo = trackGeometry(new THREE.BoxGeometry(12, 6, 6));
    var frontSightBase = new THREE.Mesh(frontSightBaseGeo, compMat);
    frontSightBase.position.set(118, 36, 0);
    slideGroup.add(frontSightBase);

    // Front Fiber Optic Rod (Green)
    var frontOpticGeo = trackGeometry(new THREE.CylinderGeometry(1.2, 1.2, 10, 6));
    var frontOpticMesh = new THREE.Mesh(frontOpticGeo, frontSightOpticMat);
    frontOpticMesh.rotation.z = Math.PI / 2;
    frontOpticMesh.position.set(118, 37, 0);
    slideGroup.add(frontOpticMesh);

    // Front Sight Glowing Sprite Point
    var frontGlowSprite = new THREE.Sprite(frontGlowSpriteMat);
    frontGlowSprite.position.set(123, 37, 0);
    frontGlowSprite.scale.set(14, 14, 1);
    slideGroup.add(frontGlowSprite);

    // Rear Sight Base (U-Notch on rear of slide)
    var rearSightBaseGeo = trackGeometry(new THREE.BoxGeometry(14, 10, 18));
    var rearSightBase = new THREE.Mesh(rearSightBaseGeo, compMat);
    rearSightBase.position.set(-42, 38, 0);
    slideGroup.add(rearSightBase);

    // Rear Sight Notch Cut
    var rearNotchGeo = trackGeometry(new THREE.BoxGeometry(16, 6, 6));
    var rearNotchMesh = new THREE.Mesh(rearNotchGeo, compRecessMat);
    rearNotchMesh.position.set(-42, 41, 0);
    slideGroup.add(rearNotchMesh);

    // Rear Fiber Optic Rods (Dual Red)
    var rearOpticGeo = trackGeometry(new THREE.CylinderGeometry(1.0, 1.0, 12, 6));

    var rearOpticLeft = new THREE.Mesh(rearOpticGeo, rearSightOpticMat);
    rearOpticLeft.rotation.z = Math.PI / 2;
    rearOpticLeft.position.set(-42, 39, 5.5);
    slideGroup.add(rearOpticLeft);

    var rearOpticRight = new THREE.Mesh(rearOpticGeo, rearSightOpticMat);
    rearOpticRight.rotation.z = Math.PI / 2;
    rearOpticRight.position.set(-42, 39, -5.5);
    slideGroup.add(rearOpticRight);

    // Rear Sights Glowing Sprites
    var rearGlowSpriteLeft = new THREE.Sprite(rearGlowSpriteMat);
    rearGlowSpriteLeft.position.set(-47, 39, 5.5);
    rearGlowSpriteLeft.scale.set(10, 10, 1);
    slideGroup.add(rearGlowSpriteLeft);

    var rearGlowSpriteRight = new THREE.Sprite(rearGlowSpriteMat);
    rearGlowSpriteRight.position.set(-47, 39, -5.5);
    rearGlowSpriteRight.scale.set(10, 10, 1);
    slideGroup.add(rearGlowSpriteRight);

    // ---------------------------------------------------------
    // 7. Magazine Assembly (magazineGroup - Animates along grip axis)
    // ---------------------------------------------------------
    var magazineGroup = new THREE.Group();
    // Mount magazine inside grip group so local origin is grip top
    gripGroup.add(magazineGroup);

    // Metal Box Body
    var magBoxGeo = trackGeometry(new THREE.BoxGeometry(32, 90, 20.5));
    var magBoxMesh = new THREE.Mesh(magBoxGeo, magBodyMat);
    magBoxMesh.position.set(-8, -44, 0);
    magazineGroup.add(magBoxMesh);

    // Indicator Hole Grooves on Mag Rear
    for (var mh = 0; mh < 5; mh++) {
      var mhGeo = trackGeometry(new THREE.BoxGeometry(4, 3, 21));
      var mhMesh = new THREE.Mesh(mhGeo, compRecessMat);
      mhMesh.position.set(-23, -20 - mh * 14, 0);
      magazineGroup.add(mhMesh);
    }

    // Polymer Base Floor Plate
    var magBaseGeo = trackGeometry(new THREE.BoxGeometry(40, 10, 26));
    var magBaseMesh = new THREE.Mesh(magBaseGeo, magBaseMat);
    magBaseMesh.position.set(-6, -92, 0);
    magazineGroup.add(magBaseMesh);

    // Extended Base Toe Front Lip
    var magToeGeo = trackGeometry(new THREE.BoxGeometry(10, 8, 25));
    var magToeMesh = new THREE.Mesh(magToeGeo, magBaseMat);
    magToeMesh.position.set(14, -92, 0);
    magToeMesh.rotation.z = -0.2;
    magazineGroup.add(magToeMesh);

    // Top Orange Feed Follower
    var followerGeo = trackGeometry(new THREE.BoxGeometry(28, 6, 18));
    var followerMesh = new THREE.Mesh(followerGeo, magFollowerMat);
    followerMesh.position.set(-8, 2, 0);
    magazineGroup.add(followerMesh);

    // Dummy Cartridge Brass Case (Loaded on top)
    var roundCaseGeo = trackGeometry(new THREE.CylinderGeometry(4.8, 4.8, 18, 8));
    var roundCaseMesh = new THREE.Mesh(roundCaseGeo, cartridgeBrassMat);
    roundCaseMesh.rotation.z = Math.PI / 2;
    roundCaseMesh.position.set(-5, 6, 0);
    magazineGroup.add(roundCaseMesh);

    // Dummy Cartridge Bullet Tip
    var roundBulletGeo = trackGeometry(new THREE.CylinderGeometry(2.5, 4.6, 9, 8));
    var roundBulletMesh = new THREE.Mesh(roundBulletGeo, cartridgeBulletMat);
    roundBulletMesh.rotation.z = -Math.PI / 2;
    roundBulletMesh.position.set(8.5, 6, 0);
    magazineGroup.add(roundBulletMesh);

    // ---------------------------------------------------------
    // Animation State Derive Function (Derived solely from nowSec)
    // ---------------------------------------------------------
    var currentPhaseLabel = "分解保持";
    var mainLoopProgress = 0;

    function updateAnimation(nowSec) {
      var cycleT = 8.0;
      var t = ((nowSec % cycleT) + cycleT) % cycleT; // Ensure non-negative t in [0, 8)
      mainLoopProgress = t / cycleT;

      var slideX = -35.0;     // Slide position X (mm)
      var leverAngle = 0.18;  // Slide stop lever tilt UP (+10 degrees = ~0.18 rad)
      var magDist = 50.0;     // Magazine displacement down along grip axis (mm)
      var magTilt = -0.05;    // Magazine slight tilt when separated (rad)
      var magReleasePush = 0; // Mag release button press inward (mm)
      var triggerAngle = 0;   // Trigger micro pull (rad)

      if (t < 1.5) {
        // Phase 1: 0.0 - 1.5s -> Magazine Insertion ("弹匣装入")
        currentPhaseLabel = "弹匣装入";
        slideX = -35.0;
        leverAngle = 0.18;

        if (t < 0.3) {
          // Micro dip downward (50 -> 55 -> 50mm)
          var dipT = t / 0.3;
          magDist = 50.0 + 5.0 * Math.sin(dipT * Math.PI);
          magTilt = -0.05;
        } else {
          // Smooth slide into grip
          var insertFactor = smootherstep(0.3, 1.45, t);
          magDist = (1.0 - insertFactor) * 50.0;
          magTilt = (1.0 - insertFactor) * -0.05;
        }
      } else if (t < 2.2) {
        // Phase 2: 1.5 - 2.2s -> Slide Pull Back Cocking ("套筒预拉")
        currentPhaseLabel = "套筒预拉";
        magDist = 0.0;
        magTilt = 0.0;

        var cockFactor = smoothstep(1.5, 2.15, t);
        slideX = -35.0 - cockFactor * 8.0; // Pulls back to -43mm

        // Slide stop lever drops down as slide pulls back
        var dropFactor = smoothstep(1.5, 1.9, t);
        leverAngle = (1.0 - dropFactor) * 0.18;
      } else if (t < 3.6) {
        // Phase 3: 2.2 - 3.6s -> Slide Forward Return & Lock ("套筒复位")
        currentPhaseLabel = "套筒复位";
        magDist = 0.0;
        magTilt = 0.0;
        leverAngle = 0.0;

        if (t < 3.4) {
          // Smooth forward movement from -43mm to 0mm
          var returnFactor = smootherstep(2.2, 3.4, t);
          slideX = -43.0 * (1.0 - returnFactor);
        } else {
          // Damped oscillation bounce at battery (±1.5mm)
          var tb = (t - 3.4) / 0.2;
          var bounce = -1.5 * Math.sin(tb * Math.PI * 2.0) * (1.0 - tb);
          slideX = bounce;
        }
      } else if (t < 4.6) {
        // Phase 4: 3.6 - 4.6s -> Battery Standby ("闭锁保持")
        currentPhaseLabel = "闭锁保持";
        magDist = 0.0;
        magTilt = 0.0;
        leverAngle = 0.0;

        // Subtle micro breathing待机
        var breatheT = (t - 3.6) / 1.0;
        slideX = Math.sin(breatheT * Math.PI * 2.0) * 0.08;
      } else if (t < 6.0) {
        // Phase 5: 4.6 - 6.0s -> Slide Pull Back to Lock ("套筒后拉")
        currentPhaseLabel = "套筒后拉";
        magDist = 0.0;
        magTilt = 0.0;

        var pullFactor = smootherstep(4.6, 5.85, t);
        slideX = -pullFactor * 35.0; // Moves to -35mm

        // As slide reaches -35mm, slide stop lever tilts UP to lock
        var lockFactor = smoothstep(5.55, 5.95, t);
        leverAngle = lockFactor * 0.18;
      } else if (t < 7.0) {
        // Phase 6: 6.0 - 7.0s -> Magazine Drop Release ("弹匣松脱")
        currentPhaseLabel = "弹匣松脱";
        slideX = -35.0;
        leverAngle = 0.18;

        // Mag release button press
        if (t >= 6.0 && t < 6.4) {
          var btnT = (t - 6.0) / 0.4;
          magReleasePush = Math.sin(btnT * Math.PI) * 2.5;
        }

        // Magazine drops down
        var dropMagFactor = smoothstep(6.1, 6.95, t);
        magDist = dropMagFactor * 50.0;
        magTilt = dropMagFactor * -0.05;
      } else {
        // Phase 7: 7.0 - 8.0s -> Disassembly Stay ("分解保持")
        currentPhaseLabel = "分解保持";
        slideX = -35.0;
        leverAngle = 0.18;
        magDist = 50.0;
        magTilt = -0.05;
        magReleasePush = 0.0;
      }

      // Apply animated transformations
      slideGroup.position.x = slideX;

      // Magazine position along local grip Y axis
      magazineGroup.position.y = -magDist;
      magazineGroup.rotation.z = magTilt;

      // Slide stop lever pivot
      slideStopGroup.rotation.z = leverAngle;

      // Mag release button push
      magReleaseLeft.position.z = 8.0 - magReleasePush;
      magReleaseRight.position.z = -8.0 + magReleasePush;

      // Trigger micro tilt during slide return
      if (t >= 2.2 && t < 3.6) {
        triggerAngle = Math.sin((t - 2.2) / 1.4 * Math.PI) * 0.1;
      }
      triggerGroup.rotation.z = triggerAngle;
    }

    // ---------------------------------------------------------
    // API Implementation
    // ---------------------------------------------------------
    var api = {
      domElement: domElement,
      camera: camera,
      viewTarget: viewTarget,

      frame: function(nowSec, dtSec) {
        updateAnimation(nowSec);
        renderer.render(scene, camera);
      },

      getProgress: function() {
        return mainLoopProgress;
      },

      getPhaseLabel: function() {
        return currentPhaseLabel;
      },

      resize: function(w, h) {
        if (!w || !h || w <= 0 || h <= 0) return;
        var newAspect = w / h;
        var fh = 320;
        var fw = fh * newAspect;

        camera.left = -fw / 2;
        camera.right = fw / 2;
        camera.top = fh / 2;
        camera.bottom = -fh / 2;
        camera.updateProjectionMatrix();

        renderer.setSize(w, h);
      },

      dispose: function() {
        // 1. Remove canvas from container
        if (domElement && domElement.parentNode) {
          domElement.parentNode.removeChild(domElement);
        }

        // 2. Dispose geometries
        for (var i = 0; i < geometriesToDispose.length; i++) {
          if (geometriesToDispose[i]) {
            geometriesToDispose[i].dispose();
          }
        }

        // 3. Dispose materials
        for (var j = 0; j < materialsToDispose.length; j++) {
          if (materialsToDispose[j]) {
            materialsToDispose[j].dispose();
          }
        }

        // 4. Dispose textures
        for (var k = 0; k < texturesToDispose.length; k++) {
          if (texturesToDispose[k]) {
            texturesToDispose[k].dispose();
          }
        }

        // 5. Dispose renderer
        renderer.dispose();
      }
    };

    // Initial frame render
    api.frame(0, 0);

    return api;
  }

  // Global Export
  window.USPMatchDemo = {
    create: createUSPMatchDemo
  };
})();
