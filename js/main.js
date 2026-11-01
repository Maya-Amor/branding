// Site-wide scripts. Animation styles live in css/styles.css under "Animations".

// Lets CSS reserve each pill's bold width, so nothing shifts when one gets selected
document.querySelectorAll(".pill-nav__link, .about__tab").forEach((el) => {
  el.dataset.label = el.textContent.trim();
});

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

// Position of an element on the page, ignoring any CSS transforms/animations on it.
const pageOffset = (el) => {
  let x = 0;
  let y = 0;
  for (let node = el; node; node = node.offsetParent) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }
  return { x, y };
};

// ----- Sticky header -----
// Home (desktop/tablet): the logo and navbar start in the hero and travel up
// into the header as you scroll, following the scroll position exactly.
// Phones: a compact bar with a hamburger menu.
// Other pages: header sits at the top; the frosted bar fades in once you scroll.
const header = document.querySelector(".site-header");

if (header) {
  const isHome = header.classList.contains("site-header--home");
  const logo = header.querySelector(".site-header__logo");
  const nav = header.querySelector(".site-header__nav");
  const menuBtn = header.querySelector(".site-header__menu-btn");
  const logoSlot = document.querySelector(".hero__logo-slot");
  const navSlot = document.querySelector(".hero__nav-slot");
  const menuSlot = document.querySelector(".hero__menu-slot");
  const phone = window.matchMedia("(max-width: 640px)");

  const DOCK_SCALE = 1; // size once docked, relative to the hero size (e.g. 0.9 = shrink 10% while docking)

  const heroText = isHome ? document.querySelector(".hero__text") : null;
  const TEXT_LAG = 0.25; // 0 = text scrolls with the page, 0.25 = moves 25% slower
  let heroTextTop = 0;
  let headerHeight = 0;

  let m = null; // measurements for the travel/dock effect (desktop/tablet)
  let mp = null; // measurements for the menu button travel (phones, Home)
  let ticking = false;

  const measure = () => {
    if (heroText) heroTextTop = pageOffset(heroText).y;
    headerHeight = header.offsetHeight;

    logo.style.transform = "";
    nav.style.transform = "";
    menuBtn.style.transform = "";
    m = null;
    mp = null;

    if (phone.matches) {
      // Home: the menu button starts centered in the hero (where the navbar is on
      // desktop) and travels up to the top-right corner of the header.
      if (isHome && menuSlot) {
        mp = {
          start: pageOffset(menuSlot),
          end: { x: menuBtn.offsetLeft, y: menuBtn.offsetTop },
        };
        mp.distance = Math.max(mp.start.y - mp.end.y, 1);
      }
      return;
    }

    // Docked layout: logo + gap + navbar, shrunk to DOCK_SCALE, centered in the header.
    const cs = getComputedStyle(header);
    const gap = parseFloat(cs.columnGap) || 0;
    const padTop = parseFloat(cs.paddingTop) || 0;
    const s = DOCK_SCALE;
    const lw = logo.offsetWidth, lh = logo.offsetHeight;
    const nw = nav.offsetWidth, nh = nav.offsetHeight;
    const rowH = s * Math.max(lh, nh);
    const left = (header.clientWidth - (s * lw + gap + s * nw)) / 2;

    const logoEnd = { x: left, y: padTop + (rowH - s * lh) / 2 };
    const navEnd = { x: left + s * lw + gap, y: padTop + (rowH - s * nh) / 2 };

    // Start = hero spots on Home; on other pages they're already docked.
    const home = isHome && logoSlot && navSlot;
    m = {
      logoLayout: { x: logo.offsetLeft, y: logo.offsetTop },
      navLayout: { x: nav.offsetLeft, y: nav.offsetTop },
      logoStart: home ? pageOffset(logoSlot) : logoEnd,
      navStart: home ? pageOffset(navSlot) : navEnd,
      logoEnd,
      navEnd,
      home,
    };
    // Scroll distance until the navbar reaches the header
    m.distance = home ? Math.max(m.navStart.y - navEnd.y, 1) : 1;
  };

  const place = (el, layout, x, y, scale) => {
    el.style.transform = `translate3d(${x - layout.x}px, ${y - layout.y}px, 0) scale(${scale})`;
  };

  const update = () => {
    ticking = false;
    const y = window.scrollY;

    // Home: title + subtitle fade out gently as you scroll. They move up a bit
    // slower than the page (TEXT_LAG), which stretches the fade over a longer
    // distance and adds a little depth. Fully gone before reaching the header.
    if (heroText) {
      const fadeEnd = Math.max((heroTextTop - headerHeight) / (1 - TEXT_LAG), 1);
      const t = clamp(y / fadeEnd, 0, 1);
      heroText.style.opacity = 1 - t * t * t; // stays almost fully visible at first, then fades
      heroText.style.transform = t ? `translate3d(0, ${Math.min(y, fadeEnd) * TEXT_LAG}px, 0)` : "";
    }

    if (phone.matches) {
      if (mp) {
        const p = clamp(y / mp.distance, 0, 1); // 0 = in hero, 1 = docked top-right
        // Rises with the page, then stops at the header; slides right on the way up.
        const btnY = Math.max(mp.start.y - y, mp.end.y);
        const btnX = lerp(mp.start.x, mp.end.x, smoothstep(0, 1, p));
        const move = `translate3d(${btnX - mp.end.x}px, ${btnY - mp.end.y}px, 0)`;
        menuBtn.style.transform = move;
        nav.style.transform = move; // the dropdown menu stays attached under the button
        // Small header logo appears once the button has docked
        header.classList.toggle("is-visible", p >= 1);
      }
      return;
    }

    if (!m) return;

    if (!m.home) {
      // Other pages: already docked; shadow fades in over the first 40px of scrolling
      place(logo, m.logoLayout, m.logoEnd.x, m.logoEnd.y, DOCK_SCALE);
      place(nav, m.navLayout, m.navEnd.x, m.navEnd.y, DOCK_SCALE);
      header.style.setProperty("--dock", clamp(y / 40, 0, 1));
      return;
    }

    const p = clamp(y / m.distance, 0, 1); // 0 = in hero, 1 = docked

    // Vertical: both scroll up with the page, then stop at the header.
    const logoY = Math.max(m.logoStart.y - y, m.logoEnd.y);
    const navY = Math.max(m.navStart.y - y, m.navEnd.y);

    // Horizontal + size: they slide into place side by side and shrink during
    // the second part of the journey (after the logo has docked at the top).
    const h = smoothstep(0.25, 0.9, p);
    const logoX = lerp(m.logoStart.x, m.logoEnd.x, h);
    const navX = lerp(m.navStart.x, m.navEnd.x, h);
    const scale = lerp(1, DOCK_SCALE, h);

    place(logo, m.logoLayout, logoX, logoY, scale);
    place(nav, m.navLayout, navX, navY, scale);

    // Shadows fade in as they come together
    header.style.setProperty("--dock", smoothstep(0.85, 1, p));
  };

  const requestUpdate = () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  };

  const refresh = () => {
    measure();
    update();
  };

  // ----- Phone menu -----
  function closeMenu() {
    header.classList.remove("menu-open");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", "Open menu");
  }

  menuBtn.addEventListener("click", () => {
    const open = !header.classList.contains("menu-open");
    header.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });

  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) closeMenu();
  });

  document.addEventListener("click", (e) => {
    if (!header.contains(e.target)) closeMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  phone.addEventListener("change", () => {
    closeMenu();
    header.classList.remove("is-visible");
    header.style.removeProperty("--dock");
    refresh();
  });

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", refresh);
  document.fonts?.ready.then(refresh); // navbar width depends on the font
  refresh();
}

// ----- Elements that fade up as they scroll into view -----
const reveals = document.querySelectorAll(".intro, .project, .reveal");

if (reveals.length) {
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target); // animate only once
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -5% 0px" }
    );
    reveals.forEach((el) => observer.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-revealed"));
  }
}

