import {card} from "../ui.js";

export const placeholder = (id, section, title) => ({id, section, title, render(root) {
  root.innerHTML = `<div class="page-stack">${card(title, `<div class="placeholder-card"><h2>${title}</h2></div>`)}</div>`;
}});
