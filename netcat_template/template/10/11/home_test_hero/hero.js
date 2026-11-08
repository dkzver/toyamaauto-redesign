(function () {
  function initHero(hero) {
    if (hero.dataset.heroReady === "true") return;
    hero.dataset.heroReady = "true";

    var path = hero.querySelector("#toyama-home-test-path");
    var buttons = Array.prototype.slice.call(hero.querySelectorAll("[data-route-index]"));
    var svg = hero.querySelector(".mhero-svg");
    var markerCircles = svg ? Array.prototype.slice.call(svg.querySelectorAll(".moving-circle")) : [];
    var anchorCircles = svg ? Array.prototype.slice.call(svg.querySelectorAll(".circle[data-menu]")) : [];

    if (!path || !buttons.length || !svg || !markerCircles.length) return;

    var pathLength = path.getTotalLength();
    var currentDistance = null;
    var animationFrame = null;
    var pointerFrame = null;
    var pointerAnchorIndex = null;
    var scrollAnimationFrame = null;
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    var anchorDistances = [];

    function pointAtDistance(distance) {
      return path.getPointAtLength(distance);
    }

    function placeOnPath(element, distance) {
      var point = pointAtDistance(distance);
      element.setAttribute("transform", "translate(" + point.x + " " + point.y + ")");
    }

    function placeMarker(distance) {
      markerCircles.forEach(function (circle) {
        placeOnPath(circle, distance);
      });
    }

    function animateMarker(targetDistance, duration) {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }

      markerCircles.forEach(function (circle) {
        circle.classList.add("is-visible");
      });

      if (currentDistance === null) {
        currentDistance = targetDistance;
        placeMarker(currentDistance);
        return;
      }

      var startDistance = currentDistance;
      var startedAt = performance.now();
      duration = duration || 1000;

      function tick(now) {
        var progress = Math.min((now - startedAt) / duration, 1);
        var easedProgress = 1 - Math.pow(1 - progress, 4);

        currentDistance = startDistance + (targetDistance - startDistance) * easedProgress;
        placeMarker(currentDistance);

        if (progress < 1) {
          animationFrame = window.requestAnimationFrame(tick);
        } else {
          currentDistance = targetDistance;
          animationFrame = null;
        }
      }

      animationFrame = window.requestAnimationFrame(tick);
    }

    function setActiveMenu(index) {
      svg.classList.remove("menu1", "menu2", "menu3", "menu4", "menu5");
      svg.classList.add("menu" + (index + 1));
    }

    function activate(index) {
      setActiveMenu(index);
      animateMarker(anchorDistances[index]);
    }

    function closestPathDistance(clientX, clientY) {
      var screenMatrix = svg.getScreenCTM();
      if (!screenMatrix) return null;

      var pointer = svg.createSVGPoint();
      pointer.x = clientX;
      pointer.y = clientY;
      pointer = pointer.matrixTransform(screenMatrix.inverse());

      var sampleCount = 100;
      var sampleStep = pathLength / sampleCount;
      var bestDistance = 0;
      var bestSquaredDistance = Infinity;

      for (var i = 0; i <= sampleCount; i++) {
        var distance = sampleStep * i;
        var point = pointAtDistance(distance);
        var dx = point.x - pointer.x;
        var dy = point.y - pointer.y;
        var squaredDistance = dx * dx + dy * dy;

        if (squaredDistance < bestSquaredDistance) {
          bestSquaredDistance = squaredDistance;
          bestDistance = distance;
        }
      }

      var left = Math.max(0, bestDistance - sampleStep);
      var right = Math.min(pathLength, bestDistance + sampleStep);

      for (var iteration = 0; iteration < 12; iteration++) {
        var firstThird = left + (right - left) / 3;
        var secondThird = right - (right - left) / 3;
        var firstPoint = pointAtDistance(firstThird);
        var secondPoint = pointAtDistance(secondThird);
        var firstDx = firstPoint.x - pointer.x;
        var firstDy = firstPoint.y - pointer.y;
        var secondDx = secondPoint.x - pointer.x;
        var secondDy = secondPoint.y - pointer.y;

        if (firstDx * firstDx + firstDy * firstDy < secondDx * secondDx + secondDy * secondDy) {
          right = secondThird;
        } else {
          left = firstThird;
        }
      }

      return (left + right) / 2;
    }

    function getNearestAnchorIndex(distance) {
      var nearestIndex = 0;
      var nearestDifference = Infinity;

      anchorDistances.forEach(function (anchorDistance, index) {
        var difference = Math.abs(anchorDistance - distance);
        if (difference < nearestDifference) {
          nearestDifference = difference;
          nearestIndex = index;
        }
      });

      return nearestIndex;
    }

    function arrangeItems() {
      var length = path.getTotalLength();
      anchorCircles.forEach(function (circle, index) {
        var progress = anchorCircles.length === 1 ? 0 : index / (anchorCircles.length - 1);
        anchorDistances[index] = length * progress;
        placeOnPath(circle, anchorDistances[index]);
      });
    }

    function getScrollOffset() {
      var navbar = document.querySelector(".navbar");
      var navbarHeight = navbar ? navbar.getBoundingClientRect().height : 0;
      return Math.max(navbarHeight, 72) + 24;
    }

    function scrollToSection(target, hash) {
      if (scrollAnimationFrame !== null) {
        window.cancelAnimationFrame(scrollAnimationFrame);
      }

      var startY = window.pageYOffset;
      var targetY = Math.max(0, target.getBoundingClientRect().top + startY - getScrollOffset());
      var distance = targetY - startY;
      var duration = 750;
      var startedAt = performance.now();

      window.history.pushState(null, "", hash);

      if (reducedMotion.matches) {
        window.scrollTo(0, targetY);
        return;
      }

      function tick(now) {
        var progress = Math.min((now - startedAt) / duration, 1);
        var easedProgress = 1 - Math.pow(1 - progress, 4);

        window.scrollTo(0, startY + distance * easedProgress);

        if (progress < 1) {
          scrollAnimationFrame = window.requestAnimationFrame(tick);
        } else {
          scrollAnimationFrame = null;
        }
      }

      scrollAnimationFrame = window.requestAnimationFrame(tick);
    }

    var car = hero.querySelector(".mhero-car");
    var carWrap = hero.querySelector(".mhero-car__wrap");
    var carScrollFrame = null;
    var carEntranceFrame = null;
    var previousScrollY = window.pageYOffset;
    var carOffset = 0;
    var departureStart = 80;
    var departureDistance = 900;
    var departureSoundPlayed = false;
    var audioContext = null;

    function prepareDepartureAudio() {
      var AudioContextConstructor = window.AudioContext || window["webkitAudioContext"];
      if (!AudioContextConstructor || audioContext) return;

      try {
        audioContext = new AudioContextConstructor();
        if (audioContext.state === "suspended") {
          audioContext.resume().catch(function (error) {
            console.warn("Не удалось включить звук отъезжающего автомобиля.", error);
          });
        }
      } catch (error) {
        console.warn("Не удалось подготовить звук отъезжающего автомобиля.", error);
      }
    }

    function playDepartureSound() {
      prepareDepartureAudio();
      if (!audioContext) return;

      if (audioContext.state === "suspended") {
        audioContext.resume().then(createEngineSound).catch(function (error) {
          console.warn("Не удалось воспроизвести звук отъезжающего автомобиля.", error);
        });
      } else {
        createEngineSound();
      }
    }

    function createEngineSound() {
      var now = audioContext.currentTime;
      var oscillator = audioContext.createOscillator();
      var filter = audioContext.createBiquadFilter();
      var volume = audioContext.createGain();

      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(55, now);
      oscillator.frequency.exponentialRampToValueAtTime(185, now + 1.15);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(260, now);
      filter.frequency.exponentialRampToValueAtTime(1100, now + 1.15);
      volume.gain.setValueAtTime(0.0001, now);
      volume.gain.linearRampToValueAtTime(0.12, now + 0.16);
      volume.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);

      oscillator.connect(filter);
      filter.connect(volume);
      volume.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 1.4);
    }

    function updateCarDeparture() {
      carScrollFrame = null;
      if (!car || reducedMotion.matches) return;

      var scrollY = window.pageYOffset;
      var progress = Math.max(0, Math.min((scrollY - departureStart) / departureDistance, 1));
      var easedProgress = progress * progress * progress;
      var currentLeft = car.getBoundingClientRect().left - carOffset;
      carOffset = (window.innerWidth - currentLeft + 40) * easedProgress;
      carWrap.style.transform = "translate3d(" + carOffset + "px, 0, 0)";
      carWrap.style.willChange = progress > 0 && progress < 1 ? "transform" : "";
    }

    function animateCarEntrance() {
      if (reducedMotion.matches || window.pageYOffset >= departureStart) {
        scheduleCarDepartureUpdate();
        return;
      }

      var startOffset = -car.getBoundingClientRect().right - 40;
      var startedAt = performance.now();
      var duration = 1100;
      carOffset = startOffset;
      carWrap.style.willChange = "transform";
      carWrap.style.transform = "translate3d(" + carOffset + "px, 0, 0)";
      carWrap.offsetWidth;

      function tick(now) {
        if (window.pageYOffset >= departureStart) {
          carEntranceFrame = null;
          carOffset = 0;
          carWrap.style.transform = "translate3d(0, 0, 0)";
          scheduleCarDepartureUpdate();
          return;
        }

        var progress = Math.min((now - startedAt) / duration, 1);
        carOffset = startOffset * Math.pow(1 - progress, 3);
        carWrap.style.transform = "translate3d(" + carOffset + "px, 0, 0)";

        if (progress < 1) {
          carEntranceFrame = window.requestAnimationFrame(tick);
        } else {
          carEntranceFrame = null;
          carOffset = 0;
          carWrap.style.transform = "translate3d(0, 0, 0)";
          carWrap.style.willChange = "";
        }
      }

      carEntranceFrame = window.requestAnimationFrame(tick);
    }

    function handleCarDepartureScroll() {
      var scrollY = window.pageYOffset;
      if (scrollY < 20) departureSoundPlayed = false;
      if (!reducedMotion.matches && scrollY > previousScrollY && scrollY > departureStart && !departureSoundPlayed) {
        departureSoundPlayed = true;
        playDepartureSound();
      }
      previousScrollY = scrollY;
      if (carEntranceFrame !== null && scrollY < departureStart) return;
      if (carEntranceFrame !== null && scrollY >= departureStart) {
        window.cancelAnimationFrame(carEntranceFrame);
        carEntranceFrame = null;
        carOffset = 0;
        carWrap.style.transform = "translate3d(0, 0, 0)";
      }
      scheduleCarDepartureUpdate();
    }

    function scheduleCarDepartureUpdate() {
      if (carScrollFrame !== null) return;
      carScrollFrame = window.requestAnimationFrame(updateCarDeparture);
    }

    if (car && carWrap) {
      window.addEventListener("scroll", handleCarDepartureScroll, { passive: true });
      window.addEventListener("resize", scheduleCarDepartureUpdate);
      window.addEventListener("wheel", prepareDepartureAudio, { passive: true, once: true });
      window.addEventListener("touchstart", prepareDepartureAudio, { passive: true, once: true });
      window.addEventListener("pointerdown", prepareDepartureAudio, { passive: true, once: true });
      window.addEventListener("keydown", prepareDepartureAudio, { once: true });
      animateCarEntrance();
    }

    buttons.forEach(function (button, index) {
      button.addEventListener("mouseenter", function () { activate(index); });
      button.addEventListener("focus", function () { activate(index); });
      button.addEventListener("click", function (event) {
        var url = new URL(button.href, window.location.href);
        var isSmoothAnchor = url.origin === window.location.origin &&
          url.pathname === "/" && window.location.pathname === "/" &&
          (url.hash === "#advantages" || url.hash === "#reviews");
        var target = isSmoothAnchor ? document.querySelector(url.hash) : null;

        if (!target || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        event.preventDefault();
        scrollToSection(target, url.hash);
      });
    });

    var container = hero.querySelector(".mhero > .container");
    if (container) {
      container.addEventListener("pointermove", function (event) {
        if (event.pointerType === "touch") return;
        if (event.target.closest("[data-route-index], .circle[data-menu]")) {
          if (pointerFrame !== null) {
            window.cancelAnimationFrame(pointerFrame);
            pointerFrame = null;
          }
          return;
        }
        if (pointerFrame !== null) return;

        pointerFrame = window.requestAnimationFrame(function () {
          pointerFrame = null;
          var distance = closestPathDistance(event.clientX, event.clientY);
          if (distance === null) return;

          var nearestIndex = getNearestAnchorIndex(distance);
          if (nearestIndex !== pointerAnchorIndex) {
            pointerAnchorIndex = nearestIndex;
            setActiveMenu(nearestIndex);
            animateMarker(anchorDistances[nearestIndex], 250);
          }
        });
      });

      container.addEventListener("pointerleave", function () {
        if (pointerFrame !== null) {
          window.cancelAnimationFrame(pointerFrame);
          pointerFrame = null;
        }
        if (currentDistance === null) return;

        var nearestIndex = getNearestAnchorIndex(currentDistance);
        pointerAnchorIndex = null;
        setActiveMenu(nearestIndex);
        animateMarker(anchorDistances[nearestIndex], 350);
      });
    }

    hero.querySelectorAll(".mhero-svg .circle[data-menu]").forEach(function (circle) {
      circle.addEventListener("mouseenter", function () {
        activate(Number(circle.getAttribute("data-menu")) - 1);
      });
    });

    arrangeItems();
  }

  function initAll() {
    document.querySelectorAll("[data-toyama-home-test]").forEach(initHero);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll, { once: true });
  } else {
    initAll();
  }
})();
