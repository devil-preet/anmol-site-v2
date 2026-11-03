/* =====================================================
   V2 cinematic layer
   - WebGL shader page transitions (loader reveal + section wipes)
   - Lenis smooth scroll        - split headings, velocity marquee
   - rising section corners     - parallax inside gallery tiles
   - magnetic buttons, tilt, custom cursor
   - Three.js: dense, small, depth-shaded jewel fields (hero + margins)
   Everything degrades gracefully: if a CDN or WebGL is unavailable the
   site falls back to simple CSS transitions.
   ===================================================== */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
  const root = document.documentElement;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const EASE = "cubic-bezier(.76,0,.24,1)";
  const inOutCubic = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const outCubic = k => 1 - Math.pow(1 - k, 3);

  /* ---------- Three.js loader (shared) ---------- */
  let threePromise = null;
  function loadThree() {
    if (threePromise) return threePromise;
    threePromise = (async () => {
      if (reduce) return null;
      const probe = document.createElement("canvas");
      const pc = probe.getContext("webgl2") || probe.getContext("webgl");
      if (!pc) return null;
      pc.getExtension("WEBGL_lose_context")?.loseContext();   // free the probe's GPU context
      let THREE, RoomEnvironment = null;
      try { THREE = await import("three"); } catch (e) { return null; }
      try { ({ RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js")); } catch (e) {}
      return { THREE, RoomEnvironment };
    })();
    return threePromise;
  }

  /* ---------- WebGL transition engine ----------
     One full-screen shader. Progress p: 0 -> 1 covers the screen (liquid
     front rising from the bottom, gold rim, sparkles), 1 -> 2 reveals it. */
  async function initTransition() {
    const lib = await loadThree();
    if (!lib || !$("#wipeGl")) return null;
    return () => createTx(lib);
  }
  function createTx(lib) {
    // fresh canvas each time so the GPU context can be released afterwards
    const old = $("#wipeGl");
    const canvas = old.cloneNode(false);
    old.replaceWith(canvas);
    const { THREE } = lib;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { uP: { value: 0 }, uT: { value: 0 }, uA: { value: 1 } },
      vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",
      fragmentShader: `
        precision highp float;
        varying vec2 vUv; uniform float uP, uT, uA;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
          return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
        }
        float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++){ v += a * noise(p); p *= 2.; a *= .5; } return v; }
        void main(){
          vec2 uv = vUv;
          float n = fbm(vec2(uv.x * uA * 2.2, uv.y * 2.2) + uT * .18);
          float arch = (uv.x - .5) * (uv.x - .5) * .6;
          float f = uv.y * .8 + n * .45 + arch;
          float thr = uP <= 1. ? uP * 1.75 - .25 : (uP - 1.) * 1.75 - .25;
          float d = uP <= 1. ? thr - f : f - thr;          // > 0 : covered
          float cover = smoothstep(-.012, .012, d);
          float rim = smoothstep(.075, 0., d) * cover;
          float glow = smoothstep(-.14, 0., d) * (1. - cover) * .35;
          vec2 cell = floor(uv * vec2(130. * uA, 130.)) + floor(uT * 9.);
          vec2 g = fract(uv * vec2(130. * uA, 130.)) - .5;
          float spark = step(.993, hash(cell)) * smoothstep(.45, .08, length(g)) * smoothstep(.4, 0., abs(d));
          vec3 plum = vec3(.169, .051, .094);
          vec3 gold = vec3(.88, .74, .45);
          vec3 inside = mix(plum, gold, rim * .9);
          vec3 col = mix(gold, inside, cover);
          col = mix(col, vec3(1., .93, .75), spark);
          float a = max(max(cover, glow), spark);
          gl_FragColor = vec4(col, a);
        }`
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    const resize = () => { renderer.setSize(innerWidth, innerHeight, false); mat.uniforms.uA.value = innerWidth / innerHeight; };
    resize();
    const set = p => { mat.uniforms.uP.value = p; mat.uniforms.uT.value = performance.now() / 1000; renderer.render(scene, cam); };
    const run = (from, to, dur, ease = inOutCubic) => new Promise(res => {
      const t0 = performance.now();
      (function step(now) {
        const k = Math.min((now - t0) / dur, 1);
        set(from + (to - from) * ease(k));
        k < 1 ? requestAnimationFrame(step) : res();
      })(t0);
    });
    set(0);
    const close = () => { renderer.dispose(); renderer.forceContextLoss(); };
    return { set, run, close };
  }
  const txPromise = initTransition();

  /* ---------- loader ---------- */
  const loader = $("#loader"), numEl = $("#loaderNum"), barEl = $("#loaderBar");
  const wipe = $("#wipe"), wipeLabel = $("#wipeLabel");
  let siteLoaded = false;
  async function openSite() {
    if (siteLoaded) return;
    siteLoaded = true;
    numEl.textContent = "100"; barEl.style.transform = "scaleX(1)";
    loader.classList.add("fade");
    await sleep(450);
    const make = await Promise.race([txPromise, sleep(1800)]);
    const tx = make ? make() : null;
    const begin = () => { root.classList.add("loaded"); window.dispatchEvent(new Event("site:loaded")); };
    if (tx) {
      // plum screen -> liquid reveal with a gold edge
      wipe.classList.add("on", "gl", "intro");
      tx.set(1);
      await new Promise(r => requestAnimationFrame(r));
      loader.classList.add("gone");
      begin();
      await tx.run(1, 2, 1700);
      wipe.classList.remove("on", "gl", "intro");
      tx.close();
    } else {
      loader.classList.add("done");
      setTimeout(begin, 450);
      setTimeout(() => loader.classList.add("gone"), 1700);
    }
  }
  if (reduce) { loader.classList.add("gone"); siteLoaded = true; root.classList.add("loaded"); window.dispatchEvent(new Event("site:loaded")); }
  else {
    let pageLoaded = document.readyState === "complete", prog = 0;
    addEventListener("load", () => pageLoaded = true);
    const t0 = performance.now();
    (function tick(now) {
      if (siteLoaded) return;
      const target = Math.min(pageLoaded ? 100 : 90, (now - t0) / 14);
      prog += Math.max((target - prog) * .1, target > prog ? .25 : 0);
      prog = Math.min(prog, target);
      numEl.textContent = Math.round(prog);
      barEl.style.transform = `scaleX(${prog / 100})`;
      if (prog >= 99.5) openSite(); else requestAnimationFrame(tick);
    })(t0);
    setTimeout(openSite, 7000); // failsafe
  }

  /* ---------- smooth scroll (Lenis) ---------- */
  let lenis = null;
  function initLenis() {
    if (!window.Lenis || reduce) return;
    lenis = new Lenis({ lerp: .09, smoothWheel: true });
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
    const lb = $("#lightbox");
    new MutationObserver(() => lb.hidden ? lenis.start() : lenis.stop()).observe(lb, { attributes: true, attributeFilter: ["hidden"] });
  }
  addEventListener("load", initLenis);

  /* ---------- split headings ---------- */
  (function splitHeadings() {
    $$("h2.rv").forEach(h => {
      let i = 0;
      const walk = node => [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(" "));
            else {
              const w = document.createElement("span"); w.className = "w";
              const s = document.createElement("span"); s.textContent = part; s.style.setProperty("--i", i++);
              w.appendChild(s); frag.appendChild(w);
            }
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      });
      walk(h);
      h.classList.add("words");
      h.style.transitionDelay = "0ms";
    });
  })();

  /* ---------- section transitions on in-page links ---------- */
  let busy = false;
  const jumpTo = t => {
    const y = t.id === "top" ? 0 : t.getBoundingClientRect().top + scrollY;
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else scrollTo({ top: y, behavior: "instant" });
    dispatchEvent(new Event("scroll"));
  };
  document.addEventListener("click", async e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href");
    if (id.length < 2) return;
    const t = $(id);
    if (!t) return;
    e.preventDefault();
    if (reduce) { t.scrollIntoView(); return; }
    if (busy) return;
    busy = true;
    wipeLabel.textContent = ($(".eyebrow", t)?.textContent || "Anmol").trim();
    const make = await Promise.race([txPromise, sleep(1)]);
    const tx = make ? make() : null;
    if (tx) {
      wipe.classList.add("on", "gl");
      const cover = tx.run(0, 1, 1000);
      sleep(560).then(() => wipe.classList.add("show"));
      await cover;
      jumpTo(t);
      await sleep(260);
      wipe.classList.remove("show");
      await tx.run(1, 2, 1100);
      wipe.classList.remove("on", "gl");
      tx.close();
    } else {
      wipe.classList.add("on");
      await wipe.animate([{ transform: "translateY(calc(100% + 14vh))" }, { transform: "translateY(0)" }], { duration: 750, easing: EASE, fill: "forwards" }).finished;
      jumpTo(t);
      await wipe.animate([{ transform: "translateY(0)" }, { transform: "translateY(calc(-100% - 14vh))" }], { duration: 850, easing: EASE, fill: "forwards", delay: 250 }).finished;
      wipe.getAnimations().forEach(x => x.cancel());
      wipe.classList.remove("on");
    }
    busy = false;
  });

  /* ---------- per-frame scroll effects ---------- */
  const track = $(".marquee-track"), heroText = $(".hero-text");
  const hero = $("#heroSec");
  const rounded = $$(".dark, .contact, .tint");
  const tiles = $$("#gallery button");
  let mx = 0, last = scrollY, vel = 0, lastDrawn = -1;
  (function loop() {
    const y = scrollY;
    vel += ((y - last) - vel) * .15; last = y;
    if (track) {
      const half = track.scrollWidth / 2;
      mx -= .6 + vel * .45;
      if (mx <= -half) mx += half;
      if (mx > 0) mx -= half;
      track.style.transform = `translateX(${mx}px) skewX(${clamp(-vel * .25, -9, 9)}deg)`;
    }
    if (heroText && !reduce && y < innerHeight * 1.2) {
      const p = clamp(y / innerHeight, 0, 1);
      heroText.style.transform = `translateY(${y * .22}px)`;
      heroText.style.opacity = 1 - p * 1.15;
    }
    if (!reduce && (y !== lastDrawn || lastDrawn < 0)) {
      lastDrawn = y;
      // sections rise as soft rounded cards and square off once they settle
      rounded.forEach(s => {
        const top = s.getBoundingClientRect().top;
        const k = clamp(top / (innerHeight * .85), 0, 1);
        s.style.setProperty("--r", (k * k * 90).toFixed(1) + "px");
      });
      // parallax inside gallery tiles
      tiles.forEach(b => {
        const r = b.getBoundingClientRect();
        if (r.bottom < -50 || r.top > innerHeight + 50) return;
        const c = (r.top + r.height / 2) / innerHeight - .5;
        b.style.setProperty("--py", (-c * 11).toFixed(2) + "%");
      });
    }
    requestAnimationFrame(loop);
  })();

  /* ---------- magnetic buttons + gallery tilt ---------- */
  if (fine && !reduce) {
    $$(".btn").forEach(b => {
      b.addEventListener("pointermove", e => {
        const r = b.getBoundingClientRect();
        b.style.setProperty("--mx", (e.clientX - r.left - r.width / 2) * .22 + "px");
        b.style.setProperty("--my", (e.clientY - r.top - r.height / 2) * .32 + "px");
      });
      b.addEventListener("pointerleave", () => { b.style.setProperty("--mx", "0px"); b.style.setProperty("--my", "0px"); });
    });
    tiles.forEach(b => {
      b.addEventListener("pointermove", e => {
        const r = b.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
        b.style.setProperty("--ry", px * 9 + "deg");
        b.style.setProperty("--rx", -py * 9 + "deg");
      });
      b.addEventListener("pointerleave", () => { b.style.setProperty("--rx", "0deg"); b.style.setProperty("--ry", "0deg"); });
    });
  }

  /* ---------- custom cursor ---------- */
  if (fine && !reduce) {
    const ring = $("#cursorRing"), dot = $("#cursorDot");
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
    addEventListener("pointermove", e => {
      x = e.clientX; y = e.clientY;
      ring.classList.add("show"); dot.classList.add("show");
      dot.style.transform = `translate(${x}px,${y}px)`;
      const inTile = !!e.target.closest("#gallery button");
      ring.classList.toggle("view", inTile);
      ring.classList.toggle("link", !inTile && !!e.target.closest("a,button,summary,input,select,label"));
    }, { passive: true });
    document.addEventListener("pointerleave", () => { ring.classList.remove("show"); dot.classList.remove("show"); });
    (function follow() {
      rx += (x - rx) * .16; ry += (y - ry) * .16;
      ring.style.transform = `translate(${rx}px,${ry}px)`;
      requestAnimationFrame(follow);
    })();
  }

  /* ---------- jewel stage (shared by both scenes) ---------- */
  function makeStage(lib, canvas, small, host) {
    const { THREE, RoomEnvironment } = lib;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
    camera.position.z = 14;
    if (RoomEnvironment) {
      const pm = new THREE.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
    }
    const key = new THREE.DirectionalLight(0xffd9a0, 2.2); key.position.set(5, 6, 8); scene.add(key);
    const rim = new THREE.DirectionalLight(0xffb3c7, 1.1); rim.position.set(-6, -3, 4); scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, .22));
    // a warm light that follows the pointer so every jewel catches a moving highlight
    const glow = new THREE.PointLight(0xffe2b0, 70, 0, 2); glow.position.set(0, 0, 6); scene.add(glow);

    const mats = {
      gold: new THREE.MeshStandardMaterial({ color: 0xf2c46a, metalness: .85, roughness: .28, envMapIntensity: 1.8, emissive: 0x4a3410, emissiveIntensity: .45 }),
      pearl: new THREE.MeshPhysicalMaterial({ color: 0xf6eee2, roughness: .2, metalness: .05, clearcoat: 1, clearcoatRoughness: .12, sheen: 1, sheenColor: new THREE.Color(0xffd6e0) }),
      sequin: new THREE.MeshPhysicalMaterial({ color: 0xf0cd8a, metalness: .9, roughness: .2, iridescence: 1, iridescenceIOR: 1.5, envMapIntensity: 1.6, emissive: 0x4a3410, emissiveIntensity: .4 }),
      kundan: new THREE.MeshPhysicalMaterial({ color: 0xfaf4e6, metalness: .6, roughness: .06, envMapIntensity: 1.7, emissive: 0x6b6250, emissiveIntensity: .35 })
    };
    const geos = {
      pearl: new THREE.SphereGeometry(.3, 20, 14),
      bugle: new THREE.CylinderGeometry(.045, .045, 1, 10),
      sequin: new THREE.CylinderGeometry(.3, .3, .03, 28),
      kundan: new THREE.OctahedronGeometry(.26)
    };
    const col = new THREE.Color();
    // counts: [pearl, bugle, sequin, kundan]; shadeMin darkens far jewels for depth
    function build(counts, placeFn, shadeMin) {
      const kinds = [
        { geo: geos.pearl, mat: mats.pearl, n: counts[0], s: [.25, .6] },
        { geo: geos.bugle, mat: mats.gold, n: counts[1], s: [.3, .65], long: true },
        { geo: geos.sequin, mat: mats.sequin, n: counts[2], s: [.25, .55] },
        { geo: geos.kundan, mat: mats.kundan, n: counts[3], s: [.3, .6], stretch: true }
      ];
      const R = Math.random, items = [];
      kinds.forEach(k => {
        k.mesh = new THREE.InstancedMesh(k.geo, k.mat, k.n);
        k.mesh.frustumCulled = false;
        scene.add(k.mesh);
        for (let i = 0; i < k.n; i++) {
          const [nx, ny, zz] = placeFn();
          const z = zz !== undefined ? zz : -5 + R() * 8;
          k.mesh.setColorAt(i, col.setScalar(shadeMin + (1 - shadeMin) * (z + 5) / 8));
          items.push({
            k, i, nx, ny, z, ox: 0, oy: 0,
            rx: R() * 6, ry: R() * 6, rz: R() * 6,
            sx: (R() - .5) * .4, sy: (R() - .5) * .4, sz: (R() - .5) * .4,
            ph: R() * 6.28, amp: .12 + R() * .3, sp: .3 + R() * .5,
            s: k.s[0] + R() * (k.s[1] - k.s[0]), d: R()
          });
        }
        k.mesh.instanceColor.needsUpdate = true;
      });
      return { kinds, items };
    }
    function size() {
      const w = host ? host.clientWidth : innerWidth, h = host ? host.clientHeight : innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    size(); addEventListener("resize", size);
    const dims = () => {
      const H = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      return { H, W: H * camera.aspect };
    };
    // effortless motion: layered slow drifts + a soft push away from the pointer
    const flow = (it, t, W, H, mxn, myn, bx, by) => {
      const df = (14 - it.z) / 14;
      const wx = bx + Math.sin(t * it.sp * .6 + it.ph) * it.amp * 1.6 + Math.sin(t * .11 + it.ph * 2) * .35;
      const wy = by + Math.cos(t * it.sp * .5 + it.ph * 1.3) * it.amp * 1.3;
      const dx = wx - mxn * W * df, dy = wy - myn * H * df;
      const dist = Math.hypot(dx, dy), rad = 2.4 * df;
      let px = 0, py = 0;
      if (dist < rad && dist > .0001) { const k = Math.pow(1 - dist / rad, 2) * 1.4; px = dx / dist * k; py = dy / dist * k; }
      it.ox += (px - it.ox) * .06; it.oy += (py - it.oy) * .06;
      return [wx + it.ox, wy + it.oy];
    };
    const put = (dummy, it, x, y, rot, s) => {
      dummy.position.set(x, y, it.z);
      dummy.rotation.set(rot[0], rot[1], rot[2]);
      if (it.k.long) dummy.scale.set(s, s * 1.2, s);
      else if (it.k.stretch) dummy.scale.set(s * .7, s * 1.35, s * .7);
      else dummy.scale.setScalar(s);
      dummy.updateMatrix();
      it.k.mesh.setMatrixAt(it.i, dummy.matrix);
    };
    // pointer state shared by this stage (camera parallax + light)
    const ptr = { x: 0, y: 0, cx: 0, cy: 0 };
    addEventListener("pointermove", e => { ptr.x = e.clientX / innerWidth * 2 - 1; ptr.y = e.clientY / innerHeight * 2 - 1; }, { passive: true });
    const aim = () => {
      ptr.cx += (ptr.x - ptr.cx) * .05; ptr.cy += (ptr.y - ptr.cy) * .05;
      camera.position.x = ptr.cx * .9; camera.position.y = -ptr.cy * .55;
      camera.lookAt(0, 0, 0);
      const { H, W } = dims();
      glow.position.set(ptr.cx * W * .64, -ptr.cy * H * .64, 6);
    };
    return { THREE, renderer, scene, camera, build, dims, flow, put, aim, ptr };
  }

  /* ---------- Scene 1: hero — a dense, quiet shower of tiny jewels ---------- */
  async function hero3D() {
    const canvas = $("#gl");
    const lib = canvas && await loadThree();
    if (!lib) return;
    const small = innerWidth < 980;
    const st = makeStage(lib, canvas, small, hero);
    const { THREE, renderer, scene, camera, ptr } = st;
    const R = Math.random;
    const { kinds, items } = st.build(small ? [14, 16, 36, 10] : [44, 46, 110, 30], () => {
      // mostly clear of the headline; a few tiny, dim ones sit far behind the text for depth
      if (!small && R() < .07) return [-.9 + R() * .9, R() * 2 - 1, -5 + R() * 1.2];
      let nx, ny;
      for (let g = 0; g < 60; g++) {
        nx = R() * 2 - 1; ny = R() * 2 - 1;
        const ok = small ? ny > .25 : (nx > .02 || (nx > -.9 && Math.abs(ny) > .88));
        if (ok) break;
      }
      return [nx, ny];
    }, .4);

    const dummy = new THREE.Object3D();
    let start = null;
    addEventListener("site:loaded", () => start = performance.now());
    if (root.classList.contains("loaded")) start = performance.now();

    canvas.style.opacity = 0;
    (function frame(now) {
      requestAnimationFrame(frame);
      const hh = hero.clientHeight, y = scrollY;
      if (y > hh * 1.05 || document.hidden || start === null) return;
      const p = clamp(y / (hh * .9), 0, 1);
      canvas.style.opacity = String(1 - p);
      st.aim();
      const t = now / 1000, since = (now - start) / 1000;
      const { H, W } = st.dims();
      for (const it of items) {
        const e = outCubic(clamp((since - it.d * 1.2) / 2, 0, 1));   // each jewel eases in, no overshoot
        const [x, yy] = st.flow(it, t, W, H, ptr.cx, -ptr.cy, it.nx * W * 1.05, it.ny * H);
        st.put(dummy, it,
          x,
          yy - (1 - e) * 2.2 + p * (5 + it.z * .3),
          [it.rx + t * it.sx + p * 1.2, it.ry + t * it.sy, it.rz + t * it.sz],
          it.s * e * (1 - p * .3));
      }
      kinds.forEach(k => k.mesh.instanceMatrix.needsUpdate = true);
      renderer.render(scene, camera);
    })(performance.now());
  }

  /* ---------- Scene 2: page-long jewels drifting down the margins ---------- */
  async function edge3D() {
    const canvas = $("#gl2");
    const lib = canvas && await loadThree();
    if (!lib) return;
    await new Promise(res => {                      // wait until the hero is mostly scrolled away
      const check = () => { if (scrollY > hero.clientHeight * .4) { removeEventListener("scroll", check); res(); } };
      addEventListener("scroll", check, { passive: true }); check();
    });
    const small = innerWidth < 980;
    const st = makeStage(lib, canvas, small, null);
    const { THREE, renderer, scene, camera, ptr } = st;
    const R = Math.random;
    const { kinds, items } = st.build(small ? [6, 7, 16, 4] : [16, 18, 42, 12], () => {
      const side = R() < .5 ? -1 : 1;
      const edge = small ? .9 + R() * .12 : .91 + R() * .11;
      return [side * edge, R() * 2 - 1];
    }, .72);
    const dummy = new THREE.Object3D();
    canvas.style.opacity = 0;
    (function frame(now) {
      requestAnimationFrame(frame);
      const hh = hero.clientHeight, y = scrollY;
      const o = clamp((y - hh * .55) / (hh * .45), 0, 1);
      canvas.style.opacity = String(o);
      if (o <= 0 || document.hidden) return;
      st.aim();
      const t = now / 1000, { H, W } = st.dims(), wrap = H * 1.3;
      for (const it of items) {
        const depth = (14 - it.z) / 14;                       // keeps screen-x where we placed it
        const speed = .0035 + (it.z + 6) * .0011;             // nearer jewels glide faster
        const by = it.ny * wrap + y * speed;
        const yy = ((by + wrap) % (2 * wrap) + 2 * wrap) % (2 * wrap) - wrap;
        const [x, yo] = st.flow(it, t, W, H, ptr.cx, -ptr.cy, it.nx * W * depth, yy);
        st.put(dummy, it, x, yo,
          [it.rx + t * it.sx + y * .002, it.ry + t * it.sy + y * .0015, it.rz + t * it.sz],
          it.s);
      }
      kinds.forEach(k => k.mesh.instanceMatrix.needsUpdate = true);
      renderer.render(scene, camera);
    })(performance.now());
  }

  hero3D();
  edge3D();
})();