// ----- Floating back-to-top button -----
// Shows once the visitor has scrolled a little way down the page.
const backToTop = document.querySelector(".back-to-top");

if (backToTop) {
  const SHOW_AFTER = 200; // px scrolled before the button appears
  let ticking = false;

  const update = () => {
    backToTop.classList.toggle("is-visible", window.scrollY > SHOW_AFTER);
    ticking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    },
    { passive: true }
  );

  update();
}

// ----- About page tabs -----
// Click (or use the arrow keys) to switch the story text below the pills.
const tablist = document.querySelector(".about__tabs");

if (tablist) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];

  const select = (tab, focus = false) => {
    tabs.forEach((t) => {
      const selected = t === tab;
      const panel = document.getElementById(t.getAttribute("aria-controls"));
      t.setAttribute("aria-selected", String(selected));
      t.tabIndex = selected ? 0 : -1;
      panel.hidden = !selected;
      if (selected) {
        // Restart the fade-in each time a tab is chosen
        panel.classList.remove("is-switching");
        void panel.offsetWidth;
        panel.classList.add("is-switching");
      }
    });
    if (focus) tab.focus();
  };

  tablist.addEventListener("click", (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (tab && tab.getAttribute("aria-selected") !== "true") select(tab);
  });

  tablist.addEventListener("keydown", (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const keys = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    select(tabs[(keys[e.key] + tabs.length) % tabs.length], true);
  });
}

