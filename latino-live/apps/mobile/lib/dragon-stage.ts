import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * The room's 3D stage: a transparent canvas where the dragon stands on a seat
 * and acts one of its own animations. The room underneath never changes.
 */

export type SeatBox = { left: number; top: number; width: number; height: number };

export type DragonModelName = "hombre" | "mujer";

export type DragonStage = {
  play: (box: SeatBox, clip: string) => void;
  pair: (left: SeatBox, right: SeatBox) => void;
  dispose: () => void;
};

type Props = {
  canvas: HTMLCanvasElement;
  /** The model's bytes, downloaded the way each host knows how. */
  loadModel: (name: DragonModelName) => Promise<ArrayBuffer>;
  poolSize?: number;
  onError?: (message: string) => void;
};

const AURA: Record<string, number> = {
  Idle: 0xffc46b,
  Feliz: 0xffd23c,
  Corazon: 0xff4f93,
  Beso: 0xff6fa8,
  Reir: 0xffb347,
  Llorar: 0x6ab7ff,
  Enojado: 0xff2a2a,
  Emocionado: 0xffe066,
};

type Gltf = { scene: THREE.Group; animations: THREE.AnimationClip[] };

type Actor = {
  group: THREE.Group;
  aura: THREE.Sprite;
  shadow: THREE.Sprite;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  busy: boolean;
  state: "in" | "run" | "out" | "";
  elapsed: number;
  startedAt: number;
  current: THREE.AnimationAction | null;
  box: SeatBox;
};

/** A soft round light, used for the aura and for the shadow under the feet. */
function glowTexture(color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.Texture();
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

/** Studio reflections, so the dragon reads with volume instead of flat colour. */
function makeEnvironment(renderer: THREE.WebGLRenderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();
  const sphere = new THREE.SphereGeometry(50, 32, 16);
  const position = sphere.attributes.position;
  const low = new THREE.Color(0x4a1a6a);
  const high = new THREE.Color(0xffc9e4);
  const mixed = new THREE.Color();
  const colors: number[] = [];
  for (let index = 0; index < position.count; index += 1) {
    mixed.copy(low).lerp(high, (position.getY(index) / 50 + 1) / 2);
    colors.push(mixed.r, mixed.g, mixed.b);
  }
  sphere.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  ([[20, 25, 30, 0xffffff, 4], [-30, 12, 20, 0xff9ad0, 3], [0, 15, -40, 0xb08cff, 3]] as const).forEach(([x, y, z, color, power]) => {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(18, 12, 1),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power) }),
    );
    panel.position.set(x, y, z);
    panel.lookAt(0, 0, 0);
    scene.add(panel);
  });
  const texture = pm.fromScene(scene, 0.03).texture;
  pm.dispose();
  return texture;
}

const smooth = (from: number, to: number, time: number) => {
  const x = Math.min(1, Math.max(0, (time - from) / (to - from)));
  return x * x * (3 - 2 * x);
};

/**
 * The dragon's height on screen: a little taller than the seat it stands on,
 * never bigger than a share of the room, so it can't cover the header or chat.
 */
const actorHeight = (box: SeatBox, stageHeight: number) =>
  Math.max(54, Math.min(150, stageHeight * 0.3, box.width * 1.3));

