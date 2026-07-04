let resizeCallback = null;
let resizeRafId = 0;

export function setupViewportHandling(callback) {
  if (typeof callback === "function") {
    resizeCallback = callback;
  }

  const handleViewportChange = () => {
    updateViewportHeight();
  };

  updateViewportHeight();

  window.addEventListener("resize", handleViewportChange, {
    passive: true,
  });

  window.addEventListener("orientationchange", handleViewportChange, {
    passive: true,
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleViewportChange, {
      passive: true,
    });

    window.visualViewport.addEventListener("scroll", handleViewportChange, {
      passive: true,
    });
  }
}

export function updateViewportHeight(callback) {
  if (typeof callback === "function") {
    resizeCallback = callback;
  }

  const viewportHeight =
    window.visualViewport?.height ||
    window.innerHeight ||
    document.documentElement.clientHeight ||
    0;

  document.documentElement.style.setProperty(
    "--vh",
    `${viewportHeight * 0.01}px`
  );

  document.documentElement.style.setProperty(
    "--app-height",
    `${viewportHeight}px`
  );

  document.body.style.minHeight = `${viewportHeight}px`;

  if (resizeRafId !== 0) {
    cancelAnimationFrame(resizeRafId);
    resizeRafId = 0;
  }

  if (typeof resizeCallback === "function") {
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = 0;
      resizeCallback();
    });
  }
}