// ----- Navbar follows where you are on the page -----
// "My projects" looks selected while the projects are on screen (Home), and
// "Let's Talk" while the footer is on screen (every page). Only one pill is
// selected at a time, so on the About page "About" steps aside at the footer.
if ("IntersectionObserver" in window) {
  const projectsSection = document.getElementById("projects");
  const footer = document.getElementById("contact");
  const projectLinks = document.querySelectorAll('.pill-nav__link[href="#projects"]');
  const talkLinks = document.querySelectorAll('.pill-nav__link[href="#contact"]');
  const pageLinks = document.querySelectorAll('.pill-nav__link[aria-current="page"]');
  let inProjects = false;
  let atFooter = false;

  const setCurrent = (links, value) => {
    links.forEach((link) => {
      if (value) link.setAttribute("aria-current", value);
      else link.removeAttribute("aria-current");
    });
  };

  const render = () => {
    setCurrent(talkLinks, atFooter && "location");
    setCurrent(projectLinks, !atFooter && inProjects && "location");
    setCurrent(pageLinks, !atFooter && "page");
  };

  if (projectsSection) {
    // Counts as "on screen" once the section crosses the middle of the window
    new IntersectionObserver(
      ([entry]) => {
        inProjects = entry.isIntersecting;
        render();
      },
      { rootMargin: "-50% 0px -50% 0px" }
    ).observe(projectsSection);
  }

  if (footer) {
    // Counts as "on screen" once most of the footer is visible
    new IntersectionObserver(
      ([entry]) => {
        atFooter = entry.isIntersecting;
        render();
      },
      { threshold: 0.6 }
    ).observe(footer);
  }
}

// ----- Case studies: arrows from each note to what it points at -----
// Each arrow leaves its note straight from the nearest edge, bends once
// (or follows a custom route), and ends with an arrowhead at the spot from the Figma design.
// Points in data-links are % of the screenshot; the start is taken from the
// note's real size, so every arrow touches its note the same way.
const linkLayers = document.querySelectorAll(".anno__links");

if (linkLayers.length) {
  const NS = "http://www.w3.org/2000/svg";

  const drawLinks = (svg) => {
    svg.replaceChildren();
    if (getComputedStyle(svg).display === "none") return;

    const stage = svg.parentElement;
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const k = W / 912; // 1 = Figma size
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    const notes = [...stage.querySelectorAll(".anno__note")].map((n) => ({
      left: n.offsetLeft,
      top: n.offsetTop,
      right: n.offsetLeft + n.offsetWidth,
      bottom: n.offsetTop + n.offsetHeight,
    }));
    const px = ([x, y]) => [(x / 100) * W, (y / 100) * H];
    const distance = (n, [x, y]) => Math.hypot(
      Math.max(n.left - x, 0, x - n.right),
      Math.max(n.top - y, 0, y - n.bottom)
    );
    const inset = 10 * k; // keep the start away from the note's rounded corners

    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

    JSON.parse(svg.dataset.links).forEach((link) => {
      // Build the arrow as a list of points: start (on the note) → bends → head
      let pts;

      if (link.points) {
        // Custom route: leaves the note from link.from ("top" / "bottom"),
        // then goes through the listed points; the last one is the head.
        const route = link.points.map(px);
        const note = notes.reduce((a, b) => (distance(a, route[0]) <= distance(b, route[0]) ? a : b));
        const x = clamp(route[0][0], note.left + inset, note.right - inset);
        const y = link.from === "top" ? note.top : note.bottom;
        route[0] = [x, route[0][1]];
        pts = [[x, y], ...route];
      } else {
        const tail = px(link.tail);
        const corner = px(link.corner);
        const head = px(link.head);
        const note = notes.reduce((a, b) => (distance(a, tail) <= distance(b, tail) ? a : b));

        if (Math.abs(link.tail[1] - link.corner[1]) < 0.01) {
          // Leaves the note sideways
          const x = corner[0] < note.left ? note.left : note.right;
          const y = clamp(tail[1], note.top + inset, note.bottom - inset);
          pts = [[x, y], [corner[0], y], head];
        } else {
          // Leaves the note from the top or bottom
          const y = corner[1] < note.top ? note.top : note.bottom;
          const x = clamp(tail[0], note.left + inset, note.right - inset);
          pts = [[x, y], [x, corner[1]], [head[0], corner[1]]];
        }
      }

      const dir = (a, b) => [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])];
      const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
      const a = 3.5 * k; // arrowhead size

      // Line with rounded bends
      const d = [`M${pts[0][0]} ${pts[0][1]}`];
      for (let i = 1; i < pts.length - 1; i++) {
        const [prev, c, next] = [pts[i - 1], pts[i], pts[i + 1]];
        const d1 = dir(prev, c);
        const d2 = dir(c, next);
        const r = Math.min(6 * k, len(prev, c) / 2, len(c, next) / 2);
        d.push(`L${c[0] - d1[0] * r} ${c[1] - d1[1] * r}`);
        d.push(`Q${c[0]} ${c[1]} ${c[0] + d2[0] * r} ${c[1] + d2[1] * r}`);
      }
      const head = pts[pts.length - 1];
      const dh = dir(pts[pts.length - 2], head);
      d.push(`L${head[0]} ${head[1]}`);

      // Arrowhead
      d.push(`M${head[0] - dh[0] * a - dh[1] * a} ${head[1] - dh[1] * a - dh[0] * a}`);
      d.push(`L${head[0]} ${head[1]}`);
      d.push(`L${head[0] - dh[0] * a + dh[1] * a} ${head[1] - dh[1] * a + dh[0] * a}`);

      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", d.join(" "));
      path.setAttribute("stroke-width", Math.max(1, k));
      svg.append(path);
    });
  };

  const drawAll = () => linkLayers.forEach(drawLinks);
  window.addEventListener("resize", drawAll);
  document.fonts?.ready.then(drawAll); // note sizes depend on the font
  window.addEventListener("load", drawAll);
  drawAll();
}

