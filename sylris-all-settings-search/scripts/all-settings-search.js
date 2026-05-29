const MODULE_ID = "sylris-search";
const WINDOW_ID = "search-window";

const CLASS_NAMES = {
  visible: "search-visible",
  launcher: "search-launcher",
  header: "search-header",
  controls: "search-controls",
  sectionButtons: "search-section-buttons",
  summary: "search-summary",
  form: "search-form",
  content: "search-content",
  footer: "search-footer",
  empty: "search-empty",
  allList: "search-all-list",
  moduleGroup: "search-module-group",
  collapseIcon: "search-collapse-icon",
  moduleTitle: "search-module-title",
  packageCount: "search-package-count",
  moduleResults: "search-module-results",
  setting: "search-setting",
  label: "search-label",
  meta: "search-meta",
  hint: "search-hint",
  input: "search-input",
  readonly: "search-readonly",
  menu: "search-menu",
  nativeControls: "search-native-controls",
  nativeOpenButton: "allSettingsButton",
  nativeMatch: "has-match",
  nativeMiss: "search-native-package-miss"
};

const SELECTORS = {
  settingsSidebar: "#settings, [data-tab='settings']",
  settingsButtonTarget: ".settings-buttons, .directory-footer, footer",
  searchInput: "[data-role='search']",
  content: "[data-role='content']",
  summary: "[data-role='summary']",
  dragHandle: "[data-action='drag']",
  settingInput: "[data-setting-key]",
  nativeSearchInput: "input[type='search'], input[name='search'], input[name='filter']",
  nativeCategory: "button[data-action='tab'][data-group='categories'][data-tab]",
  nativeCount: ".count[data-count], .count",
  nativeHeaderButton: "header button.header-control.icon.fa-solid.fa-ellipsis-vertical, #settings-config > header > button.header-control.icon.fa-solid.fa-ellipsis-vertical"
};

const ACTIONS = {
  close: "close",
  clear: "clear",
  refresh: "refresh",
  save: "save",
  drag: "drag",
  openMenu: "open-menu",
  expandAll: "expand-all",
  collapseAll: "collapse-all",
  openAll: "search-open-all"
};

class AllSettingsSearch {
  static element = null;
  static searchTerm = "";
  static collapsedPackages = new Set();
  static sidebarObserver = null;
  static nativeKnownElements = new WeakSet();
  static nativeCountObservers = new WeakMap();
  static nativeUpdateTimers = new WeakMap();
  static dragState = null;
  static moveDragHandler = event => this.moveDrag(event);
  static stopDragHandler = event => this.stopDrag(event);

  static initialise() {
    window.AllSettingsSearch = this;
    Hooks.on("renderSettingsConfig", (app, html) => this.improveCoreSearch(app, html));
    Hooks.on("renderApplication", (app, html) => {if (app?.constructor?.name === "SettingsConfig") {this.improveCoreSearch(app, html);}});
  }

  static open() {
    this.ensureElement();
    this.element.classList.add(CLASS_NAMES.visible);
    this.render();
    this.element.querySelector(SELECTORS.searchInput)?.focus();
  }

  static close() {
    this.element?.classList.remove(CLASS_NAMES.visible);
  }

  static ensureElement() {
    if (this.element) {return;}

    const wrapper = document.createElement("section");
    wrapper.id = WINDOW_ID;
    wrapper.innerHTML = `
      <header class="${CLASS_NAMES.header}" data-action="${ACTIONS.drag}">
        <h2><i class="fas fa-search"></i> All Settings Search</h2>
        <button type="button" data-action="${ACTIONS.close}" aria-label="Close"><i class="fas fa-times"></i></button>
      </header>
      <div class="${CLASS_NAMES.controls}">
        <input type="search" data-role="search" placeholder="Search every setting, package, key, hint, or scope...">
        <div class="${CLASS_NAMES.sectionButtons}" role="group" aria-label="Section controls">
          <button type="button" data-action="${ACTIONS.expandAll}">Expand All</button>
          <button type="button" data-action="${ACTIONS.collapseAll}">Collapse All</button>
        </div>
        <button type="button" data-action="${ACTIONS.clear}">Clear</button>
        <button type="button" data-action="${ACTIONS.refresh}">Refresh</button>
      </div>
      <div class="${CLASS_NAMES.summary}" data-role="summary"></div>
      <form class="${CLASS_NAMES.form}">
        <main class="${CLASS_NAMES.content}" data-role="content"></main>
      </form>
      <footer class="${CLASS_NAMES.footer}">
        <button type="button" data-action="${ACTIONS.save}"><i class="fas fa-save"></i> Save Changes</button>
      </footer>
    `;

    document.body.appendChild(wrapper);
    this.element = wrapper;
    this.bindWindowEvents();
  }

