/* =====================================================
   V2 cinematic layer
   - loader curtain  - Lenis smooth scroll  - section wipes
   - split headings  - velocity marquee     - magnetic buttons
   - gallery tilt    - custom cursor        - Three.js hero scene
   Everything degrades gracefully: if a CDN or WebGL is
   unavailable the site simply behaves like v1.
   ===================================================== */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
  const root = document.documentElement;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const EASE = "cubic-bezier(.76,0,.24,1)";

  /* ---------- loader ---------- */
  const loader = $("#loader"), numEl = $("#loaderNum"), barEl = $("#loaderBar");
  let siteLoaded = false;
  function openSite() {
    if (siteLoaded) return;
    siteLoaded = true;
    numEl.textContent = "100"; barEl.style.transform = "scaleX(1)";
    loader.classList.add("done");
    setTimeout(() => {
      root.classList.add("loaded");
      window.dispatchEvent(new Event("site:loaded"));
    }, 450);
    setTimeout(() => loader.classList.add("gone"), 1700);
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
    // pause smooth scroll while the lightbox is open
    const lb = $("#lightbox");
    new MutationObserver(() => lb.hidden ? lenis.start() : lenis.stop()).observe(lb, { attributes: true, attributeFilter: ["hidden"] });
  }
  addEventListener("load", initLenis);

  /* ---------- split headings ---------- */
  function splitHeadings() {
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
      h.classList.add("split");
      h.style.transitionDelay = "0ms";
    });
  }
  splitHeadings();

  /* ---------- section wipe on in-page links ---------- */
  const wipe = $("#wipe"), wipeLabel = $("#wipeLabel");
  let busy = false;
  const jumpTo = t => {
    const y = t.id === "top" ? 0 : t.getBoundingClientRect().top + scrollY;
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else scrollTo({ top: y, behavior: "instant" });
    dispatchEvent(new Event("scroll"));
  };
  document.addEventListener("click", e => {
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
    wipeLabel.textContent = ($(".eyebrow", t)?.textContent || "Anmol").replace(/^\s+|\s+$/g, "");
    wipe.classList.add("on");
    const down = wipe.animate(
      [{ transform: "translateY(calc(100% + 14vh))" }, { transform: "translateY(0)" }],
      { duration: 750, easing: EASE, fill: "forwards" });
    down.finished.then(() => {
      jumpTo(t);
      return wipe.animate(
        [{ transform: "translateY(0)" }, { transform: "translateY(calc(-100% - 14vh))" }],
        { duration: 850, easing: EASE, fill: "forwards", delay: 250 }).finished;
    }).then(() => {
      wipe.getAnimations().forEach(x => x.cancel());
      wipe.classList.remove("on");
      busy = false;
    });
  });

  /* ---------- velocity-driven marquee + hero parallax ---------- */
  const track = $(".marquee-track"), heroText = $(".hero-text"), hero = $("#heroSec");
  let mx = 0, last = scrollY, vel = 0;
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
    requestAnimationFrame(loop);
  })();

  /* ---------- magnetic buttons ---------- */
  if (fine && !reduce) {
    $$(".btn").forEach(b => {
      b.addEventListener("pointermove", e => {
        const r = b.getBoundingClientRect();
        b.style.setProperty("--mx", (e.clientX - r.left - r.width / 2) * .22 + "px");
        b.style.setProperty("--my", (e.clientY - r.top - r.height / 2) * .32 + "px");
      });
      b.addEventListener("pointerleave", () => { b.style.setProperty("--mx", "0px"); b.style.setProperty("--my", "0px"); });
    });
    /* gallery tilt */
    $$("#gallery button").forEach(b => {
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
      const over = e.target.closest;
      if (!over) return;
      ring.classList.toggle("view", !!e.target.closest("#gallery button"));
      ring.classList.toggle("link", !e.target.closest("#gallery button") && !!e.target.closest("a,button,summary,input,select,label"));
    }, { passive: true });
    document.addEventListener("pointerleave", () => { ring.classList.remove("show"); dot.classList.remove("show"); });
    (function follow() {
      rx += (x - rx) * .16; ry += (y - ry) * .16;
      ring.style.transform = `translate(${rx}px,${ry}px)`;
      requestAnimationFrame(follow);
    })();
  }

  /* ---------- Three.js hero scene ---------- */
  async function hero3D() {
    const canvas = $("#gl");
    if (!canvas || reduce) return;
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) return;
    let THREE, RoomEnvironment = null;
    try { THREE = await import("three"); } catch (e) { return; }
    try { ({ RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js")); } catch (e) {}

    const small = innerWidth < 980;
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
    const key = new THREE.DirectionalLight(0xffd9a0, 2.4); key.position.set(5, 6, 8); scene.add(key);
    const rim = new THREE.DirectionalLight(0xffb3c7, 1.2); rim.position.set(-6, -3, 4); scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, .25));

    const gold = new THREE.MeshStandardMaterial({ color: 0xf2c46a, metalness: .8, roughness: .32, envMapIntensity: 1.8, emissive: 0x4a3410, emissiveIntensity: .6 });
    const pearlMat = new THREE.MeshPhysicalMaterial({ color: 0xf6eee2, roughness: .22, metalness: .05, clearcoat: 1, clearcoatRoughness: .15, sheen: 1, sheenColor: new THREE.Color(0xffd6e0) });
    const sequinMat = new THREE.MeshPhysicalMaterial({ color: 0xf0cd8a, metalness: .85, roughness: .22, iridescence: 1, iridescenceIOR: 1.5, envMapIntensity: 1.6, emissive: 0x4a3410, emissiveIntensity: .5 });
    const kundanMat = new THREE.MeshPhysicalMaterial({ color: 0xfaf4e6, metalness: .55, roughness: .08, envMapIntensity: 1.6, emissive: 0x6b6250, emissiveIntensity: .45 });

    const kinds = [
      { geo: new THREE.SphereGeometry(.3, 32, 24), mat: pearlMat, n: small ? 7 : 14, s: [.55, 1.15] },
      { geo: new THREE.CylinderGeometry(.05, .05, 1, 12), mat: gold, n: small ? 8 : 16, s: [.6, 1.2], long: true },
      { geo: new THREE.CylinderGeometry(.3, .3, .03, 36), mat: sequinMat, n: small ? 7 : 14, s: [.5, 1] },
      { geo: new THREE.OctahedronGeometry(.26), mat: kundanMat, n: small ? 5 : 9, s: [.6, 1.1], stretch: true }
    ];

    const R = Math.random;
    const items = [];
    kinds.forEach(k => {
      k.mesh = new THREE.InstancedMesh(k.geo, k.mat, k.n);
      k.mesh.frustumCulled = false;
      scene.add(k.mesh);
      for (let i = 0; i < k.n; i++) {
        let nx, ny;
        // keep jewels clear of the headline: desktop = right of the text column
        // (plus the far top/bottom edges); mobile = only the lower part of the hero
        for (let g = 0; g < 60; g++) {
          nx = R() * 2 - 1; ny = R() * 2 - 1;
          const ok = small ? ny > .25 : (nx > .02 || (nx > -.9 && Math.abs(ny) > .88));
          if (ok) break;
        }
        items.push({
          k, i, nx, ny, z: -5 + R() * 8,
          rx: R() * 6, ry: R() * 6, rz: R() * 6,
          sx: (R() - .5) * .6, sy: (R() - .5) * .6, sz: (R() - .5) * .6,
          ph: R() * 6.28, amp: .15 + R() * .35, sp: .35 + R() * .6,
          s: k.s[0] + R() * (k.s[1] - k.s[0]), d: R() * .9
        });
      }
    });

    function size() {
      const w = hero.clientWidth, h = hero.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    size(); addEventListener("resize", size);

    let tx = 0, ty = 0, cx = 0, cy = 0;
    addEventListener("pointermove", e => { tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1; }, { passive: true });

    const dummy = new THREE.Object3D();
    let start = null;
    addEventListener("site:loaded", () => start = performance.now());
    if (root.classList.contains("loaded")) start = performance.now();
    const easeOutBack = t => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

    canvas.style.opacity = 0;
    function frame(now) {
      requestAnimationFrame(frame);
      const hh = hero.clientHeight, y = scrollY;
      if (y > hh * 1.05 || document.hidden || start === null) return;
      const p = clamp(y / (hh * .9), 0, 1);
      canvas.style.opacity = String(1 - p);
      cx += (tx - cx) * .05; cy += (ty - cy) * .05;
      const t = now / 1000;
      const H = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      const W = H * camera.aspect;
      const since = (now - start) / 1000;

      for (const it of items) {
        const e = easeOutBack(clamp((since - it.d * .9) / 1.5, 0, 1));
        const par = (it.z + 8) * .06;
        const bx = it.nx * W * 1.05, by = it.ny * H * 1.0;
        const fx = 1 + (1 - e) * 1.6;                      // fly-in from far out
        dummy.position.set(
          bx * fx + cx * par * 2,
          by * fx + Math.sin(t * it.sp + it.ph) * it.amp + p * (6 + it.z * .3) - cy * par,
          it.z
        );
        dummy.rotation.set(it.rx + t * it.sx + p * 2, it.ry + t * it.sy, it.rz + t * it.sz);
        let s = it.s * Math.max(e, 0) * (1 - p * .35);
        if (it.k.long) dummy.scale.set(s, s * 1.2, s);
        else if (it.k.stretch) dummy.scale.set(s * .7, s * 1.35, s * .7);
        else dummy.scale.setScalar(s);
        dummy.updateMatrix();
        it.k.mesh.setMatrixAt(it.i, dummy.matrix);
      }
      kinds.forEach(k => k.mesh.instanceMatrix.needsUpdate = true);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }
  hero3D();
})();