// ----- Case studies: section navigator -----
// A table of contents listing the sections (from their data-section labels):
// a side list on wide screens, a tabs row under the navbar on smaller ones.
// It highlights the section you're reading.
const csSections = [...document.querySelectorAll("[data-section]")];

if (csSections.length) {
  const nav = document.createElement("nav");
  // Side list on wide screens; becomes a tabs row on narrow screens and phones (see CSS)
  nav.className = "cs-nav cs-nav--side";
  nav.setAttribute("aria-label", "Case study sections");

  const track = document.createElement("div");
  track.className = "cs-nav__track";

  const links = csSections.map((section) => {
    const a = document.createElement("a");
    a.className = "cs-nav__link";
    a.href = "#" + section.id;
    a.textContent = section.dataset.section;
    a.dataset.label = section.dataset.section; // reserves the bold width
    track.append(a);
    return a;
  });

  nav.append(track);
  document.body.append(nav);

  let current = -1;
  let ticking = false;

  const update = () => {
    ticking = false;
    const navBox = nav.getBoundingClientRect();

    // Current section: the last one whose top has passed the reading line
    // (just under the tabs row, or 30% down the screen for the side list)
    const isSide = navBox.height > navBox.width;
    const line = isSide ? window.innerHeight * 0.3 : navBox.bottom + 40;
    let active = -1;
    csSections.forEach((section, i) => {
      if (section.getBoundingClientRect().top <= line) active = i;
    });

    if (active !== current) {
      current = active;
      links.forEach((a, i) => {
        if (i === active) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
      // Keep the current section in view when the bar scrolls sideways (phones)
      const link = links[active];
      if (link && track.scrollWidth > track.clientWidth) {
        track.scrollTo({
          left: link.offsetLeft - (track.clientWidth - link.offsetWidth) / 2,
          behavior: "smooth",
        });
      }
    }
  };

  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });
  window.addEventListener("resize", update);
  update();
}

// ----- About: draggable sticky notes -----
// Pick up any note (mouse or finger) and move it around the board.
// The note you grab comes to the front; notes stay inside the board.
const board = document.querySelector(".facts__board");