export function createDragonStage({ canvas, loadModel, poolSize = 2, onError }: Props): DragonStage {
  let dead = false;
  let frame = 0;
  /**
   * While no dragon is on stage the loop steps aside: an idle room asks for a
   * frame every fifth of a second instead of sixty times a second. A new
   * emotion wakes it at once.
   */
  let idleTimer: number | null = null;
  let scheduled = false;
  const kick = () => {
    if (dead || !scheduled) return;
    if (idleTimer !== null) {
      window.clearTimeout(idleTimer);
      idleTimer = null;
    }
    scheduled = false;
    frame = requestAnimationFrame(loop);
  };
  let width = canvas.clientWidth || 320;
  let height = canvas.clientHeight || 480;
  let camera = new THREE.OrthographicCamera(0, width, height, 0, -3000, 3000);
  camera.position.z = 1000;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();

  const resize = () => {
    width = canvas.clientWidth || width;
    height = canvas.clientHeight || height;
    renderer.setSize(width, height, false);
    camera = new THREE.OrthographicCamera(0, width, height, 0, -3000, 3000);
    camera.position.z = 1000;
  };
  resize();
  window.addEventListener("resize", resize);

  scene.add(new THREE.HemisphereLight(0xffe3ef, 0x4a1a6a, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(200, 500, 700);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff8fd0, 2.8);
  rim.position.set(-300, 300, -600);
  scene.add(rim);
  const environment = makeEnvironment(renderer);
  scene.environment = environment;

  const auraTexture = glowTexture("rgba(255,255,255,1)");
  const shadowTexture = glowTexture("rgba(0,0,0,1)");
  const loader = new GLTFLoader();
  // A plain clock: three's own Clock is on its way out, and this scene only
  // needs the seconds since the last frame.
  let lastFrame = performance.now();
  const pool: Actor[] = [];

  // A tap that arrives while the model is still downloading waits here, so the
  // very first emote plays instead of being lost.
  let pendingPlay: { box: SeatBox; clip: string } | null = null;
  let pendingPair: { left: SeatBox; right: SeatBox } | null = null;

  const makeActor = (gltf: Gltf): Actor => {
    const group = SkeletonUtils.clone(gltf.scene) as THREE.Group;
    group.visible = false;
    group.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.frustumCulled = false;
      const material = (mesh.material as THREE.MeshStandardMaterial).clone();
      material.envMapIntensity = 1.1;
      (["map", "normalMap", "metalnessMap"] as const).forEach(name => {
        const map = material[name];
        if (map) map.anisotropy = 8;
      });
      mesh.material = material;
    });
    scene.add(group);

    const aura = new THREE.Sprite(new THREE.SpriteMaterial({
      map: auraTexture, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5,
    }));
    const shadow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: shadowTexture, transparent: true, depthWrite: false, opacity: 0.4,
    }));
    aura.visible = false;
    shadow.visible = false;
    scene.add(aura, shadow);

    const mixer = new THREE.AnimationMixer(group);
    const actions = new Map<string, THREE.AnimationAction>();
    gltf.animations.forEach(clip => actions.set(clip.name, mixer.clipAction(clip)));
    return {
      group, aura, shadow, mixer, actions,
      busy: false, state: "", elapsed: 0, startedAt: 0, current: null,
      box: { left: 0, top: 0, width: 60, height: 60 },
    };
  };

  const placeActor = (actor: Actor, box: SeatBox, fade: number, opacity: number) => {
    const px = actorHeight(box, height);
    const scale = px / 4.9;
    const cx = box.left + box.width / 2;
    const cy = height - (box.top + box.height * 0.98);
    actor.group.position.set(cx, cy, 0);
    actor.group.scale.setScalar(Math.max(0.001, scale * fade));
    actor.aura.position.set(cx, cy + px * 0.5, -300);
    actor.aura.scale.set(px * 1.5, px * 1.5, 1);
    actor.aura.material.opacity = opacity * fade * (0.85 + 0.15 * Math.sin(performance.now() / 120));
    actor.shadow.position.set(cx, cy + 2, -200);
    actor.shadow.scale.set(px * 0.9 * fade, px * 0.22 * fade, 1);
  };

  const play = (box: SeatBox, clip: string) => {
    kick();
    if (!pool.length) {
      pendingPlay = { box, clip };
      return;
    }
    const actor = pool.find(item => !item.busy) ?? [...pool].sort((a, b) => a.startedAt - b.startedAt)[0];
    const action = actor.actions.get(clip);
    if (!action) return;
    actor.actions.forEach(other => other.stop());
    actor.busy = true;
    actor.startedAt = performance.now();
    actor.state = "in";
    actor.elapsed = 0;
    actor.current = action;
    actor.box = box;
    actor.group.visible = true;
    actor.aura.visible = true;
    actor.shadow.visible = true;
    actor.aura.material.color.setHex(AURA[clip] ?? 0xffffff);
    action.reset().setLoop(THREE.LoopOnce, 1).play();
    action.clampWhenFinished = true;
  };

  const pairState = { on: false, time: 0, phase: 0, left: null as SeatBox | null, right: null as SeatBox | null };
  let man: Actor | null = null;
  let woman: Actor | null = null;
  let maleModel: Gltf | null = null;
  let femaleModel: Gltf | null = null;
  let femaleLoading = false;

  // The two dragons of the couple are only cloned the first time someone asks
  // for them: keeping extra copies alive costs too much on a phone.
  const startPair = (left: SeatBox, right: SeatBox) => {
    pairState.on = true;
    pairState.time = 0;
    pairState.phase = 0;
    pairState.left = left;
    pairState.right = right;
    [man, woman].forEach(actor => {
      if (!actor) return;
      actor.actions.forEach(action => action.stop());
      actor.group.visible = actor.aura.visible = actor.shadow.visible = true;
      actor.aura.material.color.setHex(0xff4f93);
      const walk = actor.actions.get("Caminar");
      if (walk) {
        walk.reset().setLoop(THREE.LoopOnce, 1).play();
        walk.clampWhenFinished = true;
      }
    });
  };

  const ensurePair = () => {
    if (!maleModel) return;
    if (!man) man = makeActor(maleModel);
    if (femaleModel) {
      if (!woman) woman = makeActor(femaleModel);
    } else if (!femaleLoading) {
      femaleLoading = true;
      loadModel("mujer")
        .then(bytes => new Promise<Gltf>((resolve, reject) => {
          loader.parse(bytes, "", gltf => resolve(gltf as unknown as Gltf), error => reject(error));
        }))
        .then(model => {
          femaleLoading = false;
          if (dead) return;
          femaleModel = model;
          woman = makeActor(model);
          if (pendingPair) {
            const waiting = pendingPair;
            pendingPair = null;
            startPair(waiting.left, waiting.right);
          }
        })
        .catch(() => {
          femaleLoading = false;
          onError?.("La dragoncita no se pudo cargar.");
        });
    }
    if (man && woman && pendingPair) {
      const waiting = pendingPair;
      pendingPair = null;
      startPair(waiting.left, waiting.right);
    }
  };

  const pair = (left: SeatBox, right: SeatBox) => {
    kick();
    if (!man || !woman) {
      pendingPair = { left, right };
      ensurePair();
      return;
    }
    if (pairState.on) return;
    startPair(left, right);
  };

  const stepPair = (delta: number) => {
    if (!pairState.on || !man || !woman) return;
    const a = pairState.left;
    const b = pairState.right;
    if (!a || !b) return;
    pairState.time += delta;
    const time = pairState.time;
    man.mixer.update(delta);
    woman.mixer.update(delta);
    const px = actorHeight(a, height);
    const scale = px / 4.9;
    const ax = a.left + a.width / 2;
    const bx = b.left + b.width / 2;
    const ay = height - (a.top + a.height * 0.98);
    const by = height - (b.top + b.height * 0.98);
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const gap = Math.max(18, 3.2 * scale);
    const walk = smooth(0, 2.4, time);
    const spots = [
      { x: ax + (mx - gap / 2 - ax) * walk, y: ay + (my - ay) * walk, side: 1 },
      { x: bx + (mx + gap / 2 - bx) * walk, y: by + (my - by) * walk, side: -1 },
    ];
    if (time >= 2.4 && pairState.phase === 0) {
      pairState.phase = 1;
      [man, woman].forEach(actor => {
        if (!actor) return;
        actor.actions.get("Caminar")?.stop();
        const kiss = actor.actions.get("Beso_Pareja");
        if (kiss) {
          kiss.reset().setLoop(THREE.LoopOnce, 1).play();
          kiss.clampWhenFinished = true;
        }
      });
    }
    const turn = smooth(0, 0.5, time);
    let fade = Math.min(1, time / 0.2);
    if (time > 7) fade = Math.max(0, 1 - (time - 7) / 0.3);
    [man, woman].forEach((actor, index) => {
      if (!actor) return;
      const spot = spots[index];
      actor.group.position.set(spot.x, spot.y, 0);
      actor.group.rotation.y = spot.side * (Math.PI / 2) * turn;
      actor.group.scale.setScalar(Math.max(0.001, scale * fade));
      actor.aura.position.set(spot.x, spot.y + px * 0.5, -300);
      actor.aura.scale.set(px * 1.5, px * 1.5, 1);
      actor.aura.material.opacity = (time > 2.4 ? 0.5 : 0.2) * fade * (0.85 + 0.15 * Math.sin(performance.now() / 120));
      actor.shadow.position.set(spot.x, spot.y + 2, -200);
      actor.shadow.scale.set(px * 0.9 * fade, px * 0.22 * fade, 1);
    });
    if (time > 7.3) {
      pairState.on = false;
      [man, woman].forEach(actor => {
        if (!actor) return;
        actor.group.visible = actor.aura.visible = actor.shadow.visible = false;
        actor.actions.forEach(action => action.stop());
      });
    }
  };

  loadModel("hombre")
    .then(bytes => new Promise<Gltf>((resolve, reject) => {
      loader.parse(bytes, "", gltf => resolve(gltf as unknown as Gltf), error => reject(error));
    }))
    .then(model => {
      if (dead) return;
      maleModel = model;
      for (let index = 0; index < poolSize; index += 1) {
        const actor = makeActor(model);
        // When its animation ends, the dragon fades out instead of popping.
        actor.mixer.addEventListener("finished", () => {
          actor.state = "out";
          actor.elapsed = 0;
        });
        pool.push(actor);
      }
      const waiting = pendingPlay;
      pendingPlay = null;
      if (waiting) play(waiting.box, waiting.clip);
      if (pendingPair) ensurePair();
    })
    .catch(() => onError?.("El dragón no se pudo cargar."));

  // Drawing only while a dragon is on screen keeps the room smooth on a phone;
  // one extra frame clears the canvas when the emote ends.
  let drewLastFrame = false;
  // While no dragon is on stage the loop steps aside: an idle room asks for a
  // frame every fifth of a second instead of sixty times a second.
  const loop = () => {
    scheduled = false;
    if (dead) return;
    const now = performance.now();
    const delta = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    stepPair(delta);
    let active = pairState.on;
    pool.forEach(actor => {
      if (!actor.busy) return;
      active = true;
      actor.mixer.update(delta);
      actor.elapsed += delta;
      let fade = 1;
      if (actor.state === "in") {
        fade = Math.min(1, actor.elapsed / 0.2);
        if (fade >= 1) actor.state = "run";
      } else if (actor.state === "out") {
        fade = Math.max(0, 1 - actor.elapsed / 0.25);
        if (fade <= 0) {
          actor.busy = false;
          actor.group.visible = actor.aura.visible = actor.shadow.visible = false;
          actor.current?.stop();
          return;
        }
      }
      placeActor(actor, actor.box, fade, 0.5);
    });
    if (active || drewLastFrame) renderer.render(scene, camera);
    drewLastFrame = active;
    if (active) {
      scheduled = true;
      frame = requestAnimationFrame(loop);
    } else {
      scheduled = true;
      idleTimer = window.setTimeout(() => {
        idleTimer = null;
        loop();
      }, 200);
    }
  };
  scheduled = true;
  loop();

  return {
    play,
    pair,
    dispose: () => {
      dead = true;
      cancelAnimationFrame(frame);
      if (idleTimer !== null) window.clearTimeout(idleTimer);
      window.removeEventListener("resize", resize);
      pool.forEach(actor => actor.mixer.stopAllAction());
      man?.mixer.stopAllAction();
      woman?.mixer.stopAllAction();
      auraTexture.dispose();
      shadowTexture.dispose();
      environment.dispose();
      renderer.dispose();
    },
  };
}
