(function () {
  function initRedesignInteractions() {
    var buttonSelector = '.btn, .btn-border, .s-request__full-btn, .s-request__btn, .card-row__buttons .msgs__tg, .card-row__buttons .max';

    document.addEventListener('pointerdown', function (e) {
      var btn = e.target.closest(buttonSelector);
      if (!btn) return;

      var rect = btn.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height) * 0.9;
      var ripple = document.createElement('span');
      ripple.className = 'rd-ripple';
      ripple.style.width = size + 'px';
      ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';

      btn.appendChild(ripple);
      setTimeout(function () {
        if (ripple && ripple.parentNode) {
          ripple.parentNode.removeChild(ripple);
        }
      }, 700);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRedesignInteractions);
  } else {
    initRedesignInteractions();
  }
})();