if (board) {
  let topZ = board.children.length;

  board.querySelectorAll(".note").forEach((note) => {
    let startX, startY, baseX, baseY, limits;

    note.addEventListener("pointerdown", (e) => {
      // Phones: notes stay put so swiping over them scrolls the page
      if (e.button !== 0 || window.matchMedia("(max-width: 640px)").matches) return;
      e.preventDefault();
      note.setPointerCapture(e.pointerId);
      note.classList.add("is-dragging");
      note.style.zIndex = ++topZ;

      startX = e.clientX;
      startY = e.clientY;
      baseX = parseFloat(note.style.getPropertyValue("--dx")) || 0;
      baseY = parseFloat(note.style.getPropertyValue("--dy")) || 0;

      // How far the note's centre may move and still stay on the board
      const b = board.getBoundingClientRect();
      const n = note.getBoundingClientRect();
      const cx = n.left + n.width / 2 - baseX;
      const cy = n.top + n.height / 2 - baseY;
      limits = { minX: b.left - cx, maxX: b.right - cx, minY: b.top - cy, maxY: b.bottom - cy };
    });

    note.addEventListener("pointermove", (e) => {
      if (!note.hasPointerCapture(e.pointerId)) return;
      const x = clamp(baseX + e.clientX - startX, limits.minX, limits.maxX);
      const y = clamp(baseY + e.clientY - startY, limits.minY, limits.maxY);
      note.style.setProperty("--dx", `${x}px`);
      note.style.setProperty("--dy", `${y}px`);
    });

    const drop = (e) => {
      if (note.hasPointerCapture(e.pointerId)) note.releasePointerCapture(e.pointerId);
      note.classList.remove("is-dragging");
    };
    note.addEventListener("pointerup", drop);
    note.addEventListener("pointercancel", drop);
  });
}

// ----- Home: the hero sticky note -----
// Drag it around the hero, or click (without dragging) to open the notes on About.
const heroNote = document.querySelector(".hero-note");

if (heroNote) {
  const hero = heroNote.closest(".hero");
  let startX, startY, baseX, baseY, limits, moved = false;

  heroNote.addEventListener("pointerdown", (e) => {
    // Phones: just a link (tap to open About)
    if (e.button !== 0 || window.matchMedia("(max-width: 640px)").matches) return;
    e.preventDefault();
    heroNote.setPointerCapture(e.pointerId);
    heroNote.classList.add("is-dragging");
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    baseX = parseFloat(heroNote.style.getPropertyValue("--dx")) || 0;
    baseY = parseFloat(heroNote.style.getPropertyValue("--dy")) || 0;

    const h = hero.getBoundingClientRect();
    const n = heroNote.getBoundingClientRect();
    const cx = n.left + n.width / 2 - baseX;
    const cy = n.top + n.height / 2 - baseY;
    limits = { minX: h.left - cx, maxX: h.right - cx, minY: h.top - cy, maxY: h.bottom - cy };
  });

  heroNote.addEventListener("pointermove", (e) => {
    if (!heroNote.hasPointerCapture(e.pointerId)) return;
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > 4) moved = true;
    heroNote.style.setProperty("--dx", `${clamp(baseX + e.clientX - startX, limits.minX, limits.maxX)}px`);
    heroNote.style.setProperty("--dy", `${clamp(baseY + e.clientY - startY, limits.minY, limits.maxY)}px`);
  });

  const drop = (e) => {
    if (heroNote.hasPointerCapture(e.pointerId)) heroNote.releasePointerCapture(e.pointerId);
    heroNote.classList.remove("is-dragging");
  };
  heroNote.addEventListener("pointerup", drop);
  heroNote.addEventListener("pointercancel", drop);

  // A drag shouldn't also count as a click
  heroNote.addEventListener("click", (e) => {
    if (moved) {
      e.preventDefault();
      moved = false;
    }
  });
}

// ----- Case study videos: autoplay on a loop, without sound -----
// Visitors who turn off motion in their system settings get a still first frame instead.
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.querySelectorAll(".brand-video video").forEach((video) => {
    video.removeAttribute("autoplay");
    video.pause();
  });
}

// ----- Typeface case study: "Try it yourself" -----
// Each toolbar control sets one CSS variable on the tester (version, size, letter
// spacing, line height).
const tester = document.querySelector(".type-tester");

if (tester) {
  const text = tester.querySelector(".type-tester__text");

  tester.querySelectorAll("[data-prop]").forEach((control) => {
    const { prop, unit = "" } = control.dataset;
    const isVersion = control.tagName === "SELECT";

    // Start each slider at the value the CSS uses (e.g. a smaller size on phones)
    if (!isVersion) control.value = parseFloat(getComputedStyle(tester).getPropertyValue(prop));

    control.addEventListener(isVersion ? "change" : "input", () => {
      tester.style.setProperty(prop, isVersion ? `"${control.value}"` : control.value + unit);
    });
  });

  // Paste as plain text, so copied formatting doesn't override the font
  text.addEventListener("paste", (e) => {
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
  });
}