  static bindWindowEvents() {
    this.element.addEventListener("click", event => {
      const target = event.target.closest("[data-action]");
      if (!target) {return;}

      const action = target.dataset.action;
      if (action === ACTIONS.close) {this.close();}
      else if (action === ACTIONS.clear) {this.clearSearch();}
      else if (action === ACTIONS.refresh) {this.render();}
      else if (action === ACTIONS.save) {this.saveChanges();}
      else if (action === ACTIONS.openMenu) {this.openMenu(target.dataset.menuKey);}
      else if (action === ACTIONS.expandAll) {this.expandAllPackages();}
      else if (action === ACTIONS.collapseAll) {this.collapseAllPackages();}
    });

    this.element.addEventListener("toggle", event => {
      const target = event.target;
      if (!target.matches(`.${CLASS_NAMES.moduleGroup}[data-package-namespace]`)) {return;}

      const namespace = target.dataset.packageNamespace;
      if (!namespace) {return;}
      if (target.open) {this.collapsedPackages.delete(namespace);}
      else {this.collapsedPackages.add(namespace);}
    }, true);

    this.element.querySelector(SELECTORS.searchInput).addEventListener("input", event => {
      this.searchTerm = event.currentTarget.value.trim().toLowerCase();
      this.render();
    });

    this.element.querySelector(SELECTORS.dragHandle).addEventListener("pointerdown", event => this.startDrag(event));
  }

  static startDrag(event) {
    if (event.button !== 0 || event.target.closest("button, input, select, textarea, a")) {return;}

    const rect = this.element.getBoundingClientRect();
    const handle = event.currentTarget;
    this.element.style.transform = "none";
    this.element.style.left = `${rect.left}px`;
    this.element.style.top = `${rect.top}px`;
    this.dragState = {
      handle,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      nextLeft: rect.left,
      nextTop: rect.top,
      frame: null
    };

    handle.setPointerCapture?.(event.pointerId);
    handle.addEventListener("pointermove", this.moveDragHandler);
    handle.addEventListener("pointerup", this.stopDragHandler, {once: true});
    handle.addEventListener("pointercancel", this.stopDragHandler, {once: true});
    event.preventDefault();
  }

