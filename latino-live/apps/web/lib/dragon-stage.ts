import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * The 3D stage of the room: a transparent canvas where the dragon stands on a
 * seat and acts one of its own animations. The page stays untouched underneath.
 */

export type DragonClip = {
  /** The animation's name inside the model, which is what plays. */
  id: string;
  label: string;
  emoji: string;
  /** Colour of the light around the dragon while it acts. */
  aura: number;
};

export const DRAGON_CLIPS: DragonClip[] = [
  { id: "Idle", label: "Idle", emoji: "🐲", aura: 0xffc46b },
  { id: "Feliz", label: "Feliz", emoji: "😊", aura: 0xffd23c },
  { id: "Corazon", label: "Corazón", emoji: "❤️", aura: 0xff4f93 },
  { id: "Beso", label: "Beso", emoji: "💋", aura: 0xff6fa8 },
  { id: "Reir", label: "Reír", emoji: "😂", aura: 0xffb347 },
  { id: "Llorar", label: "Llorar", emoji: "😭", aura: 0x6ab7ff },
  { id: "Enojado", label: "Enojado", emoji: "😡", aura: 0xff2a2a },
  { id: "Emocionado", label: "Emocionado", emoji: "🤩", aura: 0xffe066 },
];

const AURA: Record<string, number> = Object.fromEntries(DRAGON_CLIPS.map(item => [item.id, item.aura]));

type Gltf = { scene: THREE.Group; animations: THREE.AnimationClip[] };

type Actor = {
  group: THREE.Group;
  aura: THREE.Sprite;
  shadow: THREE.Sprite;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  busy: boolean;
  seat: number | null;
  state: "in" | "run" | "out" | "";
  elapsed: number;
  startedAt: number;
  current: THREE.AnimationAction | null;
};

