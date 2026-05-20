const FocusFlow = {
  select(selector, parent = document) {
    return parent.querySelector(selector);
  },

  selectAll(selector, parent = document) {
    return [...parent.querySelectorAll(selector)];
  },

  setActiveNavigation() {
    const currentPage = document.body.dataset.page;

    this.selectAll("[data-navigation-page]").forEach((link) => {
      const isActive = link.dataset.navigationPage === currentPage;

      link.classList.toggle("active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  },

  initialise() {
    this.setActiveNavigation();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  FocusFlow.initialise();
});