  static moveDrag(event) {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) {return;}

    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - this.dragState.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - this.dragState.height - margin);
    this.dragState.nextLeft = Math.min(Math.max(margin, event.clientX - this.dragState.offsetX), maxLeft);
    this.dragState.nextTop = Math.min(Math.max(margin, event.clientY - this.dragState.offsetY), maxTop);

    if (this.dragState.frame) {return;}
    this.dragState.frame = requestAnimationFrame(() => this.applyDragPosition());
  }

  static applyDragPosition() {
    if (!this.dragState) {return;}

    this.element.style.left = `${this.dragState.nextLeft}px`;
    this.element.style.top = `${this.dragState.nextTop}px`;
    this.dragState.frame = null;
  }

  static stopDrag(event) {
    if (!this.dragState || (event?.pointerId !== undefined && event.pointerId !== this.dragState.pointerId)) {return;}

    const {handle, pointerId, frame} = this.dragState;
    if (frame) {cancelAnimationFrame(frame);}
    handle.releasePointerCapture?.(pointerId);
    handle.removeEventListener("pointermove", this.moveDragHandler);
    handle.removeEventListener("pointercancel", this.stopDragHandler);
    this.dragState = null;
  }

  static clearSearch() {
    this.searchTerm = "";
    const input = this.element.querySelector(SELECTORS.searchInput);
    input.value = "";
    this.render();
    input.focus();
  }

  static expandAllPackages() {
    this.collapsedPackages.clear();
    this.render();
  }

  static collapseAllPackages() {
    for (const pkg of this.getCategorisedData().packages) {this.collapsedPackages.add(pkg.namespace);}
    this.render();
  }

  static render() {
    if (!this.element) {return;}

    const data = this.getCategorisedData();
    const content = this.element.querySelector(SELECTORS.content);
    const summary = this.element.querySelector(SELECTORS.summary);
    const settingText = `${data.settings.length} setting${data.settings.length === 1 ? "" : "s"}`;
    const menuText = `${data.menus.length} submenu${data.menus.length === 1 ? "" : "s"}`;
    const packageText = `${data.packages.length} package${data.packages.length === 1 ? "" : "s"}`;

    summary.textContent = this.searchTerm ? `${settingText} and ${menuText} found in ${packageText}.` : `${settingText} and ${menuText} across ${packageText}.`;
    content.innerHTML = data.packages.length ? this.renderAll(data.packages) : `<p class="${CLASS_NAMES.empty}">No settings matched your search.</p>`;
  }

  static getCategorisedData() {
    const packages = new Map();
    const settings = [];
    const menus = [];

    for (const [fullKey, setting] of game.settings.settings.entries()) {
      if (setting.config === false) {continue;}

      const namespace = setting.namespace ?? fullKey.split(".")[0];
      const packageData = this.getPackage(packages, namespace);
      const settingData = this.normaliseSetting(fullKey, setting, packageData.label);
      if (!this.matchesSearch(settingData.searchText)) {continue;}

      packageData.settings.push(settingData);
      settings.push(settingData);
    }

    for (const [fullKey, menu] of game.settings.menus.entries()) {
      const namespace = menu.namespace ?? fullKey.split(".")[0];
      const packageData = this.getPackage(packages, namespace);
      const menuData = this.normaliseMenu(fullKey, menu, packageData.label);
      if (!this.matchesSearch(menuData.searchText)) {continue;}

      packageData.menus.push(menuData);
      menus.push(menuData);
    }

    const sortedPackages = Array.from(packages.values())
      .filter(pkg => pkg.settings.length || pkg.menus.length)
      .sort((a, b) => this.sortPackages(a, b));

    for (const pkg of sortedPackages) {
      pkg.menus.sort((a, b) => a.name.localeCompare(b.name, game.i18n?.lang || undefined));
      pkg.settings.sort((a, b) => a.name.localeCompare(b.name, game.i18n?.lang || undefined));
    }

    return {packages: sortedPackages, settings, menus};
  }

  static getPackage(packages, namespace) {
    if (packages.has(namespace)) {return packages.get(namespace);}

    const packageData = {
      namespace,
      label: this.getPackageLabel(namespace),
      type: this.getPackageType(namespace),
      settings: [],
      menus: []
    };
    packages.set(namespace, packageData);
    return packageData;
  }

  static normaliseSetting(fullKey, setting, packageLabel) {
    const namespace = setting.namespace ?? fullKey.split(".")[0];
    const key = setting.key ?? fullKey.split(".").slice(1).join(".");
    const name = this.localise(setting.name || key);
    const hint = this.localise(setting.hint || "");
    const scope = setting.scope || "client";
    const value = this.getCurrentValue(namespace, key);

    return {
      type: "setting",
      fullKey,
      namespace,
      key,
      packageLabel,
      name,
      hint,
      scope,
      value,
      setting,
      readonly: !this.canEditSetting(setting),
      searchText: `${packageLabel} ${namespace} ${key} ${name} ${hint} ${scope}`.toLowerCase()
    };
  }

  static normaliseMenu(fullKey, menu, packageLabel) {
    const namespace = menu.namespace ?? fullKey.split(".")[0];
    const key = menu.key ?? fullKey.split(".").slice(1).join(".");
    const name = this.localise(menu.name || menu.label || key);
    const hint = this.localise(menu.hint || "");

    return {
      type: "menu",
      fullKey,
      namespace,
      key,
      packageLabel,
      name,
      hint,
      menu,
      searchText: `${packageLabel} ${namespace} ${key} ${name} ${hint} submenu menu`.toLowerCase()
    };
  }

  static matchesSearch(searchText) {
    if (!this.searchTerm) {return true;}
    return this.searchTerm.split(/\s+/).every(term => searchText.includes(term));
  }

  static renderAll(packages) {
    return `<section class="${CLASS_NAMES.allList}">${packages.map(pkg => this.renderPackage(pkg)).join("")}</section>`;
  }

  static renderPackage(pkg) {
    const count = pkg.settings.length + pkg.menus.length;
    const openAttribute = this.collapsedPackages.has(pkg.namespace) ? "" : " open";
    const items = `${pkg.menus.map(menu => this.renderMenu(menu)).join("")}${pkg.settings.map(setting => this.renderSetting(setting)).join("")}`;

    return `
      <details class="${CLASS_NAMES.moduleGroup}" data-package-namespace="${this.escapeHtml(pkg.namespace)}"${openAttribute}>
        <summary>
          <span class="${CLASS_NAMES.collapseIcon}" aria-hidden="true">▶</span>
          <span class="${CLASS_NAMES.moduleTitle}">${this.escapeHtml(pkg.label)}</span>
          <span class="${CLASS_NAMES.packageCount}">${count}</span>
        </summary>
        <div class="${CLASS_NAMES.moduleResults}">${items}</div>
      </details>
    `;
  }

  static renderMenu(menu) {
    return `
      <section class="${CLASS_NAMES.setting} ${CLASS_NAMES.menu}" data-entry-type="menu">
        <div>
          <div class="${CLASS_NAMES.label}"><i class="fas fa-folder-open"></i> ${this.escapeHtml(menu.name)}</div>
          <div class="${CLASS_NAMES.meta}">${this.escapeHtml(menu.fullKey)} · submenu</div>
          ${menu.hint ? `<div class="${CLASS_NAMES.hint}">${this.escapeHtml(menu.hint)}</div>` : ""}
        </div>
        <div class="${CLASS_NAMES.input}">
          <button type="button" data-action="${ACTIONS.openMenu}" data-menu-key="${this.escapeHtml(menu.fullKey)}">Open Submenu</button>
        </div>
      </section>
    `;
  }

  static renderSetting(settingData) {
    const readonlyClass = settingData.readonly ? ` ${CLASS_NAMES.readonly}` : "";

    return `
      <section class="${CLASS_NAMES.setting}${readonlyClass}" data-entry-type="setting">
        <div>
          <div class="${CLASS_NAMES.label}">${this.escapeHtml(settingData.name)}</div>
          <div class="${CLASS_NAMES.meta}">${this.escapeHtml(settingData.fullKey)} · ${this.escapeHtml(settingData.scope)}${settingData.readonly ? " · read only" : ""}</div>
          ${settingData.hint ? `<div class="${CLASS_NAMES.hint}">${this.escapeHtml(settingData.hint)}</div>` : ""}
        </div>
        <div class="${CLASS_NAMES.input}">${this.renderInput(settingData)}</div>
      </section>
    `;
  }

  static renderInput(settingData) {
    const {setting, value, fullKey, readonly} = settingData;
    const disabled = readonly ? " disabled" : "";
    const keyAttribute = `data-setting-key="${this.escapeHtml(fullKey)}"`;

    if (setting.choices) {
      const options = Object.entries(setting.choices).map(([choiceValue, choiceLabel]) => {
        const selected = String(value) === String(choiceValue) ? " selected" : "";
        return `<option value="${this.escapeHtml(choiceValue)}"${selected}>${this.escapeHtml(this.localise(choiceLabel))}</option>`;
      }).join("");
      return `<select ${keyAttribute}${disabled}>${options}</select>`;
    }

    if (setting.type === Boolean) {return `<input type="checkbox" ${keyAttribute}${value ? " checked" : ""}${disabled}>`;}

    if (setting.type === Number) {
      const range = setting.range || {};
      const min = Number.isFinite(range.min) ? ` min="${range.min}"` : "";
      const max = Number.isFinite(range.max) ? ` max="${range.max}"` : "";
      const step = Number.isFinite(range.step) ? ` step="${range.step}"` : "";
      return `<input type="number" ${keyAttribute} value="${this.escapeHtml(value ?? "")}"${min}${max}${step}${disabled}>`;
    }

    if (setting.type === Object || setting.type === Array || typeof value === "object") {return `<textarea ${keyAttribute}${disabled}>${this.escapeHtml(this.stringifyValue(value))}</textarea>`;}

    return `<input type="text" ${keyAttribute} value="${this.escapeHtml(value ?? "")}"${disabled}>`;
  }

  static async saveChanges() {
    const inputs = Array.from(this.element.querySelectorAll(SELECTORS.settingInput)).filter(input => !input.disabled);
    const changedSettings = [];
    const failedSettings = [];
    let needsReload = false;

    for (const input of inputs) {
      const fullKey = input.dataset.settingKey;
      const setting = game.settings.settings.get(fullKey);
      if (!setting) {continue;}

      const namespace = setting.namespace ?? fullKey.split(".")[0];
      const key = setting.key ?? fullKey.split(".").slice(1).join(".");
      const currentValue = this.getCurrentValue(namespace, key);
      let nextValue;

      try {
        nextValue = this.readInputValue(input, setting);
      } catch (error) {
        failedSettings.push(`${fullKey}: ${error.message}`);
        continue;
      }

      if (this.valuesMatch(currentValue, nextValue)) {continue;}

      try {
        await game.settings.set(namespace, key, nextValue);
        changedSettings.push(fullKey);
        needsReload ||= Boolean(setting.requiresReload);
      } catch (error) {
        failedSettings.push(`${fullKey}: ${error.message}`);
      }
    }

    if (changedSettings.length) {ui.notifications?.info(`All Settings Search: saved ${changedSettings.length} setting${changedSettings.length === 1 ? "" : "s"}.`);}
    else if (!failedSettings.length) {ui.notifications?.info("All Settings Search: no changes to save.");}

    if (failedSettings.length) {
      console.warn(`${MODULE_ID} | Some settings failed to save`, failedSettings);
      ui.notifications?.warn(`All Settings Search: ${failedSettings.length} setting${failedSettings.length === 1 ? "" : "s"} failed to save. Check the console for details.`);
    }

    if (needsReload) {this.confirmReload();}
    this.render();
  }

  static readInputValue(input, setting) {
    if (setting.type === Boolean) {return input.checked;}

    if (setting.type === Number) {
      const value = Number(input.value);
      if (Number.isNaN(value)) {throw new Error("Expected a number");}
      return value;
    }

    if (setting.type === Object || setting.type === Array) {
      if (!input.value.trim()) {return setting.type === Array ? [] : {};}
      return JSON.parse(input.value);
    }

    return input.value;
  }

  static async openMenu(fullKey) {
    const menu = game.settings.menus.get(fullKey);
    if (!menu?.type) {return;}

    try {
      const app = new menu.type();
      try {
        await app.render({force: true});
      } catch (error) {
        await app.render(true);
      }
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to open menu ${fullKey}`, error);
      ui.notifications?.error(`Failed to open ${this.localise(menu.name || fullKey)}. Check the console for details.`);
    }
  }

  static confirmReload() {
    const SettingsConfig = foundry.applications?.settings?.SettingsConfig;
    if (SettingsConfig?.reloadConfirm) {
      SettingsConfig.reloadConfirm({world: true});
      return;
    }

    ui.notifications?.warn("One or more saved settings require a reload.");
  }

  static getCurrentValue(namespace, key) {
    try {
      return game.settings.get(namespace, key);
    } catch (error) {
      console.warn(`${MODULE_ID} | Failed to read setting ${namespace}.${key}`, error);
      return undefined;
    }
  }

  static canEditSetting(setting) {
    if (setting.scope !== "world") {return true;}
    if (game.user?.can?.("SETTINGS_MODIFY")) {return true;}
    return Boolean(game.user?.isGM);
  }

  static getPackageLabel(namespace) {
    if (namespace === "core") {return "Core";}
    if (game.system?.id === namespace) {return game.system.title || namespace;}
    return game.modules?.get(namespace)?.title || namespace;
  }

  static getPackageType(namespace) {
    if (namespace === "core") {return 0;}
    if (game.system?.id === namespace) {return 1;}
    return 2;
  }

  static sortPackages(a, b) {
    if (a.type !== b.type) {return a.type - b.type;}
    return a.label.localeCompare(b.label, game.i18n?.lang || undefined);
  }

  static valuesMatch(a, b) {
    return this.stringifyValue(a) === this.stringifyValue(b);
  }

  static stringifyValue(value) {
    if (typeof value === "string") {return value;}
    return JSON.stringify(value, null, 2);
  }

  static localise(value) {
    if (typeof value !== "string") {return String(value ?? "");}
    return game.i18n?.localize(value) || value;
  }

  static escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  static improveCoreSearch(app, html) {
    const element = this.resolveHtmlElement(html, app);
    if (!element) {return;}

    this.injectNativeControls(element);

    if (!this.nativeKnownElements.has(element)) {
      this.nativeKnownElements.add(element);
      this.bindNativeSearchEvents(element);
      this.observeNativeCounts(element);
    }

    this.scheduleNativeUpdate(element, 50);
  }

  static resolveHtmlElement(html, app) {
    if (html instanceof HTMLElement) {return html;}
    if (html?.[0] instanceof HTMLElement) {return html[0];}
    if (app?.element instanceof HTMLElement) {return app.element;}
    if (app?.element?.[0] instanceof HTMLElement) {return app.element[0];}
    return document.querySelector(".settings-config, #settings-config, [data-application-part='settings']");
  }

  static injectNativeControls(element) {
    if (element.querySelector(`.${CLASS_NAMES.nativeControls}`)) {return;}

    const controls = document.createElement("div");
    controls.className = CLASS_NAMES.nativeControls;
    controls.innerHTML = `<button type="button" class="${CLASS_NAMES.nativeOpenButton}" data-action="${ACTIONS.openAll}" title="Open All Settings"><i class="fas fa-list"></i></button>`;
    controls.querySelector(`[data-action='${ACTIONS.openAll}']`).addEventListener("click", () => this.open());

    const target = element.querySelector(SELECTORS.nativeHeaderButton) || document.querySelector(SELECTORS.nativeHeaderButton);
    if (target) {target.insertAdjacentElement("beforebegin", controls);}
    else {(element.querySelector("header") || element).prepend(controls);}
  }

  static bindNativeSearchEvents(element) {
    const schedule = () => this.scheduleNativeUpdate(element, 75);

    for (const eventName of ["input", "search", "keyup"]) {
      element.addEventListener(eventName, event => {if (event.target.matches(SELECTORS.nativeSearchInput)) {schedule();}});
    }

    element.addEventListener("click", event => {if (event.target.closest(SELECTORS.nativeCategory)) {schedule();}});
  }

  static observeNativeCounts(element) {
    if (this.nativeCountObservers.has(element)) {return;}

    const observer = new MutationObserver(() => this.scheduleNativeUpdate(element, 0));
    observer.observe(element, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["data-count"]});
    this.nativeCountObservers.set(element, observer);
  }

  static scheduleNativeUpdate(element, delay = 0) {
    const existingTimer = this.nativeUpdateTimers.get(element);
    if (existingTimer) {window.clearTimeout(existingTimer);}

    const timer = window.setTimeout(() => {
      this.nativeUpdateTimers.delete(element);
      if (element.isConnected) {this.updateNativeSearch(element);}
    }, delay);
    this.nativeUpdateTimers.set(element, timer);
  }

  static updateNativeSearch(element) {
    const searchInput = element.querySelector(SELECTORS.nativeSearchInput);
    const hasSearch = Boolean(searchInput?.value?.trim());
    const packageElements = this.getNativePackageElements(element);

    for (const packageElement of packageElements) {
      packageElement.classList.remove(CLASS_NAMES.nativeMatch, CLASS_NAMES.nativeMiss);
      if (!hasSearch) {continue;}

      const count = this.getNativePackageCount(packageElement);
      if (count === null) {continue;}
      packageElement.classList.add(count > 0 ? CLASS_NAMES.nativeMatch : CLASS_NAMES.nativeMiss);
    }
  }

  static getNativePackageElements(element) {
    return Array.from(element.querySelectorAll(SELECTORS.nativeCategory));
  }

  static getNativePackageCount(packageElement) {
    const countElement = packageElement.querySelector(SELECTORS.nativeCount);
    if (!countElement) {return null;}

    const rawCount = countElement.dataset.count?.trim() || countElement.textContent.replaceAll("[", "").replaceAll("]", "").trim();
    const count = Number.parseInt(rawCount, 10);
    return Number.isFinite(count) ? count : null;
  }
}

AllSettingsSearch.initialise();