export type DragonStage = {
  play: (seat: number | null, clip: string) => void;
  pair: (left: number, right: number) => void;
  dispose: () => void;
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
 * Builds the stage on a canvas. `getSeatEl` answers the seat's box on the page,
 * so the dragon always stands exactly on the seat it is acting for.
 */
export function createDragonStage({
  canvas,
  getSeatEl,
  poolSize = 2,
  onError,
}: {
  canvas: HTMLCanvasElement;
  getSeatEl: (seat: number) => HTMLElement | null;
  poolSize?: number;
  onError?: (message: string) => void;
}): DragonStage {
  let dead = false;
  let frame = 0;
  let height = window.innerHeight;
  let camera = new THREE.OrthographicCamera(0, window.innerWidth, height, 0, -3000, 3000);
  camera.position.z = 1000;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();

  const resize = () => {
    const width = window.innerWidth;
    height = window.innerHeight;
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
  const clock = new THREE.Clock();
  const pool: Actor[] = [];
  // A tap that arrives while the model is still downloading waits here, so the
  // very first emote plays instead of being lost.
  let pendingPlay: { seat: number | null; clip: string } | null = null;
  let pendingPair: { left: number; right: number } | null = null;

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
    return { group, aura, shadow, mixer, actions, busy: false, seat: null, state: "", elapsed: 0, startedAt: 0, current: null };
  };

  const play = (seat: number | null, clip: string) => {
    if (!pool.length) {
      pendingPlay = { seat, clip };
      return;
    }
    const actor = pool.find(item => !item.busy) ?? [...pool].sort((a, b) => a.startedAt - b.startedAt)[0];
    const action = actor.actions.get(clip);
    if (!action) return;
    actor.actions.forEach(other => other.stop());
    actor.busy = true;
    actor.seat = seat;
    actor.startedAt = performance.now();
    actor.state = "in";
    actor.elapsed = 0;
    actor.current = action;
    actor.group.visible = true;
    actor.aura.visible = true;
    actor.shadow.visible = true;
    actor.aura.material.color.setHex(AURA[clip] ?? 0xffffff);
    action.reset().setLoop(THREE.LoopOnce, 1).play();
    action.clampWhenFinished = true;
  };

  const pairState = { on: false, time: 0, left: 0, right: 0, phase: 0 };
  let man: Actor | null = null;
  let woman: Actor | null = null;
  // The two dragons of the couple are only cloned the first time someone asks
  // for them: keeping five copies of the model alive costs too much on a phone.
  let maleModel: Gltf | null = null;
  let femaleModel: Gltf | null = null;
  let femaleLoading = false;

  const startPair = (left: number, right: number) => {
    pairState.on = true;
    pairState.time = 0;
    pairState.left = left;
    pairState.right = right;
    pairState.phase = 0;
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
      loader.load(
        "/dragon/dragon_mujer.glb",
        female => {
          femaleLoading = false;
          if (dead) return;
          femaleModel = female as unknown as Gltf;
          woman = makeActor(femaleModel);
          if (pendingPair) {
            const waiting = pendingPair;
            pendingPair = null;
            pair(waiting.left, waiting.right);
          }
        },
        undefined,
        () => {
          femaleLoading = false;
          onError?.("La dragoncita no se pudo cargar.");
        },
      );
    }
    if (man && woman && pendingPair) {
      const waiting = pendingPair;
      pendingPair = null;
      startPair(waiting.left, waiting.right);
    }
  };

  const pair = (left: number, right: number) => {
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
    pairState.time += delta;
    const time = pairState.time;
    const leftEl = getSeatEl(pairState.left);
    const rightEl = getSeatEl(pairState.right);
    if (!leftEl || !rightEl) {
      pairState.on = false;
      [man, woman].forEach(actor => { actor.group.visible = actor.aura.visible = actor.shadow.visible = false; });
      return;
    }
    man.mixer.update(delta);
    woman.mixer.update(delta);
    const a = leftEl.getBoundingClientRect();
    const b = rightEl.getBoundingClientRect();
    const px = Math.max(70, a.width * 1.3);
    const scale = px / 4.3;
    const ax = a.left + a.width / 2;
    const bx = b.left + b.width / 2;
    const ay = a.top + a.height * 0.9;
    const by = b.top + b.height * 0.9;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const gap = 3.7 * scale;
    const walk = smooth(0, 2.4, time);
    const spots: [number, number, number][] = [
      [ax + (mx - gap / 2 - ax) * walk, ay + (my - ay) * walk, 1],
      [bx + (mx + gap / 2 - bx) * walk, by + (my - by) * walk, -1],
    ];
    if (time >= 2.4 && pairState.phase === 0) {
      pairState.phase = 1;
      [man, woman].forEach(actor => {
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
      const [x, y, side] = spots[index];
      actor.group.position.set(x, height - y, 0);
      actor.group.rotation.y = side * (Math.PI / 2) * turn;
      actor.group.scale.setScalar(Math.max(0.001, scale * fade));
      actor.aura.position.set(x, height - y + px * 0.5, -300);
      actor.aura.scale.set(px * 1.5, px * 1.5, 1);
      actor.aura.material.opacity = (time > 2.4 ? 0.5 : 0.2) * fade * (0.85 + 0.15 * Math.sin(performance.now() / 120));
      actor.shadow.position.set(x, height - y + 2, -200);
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

  loader.load(
    "/dragon/dragon_hombre.glb",
    gltf => {
      if (dead) return;
      const model = gltf as unknown as Gltf;
      for (let index = 0; index < poolSize; index += 1) {
        const actor = makeActor(model);
        // When its animation ends, the dragon fades out instead of popping.
        actor.mixer.addEventListener("finished", () => {
          actor.state = "out";
          actor.elapsed = 0;
        });
        pool.push(actor);
      }
      maleModel = model;
      const waiting = pendingPlay;
      pendingPlay = null;
      if (waiting) play(waiting.seat, waiting.clip);
      if (pendingPair) ensurePair();
    },
    undefined,
    () => onError?.("El dragón no se pudo cargar. Revisa tu conexión."),
  );

  // Drawing only while a dragon is on screen keeps the room's scrolling and taps
  // smooth on a phone; one extra frame clears the canvas when the emote ends.
  let drewLastFrame = false;
  const loop = () => {
    frame = requestAnimationFrame(loop);
    const delta = Math.min(clock.getDelta(), 0.05);
    stepPair(delta);
    let active = pairState.on;
    pool.forEach(actor => {
      if (!actor.busy) return;
      active = true;
      if (actor.seat === null) {
        actor.busy = false;
        actor.group.visible = actor.aura.visible = actor.shadow.visible = false;
        return;
      }
      const element = getSeatEl(actor.seat);
      if (!element) {
        actor.busy = false;
        actor.group.visible = actor.aura.visible = actor.shadow.visible = false;
        return;
      }
      actor.mixer.update(delta);
      const box = element.getBoundingClientRect();
      // A dragon standing on a seat is a little taller than the seat itself.
      const px = Math.max(70, box.width * 1.3);
      const scale = px / 4.3;
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
      const cx = box.left + box.width / 2;
      const cy = height - (box.top + box.height * 0.98);
      actor.group.position.set(cx, cy, 0);
      actor.group.scale.setScalar(Math.max(0.001, scale * fade));
      actor.aura.position.set(cx, cy + px * 0.5, -300);
      actor.aura.scale.set(px * 1.5, px * 1.5, 1);
      actor.aura.material.opacity = 0.5 * fade * (0.85 + 0.15 * Math.sin(performance.now() / 120));
      actor.shadow.position.set(cx, cy + 2, -200);
      actor.shadow.scale.set(px * 0.9 * fade, px * 0.22 * fade, 1);
    });
    if (active || drewLastFrame) renderer.render(scene, camera);
    drewLastFrame = active;
  };
  loop();

  return {
    play,
    pair,
    dispose: () => {
      dead = true;
      cancelAnimationFrame(frame);
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
