// RpAdmin — Dev By Royalputo
// Lightweight CSS-3D interactions (no third-party scripts, CSP-safe).

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function bindTilt(root) {
  root.querySelectorAll("[data-tilt]").forEach((card) => {
    if (card.dataset.tiltBound) return;
    card.dataset.tiltBound = "1";
    const strength = Number(card.dataset.tilt) || 6;

    card.addEventListener(
      "pointermove",
      (event) => {
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.transform =
          `perspective(900px) rotateX(${(-py * strength).toFixed(2)}deg) ` +
          `rotateY(${(px * strength).toFixed(2)}deg) translateZ(8px)`;
      },
      { passive: true }
    );

    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });
}

function bindHeroParallax(root) {
  const scene = root.querySelector(".landing-hero");
  const target = root.querySelector(".hero-logo-wrap");
  if (!scene || !target) return;

  scene.addEventListener(
    "pointermove",
    (event) => {
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;
      target.style.transform =
        `perspective(900px) rotateX(${(-y * 10).toFixed(2)}deg) ` +
        `rotateY(${(x * 14).toFixed(2)}deg) translate3d(${x * 10}px, ${y * 8}px, 0)`;
    },
    { passive: true }
  );

  scene.addEventListener("pointerleave", () => {
    target.style.transform = "";
  });
}

export function initEffects(root) {
  if (reduced()) return;
  bindTilt(root);
  bindHeroParallax(root);
}

export function pageTransition(root) {
  if (reduced()) return;
  root.classList.remove("page-enter");
  void root.offsetWidth;
  root.classList.add("page-enter");
}
