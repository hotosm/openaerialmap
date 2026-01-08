/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const sn = globalThis, Gn = sn.ShadowRoot && (sn.ShadyCSS === void 0 || sn.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, Yn = Symbol(), wo = /* @__PURE__ */ new WeakMap();
let si = class {
  constructor(e, t, o) {
    if (this._$cssResult$ = !0, o !== Yn) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = e, this.t = t;
  }
  get styleSheet() {
    let e = this.o;
    const t = this.t;
    if (Gn && e === void 0) {
      const o = t !== void 0 && t.length === 1;
      o && (e = wo.get(t)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), o && wo.set(t, e));
    }
    return e;
  }
  toString() {
    return this.cssText;
  }
};
const qi = (n) => new si(typeof n == "string" ? n : n + "", void 0, Yn), zi = (n, ...e) => {
  const t = n.length === 1 ? n[0] : e.reduce((o, i, s) => o + ((a) => {
    if (a._$cssResult$ === !0) return a.cssText;
    if (typeof a == "number") return a;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + a + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(i) + n[s + 1], n[0]);
  return new si(t, n, Yn);
}, Fi = (n, e) => {
  if (Gn) n.adoptedStyleSheets = e.map((t) => t instanceof CSSStyleSheet ? t : t.styleSheet);
  else for (const t of e) {
    const o = document.createElement("style"), i = sn.litNonce;
    i !== void 0 && o.setAttribute("nonce", i), o.textContent = t.cssText, n.appendChild(o);
  }
}, So = Gn ? (n) => n : (n) => n instanceof CSSStyleSheet ? ((e) => {
  let t = "";
  for (const o of e.cssRules) t += o.cssText;
  return qi(t);
})(n) : n;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: Ki, defineProperty: Bi, getOwnPropertyDescriptor: Vi, getOwnPropertyNames: Zi, getOwnPropertySymbols: Ji, getPrototypeOf: Qi } = Object, rt = globalThis, xo = rt.trustedTypes, Gi = xo ? xo.emptyScript : "", jn = rt.reactiveElementPolyfillSupport, Tt = (n, e) => n, gn = { toAttribute(n, e) {
  switch (e) {
    case Boolean:
      n = n ? Gi : null;
      break;
    case Object:
    case Array:
      n = n == null ? n : JSON.stringify(n);
  }
  return n;
}, fromAttribute(n, e) {
  let t = n;
  switch (e) {
    case Boolean:
      t = n !== null;
      break;
    case Number:
      t = n === null ? null : Number(n);
      break;
    case Object:
    case Array:
      try {
        t = JSON.parse(n);
      } catch {
        t = null;
      }
  }
  return t;
} }, Xn = (n, e) => !Ki(n, e), Co = { attribute: !0, type: String, converter: gn, reflect: !1, useDefault: !1, hasChanged: Xn };
Symbol.metadata ?? (Symbol.metadata = Symbol("metadata")), rt.litPropertyMetadata ?? (rt.litPropertyMetadata = /* @__PURE__ */ new WeakMap());
let pt = class extends HTMLElement {
  static addInitializer(e) {
    this._$Ei(), (this.l ?? (this.l = [])).push(e);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(e, t = Co) {
    if (t.state && (t.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((t = Object.create(t)).wrapped = !0), this.elementProperties.set(e, t), !t.noAccessor) {
      const o = Symbol(), i = this.getPropertyDescriptor(e, o, t);
      i !== void 0 && Bi(this.prototype, e, i);
    }
  }
  static getPropertyDescriptor(e, t, o) {
    const { get: i, set: s } = Vi(this.prototype, e) ?? { get() {
      return this[t];
    }, set(a) {
      this[t] = a;
    } };
    return { get: i, set(a) {
      const d = i == null ? void 0 : i.call(this);
      s == null || s.call(this, a), this.requestUpdate(e, d, o);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(e) {
    return this.elementProperties.get(e) ?? Co;
  }
  static _$Ei() {
    if (this.hasOwnProperty(Tt("elementProperties"))) return;
    const e = Qi(this);
    e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(Tt("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(Tt("properties"))) {
      const t = this.properties, o = [...Zi(t), ...Ji(t)];
      for (const i of o) this.createProperty(i, t[i]);
    }
    const e = this[Symbol.metadata];
    if (e !== null) {
      const t = litPropertyMetadata.get(e);
      if (t !== void 0) for (const [o, i] of t) this.elementProperties.set(o, i);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [t, o] of this.elementProperties) {
      const i = this._$Eu(t, o);
      i !== void 0 && this._$Eh.set(i, t);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(e) {
    const t = [];
    if (Array.isArray(e)) {
      const o = new Set(e.flat(1 / 0).reverse());
      for (const i of o) t.unshift(So(i));
    } else e !== void 0 && t.push(So(e));
    return t;
  }
  static _$Eu(e, t) {
    const o = t.attribute;
    return o === !1 ? void 0 : typeof o == "string" ? o : typeof e == "string" ? e.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    var e;
    this._$ES = new Promise((t) => this.enableUpdating = t), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), (e = this.constructor.l) == null || e.forEach((t) => t(this));
  }
  addController(e) {
    var t;
    (this._$EO ?? (this._$EO = /* @__PURE__ */ new Set())).add(e), this.renderRoot !== void 0 && this.isConnected && ((t = e.hostConnected) == null || t.call(e));
  }
  removeController(e) {
    var t;
    (t = this._$EO) == null || t.delete(e);
  }
  _$E_() {
    const e = /* @__PURE__ */ new Map(), t = this.constructor.elementProperties;
    for (const o of t.keys()) this.hasOwnProperty(o) && (e.set(o, this[o]), delete this[o]);
    e.size > 0 && (this._$Ep = e);
  }
  createRenderRoot() {
    const e = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return Fi(e, this.constructor.elementStyles), e;
  }
  connectedCallback() {
    var e;
    this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this.enableUpdating(!0), (e = this._$EO) == null || e.forEach((t) => {
      var o;
      return (o = t.hostConnected) == null ? void 0 : o.call(t);
    });
  }
  enableUpdating(e) {
  }
  disconnectedCallback() {
    var e;
    (e = this._$EO) == null || e.forEach((t) => {
      var o;
      return (o = t.hostDisconnected) == null ? void 0 : o.call(t);
    });
  }
  attributeChangedCallback(e, t, o) {
    this._$AK(e, o);
  }
  _$ET(e, t) {
    var s;
    const o = this.constructor.elementProperties.get(e), i = this.constructor._$Eu(e, o);
    if (i !== void 0 && o.reflect === !0) {
      const a = (((s = o.converter) == null ? void 0 : s.toAttribute) !== void 0 ? o.converter : gn).toAttribute(t, o.type);
      this._$Em = e, a == null ? this.removeAttribute(i) : this.setAttribute(i, a), this._$Em = null;
    }
  }
  _$AK(e, t) {
    var s, a;
    const o = this.constructor, i = o._$Eh.get(e);
    if (i !== void 0 && this._$Em !== i) {
      const d = o.getPropertyOptions(i), c = typeof d.converter == "function" ? { fromAttribute: d.converter } : ((s = d.converter) == null ? void 0 : s.fromAttribute) !== void 0 ? d.converter : gn;
      this._$Em = i;
      const l = c.fromAttribute(t, d.type);
      this[i] = l ?? ((a = this._$Ej) == null ? void 0 : a.get(i)) ?? l, this._$Em = null;
    }
  }
  requestUpdate(e, t, o) {
    var i;
    if (e !== void 0) {
      const s = this.constructor, a = this[e];
      if (o ?? (o = s.getPropertyOptions(e)), !((o.hasChanged ?? Xn)(a, t) || o.useDefault && o.reflect && a === ((i = this._$Ej) == null ? void 0 : i.get(e)) && !this.hasAttribute(s._$Eu(e, o)))) return;
      this.C(e, t, o);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(e, t, { useDefault: o, reflect: i, wrapped: s }, a) {
    o && !(this._$Ej ?? (this._$Ej = /* @__PURE__ */ new Map())).has(e) && (this._$Ej.set(e, a ?? t ?? this[e]), s !== !0 || a !== void 0) || (this._$AL.has(e) || (this.hasUpdated || o || (t = void 0), this._$AL.set(e, t)), i === !0 && this._$Em !== e && (this._$Eq ?? (this._$Eq = /* @__PURE__ */ new Set())).add(e));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (t) {
      Promise.reject(t);
    }
    const e = this.scheduleUpdate();
    return e != null && await e, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    var o;
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this._$Ep) {
        for (const [s, a] of this._$Ep) this[s] = a;
        this._$Ep = void 0;
      }
      const i = this.constructor.elementProperties;
      if (i.size > 0) for (const [s, a] of i) {
        const { wrapped: d } = a, c = this[s];
        d !== !0 || this._$AL.has(s) || c === void 0 || this.C(s, void 0, a, c);
      }
    }
    let e = !1;
    const t = this._$AL;
    try {
      e = this.shouldUpdate(t), e ? (this.willUpdate(t), (o = this._$EO) == null || o.forEach((i) => {
        var s;
        return (s = i.hostUpdate) == null ? void 0 : s.call(i);
      }), this.update(t)) : this._$EM();
    } catch (i) {
      throw e = !1, this._$EM(), i;
    }
    e && this._$AE(t);
  }
  willUpdate(e) {
  }
  _$AE(e) {
    var t;
    (t = this._$EO) == null || t.forEach((o) => {
      var i;
      return (i = o.hostUpdated) == null ? void 0 : i.call(o);
    }), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(e)), this.updated(e);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(e) {
    return !0;
  }
  update(e) {
    this._$Eq && (this._$Eq = this._$Eq.forEach((t) => this._$ET(t, this[t]))), this._$EM();
  }
  updated(e) {
  }
  firstUpdated(e) {
  }
};
pt.elementStyles = [], pt.shadowRootOptions = { mode: "open" }, pt[Tt("elementProperties")] = /* @__PURE__ */ new Map(), pt[Tt("finalized")] = /* @__PURE__ */ new Map(), jn == null || jn({ ReactiveElement: pt }), (rt.reactiveElementVersions ?? (rt.reactiveElementVersions = [])).push("2.1.1");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Nt = globalThis, vn = Nt.trustedTypes, Ao = vn ? vn.createPolicy("lit-html", { createHTML: (n) => n }) : void 0, ri = "$lit$", st = `lit$${Math.random().toFixed(9).slice(2)}$`, ai = "?" + st, Yi = `<${ai}>`, ht = document, Mt = () => ht.createComment(""), Ht = (n) => n === null || typeof n != "object" && typeof n != "function", eo = Array.isArray, Xi = (n) => eo(n) || typeof (n == null ? void 0 : n[Symbol.iterator]) == "function", $n = `[ 	
\f\r]`, yt = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, Oo = /-->/g, Po = />/g, ct = RegExp(`>|${$n}(?:([^\\s"'>=/]+)(${$n}*=${$n}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), Eo = /'/g, Io = /"/g, li = /^(?:script|style|textarea|title)$/i, es = (n) => (e, ...t) => ({ _$litType$: n, strings: e, values: t }), He = es(1), gt = Symbol.for("lit-noChange"), Te = Symbol.for("lit-nothing"), jo = /* @__PURE__ */ new WeakMap(), dt = ht.createTreeWalker(ht, 129);
function ci(n, e) {
  if (!eo(n) || !n.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return Ao !== void 0 ? Ao.createHTML(e) : e;
}
const ts = (n, e) => {
  const t = n.length - 1, o = [];
  let i, s = e === 2 ? "<svg>" : e === 3 ? "<math>" : "", a = yt;
  for (let d = 0; d < t; d++) {
    const c = n[d];
    let l, u, h = -1, g = 0;
    for (; g < c.length && (a.lastIndex = g, u = a.exec(c), u !== null); ) g = a.lastIndex, a === yt ? u[1] === "!--" ? a = Oo : u[1] !== void 0 ? a = Po : u[2] !== void 0 ? (li.test(u[2]) && (i = RegExp("</" + u[2], "g")), a = ct) : u[3] !== void 0 && (a = ct) : a === ct ? u[0] === ">" ? (a = i ?? yt, h = -1) : u[1] === void 0 ? h = -2 : (h = a.lastIndex - u[2].length, l = u[1], a = u[3] === void 0 ? ct : u[3] === '"' ? Io : Eo) : a === Io || a === Eo ? a = ct : a === Oo || a === Po ? a = yt : (a = ct, i = void 0);
    const f = a === ct && n[d + 1].startsWith("/>") ? " " : "";
    s += a === yt ? c + Yi : h >= 0 ? (o.push(l), c.slice(0, h) + ri + c.slice(h) + st + f) : c + st + (h === -2 ? d : f);
  }
  return [ci(n, s + (n[t] || "<?>") + (e === 2 ? "</svg>" : e === 3 ? "</math>" : "")), o];
};
let Bn = class di {
  constructor({ strings: e, _$litType$: t }, o) {
    let i;
    this.parts = [];
    let s = 0, a = 0;
    const d = e.length - 1, c = this.parts, [l, u] = ts(e, t);
    if (this.el = di.createElement(l, o), dt.currentNode = this.el.content, t === 2 || t === 3) {
      const h = this.el.content.firstChild;
      h.replaceWith(...h.childNodes);
    }
    for (; (i = dt.nextNode()) !== null && c.length < d; ) {
      if (i.nodeType === 1) {
        if (i.hasAttributes()) for (const h of i.getAttributeNames()) if (h.endsWith(ri)) {
          const g = u[a++], f = i.getAttribute(h).split(st), x = /([.?@])?(.*)/.exec(g);
          c.push({ type: 1, index: s, name: x[2], strings: f, ctor: x[1] === "." ? os : x[1] === "?" ? is : x[1] === "@" ? ss : kn }), i.removeAttribute(h);
        } else h.startsWith(st) && (c.push({ type: 6, index: s }), i.removeAttribute(h));
        if (li.test(i.tagName)) {
          const h = i.textContent.split(st), g = h.length - 1;
          if (g > 0) {
            i.textContent = vn ? vn.emptyScript : "";
            for (let f = 0; f < g; f++) i.append(h[f], Mt()), dt.nextNode(), c.push({ type: 2, index: ++s });
            i.append(h[g], Mt());
          }
        }
      } else if (i.nodeType === 8) if (i.data === ai) c.push({ type: 2, index: s });
      else {
        let h = -1;
        for (; (h = i.data.indexOf(st, h + 1)) !== -1; ) c.push({ type: 7, index: s }), h += st.length - 1;
      }
      s++;
    }
  }
  static createElement(e, t) {
    const o = ht.createElement("template");
    return o.innerHTML = e, o;
  }
};
function vt(n, e, t = n, o) {
  var a, d;
  if (e === gt) return e;
  let i = o !== void 0 ? (a = t._$Co) == null ? void 0 : a[o] : t._$Cl;
  const s = Ht(e) ? void 0 : e._$litDirective$;
  return (i == null ? void 0 : i.constructor) !== s && ((d = i == null ? void 0 : i._$AO) == null || d.call(i, !1), s === void 0 ? i = void 0 : (i = new s(n), i._$AT(n, t, o)), o !== void 0 ? (t._$Co ?? (t._$Co = []))[o] = i : t._$Cl = i), i !== void 0 && (e = vt(n, i._$AS(n, e.values), i, o)), e;
}
let ns = class {
  constructor(e, t) {
    this._$AV = [], this._$AN = void 0, this._$AD = e, this._$AM = t;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(e) {
    const { el: { content: t }, parts: o } = this._$AD, i = ((e == null ? void 0 : e.creationScope) ?? ht).importNode(t, !0);
    dt.currentNode = i;
    let s = dt.nextNode(), a = 0, d = 0, c = o[0];
    for (; c !== void 0; ) {
      if (a === c.index) {
        let l;
        c.type === 2 ? l = new to(s, s.nextSibling, this, e) : c.type === 1 ? l = new c.ctor(s, c.name, c.strings, this, e) : c.type === 6 && (l = new rs(s, this, e)), this._$AV.push(l), c = o[++d];
      }
      a !== (c == null ? void 0 : c.index) && (s = dt.nextNode(), a++);
    }
    return dt.currentNode = ht, i;
  }
  p(e) {
    let t = 0;
    for (const o of this._$AV) o !== void 0 && (o.strings !== void 0 ? (o._$AI(e, o, t), t += o.strings.length - 2) : o._$AI(e[t])), t++;
  }
}, to = class ui {
  get _$AU() {
    var e;
    return ((e = this._$AM) == null ? void 0 : e._$AU) ?? this._$Cv;
  }
  constructor(e, t, o, i) {
    this.type = 2, this._$AH = Te, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = o, this.options = i, this._$Cv = (i == null ? void 0 : i.isConnected) ?? !0;
  }
  get parentNode() {
    let e = this._$AA.parentNode;
    const t = this._$AM;
    return t !== void 0 && (e == null ? void 0 : e.nodeType) === 11 && (e = t.parentNode), e;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(e, t = this) {
    e = vt(this, e, t), Ht(e) ? e === Te || e == null || e === "" ? (this._$AH !== Te && this._$AR(), this._$AH = Te) : e !== this._$AH && e !== gt && this._(e) : e._$litType$ !== void 0 ? this.$(e) : e.nodeType !== void 0 ? this.T(e) : Xi(e) ? this.k(e) : this._(e);
  }
  O(e) {
    return this._$AA.parentNode.insertBefore(e, this._$AB);
  }
  T(e) {
    this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
  }
  _(e) {
    this._$AH !== Te && Ht(this._$AH) ? this._$AA.nextSibling.data = e : this.T(ht.createTextNode(e)), this._$AH = e;
  }
  $(e) {
    var s;
    const { values: t, _$litType$: o } = e, i = typeof o == "number" ? this._$AC(e) : (o.el === void 0 && (o.el = Bn.createElement(ci(o.h, o.h[0]), this.options)), o);
    if (((s = this._$AH) == null ? void 0 : s._$AD) === i) this._$AH.p(t);
    else {
      const a = new ns(i, this), d = a.u(this.options);
      a.p(t), this.T(d), this._$AH = a;
    }
  }
  _$AC(e) {
    let t = jo.get(e.strings);
    return t === void 0 && jo.set(e.strings, t = new Bn(e)), t;
  }
  k(e) {
    eo(this._$AH) || (this._$AH = [], this._$AR());
    const t = this._$AH;
    let o, i = 0;
    for (const s of e) i === t.length ? t.push(o = new ui(this.O(Mt()), this.O(Mt()), this, this.options)) : o = t[i], o._$AI(s), i++;
    i < t.length && (this._$AR(o && o._$AB.nextSibling, i), t.length = i);
  }
  _$AR(e = this._$AA.nextSibling, t) {
    var o;
    for ((o = this._$AP) == null ? void 0 : o.call(this, !1, !0, t); e !== this._$AB; ) {
      const i = e.nextSibling;
      e.remove(), e = i;
    }
  }
  setConnected(e) {
    var t;
    this._$AM === void 0 && (this._$Cv = e, (t = this._$AP) == null || t.call(this, e));
  }
}, kn = class {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(e, t, o, i, s) {
    this.type = 1, this._$AH = Te, this._$AN = void 0, this.element = e, this.name = t, this._$AM = i, this.options = s, o.length > 2 || o[0] !== "" || o[1] !== "" ? (this._$AH = Array(o.length - 1).fill(new String()), this.strings = o) : this._$AH = Te;
  }
  _$AI(e, t = this, o, i) {
    const s = this.strings;
    let a = !1;
    if (s === void 0) e = vt(this, e, t, 0), a = !Ht(e) || e !== this._$AH && e !== gt, a && (this._$AH = e);
    else {
      const d = e;
      let c, l;
      for (e = s[0], c = 0; c < s.length - 1; c++) l = vt(this, d[o + c], t, c), l === gt && (l = this._$AH[c]), a || (a = !Ht(l) || l !== this._$AH[c]), l === Te ? e = Te : e !== Te && (e += (l ?? "") + s[c + 1]), this._$AH[c] = l;
    }
    a && !i && this.j(e);
  }
  j(e) {
    e === Te ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
  }
}, os = class extends kn {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(e) {
    this.element[this.name] = e === Te ? void 0 : e;
  }
}, is = class extends kn {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(e) {
    this.element.toggleAttribute(this.name, !!e && e !== Te);
  }
}, ss = class extends kn {
  constructor(e, t, o, i, s) {
    super(e, t, o, i, s), this.type = 5;
  }
  _$AI(e, t = this) {
    if ((e = vt(this, e, t, 0) ?? Te) === gt) return;
    const o = this._$AH, i = e === Te && o !== Te || e.capture !== o.capture || e.once !== o.once || e.passive !== o.passive, s = e !== Te && (o === Te || i);
    i && this.element.removeEventListener(this.name, this, o), s && this.element.addEventListener(this.name, this, e), this._$AH = e;
  }
  handleEvent(e) {
    var t;
    typeof this._$AH == "function" ? this._$AH.call(((t = this.options) == null ? void 0 : t.host) ?? this.element, e) : this._$AH.handleEvent(e);
  }
}, rs = class {
  constructor(e, t, o) {
    this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = o;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(e) {
    vt(this, e);
  }
};
const Dn = Nt.litHtmlPolyfillSupport;
Dn == null || Dn(Bn, to), (Nt.litHtmlVersions ?? (Nt.litHtmlVersions = [])).push("3.3.1");
const as = (n, e, t) => {
  const o = (t == null ? void 0 : t.renderBefore) ?? e;
  let i = o._$litPart$;
  if (i === void 0) {
    const s = (t == null ? void 0 : t.renderBefore) ?? null;
    o._$litPart$ = i = new to(e.insertBefore(Mt(), s), s, void 0, t ?? {});
  }
  return i._$AI(n), i;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ut = globalThis;
let Ut = class extends pt {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    var t;
    const e = super.createRenderRoot();
    return (t = this.renderOptions).renderBefore ?? (t.renderBefore = e.firstChild), e;
  }
  update(e) {
    const t = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = as(t, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    var e;
    super.connectedCallback(), (e = this._$Do) == null || e.setConnected(!0);
  }
  disconnectedCallback() {
    var e;
    super.disconnectedCallback(), (e = this._$Do) == null || e.setConnected(!1);
  }
  render() {
    return gt;
  }
};
var ii;
Ut._$litElement$ = !0, Ut.finalized = !0, (ii = ut.litElementHydrateSupport) == null || ii.call(ut, { LitElement: Ut });
const Ln = ut.litElementPolyfillSupport;
Ln == null || Ln({ LitElement: Ut });
(ut.litElementVersions ?? (ut.litElementVersions = [])).push("4.2.1");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const ls = (n) => (e, t) => {
  t !== void 0 ? t.addInitializer(() => {
    customElements.define(n, e);
  }) : customElements.define(n, e);
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const cs = { attribute: !0, type: String, converter: gn, reflect: !1, hasChanged: Xn }, ds = (n = cs, e, t) => {
  const { kind: o, metadata: i } = t;
  let s = globalThis.litPropertyMetadata.get(i);
  if (s === void 0 && globalThis.litPropertyMetadata.set(i, s = /* @__PURE__ */ new Map()), o === "setter" && ((n = Object.create(n)).wrapped = !0), s.set(t.name, n), o === "accessor") {
    const { name: a } = t;
    return { set(d) {
      const c = e.get.call(this);
      e.set.call(this, d), this.requestUpdate(a, c, n);
    }, init(d) {
      return d !== void 0 && this.C(a, void 0, n, d), d;
    } };
  }
  if (o === "setter") {
    const { name: a } = t;
    return function(d) {
      const c = this[a];
      e.call(this, d), this.requestUpdate(a, c, n);
    };
  }
  throw Error("Unsupported decorator location: " + o);
};
function Be(n) {
  return (e, t) => typeof t == "object" ? ds(n, e, t) : ((o, i, s) => {
    const a = i.hasOwnProperty(s);
    return i.constructor.createProperty(s, o), a ? Object.getOwnPropertyDescriptor(i, s) : void 0;
  })(n, e, t);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function at(n) {
  return Be({ ...n, state: !0, attribute: !1 });
}
/*! For license information please see elements.js.LICENSE.txt */
var us = { 7: function(n, e, t) {
  (function(o, i, s) {
    var a = function() {
      return a = Object.assign || function(x) {
        for (var O, C = 1, S = arguments.length; C < S; C++) for (var P in O = arguments[C]) Object.prototype.hasOwnProperty.call(O, P) && (x[P] = O[P]);
        return x;
      }, a.apply(this, arguments);
    };
    function d(x, O) {
      var C = typeof Symbol == "function" && x[Symbol.iterator];
      if (!C) return x;
      var S, P, $ = C.call(x), N = [];
      try {
        for (; (O === void 0 || O-- > 0) && !(S = $.next()).done; ) N.push(S.value);
      } catch (U) {
        P = { error: U };
      } finally {
        try {
          S && !S.done && (C = $.return) && C.call($);
        } finally {
          if (P) throw P.error;
        }
      }
      return N;
    }
    function c(x, O) {
      return [x, !x || x.endsWith("/") ? "" : "/", O, ".json"].join("");
    }
    function l(x, O) {
      var C = x;
      return O && Object.keys(O).forEach(function(S) {
        var P = O[S], $ = new RegExp("{".concat(S, "}"), "gm");
        C = C.replace($, P.toString());
      }), C;
    }
    function u(x, O, C) {
      var S = x[O];
      if (!S) return C;
      var P = C.split("."), $ = "";
      do {
        var N = S[$ += P.shift()];
        N === void 0 || typeof N != "object" && P.length ? P.length ? $ += "." : S = C : (S = N, $ = "");
      } while (P.length);
      return S;
    }
    var h = {}, g = { root: "", lang: "en", fallbackLang: "en" }, f = i.createContext(null);
    o.TranslateContext = f, o.TranslateProvider = function(x) {
      var O = function(N, U) {
        N = Object.assign({}, g, N), h = U || h;
        var ie = d(s.useState(N.lang), 2), ye = ie[0], se = ie[1], ke = d(s.useState(h), 2), M = ke[0], q = ke[1], ge = d(s.useState(!1), 2), De = ge[0], Ee = ge[1], Le = function(re) {
          if (!M.hasOwnProperty(re)) {
            Ee(!1);
            var ae = c(N.root, re);
            fetch(ae).then(function(he) {
              return he.json();
            }).then(function(he) {
              h[re] = he, q(a({}, h)), Ee(!0);
            }).catch(function(he) {
              console.log("Aww, snap.", he), q(a({}, h)), Ee(!0);
            });
          }
        };
        return s.useEffect(function() {
          Le(N.fallbackLang), Le(ye);
        }, [ye]), { lang: ye, setLang: se, t: function(re, ae) {
          if (!M.hasOwnProperty(ye)) return re;
          var he = u(M, ye, re);
          return he === re && ye !== N.fallbackLang && (he = u(M, N.fallbackLang, re)), l(he, ae);
        }, isReady: De };
      }({ root: x.root || "assets", lang: x.lang || "en", fallbackLang: x.fallbackLang || "en" }, x.translations), C = O.t, S = O.setLang, P = O.lang, $ = O.isReady;
      return i.h(f.Provider, { value: { t: C, setLang: S, lang: P, isReady: $ } }, x.children);
    }, o.format = l, o.getResourceUrl = c, o.getValue = u, Object.defineProperty(o, "__esModule", { value: !0 });
  })(e, t(616), t(78));
}, 633: (n, e) => {
  var t;
  (function() {
    var o = {}.hasOwnProperty;
    function i() {
      for (var s = [], a = 0; a < arguments.length; a++) {
        var d = arguments[a];
        if (d) {
          var c = typeof d;
          if (c === "string" || c === "number") s.push(d);
          else if (Array.isArray(d)) {
            if (d.length) {
              var l = i.apply(null, d);
              l && s.push(l);
            }
          } else if (c === "object") {
            if (d.toString !== Object.prototype.toString && !d.toString.toString().includes("[native code]")) {
              s.push(d.toString());
              continue;
            }
            for (var u in d) o.call(d, u) && d[u] && s.push(u);
          }
        }
      }
      return s.join(" ");
    }
    n.exports ? (i.default = i, n.exports = i) : (t = (function() {
      return i;
    }).apply(e, [])) === void 0 || (n.exports = t);
  })();
}, 21: (n, e, t) => {
  t.d(e, { A: () => d });
  var o = t(645), i = t.n(o), s = t(278), a = t.n(s)()(i());
  a.push([n.id, '.hanko_accordion{font-weight:var(--font-weight, 400);font-size:var(--font-size, 16px);font-family:var(--font-family, sans-serif);line-height:var(--line-height, 1.4rem);width:100%;overflow:hidden}.hanko_accordion .hanko_accordionItem{color:var(--color, #333333);margin:.25rem 0;overflow:hidden}.hanko_accordion .hanko_accordionItem.hanko_dropdown{margin:0}.hanko_accordion .hanko_accordionItem .hanko_label{border-radius:var(--border-radius, 8px);border-style:none;height:var(--item-height, 42px);background:var(--background-color, white);box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:0 1rem;margin:0;cursor:pointer;transition:all .35s}.hanko_accordion .hanko_accordionItem .hanko_label .hanko_labelText{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hanko_accordion .hanko_accordionItem .hanko_label .hanko_labelText .hanko_description{color:var(--color-shade-1, #8f9095)}.hanko_accordion .hanko_accordionItem .hanko_label.hanko_dropdown{margin:0;color:var(--link-color, #506cf0);justify-content:flex-start}.hanko_accordion .hanko_accordionItem .hanko_label:hover{color:var(--brand-contrast-color, white);background:var(--brand-color-shade-1, #6b84fb)}.hanko_accordion .hanko_accordionItem .hanko_label:hover .hanko_description{color:var(--brand-contrast-color, white)}.hanko_accordion .hanko_accordionItem .hanko_label:hover.hanko_dropdown{color:var(--link-color, #506cf0);background:none}.hanko_accordion .hanko_accordionItem .hanko_label:not(.hanko_dropdown)::after{content:"❯";width:1rem;text-align:center;transition:all .35s}.hanko_accordion .hanko_accordionItem .hanko_accordionInput{position:absolute;opacity:0;z-index:-1}.hanko_accordion .hanko_accordionItem .hanko_accordionInput:checked+.hanko_label{color:var(--brand-contrast-color, white);background:var(--brand-color, #506cf0)}.hanko_accordion .hanko_accordionItem .hanko_accordionInput:checked+.hanko_label .hanko_description{color:var(--brand-contrast-color, white)}.hanko_accordion .hanko_accordionItem .hanko_accordionInput:checked+.hanko_label.hanko_dropdown{color:var(--link-color, #506cf0);background:none}.hanko_accordion .hanko_accordionItem .hanko_accordionInput:checked+.hanko_label:not(.hanko_dropdown)::after{transform:rotate(90deg)}.hanko_accordion .hanko_accordionItem .hanko_accordionInput:checked+.hanko_label~.hanko_accordionContent{margin:.25rem 1rem;opacity:1;max-height:100vh}.hanko_accordion .hanko_accordionItem .hanko_accordionContent{max-height:0;margin:0 1rem;opacity:0;overflow:hidden;transition:all .35s}.hanko_accordion .hanko_accordionItem .hanko_accordionContent.hanko_dropdownContent{border-style:none}', ""]), a.locals = { accordion: "hanko_accordion", accordionItem: "hanko_accordionItem", dropdown: "hanko_dropdown", label: "hanko_label", labelText: "hanko_labelText", description: "hanko_description", accordionInput: "hanko_accordionInput", accordionContent: "hanko_accordionContent", dropdownContent: "hanko_dropdownContent" };
  const d = a;
}, 905: (n, e, t) => {
  t.d(e, { A: () => d });
  var o = t(645), i = t.n(o), s = t(278), a = t.n(s)()(i());
  a.push([n.id, ".hanko_errorBox{font-weight:var(--font-weight, 400);font-size:var(--font-size, 16px);font-family:var(--font-family, sans-serif);line-height:var(--line-height, 1.4rem);border-radius:var(--border-radius, 8px);border-style:var(--border-style, solid);border-width:var(--border-width, 1px);color:var(--error-color, #e82020);background:var(--background-color, white);margin:var(--item-margin, 0.5rem 0);display:flex;align-items:start;box-sizing:border-box;line-height:1.5rem;padding:.25em;gap:.2em}.hanko_errorBox>span{display:inline-flex}.hanko_errorBox>span:first-child{padding:.25em 0 .25em .19em}.hanko_errorBox[hidden]{display:none}.hanko_errorMessage{color:var(--error-color, #e82020)}", ""]), a.locals = { errorBox: "hanko_errorBox", errorMessage: "hanko_errorMessage" };
  const d = a;
}, 577: (n, e, t) => {
  t.d(e, { A: () => d });
  var o = t(645), i = t.n(o), s = t(278), a = t.n(s)()(i());
  a.push([n.id, '.hanko_form{display:flex;flex-grow:1}.hanko_form .hanko_ul{flex-grow:1;margin:var(--item-margin, 0.5rem 0);padding-inline-start:0;list-style-type:none;display:flex;flex-wrap:wrap;gap:1em}.hanko_form .hanko_li{display:flex;max-width:100%;flex-grow:1;flex-basis:min-content}.hanko_form .hanko_li.hanko_maxWidth{min-width:100%}.hanko_button{font-weight:var(--font-weight, 400);font-size:var(--font-size, 16px);font-family:var(--font-family, sans-serif);line-height:var(--line-height, 1.4rem);border-radius:var(--border-radius, 8px);border-style:var(--border-style, solid);border-width:var(--border-width, 1px);white-space:nowrap;width:100%;min-width:var(--button-min-width, 7em);min-height:var(--item-height, 42px);outline:none;cursor:pointer;transition:.1s ease-out;flex-grow:1;flex-shrink:1;display:inline-flex}.hanko_button:disabled{cursor:default}.hanko_button.hanko_primary{color:var(--brand-contrast-color, white);background:var(--brand-color, #506cf0);border-color:var(--brand-color, #506cf0);justify-content:center}.hanko_button.hanko_primary:hover{color:var(--brand-contrast-color, white);background:var(--brand-color-shade-1, #6b84fb);border-color:var(--brand-color, #506cf0)}.hanko_button.hanko_primary:focus{color:var(--brand-contrast-color, white);background:var(--brand-color, #506cf0);border-color:var(--color, #333333)}.hanko_button.hanko_primary:disabled{color:var(--color-shade-1, #8f9095);background:var(--color-shade-2, #e5e6ef);border-color:var(--color-shade-2, #e5e6ef)}.hanko_button.hanko_secondary{color:var(--color, #333333);background:var(--background-color, white);border-color:var(--color, #333333);justify-content:flex-start}.hanko_button.hanko_secondary:hover{color:var(--color, #333333);background:var(--color-shade-2, #e5e6ef);border-color:var(--color, #333333)}.hanko_button.hanko_secondary:focus{color:var(--color, #333333);background:var(--background-color, white);border-color:var(--brand-color, #506cf0)}.hanko_button.hanko_secondary:disabled{color:var(--color-shade-1, #8f9095);background:var(--color-shade-2, #e5e6ef);border-color:var(--color-shade-1, #8f9095)}.hanko_button.hanko_dangerous{color:var(--error-color, #e82020);background:var(--background-color, white);border-color:var(--error-color, #e82020);flex-grow:0;width:auto}.hanko_caption{flex-grow:1;flex-wrap:wrap;display:flex;justify-content:space-between;align-items:baseline}.hanko_lastUsed{color:var(--color-shade-1, #8f9095);font-size:smaller}.hanko_inputWrapper{flex-grow:1;position:relative;display:flex;min-width:var(--input-min-width, 14em);max-width:100%}.hanko_input{font-weight:var(--font-weight, 400);font-size:var(--font-size, 16px);font-family:var(--font-family, sans-serif);line-height:var(--line-height, 1.4rem);border-radius:var(--border-radius, 8px);border-style:var(--border-style, solid);border-width:var(--border-width, 1px);height:var(--item-height, 42px);color:var(--color, #333333);border-color:var(--color-shade-1, #8f9095);background:var(--background-color, white);padding:0 .5rem;outline:none;width:100%;box-sizing:border-box;transition:.1s ease-out}.hanko_input.hanko_error{border-color:var(--error-color, #e82020)}.hanko_input:-webkit-autofill,.hanko_input:-webkit-autofill:hover,.hanko_input:-webkit-autofill:focus{-webkit-text-fill-color:var(--color, #333333);-webkit-box-shadow:0 0 0 50px var(--background-color, white) inset}.hanko_input::-ms-reveal,.hanko_input::-ms-clear{display:none}.hanko_input::placeholder{color:var(--color-shade-1, #8f9095)}.hanko_input:focus{color:var(--color, #333333);border-color:var(--color, #333333)}.hanko_input:disabled{color:var(--color-shade-1, #8f9095);background:var(--color-shade-2, #e5e6ef);border-color:var(--color-shade-1, #8f9095)}.hanko_passcodeInputWrapper{flex-grow:1;min-width:var(--input-min-width, 14em);max-width:fit-content;position:relative;display:flex;justify-content:space-between}.hanko_passcodeInputWrapper .hanko_passcodeDigitWrapper{flex-grow:1;margin:0 .5rem 0 0}.hanko_passcodeInputWrapper .hanko_passcodeDigitWrapper:last-child{margin:0}.hanko_passcodeInputWrapper .hanko_passcodeDigitWrapper .hanko_input{text-align:center}.hanko_checkboxWrapper{font-weight:var(--font-weight, 400);font-size:var(--font-size, 16px);font-family:var(--font-family, sans-serif);line-height:var(--line-height, 1.4rem);color:var(--color, #333333);align-items:center;display:flex}.hanko_checkboxWrapper .hanko_label{color:inherit;padding-left:.5rem;cursor:pointer}.hanko_checkboxWrapper .hanko_label.hanko_disabled{cursor:default;color:var(--color-shade-1, #8f9095)}.hanko_checkboxWrapper .hanko_checkbox{border:currentColor solid 1px;border-radius:.15em;appearance:none;-webkit-appearance:none;width:1.1rem;height:1.1rem;margin:0;color:currentColor;background-color:var(--background-color, white);font:inherit;box-shadow:none;display:inline-flex;place-content:center;cursor:pointer}.hanko_checkboxWrapper .hanko_checkbox:checked{background-color:var(--color, #333333)}.hanko_checkboxWrapper .hanko_checkbox:disabled{cursor:default;background-color:var(--color-shade-2, #e5e6ef);border-color:var(--color-shade-1, #8f9095)}.hanko_checkboxWrapper .hanko_checkbox:checked:after{content:"✓";color:var(--background-color, white);position:absolute;line-height:1.1rem}.hanko_checkboxWrapper .hanko_checkbox:disabled:after{color:var(--color-shade-1, #8f9095)}', ""]), a.locals = { form: "hanko_form", ul: "hanko_ul", li: "hanko_li", maxWidth: "hanko_maxWidth", button: "hanko_button", primary: "hanko_primary", secondary: "hanko_secondary", dangerous: "hanko_dangerous", caption: "hanko_caption", lastUsed: "hanko_lastUsed", inputWrapper: "hanko_inputWrapper", input: "hanko_input", error: "hanko_error", passcodeInputWrapper: "hanko_passcodeInputWrapper", passcodeDigitWrapper: "hanko_passcodeDigitWrapper", checkboxWrapper: "hanko_checkboxWrapper", label: "hanko_label", disabled: "hanko_disabled", checkbox: "hanko_checkbox" };
  const d = a;
}, 619: (n, e, t) => {
  t.d(e, { A: () => d });
  var o = t(645), i = t.n(o), s = t(278), a = t.n(s)()(i());
  a.push([n.id, ".hanko_headline{color:var(--color, #333333);font-family:var(--font-family, sans-serif);text-align:left;letter-spacing:0;font-style:normal;line-height:1.1}.hanko_headline.hanko_grade1{font-size:var(--headline1-font-size, 24px);font-weight:var(--headline1-font-weight, 600);margin:var(--headline1-margin, 0 0 0.5rem)}.hanko_headline.hanko_grade2{font-size:var(--headline2-font-size, 16px);font-weight:var(--headline2-font-weight, 600);margin:var(--headline2-margin, 1rem 0 0.5rem)}", ""]), a.locals = { headline: "hanko_headline", grade1: "hanko_grade1", grade2: "hanko_grade2" };
  const d = a;
}, 697: (n, e, t) => {
  t.d(e, { A: () => d });
  var o = t(645), i = t.n(o), s = t(278), a = t.n(s)()(i());
  a.push([n.id, ".hanko_icon,.hanko_loadingSpinnerWrapper .hanko_loadingSpinner,.hanko_loadingSpinnerWrapperIcon .hanko_loadingSpinner,.hanko_exclamationMark,.hanko_checkmark{display:inline-block;fill:var(--brand-contrast-color, white);width:18px}.hanko_icon.hanko_secondary,.hanko_loadingSpinnerWrapper .hanko_secondary.hanko_loadingSpinner,.hanko_loadingSpinnerWrapperIcon .hanko_secondary.hanko_loadingSpinner,.hanko_secondary.hanko_exclamationMark,.hanko_secondary.hanko_checkmark{fill:var(--color, #333333)}.hanko_icon.hanko_disabled,.hanko_loadingSpinnerWrapper .hanko_disabled.hanko_loadingSpinner,.hanko_loadingSpinnerWrapperIcon .hanko_disabled.hanko_loadingSpinner,.hanko_disabled.hanko_exclamationMark,.hanko_disabled.hanko_checkmark{fill:var(--color-shade-1, #8f9095)}.hanko_checkmark{fill:var(--brand-color, #506cf0)}.hanko_checkmark.hanko_secondary{fill:var(--color-shade-1, #8f9095)}.hanko_checkmark.hanko_fadeOut{animation:hanko_fadeOut ease-out 1.5s forwards !important}@keyframes hanko_fadeOut{0%{opacity:1}100%{opacity:0}}.hanko_exclamationMark{fill:var(--error-color, #e82020)}.hanko_loadingSpinnerWrapperIcon{width:100%;column-gap:10px;margin-left:10px}.hanko_loadingSpinnerWrapper,.hanko_loadingSpinnerWrapperIcon{display:inline-flex;align-items:center;height:100%;margin:0 5px;justify-content:inherit;flex-wrap:inherit}.hanko_loadingSpinnerWrapper.hanko_centerContent,.hanko_centerContent.hanko_loadingSpinnerWrapperIcon{justify-content:center}.hanko_loadingSpinnerWrapper.hanko_maxWidth,.hanko_maxWidth.hanko_loadingSpinnerWrapperIcon{width:100%}.hanko_loadingSpinnerWrapper .hanko_loadingSpinner,.hanko_loadingSpinnerWrapperIcon .hanko_loadingSpinner{fill:var(--brand-color, #506cf0);animation:hanko_spin 500ms ease-in-out infinite}.hanko_loadingSpinnerWrapper.hanko_secondary,.hanko_secondary.hanko_loadingSpinnerWrapperIcon{fill:var(--color-shade-1, #8f9095)}@keyframes hanko_spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}.hanko_googleIcon.hanko_disabled{fill:var(--color-shade-1, #8f9095)}.hanko_googleIcon.hanko_blue{fill:#4285f4}.hanko_googleIcon.hanko_green{fill:#34a853}.hanko_googleIcon.hanko_yellow{fill:#fbbc05}.hanko_googleIcon.hanko_red{fill:#ea4335}.hanko_microsoftIcon.hanko_disabled{fill:var(--color-shade-1, #8f9095)}.hanko_microsoftIcon.hanko_blue{fill:#00a4ef}.hanko_microsoftIcon.hanko_green{fill:#7fba00}.hanko_microsoftIcon.hanko_yellow{fill:#ffb900}.hanko_microsoftIcon.hanko_red{fill:#f25022}.hanko_facebookIcon.hanko_outline{fill:#0866ff}.hanko_facebookIcon.hanko_disabledOutline{fill:var(--color-shade-1, #8f9095)}.hanko_facebookIcon.hanko_letter{fill:#fff}.hanko_facebookIcon.hanko_disabledLetter{fill:var(--color-shade-2, #e5e6ef)}", ""]), a.locals = { icon: "hanko_icon", loadingSpinnerWrapper: "hanko_loadingSpinnerWrapper", loadingSpinner: "hanko_loadingSpinner", loadingSpinnerWrapperIcon: "hanko_loadingSpinnerWrapperIcon", exclamationMark: "hanko_exclamationMark", checkmark: "hanko_checkmark", secondary: "hanko_secondary", disabled: "hanko_disabled", fadeOut: "hanko_fadeOut", centerContent: "hanko_centerContent", maxWidth: "hanko_maxWidth", spin: "hanko_spin", googleIcon: "hanko_googleIcon", blue: "hanko_blue", green: "hanko_green", yellow: "hanko_yellow", red: "hanko_red", microsoftIcon: "hanko_microsoftIcon", facebookIcon: "hanko_facebookIcon", outline: "hanko_outline", disabledOutline: "hanko_disabledOutline", letter: "hanko_letter", disabledLetter: "hanko_disabledLetter" };
  const d = a;
}, 995: (n, e, t) => {
  t.d(e, { A: () => d });
  var o = t(645), i = t.n(o), s = t(278), a = t.n(s)()(i());
  a.push([n.id, ".hanko_link{font-weight:var(--font-weight, 400);font-size:var(--font-size, 16px);font-family:var(--font-family, sans-serif);line-height:var(--line-height, 1.4rem);color:var(--link-color, #506cf0);text-decoration:var(--link-text-decoration, none);cursor:pointer;background:none !important;border:none;padding:0 !important;transition:all .1s}.hanko_link:hover{text-decoration:var(--link-text-decoration-hover, underline)}.hanko_link:disabled{color:var(--color, #333333) !important;pointer-events:none;cursor:default}.hanko_link.hanko_danger{color:var(--error-color, #e82020)}.hanko_linkWrapper{display:inline-flex;flex-direction:row;justify-content:space-between;align-items:center;overflow:hidden}.hanko_linkWrapper.hanko_reverse{flex-direction:row-reverse}", ""]), a.locals = { link: "hanko_link", danger: "hanko_danger", linkWrapper: "hanko_linkWrapper", reverse: "hanko_reverse" };
  const d = a;
}, 560: (n, e, t) => {
  t.d(e, { A: () => d });
  var o = t(645), i = t.n(o), s = t(278), a = t.n(s)()(i());
  a.push([n.id, ".hanko_otpCreationDetails{font-weight:var(--font-weight, 400);font-size:var(--font-size, 16px);font-family:var(--font-family, sans-serif);line-height:var(--line-height, 1.4rem);color:var(--color, #333333);margin:var(--item-margin, 0.5rem 0);display:flex;justify-content:center;align-items:center;flex-direction:column;font-size:smaller}", ""]), a.locals = { otpCreationDetails: "hanko_otpCreationDetails" };
  const d = a;
}, 489: (n, e, t) => {
  t.d(e, { A: () => d });
  var o = t(645), i = t.n(o), s = t(278), a = t.n(s)()(i());
  a.push([n.id, ".hanko_paragraph{font-weight:var(--font-weight, 400);font-size:var(--font-size, 16px);font-family:var(--font-family, sans-serif);line-height:var(--line-height, 1.4rem);color:var(--color, #333333);margin:var(--item-margin, 0.5rem 0);text-align:left;word-break:break-word}", ""]), a.locals = { paragraph: "hanko_paragraph" };
  const d = a;
}, 111: (n, e, t) => {
  t.d(e, { A: () => d });
  var o = t(645), i = t.n(o), s = t(278), a = t.n(s)()(i());
  a.push([n.id, ".hanko_spacer{height:1em}.hanko_divider{font-weight:var(--font-weight, 400);font-size:var(--font-size, 16px);font-family:var(--font-family, sans-serif);line-height:var(--line-height, 1.4rem);display:flex;visibility:var(--divider-visibility, visible);color:var(--color-shade-1, #8f9095);margin:var(--item-margin, 0.5rem 0);padding:.5em 0}.hanko_divider .hanko_line{border-bottom-style:var(--border-style, solid);border-bottom-width:var(--border-width, 1px);color:inherit;font:inherit;width:100%}.hanko_divider .hanko_text{font:inherit;color:inherit;background:var(--background-color, white);padding:var(--divider-padding, 0 42px);line-height:.1em}", ""]), a.locals = { spacer: "hanko_spacer", divider: "hanko_divider", line: "hanko_line", text: "hanko_text" };
  const d = a;
}, 914: (n, e, t) => {
  t.d(e, { A: () => d });
  var o = t(645), i = t.n(o), s = t(278), a = t.n(s)()(i());
  a.push([n.id, ".hanko_container{background-color:var(--background-color, white);padding:var(--container-padding, 30px);max-width:var(--container-max-width, 410px);display:flex;flex-direction:column;flex-wrap:nowrap;justify-content:center;align-items:center;align-content:flex-start;box-sizing:border-box}.hanko_content{box-sizing:border-box;flex:0 1 auto;width:100%;height:100%}.hanko_footer{padding:.5rem 0 0;box-sizing:border-box;width:100%}.hanko_footer :nth-child(1){float:left}.hanko_footer :nth-child(2){float:right}.hanko_clipboardContainer{display:flex}.hanko_clipboardIcon{display:flex;margin:auto;cursor:pointer}", ""]), a.locals = { container: "hanko_container", content: "hanko_content", footer: "hanko_footer", clipboardContainer: "hanko_clipboardContainer", clipboardIcon: "hanko_clipboardIcon" };
  const d = a;
}, 278: (n) => {
  n.exports = function(e) {
    var t = [];
    return t.toString = function() {
      return this.map(function(o) {
        var i = "", s = o[5] !== void 0;
        return o[4] && (i += "@supports (".concat(o[4], ") {")), o[2] && (i += "@media ".concat(o[2], " {")), s && (i += "@layer".concat(o[5].length > 0 ? " ".concat(o[5]) : "", " {")), i += e(o), s && (i += "}"), o[2] && (i += "}"), o[4] && (i += "}"), i;
      }).join("");
    }, t.i = function(o, i, s, a, d) {
      typeof o == "string" && (o = [[null, o, void 0]]);
      var c = {};
      if (s) for (var l = 0; l < this.length; l++) {
        var u = this[l][0];
        u != null && (c[u] = !0);
      }
      for (var h = 0; h < o.length; h++) {
        var g = [].concat(o[h]);
        s && c[g[0]] || (d !== void 0 && (g[5] === void 0 || (g[1] = "@layer".concat(g[5].length > 0 ? " ".concat(g[5]) : "", " {").concat(g[1], "}")), g[5] = d), i && (g[2] && (g[1] = "@media ".concat(g[2], " {").concat(g[1], "}")), g[2] = i), a && (g[4] ? (g[1] = "@supports (".concat(g[4], ") {").concat(g[1], "}"), g[4] = a) : g[4] = "".concat(a)), t.push(g));
      }
    }, t;
  };
}, 645: (n) => {
  n.exports = function(e) {
    return e[1];
  };
}, 616: (n, e, t) => {
  t.r(e), t.d(e, { Component: () => U, Fragment: () => N, cloneElement: () => qe, createContext: () => ze, createElement: () => S, createRef: () => $, h: () => S, hydrate: () => We, isValidElement: () => a, options: () => i, render: () => pe, toChildArray: () => ge });
  var o, i, s, a, d, c, l, u, h, g = {}, f = [], x = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
  function O(m, v) {
    for (var b in v) m[b] = v[b];
    return m;
  }
  function C(m) {
    var v = m.parentNode;
    v && v.removeChild(m);
  }
  function S(m, v, b) {
    var j, T, I, W = {};
    for (I in v) I == "key" ? j = v[I] : I == "ref" ? T = v[I] : W[I] = v[I];
    if (arguments.length > 2 && (W.children = arguments.length > 3 ? o.call(arguments, 2) : b), typeof m == "function" && m.defaultProps != null) for (I in m.defaultProps) W[I] === void 0 && (W[I] = m.defaultProps[I]);
    return P(m, W, j, T, null);
  }
  function P(m, v, b, j, T) {
    var I = { type: m, props: v, key: b, ref: j, __k: null, __: null, __b: 0, __e: null, __d: void 0, __c: null, __h: null, constructor: void 0, __v: T ?? ++s };
    return T == null && i.vnode != null && i.vnode(I), I;
  }
  function $() {
    return { current: null };
  }
  function N(m) {
    return m.children;
  }
  function U(m, v) {
    this.props = m, this.context = v;
  }
  function ie(m, v) {
    if (v == null) return m.__ ? ie(m.__, m.__.__k.indexOf(m) + 1) : null;
    for (var b; v < m.__k.length; v++) if ((b = m.__k[v]) != null && b.__e != null) return b.__e;
    return typeof m.type == "function" ? ie(m) : null;
  }
  function ye(m) {
    var v, b;
    if ((m = m.__) != null && m.__c != null) {
      for (m.__e = m.__c.base = null, v = 0; v < m.__k.length; v++) if ((b = m.__k[v]) != null && b.__e != null) {
        m.__e = m.__c.base = b.__e;
        break;
      }
      return ye(m);
    }
  }
  function se(m) {
    (!m.__d && (m.__d = !0) && d.push(m) && !ke.__r++ || c !== i.debounceRendering) && ((c = i.debounceRendering) || l)(ke);
  }
  function ke() {
    var m, v, b, j, T, I, W, X;
    for (d.sort(u); m = d.shift(); ) m.__d && (v = d.length, j = void 0, T = void 0, W = (I = (b = m).__v).__e, (X = b.__P) && (j = [], (T = O({}, I)).__v = I.__v + 1, Ie(X, I, T, b.__n, X.ownerSVGElement !== void 0, I.__h != null ? [W] : null, j, W ?? ie(I), I.__h), k(j, I), I.__e != W && ye(I)), d.length > v && d.sort(u));
    ke.__r = 0;
  }
  function M(m, v, b, j, T, I, W, X, G, ve) {
    var w, be, J, H, E, we, B, F = j && j.__k || f, Me = F.length;
    for (b.__k = [], w = 0; w < v.length; w++) if ((H = b.__k[w] = (H = v[w]) == null || typeof H == "boolean" || typeof H == "function" ? null : typeof H == "string" || typeof H == "number" || typeof H == "bigint" ? P(null, H, null, null, H) : Array.isArray(H) ? P(N, { children: H }, null, null, null) : H.__b > 0 ? P(H.type, H.props, H.key, H.ref ? H.ref : null, H.__v) : H) != null) {
      if (H.__ = b, H.__b = b.__b + 1, (J = F[w]) === null || J && H.key == J.key && H.type === J.type) F[w] = void 0;
      else for (be = 0; be < Me; be++) {
        if ((J = F[be]) && H.key == J.key && H.type === J.type) {
          F[be] = void 0;
          break;
        }
        J = null;
      }
      Ie(m, H, J = J || g, T, I, W, X, G, ve), E = H.__e, (be = H.ref) && J.ref != be && (B || (B = []), J.ref && B.push(J.ref, null, H), B.push(be, H.__c || E, H)), E != null ? (we == null && (we = E), typeof H.type == "function" && H.__k === J.__k ? H.__d = G = q(H, G, m) : G = De(m, H, J, F, E, G), typeof b.type == "function" && (b.__d = G)) : G && J.__e == G && G.parentNode != m && (G = ie(J));
    }
    for (b.__e = we, w = Me; w--; ) F[w] != null && (typeof b.type == "function" && F[w].__e != null && F[w].__e == b.__d && (b.__d = Ee(j).nextSibling), L(F[w], F[w]));
    if (B) for (w = 0; w < B.length; w++) y(B[w], B[++w], B[++w]);
  }
  function q(m, v, b) {
    for (var j, T = m.__k, I = 0; T && I < T.length; I++) (j = T[I]) && (j.__ = m, v = typeof j.type == "function" ? q(j, v, b) : De(b, j, j, T, j.__e, v));
    return v;
  }
  function ge(m, v) {
    return v = v || [], m == null || typeof m == "boolean" || (Array.isArray(m) ? m.some(function(b) {
      ge(b, v);
    }) : v.push(m)), v;
  }
  function De(m, v, b, j, T, I) {
    var W, X, G;
    if (v.__d !== void 0) W = v.__d, v.__d = void 0;
    else if (b == null || T != I || T.parentNode == null) e: if (I == null || I.parentNode !== m) m.appendChild(T), W = null;
    else {
      for (X = I, G = 0; (X = X.nextSibling) && G < j.length; G += 1) if (X == T) break e;
      m.insertBefore(T, I), W = I;
    }
    return W !== void 0 ? W : T.nextSibling;
  }
  function Ee(m) {
    var v, b, j;
    if (m.type == null || typeof m.type == "string") return m.__e;
    if (m.__k) {
      for (v = m.__k.length - 1; v >= 0; v--) if ((b = m.__k[v]) && (j = Ee(b))) return j;
    }
    return null;
  }
  function Le(m, v, b) {
    v[0] === "-" ? m.setProperty(v, b ?? "") : m[v] = b == null ? "" : typeof b != "number" || x.test(v) ? b : b + "px";
  }
  function re(m, v, b, j, T) {
    var I;
    e: if (v === "style") if (typeof b == "string") m.style.cssText = b;
    else {
      if (typeof j == "string" && (m.style.cssText = j = ""), j) for (v in j) b && v in b || Le(m.style, v, "");
      if (b) for (v in b) j && b[v] === j[v] || Le(m.style, v, b[v]);
    }
    else if (v[0] === "o" && v[1] === "n") I = v !== (v = v.replace(/Capture$/, "")), v = v.toLowerCase() in m ? v.toLowerCase().slice(2) : v.slice(2), m.l || (m.l = {}), m.l[v + I] = b, b ? j || m.addEventListener(v, I ? he : ae, I) : m.removeEventListener(v, I ? he : ae, I);
    else if (v !== "dangerouslySetInnerHTML") {
      if (T) v = v.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
      else if (v !== "width" && v !== "height" && v !== "href" && v !== "list" && v !== "form" && v !== "tabIndex" && v !== "download" && v in m) try {
        m[v] = b ?? "";
        break e;
      } catch {
      }
      typeof b == "function" || (b == null || b === !1 && v.indexOf("-") == -1 ? m.removeAttribute(v) : m.setAttribute(v, b));
    }
  }
  function ae(m) {
    return this.l[m.type + !1](i.event ? i.event(m) : m);
  }
  function he(m) {
    return this.l[m.type + !0](i.event ? i.event(m) : m);
  }
  function Ie(m, v, b, j, T, I, W, X, G) {
    var ve, w, be, J, H, E, we, B, F, Me, ot, fe, Kt, it, R, V = v.type;
    if (v.constructor !== void 0) return null;
    b.__h != null && (G = b.__h, X = v.__e = b.__e, v.__h = null, I = [X]), (ve = i.__b) && ve(v);
    try {
      e: if (typeof V == "function") {
        if (B = v.props, F = (ve = V.contextType) && j[ve.__c], Me = ve ? F ? F.props.value : ve.__ : j, b.__c ? we = (w = v.__c = b.__c).__ = w.__E : ("prototype" in V && V.prototype.render ? v.__c = w = new V(B, Me) : (v.__c = w = new U(B, Me), w.constructor = V, w.render = K), F && F.sub(w), w.props = B, w.state || (w.state = {}), w.context = Me, w.__n = j, be = w.__d = !0, w.__h = [], w._sb = []), w.__s == null && (w.__s = w.state), V.getDerivedStateFromProps != null && (w.__s == w.state && (w.__s = O({}, w.__s)), O(w.__s, V.getDerivedStateFromProps(B, w.__s))), J = w.props, H = w.state, w.__v = v, be) V.getDerivedStateFromProps == null && w.componentWillMount != null && w.componentWillMount(), w.componentDidMount != null && w.__h.push(w.componentDidMount);
        else {
          if (V.getDerivedStateFromProps == null && B !== J && w.componentWillReceiveProps != null && w.componentWillReceiveProps(B, Me), !w.__e && w.shouldComponentUpdate != null && w.shouldComponentUpdate(B, w.__s, Me) === !1 || v.__v === b.__v) {
            for (v.__v !== b.__v && (w.props = B, w.state = w.__s, w.__d = !1), w.__e = !1, v.__e = b.__e, v.__k = b.__k, v.__k.forEach(function(Qe) {
              Qe && (Qe.__ = v);
            }), ot = 0; ot < w._sb.length; ot++) w.__h.push(w._sb[ot]);
            w._sb = [], w.__h.length && W.push(w);
            break e;
          }
          w.componentWillUpdate != null && w.componentWillUpdate(B, w.__s, Me), w.componentDidUpdate != null && w.__h.push(function() {
            w.componentDidUpdate(J, H, E);
          });
        }
        if (w.context = Me, w.props = B, w.__P = m, fe = i.__r, Kt = 0, "prototype" in V && V.prototype.render) {
          for (w.state = w.__s, w.__d = !1, fe && fe(v), ve = w.render(w.props, w.state, w.context), it = 0; it < w._sb.length; it++) w.__h.push(w._sb[it]);
          w._sb = [];
        } else do
          w.__d = !1, fe && fe(v), ve = w.render(w.props, w.state, w.context), w.state = w.__s;
        while (w.__d && ++Kt < 25);
        w.state = w.__s, w.getChildContext != null && (j = O(O({}, j), w.getChildContext())), be || w.getSnapshotBeforeUpdate == null || (E = w.getSnapshotBeforeUpdate(J, H)), R = ve != null && ve.type === N && ve.key == null ? ve.props.children : ve, M(m, Array.isArray(R) ? R : [R], v, b, j, T, I, W, X, G), w.base = v.__e, v.__h = null, w.__h.length && W.push(w), we && (w.__E = w.__ = null), w.__e = !1;
      } else I == null && v.__v === b.__v ? (v.__k = b.__k, v.__e = b.__e) : v.__e = p(b.__e, v, b, j, T, I, W, G);
      (ve = i.diffed) && ve(v);
    } catch (Qe) {
      v.__v = null, (G || I != null) && (v.__e = X, v.__h = !!G, I[I.indexOf(X)] = null), i.__e(Qe, v, b);
    }
  }
  function k(m, v) {
    i.__c && i.__c(v, m), m.some(function(b) {
      try {
        m = b.__h, b.__h = [], m.some(function(j) {
          j.call(b);
        });
      } catch (j) {
        i.__e(j, b.__v);
      }
    });
  }
  function p(m, v, b, j, T, I, W, X) {
    var G, ve, w, be = b.props, J = v.props, H = v.type, E = 0;
    if (H === "svg" && (T = !0), I != null) {
      for (; E < I.length; E++) if ((G = I[E]) && "setAttribute" in G == !!H && (H ? G.localName === H : G.nodeType === 3)) {
        m = G, I[E] = null;
        break;
      }
    }
    if (m == null) {
      if (H === null) return document.createTextNode(J);
      m = T ? document.createElementNS("http://www.w3.org/2000/svg", H) : document.createElement(H, J.is && J), I = null, X = !1;
    }
    if (H === null) be === J || X && m.data === J || (m.data = J);
    else {
      if (I = I && o.call(m.childNodes), ve = (be = b.props || g).dangerouslySetInnerHTML, w = J.dangerouslySetInnerHTML, !X) {
        if (I != null) for (be = {}, E = 0; E < m.attributes.length; E++) be[m.attributes[E].name] = m.attributes[E].value;
        (w || ve) && (w && (ve && w.__html == ve.__html || w.__html === m.innerHTML) || (m.innerHTML = w && w.__html || ""));
      }
      if (function(we, B, F, Me, ot) {
        var fe;
        for (fe in F) fe === "children" || fe === "key" || fe in B || re(we, fe, null, F[fe], Me);
        for (fe in B) ot && typeof B[fe] != "function" || fe === "children" || fe === "key" || fe === "value" || fe === "checked" || F[fe] === B[fe] || re(we, fe, B[fe], F[fe], Me);
      }(m, J, be, T, X), w) v.__k = [];
      else if (E = v.props.children, M(m, Array.isArray(E) ? E : [E], v, b, j, T && H !== "foreignObject", I, W, I ? I[0] : b.__k && ie(b, 0), X), I != null) for (E = I.length; E--; ) I[E] != null && C(I[E]);
      X || ("value" in J && (E = J.value) !== void 0 && (E !== m.value || H === "progress" && !E || H === "option" && E !== be.value) && re(m, "value", E, be.value, !1), "checked" in J && (E = J.checked) !== void 0 && E !== m.checked && re(m, "checked", E, be.checked, !1));
    }
    return m;
  }
  function y(m, v, b) {
    try {
      typeof m == "function" ? m(v) : m.current = v;
    } catch (j) {
      i.__e(j, b);
    }
  }
  function L(m, v, b) {
    var j, T;
    if (i.unmount && i.unmount(m), (j = m.ref) && (j.current && j.current !== m.__e || y(j, null, v)), (j = m.__c) != null) {
      if (j.componentWillUnmount) try {
        j.componentWillUnmount();
      } catch (I) {
        i.__e(I, v);
      }
      j.base = j.__P = null, m.__c = void 0;
    }
    if (j = m.__k) for (T = 0; T < j.length; T++) j[T] && L(j[T], v, b || typeof m.type != "function");
    b || m.__e == null || C(m.__e), m.__ = m.__e = m.__d = void 0;
  }
  function K(m, v, b) {
    return this.constructor(m, b);
  }
  function pe(m, v, b) {
    var j, T, I;
    i.__ && i.__(m, v), T = (j = typeof b == "function") ? null : b && b.__k || v.__k, I = [], Ie(v, m = (!j && b || v).__k = S(N, null, [m]), T || g, g, v.ownerSVGElement !== void 0, !j && b ? [b] : T ? null : v.firstChild ? o.call(v.childNodes) : null, I, !j && b ? b : T ? T.__e : v.firstChild, j), k(I, m);
  }
  function We(m, v) {
    pe(m, v, We);
  }
  function qe(m, v, b) {
    var j, T, I, W = O({}, m.props);
    for (I in v) I == "key" ? j = v[I] : I == "ref" ? T = v[I] : W[I] = v[I];
    return arguments.length > 2 && (W.children = arguments.length > 3 ? o.call(arguments, 2) : b), P(m.type, W, j || m.key, T || m.ref, null);
  }
  function ze(m, v) {
    var b = { __c: v = "__cC" + h++, __: m, Consumer: function(j, T) {
      return j.children(T);
    }, Provider: function(j) {
      var T, I;
      return this.getChildContext || (T = [], (I = {})[v] = this, this.getChildContext = function() {
        return I;
      }, this.shouldComponentUpdate = function(W) {
        this.props.value !== W.value && T.some(function(X) {
          X.__e = !0, se(X);
        });
      }, this.sub = function(W) {
        T.push(W);
        var X = W.componentWillUnmount;
        W.componentWillUnmount = function() {
          T.splice(T.indexOf(W), 1), X && X.call(W);
        };
      }), j.children;
    } };
    return b.Provider.__ = b.Consumer.contextType = b;
  }
  o = f.slice, i = { __e: function(m, v, b, j) {
    for (var T, I, W; v = v.__; ) if ((T = v.__c) && !T.__) try {
      if ((I = T.constructor) && I.getDerivedStateFromError != null && (T.setState(I.getDerivedStateFromError(m)), W = T.__d), T.componentDidCatch != null && (T.componentDidCatch(m, j || {}), W = T.__d), W) return T.__E = T;
    } catch (X) {
      m = X;
    }
    throw m;
  } }, s = 0, a = function(m) {
    return m != null && m.constructor === void 0;
  }, U.prototype.setState = function(m, v) {
    var b;
    b = this.__s != null && this.__s !== this.state ? this.__s : this.__s = O({}, this.state), typeof m == "function" && (m = m(O({}, b), this.props)), m && O(b, m), m != null && this.__v && (v && this._sb.push(v), se(this));
  }, U.prototype.forceUpdate = function(m) {
    this.__v && (this.__e = !0, m && this.__h.push(m), se(this));
  }, U.prototype.render = N, d = [], l = typeof Promise == "function" ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, u = function(m, v) {
    return m.__v.__b - v.__v.__b;
  }, ke.__r = 0, h = 0;
}, 78: (n, e, t) => {
  t.r(e), t.d(e, { useCallback: () => se, useContext: () => ke, useDebugValue: () => M, useEffect: () => $, useErrorBoundary: () => q, useId: () => ge, useImperativeHandle: () => ie, useLayoutEffect: () => N, useMemo: () => ye, useReducer: () => P, useRef: () => U, useState: () => S });
  var o, i, s, a, d = t(616), c = 0, l = [], u = [], h = d.options.__b, g = d.options.__r, f = d.options.diffed, x = d.options.__c, O = d.options.unmount;
  function C(k, p) {
    d.options.__h && d.options.__h(i, k, c || p), c = 0;
    var y = i.__H || (i.__H = { __: [], __h: [] });
    return k >= y.__.length && y.__.push({ __V: u }), y.__[k];
  }
  function S(k) {
    return c = 1, P(Ie, k);
  }
  function P(k, p, y) {
    var L = C(o++, 2);
    if (L.t = k, !L.__c && (L.__ = [y ? y(p) : Ie(void 0, p), function(qe) {
      var ze = L.__N ? L.__N[0] : L.__[0], m = L.t(ze, qe);
      ze !== m && (L.__N = [m, L.__[1]], L.__c.setState({}));
    }], L.__c = i, !i.u)) {
      var K = function(qe, ze, m) {
        if (!L.__c.__H) return !0;
        var v = L.__c.__H.__.filter(function(j) {
          return j.__c;
        });
        if (v.every(function(j) {
          return !j.__N;
        })) return !pe || pe.call(this, qe, ze, m);
        var b = !1;
        return v.forEach(function(j) {
          if (j.__N) {
            var T = j.__[0];
            j.__ = j.__N, j.__N = void 0, T !== j.__[0] && (b = !0);
          }
        }), !(!b && L.__c.props === qe) && (!pe || pe.call(this, qe, ze, m));
      };
      i.u = !0;
      var pe = i.shouldComponentUpdate, We = i.componentWillUpdate;
      i.componentWillUpdate = function(qe, ze, m) {
        if (this.__e) {
          var v = pe;
          pe = void 0, K(qe, ze, m), pe = v;
        }
        We && We.call(this, qe, ze, m);
      }, i.shouldComponentUpdate = K;
    }
    return L.__N || L.__;
  }
  function $(k, p) {
    var y = C(o++, 3);
    !d.options.__s && he(y.__H, p) && (y.__ = k, y.i = p, i.__H.__h.push(y));
  }
  function N(k, p) {
    var y = C(o++, 4);
    !d.options.__s && he(y.__H, p) && (y.__ = k, y.i = p, i.__h.push(y));
  }
  function U(k) {
    return c = 5, ye(function() {
      return { current: k };
    }, []);
  }
  function ie(k, p, y) {
    c = 6, N(function() {
      return typeof k == "function" ? (k(p()), function() {
        return k(null);
      }) : k ? (k.current = p(), function() {
        return k.current = null;
      }) : void 0;
    }, y == null ? y : y.concat(k));
  }
  function ye(k, p) {
    var y = C(o++, 7);
    return he(y.__H, p) ? (y.__V = k(), y.i = p, y.__h = k, y.__V) : y.__;
  }
  function se(k, p) {
    return c = 8, ye(function() {
      return k;
    }, p);
  }
  function ke(k) {
    var p = i.context[k.__c], y = C(o++, 9);
    return y.c = k, p ? (y.__ == null && (y.__ = !0, p.sub(i)), p.props.value) : k.__;
  }
  function M(k, p) {
    d.options.useDebugValue && d.options.useDebugValue(p ? p(k) : k);
  }
  function q(k) {
    var p = C(o++, 10), y = S();
    return p.__ = k, i.componentDidCatch || (i.componentDidCatch = function(L, K) {
      p.__ && p.__(L, K), y[1](L);
    }), [y[0], function() {
      y[1](void 0);
    }];
  }
  function ge() {
    var k = C(o++, 11);
    if (!k.__) {
      for (var p = i.__v; p !== null && !p.__m && p.__ !== null; ) p = p.__;
      var y = p.__m || (p.__m = [0, 0]);
      k.__ = "P" + y[0] + "-" + y[1]++;
    }
    return k.__;
  }
  function De() {
    for (var k; k = l.shift(); ) if (k.__P && k.__H) try {
      k.__H.__h.forEach(re), k.__H.__h.forEach(ae), k.__H.__h = [];
    } catch (p) {
      k.__H.__h = [], d.options.__e(p, k.__v);
    }
  }
  d.options.__b = function(k) {
    i = null, h && h(k);
  }, d.options.__r = function(k) {
    g && g(k), o = 0;
    var p = (i = k.__c).__H;
    p && (s === i ? (p.__h = [], i.__h = [], p.__.forEach(function(y) {
      y.__N && (y.__ = y.__N), y.__V = u, y.__N = y.i = void 0;
    })) : (p.__h.forEach(re), p.__h.forEach(ae), p.__h = [])), s = i;
  }, d.options.diffed = function(k) {
    f && f(k);
    var p = k.__c;
    p && p.__H && (p.__H.__h.length && (l.push(p) !== 1 && a === d.options.requestAnimationFrame || ((a = d.options.requestAnimationFrame) || Le)(De)), p.__H.__.forEach(function(y) {
      y.i && (y.__H = y.i), y.__V !== u && (y.__ = y.__V), y.i = void 0, y.__V = u;
    })), s = i = null;
  }, d.options.__c = function(k, p) {
    p.some(function(y) {
      try {
        y.__h.forEach(re), y.__h = y.__h.filter(function(L) {
          return !L.__ || ae(L);
        });
      } catch (L) {
        p.some(function(K) {
          K.__h && (K.__h = []);
        }), p = [], d.options.__e(L, y.__v);
      }
    }), x && x(k, p);
  }, d.options.unmount = function(k) {
    O && O(k);
    var p, y = k.__c;
    y && y.__H && (y.__H.__.forEach(function(L) {
      try {
        re(L);
      } catch (K) {
        p = K;
      }
    }), y.__H = void 0, p && d.options.__e(p, y.__v));
  };
  var Ee = typeof requestAnimationFrame == "function";
  function Le(k) {
    var p, y = function() {
      clearTimeout(L), Ee && cancelAnimationFrame(p), setTimeout(k);
    }, L = setTimeout(y, 100);
    Ee && (p = requestAnimationFrame(y));
  }
  function re(k) {
    var p = i, y = k.__c;
    typeof y == "function" && (k.__c = void 0, y()), i = p;
  }
  function ae(k) {
    var p = i;
    k.__c = k.__(), i = p;
  }
  function he(k, p) {
    return !k || k.length !== p.length || p.some(function(y, L) {
      return y !== k[L];
    });
  }
  function Ie(k, p) {
    return typeof p == "function" ? p(k) : p;
  }
}, 292: (n) => {
  var e = [];
  function t(s) {
    for (var a = -1, d = 0; d < e.length; d++) if (e[d].identifier === s) {
      a = d;
      break;
    }
    return a;
  }
  function o(s, a) {
    for (var d = {}, c = [], l = 0; l < s.length; l++) {
      var u = s[l], h = a.base ? u[0] + a.base : u[0], g = d[h] || 0, f = "".concat(h, " ").concat(g);
      d[h] = g + 1;
      var x = t(f), O = { css: u[1], media: u[2], sourceMap: u[3], supports: u[4], layer: u[5] };
      if (x !== -1) e[x].references++, e[x].updater(O);
      else {
        var C = i(O, a);
        a.byIndex = l, e.splice(l, 0, { identifier: f, updater: C, references: 1 });
      }
      c.push(f);
    }
    return c;
  }
  function i(s, a) {
    var d = a.domAPI(a);
    return d.update(s), function(c) {
      if (c) {
        if (c.css === s.css && c.media === s.media && c.sourceMap === s.sourceMap && c.supports === s.supports && c.layer === s.layer) return;
        d.update(s = c);
      } else d.remove();
    };
  }
  n.exports = function(s, a) {
    var d = o(s = s || [], a = a || {});
    return function(c) {
      c = c || [];
      for (var l = 0; l < d.length; l++) {
        var u = t(d[l]);
        e[u].references--;
      }
      for (var h = o(c, a), g = 0; g < d.length; g++) {
        var f = t(d[g]);
        e[f].references === 0 && (e[f].updater(), e.splice(f, 1));
      }
      d = h;
    };
  };
}, 88: (n) => {
  n.exports = function(e) {
    var t = document.createElement("style");
    return e.setAttributes(t, e.attributes), e.insert(t, e.options), t;
  };
}, 884: (n, e, t) => {
  n.exports = function(o) {
    var i = t.nc;
    i && o.setAttribute("nonce", i);
  };
}, 360: (n) => {
  var e, t = (e = [], function(s, a) {
    return e[s] = a, e.filter(Boolean).join(`
`);
  });
  function o(s, a, d, c) {
    var l;
    if (d) l = "";
    else {
      l = "", c.supports && (l += "@supports (".concat(c.supports, ") {")), c.media && (l += "@media ".concat(c.media, " {"));
      var u = c.layer !== void 0;
      u && (l += "@layer".concat(c.layer.length > 0 ? " ".concat(c.layer) : "", " {")), l += c.css, u && (l += "}"), c.media && (l += "}"), c.supports && (l += "}");
    }
    if (s.styleSheet) s.styleSheet.cssText = t(a, l);
    else {
      var h = document.createTextNode(l), g = s.childNodes;
      g[a] && s.removeChild(g[a]), g.length ? s.insertBefore(h, g[a]) : s.appendChild(h);
    }
  }
  var i = { singleton: null, singletonCounter: 0 };
  n.exports = function(s) {
    if (typeof document > "u") return { update: function() {
    }, remove: function() {
    } };
    var a = i.singletonCounter++, d = i.singleton || (i.singleton = s.insertStyleElement(s));
    return { update: function(c) {
      o(d, a, !1, c);
    }, remove: function(c) {
      o(d, a, !0, c);
    } };
  };
}, 6: (n, e, t) => {
  t.d(e, { en: () => o });
  const o = { headlines: { error: "An error has occurred", loginEmail: "Sign in or create account", loginEmailNoSignup: "Sign in", loginFinished: "Login successful", loginPasscode: "Enter passcode", loginPassword: "Enter password", registerAuthenticator: "Create a passkey", registerConfirm: "Create account?", registerPassword: "Set new password", otpSetUp: "Set up authenticator app", profileEmails: "Emails", profilePassword: "Password", profilePasskeys: "Passkeys", isPrimaryEmail: "Primary email address", setPrimaryEmail: "Set primary email address", createEmail: "Enter a new email", createUsername: "Enter a new username", emailVerified: "Verified", emailUnverified: "Unverified", emailDelete: "Delete", renamePasskey: "Rename passkey", deletePasskey: "Delete passkey", lastUsedAt: "Last used at", createdAt: "Created at", connectedAccounts: "Connected accounts", deleteAccount: "Delete account", accountNotFound: "Account not found", signIn: "Sign in", signUp: "Create account", selectLoginMethod: "Select login method", setupLoginMethod: "Set up login method", lastUsed: "Last seen", ipAddress: "IP address", revokeSession: "Revoke session", profileSessions: "Sessions", mfaSetUp: "Set up MFA", securityKeySetUp: "Add security key", securityKeyLogin: "Security key", otpLogin: "Authentication code", renameSecurityKey: "Rename security key", deleteSecurityKey: "Delete security key", securityKeys: "Security keys", authenticatorApp: "Authenticator app", authenticatorAppAlreadySetUp: "Authenticator app is set up", authenticatorAppNotSetUp: "Set up authenticator app", trustDevice: "Trust this browser?" }, texts: { enterPasscode: 'Enter the passcode that was sent to "{emailAddress}".', enterPasscodeNoEmail: "Enter the passcode that was sent to your primary email address.", setupPasskey: "Sign in to your account easily and securely with a passkey. Note: Your biometric data is only stored on your devices and will never be shared with anyone.", createAccount: 'No account exists for "{emailAddress}". Do you want to create a new account?', otpEnterVerificationCode: "Enter the one-time password (OTP) obtained from your authenticator app below:", otpScanQRCode: "Scan the QR code using your authenticator app (such as Google Authenticator or any other TOTP app). Alternatively, you can manually enter the OTP secret key into the app.", otpSecretKey: "OTP secret key", passwordFormatHint: "Must be between {minLength} and {maxLength} characters long.", securityKeySetUp: "Use a dedicated security key via USB, Bluetooth, or NFC, or your mobile phone. Connect or activate your security key, then click the button below and follow the prompts to complete the registration.", setPrimaryEmail: "Set this email address to be used for contacting you.", isPrimaryEmail: "This email address will be used to contact you if necessary.", emailVerified: "This email address has been verified.", emailUnverified: "This email address has not been verified.", emailDelete: "If you delete this email address, it can no longer be used to sign in.", renamePasskey: "Set a name for the passkey.", deletePasskey: "Delete this passkey from your account.", deleteAccount: "Are you sure you want to delete this account? All data will be deleted immediately and cannot be recovered.", noAccountExists: 'No account exists for "{emailAddress}".', selectLoginMethodForFutureLogins: "Select one of the following login methods to use for future logins.", howDoYouWantToLogin: "How do you want to login?", mfaSetUp: "Protect your account with Multi-Factor Authentication (MFA). MFA adds an additional step to your login process, ensuring that even if your password or email account is compromised, your account stays secure.", securityKeyLogin: "Connect or activate your security key, then click the button below. Once ready, use it via USB, NFC, your mobile phone. Follow the prompts to complete the login process.", otpLogin: "Open your authenticator app to obtain the one-time password (OTP). Enter the code in the field below to complete your login.", renameSecurityKey: "Set a name for the security key.", deleteSecurityKey: "Delete this security key from your account.", authenticatorAppAlreadySetUp: "Your account is secured with an authenticator app that generates time-based one-time passwords (TOTP) for multi-factor authentication.", authenticatorAppNotSetUp: "Secure your account with an authenticator app that generates time-based one-time passwords (TOTP) for multi-factor authentication.", trustDevice: "If you trust this browser, you won’t need to enter your OTP (One-Time-Password) or use your security key for multi-factor authentication (MFA) the next time you log in." }, labels: { or: "or", no: "no", yes: "yes", email: "Email", continue: "Continue", copied: "copied", skip: "Skip", save: "Save", password: "Password", passkey: "Passkey", passcode: "Passcode", signInPassword: "Sign in with a password", signInPasscode: "Sign in with a passcode", forgotYourPassword: "Forgot your password?", back: "Back", signInPasskey: "Sign in with a passkey", registerAuthenticator: "Create a passkey", signIn: "Sign in", signUp: "Create account", sendNewPasscode: "Send new code", passwordRetryAfter: "Retry in {passwordRetryAfter}", passcodeResendAfter: "Request a new code in {passcodeResendAfter}", unverifiedEmail: "unverified", primaryEmail: "primary", setAsPrimaryEmail: "Set as primary", verify: "Verify", delete: "Delete", newEmailAddress: "New email address", newPassword: "New password", rename: "Rename", newPasskeyName: "New passkey name", addEmail: "Add email", createPasskey: "Create a passkey", webauthnUnsupported: "Passkeys are not supported by your browser", signInWith: "Sign in with {provider}", deleteAccount: "Yes, delete this account.", emailOrUsername: "Email or username", username: "Username", optional: "optional", dontHaveAnAccount: "Don't have an account?", alreadyHaveAnAccount: "Already have an account?", changeUsername: "Change username", setUsername: "Set username", changePassword: "Change password", setPassword: "Set password", revoke: "Revoke", currentSession: "Current session", authenticatorApp: "Authenticator app", securityKey: "Security key", securityKeyUse: "Use security key", newSecurityKeyName: "New security key name", createSecurityKey: "Add a security key", authenticatorAppManage: "Manage authenticator app", authenticatorAppAdd: "Set up", configured: "configured", useAnotherMethod: "Use another method", lastUsed: "Last used", trustDevice: "Trust this browser", staySignedIn: "Stay signed in" }, errors: { somethingWentWrong: "A technical error has occurred. Please try again later.", requestTimeout: "The request timed out.", invalidPassword: "Wrong email or password.", invalidPasscode: "The passcode provided was not correct.", passcodeAttemptsReached: "The passcode was entered incorrectly too many times. Please request a new code.", tooManyRequests: "Too many requests have been made. Please wait to repeat the requested operation.", unauthorized: "Your session has expired. Please log in again.", invalidWebauthnCredential: "This passkey cannot be used anymore.", passcodeExpired: "The passcode has expired. Please request a new one.", userVerification: "User verification required. Please ensure your authenticator device is protected with a PIN or biometric.", emailAddressAlreadyExistsError: "The email address already exists.", maxNumOfEmailAddressesReached: "No further email addresses can be added.", thirdPartyAccessDenied: "Access denied. The request was cancelled by the user or the provider has denied access for other reasons.", thirdPartyMultipleAccounts: "Cannot identify account. The email address is used by multiple accounts.", thirdPartyUnverifiedEmail: "Email verification required. Please verify the used email address with your provider.", signupDisabled: "Account registration is disabled.", handlerNotFoundError: "The current step in your process is not supported by this application version. Please try again later or contact support if the issue persists." }, flowErrors: { technical_error: "A technical error has occurred. Please try again later.", flow_expired_error: "The session has expired, please click the button to restart.", value_invalid_error: "The entered value is invalid.", passcode_invalid: "The passcode provided was not correct.", passkey_invalid: "This passkey cannot be used anymore", passcode_max_attempts_reached: "The passcode was entered incorrectly too many times. Please request a new code.", rate_limit_exceeded: "Too many requests have been made. Please wait to repeat the requested operation.", unknown_username_error: "The username is unknown.", unknown_email_error: "The email address is unknown.", username_already_exists: "The username is already taken.", invalid_username_error: "The username must contain only letters, numbers, and underscores.", email_already_exists: "The email is already taken.", not_found: "The requested resource was not found.", operation_not_permitted_error: "The operation is not permitted.", flow_discontinuity_error: "The process cannot be continued due to user settings or the provider's configuration.", form_data_invalid_error: "The submitted form data contains errors.", unauthorized: "Your session has expired. Please log in again.", value_missing_error: "The value is missing.", value_too_long_error: "Value is too long.", value_too_short_error: "The value is too short.", webauthn_credential_invalid_mfa_only: "This credential can be used as a second factor security key only.", webauthn_credential_already_exists: "The request either timed out, was canceled or the device is already registered. Please try again or try using another device.", platform_authenticator_required: "Your account is configured to use platform authenticators, but your current device or browser does not support this feature. Please try again with a compatible device or browser." } };
} }, $o = {};
function Y(n) {
  var e = $o[n];
  if (e !== void 0) return e.exports;
  var t = $o[n] = { id: n, exports: {} };
  return us[n].call(t.exports, t, t.exports, Y), t.exports;
}
Y.n = (n) => {
  var e = n && n.__esModule ? () => n.default : () => n;
  return Y.d(e, { a: e }), e;
}, Y.d = (n, e) => {
  for (var t in e) Y.o(e, t) && !Y.o(n, t) && Object.defineProperty(n, t, { enumerable: !0, get: e[t] });
}, Y.o = (n, e) => Object.prototype.hasOwnProperty.call(n, e), Y.r = (n) => {
  typeof Symbol < "u" && Symbol.toStringTag && Object.defineProperty(n, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(n, "__esModule", { value: !0 });
}, Y.nc = void 0;
var oe = {};
Y.d(oe, { fK: () => wn, tJ: () => xi, Z7: () => An, Q9: () => Pi, Lv: () => Ai, qQ: () => xn, I4: () => $i, O8: () => xe, ku: () => io, ls: () => oo, bO: () => so, yv: () => Cn, AT: () => ao, m_: () => qt, KG: () => ro, DH: () => Sn, kf: () => mo, oY: () => $e, xg: () => Ei, Wg: () => Je, J: () => Ii, AC: () => lo, D_: () => Ye, jx: () => Oi, nX: () => co, Nx: () => no, Sd: () => mt, kz: () => oa, fX: () => uo, qA: () => ho, tz: () => fo, gN: () => po });
var Vn = {};
Y.r(Vn), Y.d(Vn, { apple: () => tr, checkmark: () => nr, copy: () => or, customProvider: () => ir, discord: () => sr, exclamation: () => rr, facebook: () => ar, github: () => lr, google: () => cr, linkedin: () => dr, mail: () => ur, microsoft: () => hr, passkey: () => pr, password: () => fr, qrCodeScanner: () => mr, securityKey: () => gr, spinner: () => vr });
var A = Y(616), hs = 0;
function r(n, e, t, o, i, s) {
  var a, d, c = {};
  for (d in e) d == "ref" ? a = e[d] : c[d] = e[d];
  var l = { type: n, props: c, key: t, ref: a, __k: null, __: null, __b: 0, __e: null, __d: void 0, __c: null, __h: null, constructor: void 0, __v: --hs, __source: i, __self: s };
  if (typeof n == "function" && (a = n.defaultProps)) for (d in a) c[d] === void 0 && (c[d] = a[d]);
  return A.options.vnode && A.options.vnode(l), l;
}
function _n() {
  return _n = Object.assign ? Object.assign.bind() : function(n) {
    for (var e = 1; e < arguments.length; e++) {
      var t = arguments[e];
      for (var o in t) Object.prototype.hasOwnProperty.call(t, o) && (n[o] = t[o]);
    }
    return n;
  }, _n.apply(this, arguments);
}
var ps = ["context", "children"];
function fs(n) {
  this.getChildContext = function() {
    return n.context;
  };
  var e = n.children, t = function(o, i) {
    if (o == null) return {};
    var s, a, d = {}, c = Object.keys(o);
    for (a = 0; a < c.length; a++) i.indexOf(s = c[a]) >= 0 || (d[s] = o[s]);
    return d;
  }(n, ps);
  return (0, A.cloneElement)(e, t);
}
function ms() {
  var n = new CustomEvent("_preact", { detail: {}, bubbles: !0, cancelable: !0 });
  this.dispatchEvent(n), this._vdom = (0, A.h)(fs, _n({}, this._props, { context: n.detail.context }), pi(this, this._vdomComponent)), (this.hasAttribute("hydrate") ? A.hydrate : A.render)(this._vdom, this._root);
}
function hi(n) {
  return n.replace(/-(\w)/g, function(e, t) {
    return t ? t.toUpperCase() : "";
  });
}
function gs(n, e, t) {
  if (this._vdom) {
    var o = {};
    o[n] = t = t ?? void 0, o[hi(n)] = t, this._vdom = (0, A.cloneElement)(this._vdom, o), (0, A.render)(this._vdom, this._root);
  }
}
function vs() {
  (0, A.render)(this._vdom = null, this._root);
}
function Do(n, e) {
  var t = this;
  return (0, A.h)("slot", _n({}, n, { ref: function(o) {
    o ? (t.ref = o, t._listener || (t._listener = function(i) {
      i.stopPropagation(), i.detail.context = e;
    }, o.addEventListener("_preact", t._listener))) : t.ref.removeEventListener("_preact", t._listener);
  } }));
}
function pi(n, e) {
  if (n.nodeType === 3) return n.data;
  if (n.nodeType !== 1) return null;
  var t = [], o = {}, i = 0, s = n.attributes, a = n.childNodes;
  for (i = s.length; i--; ) s[i].name !== "slot" && (o[s[i].name] = s[i].value, o[hi(s[i].name)] = s[i].value);
  for (i = a.length; i--; ) {
    var d = pi(a[i], null), c = a[i].slot;
    c ? o[c] = (0, A.h)(Do, { name: c }, d) : t[i] = d;
  }
  var l = e ? (0, A.h)(Do, null, t) : t;
  return (0, A.h)(e || n.nodeName.toLowerCase(), o, l);
}
var Z = Y(7), _ = Y(78);
function fi(n, e) {
  for (var t in e) n[t] = e[t];
  return n;
}
function Lo(n, e) {
  for (var t in n) if (t !== "__source" && !(t in e)) return !0;
  for (var o in e) if (o !== "__source" && n[o] !== e[o]) return !0;
  return !1;
}
function To(n) {
  this.props = n;
}
(To.prototype = new A.Component()).isPureReactComponent = !0, To.prototype.shouldComponentUpdate = function(n, e) {
  return Lo(this.props, n) || Lo(this.state, e);
};
var No = A.options.__b;
A.options.__b = function(n) {
  n.type && n.type.__f && n.ref && (n.props.ref = n.ref, n.ref = null), No && No(n);
};
var _s = typeof Symbol < "u" && Symbol.for && Symbol.for("react.forward_ref") || 3911, ys = (A.toChildArray, A.options.__e);
A.options.__e = function(n, e, t, o) {
  if (n.then) {
    for (var i, s = e; s = s.__; ) if ((i = s.__c) && i.__c) return e.__e == null && (e.__e = t.__e, e.__k = t.__k), i.__c(n, e);
  }
  ys(n, e, t, o);
};
var Uo = A.options.unmount;
function mi(n, e, t) {
  return n && (n.__c && n.__c.__H && (n.__c.__H.__.forEach(function(o) {
    typeof o.__c == "function" && o.__c();
  }), n.__c.__H = null), (n = fi({}, n)).__c != null && (n.__c.__P === t && (n.__c.__P = e), n.__c = null), n.__k = n.__k && n.__k.map(function(o) {
    return mi(o, e, t);
  })), n;
}
function gi(n, e, t) {
  return n && (n.__v = null, n.__k = n.__k && n.__k.map(function(o) {
    return gi(o, e, t);
  }), n.__c && n.__c.__P === e && (n.__e && t.insertBefore(n.__e, n.__d), n.__c.__e = !0, n.__c.__P = t)), n;
}
function Tn() {
  this.__u = 0, this.t = null, this.__b = null;
}
function vi(n) {
  var e = n.__.__c;
  return e && e.__a && e.__a(n);
}
function Bt() {
  this.u = null, this.o = null;
}
A.options.unmount = function(n) {
  var e = n.__c;
  e && e.__R && e.__R(), e && n.__h === !0 && (n.type = null), Uo && Uo(n);
}, (Tn.prototype = new A.Component()).__c = function(n, e) {
  var t = e.__c, o = this;
  o.t == null && (o.t = []), o.t.push(t);
  var i = vi(o.__v), s = !1, a = function() {
    s || (s = !0, t.__R = null, i ? i(d) : d());
  };
  t.__R = a;
  var d = function() {
    if (!--o.__u) {
      if (o.state.__a) {
        var l = o.state.__a;
        o.__v.__k[0] = gi(l, l.__c.__P, l.__c.__O);
      }
      var u;
      for (o.setState({ __a: o.__b = null }); u = o.t.pop(); ) u.forceUpdate();
    }
  }, c = e.__h === !0;
  o.__u++ || c || o.setState({ __a: o.__b = o.__v.__k[0] }), n.then(a, a);
}, Tn.prototype.componentWillUnmount = function() {
  this.t = [];
}, Tn.prototype.render = function(n, e) {
  if (this.__b) {
    if (this.__v.__k) {
      var t = document.createElement("div"), o = this.__v.__k[0].__c;
      this.__v.__k[0] = mi(this.__b, t, o.__O = o.__P);
    }
    this.__b = null;
  }
  var i = e.__a && (0, A.createElement)(A.Fragment, null, n.fallback);
  return i && (i.__h = null), [(0, A.createElement)(A.Fragment, null, e.__a ? null : n.children), i];
};
var Mo = function(n, e, t) {
  if (++t[1] === t[0] && n.o.delete(e), n.props.revealOrder && (n.props.revealOrder[0] !== "t" || !n.o.size)) for (t = n.u; t; ) {
    for (; t.length > 3; ) t.pop()();
    if (t[1] < t[0]) break;
    n.u = t = t[2];
  }
};
(Bt.prototype = new A.Component()).__a = function(n) {
  var e = this, t = vi(e.__v), o = e.o.get(n);
  return o[0]++, function(i) {
    var s = function() {
      e.props.revealOrder ? (o.push(i), Mo(e, n, o)) : i();
    };
    t ? t(s) : s();
  };
}, Bt.prototype.render = function(n) {
  this.u = null, this.o = /* @__PURE__ */ new Map();
  var e = (0, A.toChildArray)(n.children);
  n.revealOrder && n.revealOrder[0] === "b" && e.reverse();
  for (var t = e.length; t--; ) this.o.set(e[t], this.u = [1, 0, this.u]);
  return n.children;
}, Bt.prototype.componentDidUpdate = Bt.prototype.componentDidMount = function() {
  var n = this;
  this.o.forEach(function(e, t) {
    Mo(n, t, e);
  });
};
var bs = typeof Symbol < "u" && Symbol.for && Symbol.for("react.element") || 60103, ks = /^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/, ws = /^on(Ani|Tra|Tou|BeforeInp|Compo)/, Ss = /[A-Z0-9]/g, xs = typeof document < "u", Cs = function(n) {
  return (typeof Symbol < "u" && typeof Symbol() == "symbol" ? /fil|che|rad/ : /fil|che|ra/).test(n);
};
A.Component.prototype.isReactComponent = {}, ["componentWillMount", "componentWillReceiveProps", "componentWillUpdate"].forEach(function(n) {
  Object.defineProperty(A.Component.prototype, n, { configurable: !0, get: function() {
    return this["UNSAFE_" + n];
  }, set: function(e) {
    Object.defineProperty(this, n, { configurable: !0, writable: !0, value: e });
  } });
});
var Ho = A.options.event;
function As() {
}
function Os() {
  return this.cancelBubble;
}
function Ps() {
  return this.defaultPrevented;
}
A.options.event = function(n) {
  return Ho && (n = Ho(n)), n.persist = As, n.isPropagationStopped = Os, n.isDefaultPrevented = Ps, n.nativeEvent = n;
};
var Ro = { configurable: !0, get: function() {
  return this.class;
} }, Wo = A.options.vnode;
A.options.vnode = function(n) {
  var e = n.type, t = n.props, o = t;
  if (typeof e == "string") {
    for (var i in o = {}, t) {
      var s = t[i];
      if (!(i === "value" && "defaultValue" in t && s == null || xs && i === "children" && e === "noscript")) {
        var a = i.toLowerCase();
        i === "defaultValue" && "value" in t && t.value == null ? i = "value" : i === "download" && s === !0 ? s = "" : a === "ondoubleclick" ? i = "ondblclick" : a !== "onchange" || e !== "input" && e !== "textarea" || Cs(t.type) ? a === "onfocus" ? i = "onfocusin" : a === "onblur" ? i = "onfocusout" : ws.test(i) ? i = a : e.indexOf("-") === -1 && ks.test(i) ? i = i.replace(Ss, "-$&").toLowerCase() : s === null && (s = void 0) : a = i = "oninput", a === "oninput" && o[i = a] && (i = "oninputCapture"), o[i] = s;
      }
    }
    e == "select" && o.multiple && Array.isArray(o.value) && (o.value = (0, A.toChildArray)(t.children).forEach(function(d) {
      d.props.selected = o.value.indexOf(d.props.value) != -1;
    })), e == "select" && o.defaultValue != null && (o.value = (0, A.toChildArray)(t.children).forEach(function(d) {
      d.props.selected = o.multiple ? o.defaultValue.indexOf(d.props.value) != -1 : o.defaultValue == d.props.value;
    })), n.props = o, t.class != t.className && (Ro.enumerable = "className" in t, t.className != null && (o.class = t.className), Object.defineProperty(o, "className", Ro));
  }
  n.$$typeof = bs, Wo && Wo(n);
};
var qo = A.options.__r;
A.options.__r = function(n) {
  qo && qo(n), n.__c;
};
var zo = A.options.diffed;
function _i(n) {
  const e = "==".slice(0, (4 - n.length % 4) % 4), t = n.replace(/-/g, "+").replace(/_/g, "/") + e, o = atob(t), i = new ArrayBuffer(o.length), s = new Uint8Array(i);
  for (let a = 0; a < o.length; a++) s[a] = o.charCodeAt(a);
  return i;
}
function yi(n) {
  const e = new Uint8Array(n);
  let t = "";
  for (const o of e) t += String.fromCharCode(o);
  return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
A.options.diffed = function(n) {
  zo && zo(n);
  var e = n.props, t = n.__e;
  t != null && n.type === "textarea" && "value" in e && e.value !== t.value && (t.value = e.value == null ? "" : e.value);
}, A.Fragment, _.useLayoutEffect, _.useState, _.useId, _.useReducer, _.useEffect, _.useLayoutEffect, _.useRef, _.useImperativeHandle, _.useMemo, _.useCallback, _.useContext, _.useDebugValue, A.createElement, A.createContext, A.createRef, A.Fragment, A.Component;
var le = "copy", Ve = "convert";
function _t(n, e, t) {
  if (e === le) return t;
  if (e === Ve) return n(t);
  if (e instanceof Array) return t.map((o) => _t(n, e[0], o));
  if (e instanceof Object) {
    const o = {};
    for (const [i, s] of Object.entries(e)) {
      if (s.derive) {
        const a = s.derive(t);
        a !== void 0 && (t[i] = a);
      }
      if (i in t) t[i] != null ? o[i] = _t(n, s.schema, t[i]) : o[i] = null;
      else if (s.required) throw new Error(`Missing key: ${i}`);
    }
    return o;
  }
}
function Zn(n, e) {
  return { required: !0, schema: n, derive: e };
}
function me(n) {
  return { required: !0, schema: n };
}
function Se(n) {
  return { required: !1, schema: n };
}
var bi = { type: me(le), id: me(Ve), transports: Se(le) }, ki = { appid: Se(le), appidExclude: Se(le), credProps: Se(le) }, wi = { appid: Se(le), appidExclude: Se(le), credProps: Se(le) }, Es = { publicKey: me({ rp: me(le), user: me({ id: me(Ve), name: me(le), displayName: me(le) }), challenge: me(Ve), pubKeyCredParams: me(le), timeout: Se(le), excludeCredentials: Se([bi]), authenticatorSelection: Se(le), attestation: Se(le), extensions: Se(ki) }), signal: Se(le) }, Is = { type: me(le), id: me(le), rawId: me(Ve), authenticatorAttachment: Se(le), response: me({ clientDataJSON: me(Ve), attestationObject: me(Ve), transports: Zn(le, (n) => {
  var e;
  return ((e = n.getTransports) == null ? void 0 : e.call(n)) || [];
}) }), clientExtensionResults: Zn(wi, (n) => n.getClientExtensionResults()) }, js = { mediation: Se(le), publicKey: me({ challenge: me(Ve), timeout: Se(le), rpId: Se(le), allowCredentials: Se([bi]), userVerification: Se(le), extensions: Se(ki) }), signal: Se(le) }, $s = { type: me(le), id: me(le), rawId: me(Ve), authenticatorAttachment: Se(le), response: me({ clientDataJSON: me(Ve), authenticatorData: me(Ve), signature: me(Ve), userHandle: me(Ve) }), clientExtensionResults: Zn(wi, (n) => n.getClientExtensionResults()) };
async function Fo(n) {
  const e = await navigator.credentials.create(function(t) {
    return _t(_i, Es, t);
  }(n));
  return function(t) {
    return _t(yi, Is, t);
  }(e);
}
async function Ko(n) {
  const e = await navigator.credentials.get(function(t) {
    return _t(_i, js, t);
  }(n));
  return function(t) {
    return _t(yi, $s, t);
  }(e);
}
function yn() {
  return yn = Object.assign ? Object.assign.bind() : function(n) {
    for (var e = 1; e < arguments.length; e++) {
      var t = arguments[e];
      for (var o in t) Object.prototype.hasOwnProperty.call(t, o) && (n[o] = t[o]);
    }
    return n;
  }, yn.apply(this, arguments);
}
var Ds = 0;
function Si(n) {
  return "__private_" + Ds++ + "_" + n;
}
function Nn(n, e) {
  if (!Object.prototype.hasOwnProperty.call(n, e)) throw new TypeError("attempted to use private field on non-instance");
  return n;
}
class xe extends Error {
  constructor(e, t, o) {
    super(e), this.code = void 0, this.cause = void 0, this.code = t, this.cause = o, Object.setPrototypeOf(this, xe.prototype);
  }
}
class $e extends xe {
  constructor(e) {
    super("Technical error", "somethingWentWrong", e), Object.setPrototypeOf(this, $e.prototype);
  }
}
class wn extends xe {
  constructor(e, t) {
    super("Conflict error", "conflict", t), Object.setPrototypeOf(this, wn.prototype);
  }
}
class Sn extends xe {
  constructor(e) {
    super("Request timed out error", "requestTimeout", e), Object.setPrototypeOf(this, Sn.prototype);
  }
}
class no extends xe {
  constructor(e) {
    super("Request cancelled error", "requestCancelled", e), Object.setPrototypeOf(this, no.prototype);
  }
}
class oo extends xe {
  constructor(e) {
    super("Invalid password error", "invalidPassword", e), Object.setPrototypeOf(this, oo.prototype);
  }
}
class io extends xe {
  constructor(e) {
    super("Invalid Passcode error", "invalidPasscode", e), Object.setPrototypeOf(this, io.prototype);
  }
}
class so extends xe {
  constructor(e) {
    super("Invalid WebAuthn credential error", "invalidWebauthnCredential", e), Object.setPrototypeOf(this, so.prototype);
  }
}
class ro extends xe {
  constructor(e) {
    super("Passcode expired error", "passcodeExpired", e), Object.setPrototypeOf(this, ro.prototype);
  }
}
class ao extends xe {
  constructor(e) {
    super("Maximum number of Passcode attempts reached error", "passcodeAttemptsReached", e), Object.setPrototypeOf(this, ao.prototype);
  }
}
class qt extends xe {
  constructor(e) {
    super("Not found error", "notFound", e), Object.setPrototypeOf(this, qt.prototype);
  }
}
class lo extends xe {
  constructor(e, t) {
    super("Too many requests error", "tooManyRequests", t), this.retryAfter = void 0, this.retryAfter = e, Object.setPrototypeOf(this, lo.prototype);
  }
}
class Ye extends xe {
  constructor(e) {
    super("Unauthorized error", "unauthorized", e), Object.setPrototypeOf(this, Ye.prototype);
  }
}
class xn extends xe {
  constructor(e) {
    super("Forbidden error", "forbidden", e), Object.setPrototypeOf(this, xn.prototype);
  }
}
class co extends xe {
  constructor(e) {
    super("User verification error", "userVerification", e), Object.setPrototypeOf(this, co.prototype);
  }
}
class Cn extends xe {
  constructor(e) {
    super("Maximum number of email addresses reached error", "maxNumOfEmailAddressesReached", e), Object.setPrototypeOf(this, Cn.prototype);
  }
}
class An extends xe {
  constructor(e) {
    super("The email address already exists", "emailAddressAlreadyExistsError", e), Object.setPrototypeOf(this, An.prototype);
  }
}
class Je extends xe {
  constructor(e, t) {
    super("An error occurred during third party sign up/sign in", e, t), Object.setPrototypeOf(this, Je.prototype);
  }
}
const uo = "hanko-session-created", ho = "hanko-session-expired", po = "hanko-user-logged-out", fo = "hanko-user-deleted";
class xi extends CustomEvent {
  constructor(e, t) {
    super(e, { detail: t });
  }
}
class Ci {
  constructor() {
    this._dispatchEvent = document.dispatchEvent.bind(document);
  }
  dispatch(e, t) {
    this._dispatchEvent(new xi(e, t));
  }
  dispatchSessionCreatedEvent(e) {
    this.dispatch(uo, e);
  }
  dispatchSessionExpiredEvent() {
    this.dispatch(ho, null);
  }
  dispatchUserLoggedOutEvent() {
    this.dispatch(po, null);
  }
  dispatchUserDeletedEvent() {
    this.dispatch(fo, null);
  }
}
function Vt(n) {
  for (var e = 1; e < arguments.length; e++) {
    var t = arguments[e];
    for (var o in t) n[o] = t[o];
  }
  return n;
}
var Un = function n(e, t) {
  function o(i, s, a) {
    if (typeof document < "u") {
      typeof (a = Vt({}, t, a)).expires == "number" && (a.expires = new Date(Date.now() + 864e5 * a.expires)), a.expires && (a.expires = a.expires.toUTCString()), i = encodeURIComponent(i).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
      var d = "";
      for (var c in a) a[c] && (d += "; " + c, a[c] !== !0 && (d += "=" + a[c].split(";")[0]));
      return document.cookie = i + "=" + e.write(s, i) + d;
    }
  }
  return Object.create({ set: o, get: function(i) {
    if (typeof document < "u" && (!arguments.length || i)) {
      for (var s = document.cookie ? document.cookie.split("; ") : [], a = {}, d = 0; d < s.length; d++) {
        var c = s[d].split("="), l = c.slice(1).join("=");
        try {
          var u = decodeURIComponent(c[0]);
          if (a[u] = e.read(l, u), i === u) break;
        } catch {
        }
      }
      return i ? a[i] : a;
    }
  }, remove: function(i, s) {
    o(i, "", Vt({}, s, { expires: -1 }));
  }, withAttributes: function(i) {
    return n(this.converter, Vt({}, this.attributes, i));
  }, withConverter: function(i) {
    return n(Vt({}, this.converter, i), this.attributes);
  } }, { attributes: { value: Object.freeze(t) }, converter: { value: Object.freeze(e) } });
}({ read: function(n) {
  return n[0] === '"' && (n = n.slice(1, -1)), n.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
}, write: function(n) {
  return encodeURIComponent(n).replace(/%(2[346BF]|3[AC-F]|40|5[BDE]|60|7[BCD])/g, decodeURIComponent);
} }, { path: "/" });
class Ls {
  constructor(e) {
    var t;
    this.authCookieName = void 0, this.authCookieDomain = void 0, this.authCookieSameSite = void 0, this.authCookieName = e.cookieName, this.authCookieDomain = e.cookieDomain, this.authCookieSameSite = (t = e.cookieSameSite) != null ? t : "lax";
  }
  getAuthCookie() {
    return Un.get(this.authCookieName);
  }
  setAuthCookie(e, t) {
    const o = { secure: !0, sameSite: this.authCookieSameSite };
    this.authCookieDomain !== void 0 && (o.domain = this.authCookieDomain);
    const i = yn({}, o, t);
    if ((i.sameSite === "none" || i.sameSite === "None") && i.secure === !1) throw new $e(new Error("Secure attribute must be set when SameSite=None"));
    Un.set(this.authCookieName, e, i);
  }
  removeAuthCookie() {
    Un.remove(this.authCookieName);
  }
}
class Ts {
  constructor(e) {
    this.keyName = void 0, this.keyName = e.keyName;
  }
  getSessionToken() {
    return sessionStorage.getItem(this.keyName);
  }
  setSessionToken(e) {
    sessionStorage.setItem(this.keyName, e);
  }
  removeSessionToken() {
    sessionStorage.removeItem(this.keyName);
  }
}
class Ns {
  constructor(e) {
    this._xhr = void 0, this._xhr = e;
  }
  getResponseHeader(e) {
    return this._xhr.getResponseHeader(e);
  }
}
class Us {
  constructor(e) {
    this.headers = void 0, this.ok = void 0, this.status = void 0, this.statusText = void 0, this.url = void 0, this._decodedJSON = void 0, this.xhr = void 0, this.headers = new Ns(e), this.ok = e.status >= 200 && e.status <= 299, this.status = e.status, this.statusText = e.statusText, this.url = e.responseURL, this.xhr = e;
  }
  json() {
    return this._decodedJSON || (this._decodedJSON = JSON.parse(this.xhr.response)), this._decodedJSON;
  }
  parseNumericHeader(e) {
    const t = parseInt(this.headers.getResponseHeader(e), 10);
    return isNaN(t) ? 0 : t;
  }
}
class Ms {
  constructor(e, t) {
    this.timeout = void 0, this.api = void 0, this.dispatcher = void 0, this.cookie = void 0, this.sessionTokenStorage = void 0, this.lang = void 0, this.sessionTokenLocation = void 0, this.api = e, this.timeout = t.timeout, this.dispatcher = new Ci(), this.cookie = new Ls(yn({}, t)), this.sessionTokenStorage = new Ts({ keyName: t.cookieName }), this.lang = t.lang, this.sessionTokenLocation = t.sessionTokenLocation;
  }
  _fetch(e, t, o = new XMLHttpRequest()) {
    const i = this, s = this.api + e, a = this.timeout, d = this.getAuthToken(), c = this.lang;
    return new Promise(function(l, u) {
      o.open(t.method, s, !0), o.setRequestHeader("Accept", "application/json"), o.setRequestHeader("Content-Type", "application/json"), o.setRequestHeader("X-Language", c), d && o.setRequestHeader("Authorization", `Bearer ${d}`), o.timeout = a, o.withCredentials = !0, o.onload = () => {
        i.processHeaders(o), l(new Us(o));
      }, o.onerror = () => {
        u(new $e());
      }, o.ontimeout = () => {
        u(new Sn());
      }, o.send(t.body ? t.body.toString() : null);
    });
  }
  _fetch_blocking(e, t, o = new XMLHttpRequest()) {
    const i = this.api + e, s = this.getAuthToken();
    return o.open(t.method, i, !1), o.setRequestHeader("Accept", "application/json"), o.setRequestHeader("Content-Type", "application/json"), s && o.setRequestHeader("Authorization", `Bearer ${s}`), o.withCredentials = !0, o.send(t.body ? t.body.toString() : null), o.responseText;
  }
  processHeaders(e) {
    let t = "", o = 0, i = "";
    if (e.getAllResponseHeaders().split(`\r
`).forEach((s) => {
      const a = s.toLowerCase();
      a.startsWith("x-auth-token") ? t = e.getResponseHeader("X-Auth-Token") : a.startsWith("x-session-lifetime") ? o = parseInt(e.getResponseHeader("X-Session-Lifetime"), 10) : a.startsWith("x-session-retention") && (i = e.getResponseHeader("X-Session-Retention"));
    }), t) {
      const s = new RegExp("^https://"), a = !!this.api.match(s) && !!window.location.href.match(s), d = i === "session" ? void 0 : new Date((/* @__PURE__ */ new Date()).getTime() + 1e3 * o);
      this.setAuthToken(t, { secure: a, expires: d });
    }
  }
  get(e) {
    return this._fetch(e, { method: "GET" });
  }
  post(e, t) {
    return this._fetch(e, { method: "POST", body: JSON.stringify(t) });
  }
  put(e, t) {
    return this._fetch(e, { method: "PUT", body: JSON.stringify(t) });
  }
  patch(e, t) {
    return this._fetch(e, { method: "PATCH", body: JSON.stringify(t) });
  }
  delete(e) {
    return this._fetch(e, { method: "DELETE" });
  }
  getAuthToken() {
    let e = "";
    switch (this.sessionTokenLocation) {
      case "cookie":
        e = this.cookie.getAuthCookie();
        break;
      case "sessionStorage":
        e = this.sessionTokenStorage.getSessionToken();
    }
    return e;
  }
  setAuthToken(e, t) {
    switch (this.sessionTokenLocation) {
      case "cookie":
        return this.cookie.setAuthCookie(e, t);
      case "sessionStorage":
        return this.sessionTokenStorage.setSessionToken(e);
    }
  }
}
class lt {
  constructor(e, t) {
    this.client = void 0, this.client = new Ms(e, t);
  }
}
class Ai extends lt {
  getDomain(e) {
    if (!e) throw new Je("somethingWentWrong", new Error("email missing from request"));
    const t = e.split("@");
    if (t.length !== 2) throw new Je("somethingWentWrong", new Error("email is not in a valid email format."));
    const o = t[1].trim();
    if (o === "") throw new Je("somethingWentWrong", new Error("email is not in a valid email format."));
    return o;
  }
  async hasProvider(e) {
    const t = this.getDomain(e);
    return this.client.get(`/saml/provider?domain=${t}`).then((o) => {
      if (o.status == 404) throw new qt(new Error("provider not found"));
      if (!o.ok) throw new $e(new Error("unable to fetch provider"));
      return o.ok;
    });
  }
  auth(e, t) {
    const o = new URL("/saml/auth", this.client.api), i = this.getDomain(e);
    if (!t) throw new Je("somethingWentWrong", new Error("redirectTo missing from request"));
    o.searchParams.append("domain", i), o.searchParams.append("redirect_to", t), window.location.assign(o.href);
  }
  getError() {
    const e = new URLSearchParams(window.location.search), t = e.get("error"), o = e.get("error_description");
    if (t) {
      let i;
      switch (t) {
        case "access_denied":
          i = "enterpriseAccessDenied";
          break;
        case "user_conflict":
          i = "emailAddressAlreadyExistsError";
          break;
        case "multiple_accounts":
          i = "enterpriseMultipleAccounts";
          break;
        case "unverified_email":
          i = "enterpriseUnverifiedEmail";
          break;
        case "email_maxnum":
          i = "maxNumOfEmailAddressesReached";
          break;
        default:
          i = "somethingWentWrong";
      }
      return new Je(i, new Error(o));
    }
  }
}
class Oi extends lt {
  async getInfo(e) {
    const t = await this.client.post("/user", { email: e });
    if (t.status === 404) throw new qt();
    if (!t.ok) throw new $e();
    return t.json();
  }
  async create(e) {
    const t = await this.client.post("/users", { email: e });
    if (t.status === 409) throw new wn();
    if (t.status === 403) throw new xn();
    if (!t.ok) throw new $e();
    return t.json();
  }
  async getCurrent() {
    const e = await this.client.get("/me");
    if (e.status === 401) throw this.client.dispatcher.dispatchSessionExpiredEvent(), new Ye();
    if (!e.ok) throw new $e();
    const t = e.json(), o = await this.client.get(`/users/${t.id}`);
    if (o.status === 401) throw this.client.dispatcher.dispatchSessionExpiredEvent(), new Ye();
    if (!o.ok) throw new $e();
    return o.json();
  }
  async delete() {
    const e = await this.client.delete("/user");
    if (e.ok) return this.client.sessionTokenStorage.removeSessionToken(), this.client.cookie.removeAuthCookie(), void this.client.dispatcher.dispatchUserDeletedEvent();
    throw e.status === 401 ? (this.client.dispatcher.dispatchSessionExpiredEvent(), new Ye()) : new $e();
  }
  async logout() {
    const e = await this.client.post("/logout");
    if (this.client.sessionTokenStorage.removeSessionToken(), this.client.cookie.removeAuthCookie(), this.client.dispatcher.dispatchUserLoggedOutEvent(), e.status !== 401 && !e.ok) throw new $e();
  }
}
class Pi extends lt {
  async list() {
    const e = await this.client.get("/emails");
    if (e.status === 401) throw this.client.dispatcher.dispatchSessionExpiredEvent(), new Ye();
    if (!e.ok) throw new $e();
    return e.json();
  }
  async create(e) {
    const t = await this.client.post("/emails", { address: e });
    if (t.ok) return t.json();
    throw t.status === 400 ? new An() : t.status === 401 ? (this.client.dispatcher.dispatchSessionExpiredEvent(), new Ye()) : t.status === 409 ? new Cn() : new $e();
  }
  async setPrimaryEmail(e) {
    const t = await this.client.post(`/emails/${e}/set_primary`);
    if (t.status === 401) throw this.client.dispatcher.dispatchSessionExpiredEvent(), new Ye();
    if (!t.ok) throw new $e();
  }
  async delete(e) {
    const t = await this.client.delete(`/emails/${e}`);
    if (t.status === 401) throw this.client.dispatcher.dispatchSessionExpiredEvent(), new Ye();
    if (!t.ok) throw new $e();
  }
}
class Ei extends lt {
  async auth(e, t) {
    const o = new URL("/thirdparty/auth", this.client.api);
    if (!e) throw new Je("somethingWentWrong", new Error("provider missing from request"));
    if (!t) throw new Je("somethingWentWrong", new Error("redirectTo missing from request"));
    o.searchParams.append("provider", e), o.searchParams.append("redirect_to", t), window.location.assign(o.href);
  }
  getError() {
    const e = new URLSearchParams(window.location.search), t = e.get("error"), o = e.get("error_description");
    if (t) {
      let i = "";
      switch (t) {
        case "access_denied":
          i = "thirdPartyAccessDenied";
          break;
        case "user_conflict":
          i = "emailAddressAlreadyExistsError";
          break;
        case "multiple_accounts":
          i = "thirdPartyMultipleAccounts";
          break;
        case "unverified_email":
          i = "thirdPartyUnverifiedEmail";
          break;
        case "email_maxnum":
          i = "maxNumOfEmailAddressesReached";
          break;
        case "signup_disabled":
          i = "signupDisabled";
          break;
        default:
          i = "somethingWentWrong";
      }
      return new Je(i, new Error(o));
    }
  }
}
class Ii extends lt {
  async validate() {
    const e = new URLSearchParams(window.location.search).get("hanko_token");
    if (!e) return;
    window.history.replaceState(null, null, window.location.pathname);
    const t = await this.client.post("/token", { value: e });
    if (!t.ok) throw new $e();
    return t.json();
  }
}
class Hs {
  static throttle(e, t, o = {}) {
    const { leading: i = !0, trailing: s = !0 } = o;
    let a, d, c, l = 0;
    const u = () => {
      l = i === !1 ? 0 : Date.now(), c = null, e.apply(a, d);
    };
    return function(...h) {
      const g = Date.now();
      l || i !== !1 || (l = g);
      const f = t - (g - l);
      a = this, d = h, f <= 0 || f > t ? (c && (window.clearTimeout(c), c = null), l = g, e.apply(a, d)) : c || s === !1 || (c = window.setTimeout(u, f));
    };
  }
}
class On {
  constructor() {
    this.throttleLimit = 1e3, this._addEventListener = document.addEventListener.bind(document), this._removeEventListener = document.removeEventListener.bind(document), this._throttle = Hs.throttle;
  }
  wrapCallback(e, t) {
    const o = (i) => {
      e(i.detail);
    };
    return t ? this._throttle(o, this.throttleLimit, { leading: !0, trailing: !1 }) : o;
  }
  addEventListenerWithType({ type: e, callback: t, once: o = !1, throttle: i = !1 }) {
    const s = this.wrapCallback(t, i);
    return this._addEventListener(e, s, { once: o }), () => this._removeEventListener(e, s);
  }
  static mapAddEventListenerParams(e, { once: t, callback: o }, i) {
    return { type: e, callback: o, once: t, throttle: i };
  }
  addEventListener(e, t, o) {
    return this.addEventListenerWithType(On.mapAddEventListenerParams(e, t, o));
  }
  onSessionCreated(e, t) {
    return this.addEventListener(uo, { callback: e, once: t }, !0);
  }
  onSessionExpired(e, t) {
    return this.addEventListener(ho, { callback: e, once: t }, !0);
  }
  onUserLoggedOut(e, t) {
    return this.addEventListener(po, { callback: e, once: t });
  }
  onUserDeleted(e, t) {
    return this.addEventListener(fo, { callback: e, once: t });
  }
}
class mo extends lt {
  async validate() {
    const e = await this.client.get("/sessions/validate");
    if (!e.ok) throw new $e();
    return await e.json();
  }
}
class Rs extends lt {
  isValid() {
    let e;
    try {
      const t = this.client._fetch_blocking("/sessions/validate", { method: "GET" });
      e = JSON.parse(t);
    } catch (t) {
      throw new $e(t);
    }
    return !!e && e.is_valid;
  }
}
class Ws {
  constructor(e) {
    this.storageKey = void 0, this.defaultState = { expiration: 0, lastCheck: 0 }, this.storageKey = e;
  }
  load() {
    const e = window.localStorage.getItem(this.storageKey);
    return e == null ? this.defaultState : JSON.parse(e);
  }
  save(e) {
    window.localStorage.setItem(this.storageKey, JSON.stringify(e || this.defaultState));
  }
}
class qs {
  constructor(e, t) {
    this.onActivityCallback = void 0, this.onInactivityCallback = void 0, this.handleFocus = () => {
      this.onActivityCallback();
    }, this.handleBlur = () => {
      this.onInactivityCallback();
    }, this.handleVisibilityChange = () => {
      document.visibilityState === "visible" ? this.onActivityCallback() : this.onInactivityCallback();
    }, this.hasFocus = () => document.hasFocus(), this.onActivityCallback = e, this.onInactivityCallback = t, window.addEventListener("focus", this.handleFocus), window.addEventListener("blur", this.handleBlur), document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }
}
class zs {
  constructor(e, t, o) {
    this.intervalID = null, this.timeoutID = null, this.checkInterval = void 0, this.checkSession = void 0, this.onSessionExpired = void 0, this.checkInterval = e, this.checkSession = t, this.onSessionExpired = o;
  }
  scheduleSessionExpiry(e) {
    var t = this;
    this.stop(), this.timeoutID = setTimeout(async function() {
      t.stop(), t.onSessionExpired();
    }, e);
  }
  start(e = 0, t = 0) {
    var o = this;
    const i = this.calcTimeToNextCheck(e);
    this.sessionExpiresSoon(t) ? this.scheduleSessionExpiry(i) : this.timeoutID = setTimeout(async function() {
      let s = await o.checkSession();
      if (s.is_valid) {
        if (o.sessionExpiresSoon(s.expiration)) return void o.scheduleSessionExpiry(s.expiration - Date.now());
        o.intervalID = setInterval(async function() {
          s = await o.checkSession(), s.is_valid ? o.sessionExpiresSoon(s.expiration) && o.scheduleSessionExpiry(s.expiration - Date.now()) : o.stop();
        }, o.checkInterval);
      } else o.stop();
    }, i);
  }
  stop() {
    this.timeoutID && (clearTimeout(this.timeoutID), this.timeoutID = null), this.intervalID && (clearInterval(this.intervalID), this.intervalID = null);
  }
  isRunning() {
    return this.timeoutID !== null || this.intervalID !== null;
  }
  sessionExpiresSoon(e) {
    return e > 0 && e - Date.now() <= this.checkInterval;
  }
  calcTimeToNextCheck(e) {
    const t = Date.now() - e;
    return this.checkInterval >= t ? this.checkInterval - t % this.checkInterval : 0;
  }
}
class Fs {
  constructor(e = "hanko_session", t, o, i) {
    this.channel = void 0, this.onSessionExpired = void 0, this.onSessionCreated = void 0, this.onLeadershipRequested = void 0, this.handleMessage = (s) => {
      const a = s.data;
      switch (a.action) {
        case "sessionExpired":
          this.onSessionExpired(a);
          break;
        case "sessionCreated":
          this.onSessionCreated(a);
          break;
        case "requestLeadership":
          this.onLeadershipRequested(a);
      }
    }, this.onSessionExpired = t, this.onSessionCreated = o, this.onLeadershipRequested = i, this.channel = new BroadcastChannel(e), this.channel.onmessage = this.handleMessage;
  }
  post(e) {
    this.channel.postMessage(e);
  }
}
class Ks extends Ci {
  constructor(e, t) {
    super(), this.listener = new On(), this.checkInterval = 3e4, this.client = void 0, this.sessionState = void 0, this.windowActivityManager = void 0, this.scheduler = void 0, this.sessionChannel = void 0, this.isLoggedIn = void 0, this.client = new mo(e, t), this.checkInterval = t.sessionCheckInterval, this.sessionState = new Ws(`${t.cookieName}_session_state`), this.sessionChannel = new Fs(this.getSessionCheckChannelName(t.sessionTokenLocation, t.sessionCheckChannelName), () => this.onChannelSessionExpired(), (s) => this.onChannelSessionCreated(s), () => this.onChannelLeadershipRequested()), this.scheduler = new zs(this.checkInterval, () => this.checkSession(), () => this.onSessionExpired()), this.windowActivityManager = new qs(() => this.startSessionCheck(), () => this.scheduler.stop());
    const o = Date.now(), { expiration: i } = this.sessionState.load();
    this.isLoggedIn = o < i, this.initializeEventListeners(), this.startSessionCheck();
  }
  initializeEventListeners() {
    this.listener.onSessionCreated((e) => {
      const { claims: t } = e, o = Date.parse(t.expiration), i = Date.now();
      this.isLoggedIn = !0, this.sessionState.save({ expiration: o, lastCheck: i }), this.sessionChannel.post({ action: "sessionCreated", claims: t }), this.startSessionCheck();
    }), this.listener.onUserLoggedOut(() => {
      this.isLoggedIn = !1, this.sessionChannel.post({ action: "sessionExpired" }), this.sessionState.save(null), this.scheduler.stop();
    }), window.addEventListener("beforeunload", () => this.scheduler.stop());
  }
  startSessionCheck() {
    if (!this.windowActivityManager.hasFocus() || (this.sessionChannel.post({ action: "requestLeadership" }), this.scheduler.isRunning())) return;
    const { lastCheck: e, expiration: t } = this.sessionState.load();
    this.isLoggedIn && this.scheduler.start(e, t);
  }
  async checkSession() {
    const e = Date.now(), { is_valid: t, claims: o, expiration_time: i } = await this.client.validate(), s = i ? Date.parse(i) : 0;
    return !t && this.isLoggedIn && this.dispatchSessionExpiredEvent(), t ? (this.isLoggedIn = !0, this.sessionState.save({ lastCheck: e, expiration: s })) : (this.isLoggedIn = !1, this.sessionState.save(null), this.sessionChannel.post({ action: "sessionExpired" })), { is_valid: t, claims: o, expiration: s };
  }
  onSessionExpired() {
    this.isLoggedIn && (this.isLoggedIn = !1, this.sessionState.save(null), this.sessionChannel.post({ action: "sessionExpired" }), this.dispatchSessionExpiredEvent());
  }
  onChannelSessionExpired() {
    this.isLoggedIn && (this.isLoggedIn = !1, this.dispatchSessionExpiredEvent());
  }
  onChannelSessionCreated(e) {
    const { claims: t } = e, o = Date.now(), i = Date.parse(t.expiration) - o;
    this.isLoggedIn = !0, this.dispatchSessionCreatedEvent({ claims: t, expirationSeconds: i });
  }
  onChannelLeadershipRequested() {
    this.windowActivityManager.hasFocus() || this.scheduler.stop();
  }
  getSessionCheckChannelName(e, t) {
    if (e == "cookie") return t;
    let o = sessionStorage.getItem("sessionCheckChannelName");
    return o != null && o !== "" || (o = `${t}-${Math.floor(100 * Math.random()) + 1}`, sessionStorage.setItem("sessionCheckChannelName", o)), o;
  }
}
var ft, bt = Si("actionDefinitions"), Mn = Si("createActionsProxy");
class Hn {
  toJSON() {
    return { name: this.name, payload: this.payload, error: this.error, status: this.status, csrf_token: this.csrf_token, actions: Nn(this, bt)[bt] };
  }
  constructor({ name: e, payload: t, error: o, status: i, actions: s, csrf_token: a }, d) {
    Object.defineProperty(this, Mn, { value: Bs }), this.name = void 0, this.payload = void 0, this.error = void 0, this.status = void 0, this.csrf_token = void 0, Object.defineProperty(this, bt, { writable: !0, value: void 0 }), this.actions = void 0, this.fetchNextState = void 0, this.name = e, this.payload = t, this.error = o, this.status = i, this.csrf_token = a, Nn(this, bt)[bt] = s, this.actions = Nn(this, Mn)[Mn](s, a), this.fetchNextState = d;
  }
  runAction(e, t) {
    const o = {};
    if ("inputs" in e && typeof e.inputs == "object" && e.inputs !== null) {
      const i = e.inputs;
      for (const s in e.inputs) {
        const a = i[s];
        a && "value" in a && (o[s] = a.value);
      }
    }
    return this.fetchNextState(e.href, { input_data: o, csrf_token: t });
  }
  validateAction(e) {
    if ("inputs" in e) for (const t in e.inputs) {
      let i = function(a, d, c, l) {
        throw new ji({ reason: a, inputName: t, wanted: c, actual: l, message: d });
      };
      const o = e.inputs[t], s = o.value;
      o.required && !s && i(ft.Required, "is required"), (o.min_length != null || o.max_length != null) && ("length" in s || i(ft.InvalidInputDefinition, 'has min/max length requirement, but is missing "length" property', "string", typeof s), o.min_length != null && s < o.min_length && i(ft.MinLength, `too short (min ${o.min_length})`, o.min_length, s.length), o.max_length != null && s > o.max_length && i(ft.MaxLength, `too long (max ${o.max_length})`, o.max_length, s.length));
    }
  }
}
function Bs(n, e) {
  const t = (i) => this.runAction(i, e), o = (i) => this.validateAction(i);
  return new Proxy(n, { get(i, s) {
    if (typeof s == "symbol") return i[s];
    const a = i[s];
    return a == null ? null : (d) => {
      const c = Object.assign(JSON.parse(JSON.stringify(a)), { validate: () => (o(c), c), tryValidate() {
        try {
          o(c);
        } catch (l) {
          if (l instanceof ji) return l;
          throw l;
        }
      }, run: () => t(c) });
      if (c !== null && typeof c == "object" && "inputs" in c) for (const l in d) {
        const u = c.inputs;
        u[l] || (u[l] = { name: l, type: "" }), u[l].value = d[l];
      }
      return c;
    };
  } });
}
(function(n) {
  n[n.InvalidInputDefinition = 0] = "InvalidInputDefinition", n[n.MinLength = 1] = "MinLength", n[n.MaxLength = 2] = "MaxLength", n[n.Required = 3] = "Required";
})(ft || (ft = {}));
class ji extends Error {
  constructor(e) {
    super(`"${e.inputName}" ${e.message}`), this.reason = void 0, this.inputName = void 0, this.wanted = void 0, this.actual = void 0, this.name = "ValidationError", this.reason = e.reason, this.inputName = e.inputName, this.wanted = e.wanted, this.actual = e.actual;
  }
}
function Bo(n) {
  return typeof n == "object" && n !== null && "status" in n && "error" in n && "name" in n && !!n.name && !!n.status;
}
class Vs extends lt {
  constructor(...e) {
    var t;
    super(...e), t = this, this.run = async function(o, i) {
      try {
        if (!Bo(o)) throw new Zs(o);
        const a = i[o.name];
        if (!a) throw new go(o);
        let d = await a(o);
        if (typeof (s = d) == "object" && s !== null && "href" in s && "inputs" in s && (d = await d.run()), Bo(d)) return t.run(d, i);
      } catch (a) {
        if (typeof i.onError == "function") return i.onError(a);
      }
      var s;
    };
  }
  async init(e, t) {
    var o = this;
    const i = await async function s(a, d) {
      try {
        const c = await o.client.post(a, d);
        return new Hn(c.json(), s);
      } catch (c) {
        t.onError == null || t.onError(c);
      }
    }(e);
    await this.run(i, t);
  }
  async fromString(e, t) {
    var o = this;
    const i = new Hn(JSON.parse(e), async function s(a, d) {
      try {
        const c = await o.client.post(a, d);
        return new Hn(c.json(), s);
      } catch (c) {
        t.onError == null || t.onError(c);
      }
    });
    await this.run(i, t);
  }
}
class go extends xe {
  constructor(e) {
    super("No handler found for state: " + (typeof e.name == "string" ? `"${e.name}"` : `(${typeof e.name})`), "handlerNotFoundError"), this.state = void 0, this.state = e, Object.setPrototypeOf(this, go.prototype);
  }
}
class Zs extends Error {
  constructor(e) {
    super("Invalid state: " + (typeof e.name == "string" ? `"${e.name}"` : `(${typeof e.name})`)), this.state = void 0, this.state = e;
  }
}
class $i extends On {
  constructor(e, t) {
    super(), this.api = void 0, this.user = void 0, this.email = void 0, this.thirdParty = void 0, this.enterprise = void 0, this.token = void 0, this.sessionClient = void 0, this.session = void 0, this.relay = void 0, this.flow = void 0;
    const o = { timeout: 13e3, cookieName: "hanko", localStorageKey: "hanko", sessionCheckInterval: 3e4, sessionCheckChannelName: "hanko-session-check", sessionTokenLocation: "cookie" };
    (t == null ? void 0 : t.cookieName) !== void 0 && (o.cookieName = t.cookieName), (t == null ? void 0 : t.timeout) !== void 0 && (o.timeout = t.timeout), (t == null ? void 0 : t.localStorageKey) !== void 0 && (o.localStorageKey = t.localStorageKey), (t == null ? void 0 : t.cookieDomain) !== void 0 && (o.cookieDomain = t.cookieDomain), (t == null ? void 0 : t.cookieSameSite) !== void 0 && (o.cookieSameSite = t.cookieSameSite), (t == null ? void 0 : t.lang) !== void 0 && (o.lang = t.lang), (t == null ? void 0 : t.sessionCheckInterval) !== void 0 && (o.sessionCheckInterval = t.sessionCheckInterval < 3e3 ? 3e3 : t.sessionCheckInterval), (t == null ? void 0 : t.sessionCheckChannelName) !== void 0 && (o.sessionCheckChannelName = t.sessionCheckChannelName), (t == null ? void 0 : t.sessionTokenLocation) !== void 0 && (o.sessionTokenLocation = t.sessionTokenLocation), this.api = e, this.user = new Oi(e, o), this.email = new Pi(e, o), this.thirdParty = new Ei(e, o), this.enterprise = new Ai(e, o), this.token = new Ii(e, o), this.sessionClient = new mo(e, o), this.session = new Rs(e, o), this.relay = new Ks(e, o), this.flow = new Vs(e, o);
  }
  setLang(e) {
    this.flow.client.lang = e;
  }
}
class mt {
  static supported() {
    return !!(navigator.credentials && navigator.credentials.create && navigator.credentials.get && window.PublicKeyCredential);
  }
  static async isPlatformAuthenticatorAvailable() {
    return !(!this.supported() || !window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) && window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  }
  static async isSecurityKeySupported() {
    return window.PublicKeyCredential !== void 0 && window.PublicKeyCredential.isExternalCTAP2SecurityKeySupported ? window.PublicKeyCredential.isExternalCTAP2SecurityKeySupported() : this.supported();
  }
  static async isConditionalMediationAvailable() {
    return !(!window.PublicKeyCredential || !window.PublicKeyCredential.isConditionalMediationAvailable) && window.PublicKeyCredential.isConditionalMediationAvailable();
  }
}
var Js = Y(292), Xe = Y.n(Js), Qs = Y(360), et = Y.n(Qs), Gs = Y(884), tt = Y.n(Gs), Ys = Y(88), nt = Y.n(Ys), rn = Y(914), kt = {};
kt.setAttributes = tt(), kt.insert = (n) => {
  window._hankoStyle = n;
}, kt.domAPI = et(), kt.insertStyleElement = nt(), Xe()(rn.A, kt);
const Rt = rn.A && rn.A.locals ? rn.A.locals : void 0, Xs = function(n) {
  function e(t) {
    var o = fi({}, t);
    return delete o.ref, n(o, t.ref || null);
  }
  return e.$$typeof = _s, e.render = e, e.prototype.isReactComponent = e.__f = !0, e.displayName = "ForwardRef(" + (n.displayName || n.name) + ")", e;
}((n, e) => {
  const { lang: t, hanko: o, setHanko: i } = (0, _.useContext)(ue), { setLang: s } = (0, _.useContext)(Z.TranslateContext);
  return (0, _.useEffect)(() => {
    s(t.replace(/[-]/, "")), i((a) => (a.setLang(t), a));
  }, [o, t, i, s]), r("section", Object.assign({ part: "container", className: Rt.container, ref: e }, { children: n.children }));
});
var an = Y(697), wt = {};
wt.setAttributes = tt(), wt.insert = (n) => {
  window._hankoStyle = n;
}, wt.domAPI = et(), wt.insertStyleElement = nt(), Xe()(an.A, wt);
const D = an.A && an.A.locals ? an.A.locals : void 0;
var er = Y(633), Q = Y.n(er);
const tr = ({ size: n, secondary: e, disabled: t }) => r("svg", Object.assign({ id: "icon-apple", xmlns: "http://www.w3.org/2000/svg", width: n, height: n, viewBox: "20.5 16 15 19", className: Q()(D.icon, e && D.secondary, t && D.disabled) }, { children: r("path", { d: "M28.2226562,20.3846154 C29.0546875,20.3846154 30.0976562,19.8048315 30.71875,19.0317864 C31.28125,18.3312142 31.6914062,17.352829 31.6914062,16.3744437 C31.6914062,16.2415766 31.6796875,16.1087095 31.65625,16 C30.7304687,16.0362365 29.6171875,16.640178 28.9492187,17.4494596 C28.421875,18.06548 27.9414062,19.0317864 27.9414062,20.0222505 C27.9414062,20.1671964 27.9648438,20.3121424 27.9765625,20.3604577 C28.0351562,20.3725366 28.1289062,20.3846154 28.2226562,20.3846154 Z M25.2929688,35 C26.4296875,35 26.9335938,34.214876 28.3515625,34.214876 C29.7929688,34.214876 30.109375,34.9758423 31.375,34.9758423 C32.6171875,34.9758423 33.4492188,33.792117 34.234375,32.6325493 C35.1132812,31.3038779 35.4765625,29.9993643 35.5,29.9389701 C35.4179688,29.9148125 33.0390625,28.9122695 33.0390625,26.0979021 C33.0390625,23.6579784 34.9140625,22.5588048 35.0195312,22.474253 C33.7773438,20.6382708 31.890625,20.5899555 31.375,20.5899555 C29.9804688,20.5899555 28.84375,21.4596313 28.1289062,21.4596313 C27.3554688,21.4596313 26.3359375,20.6382708 25.1289062,20.6382708 C22.8320312,20.6382708 20.5,22.5950413 20.5,26.2911634 C20.5,28.5861411 21.3671875,31.013986 22.4335938,32.5842339 C23.3476562,33.9129053 24.1445312,35 25.2929688,35 Z" }) })), nr = ({ secondary: n, size: e, fadeOut: t, disabled: o }) => r("svg", Object.assign({ id: "icon-checkmark", xmlns: "http://www.w3.org/2000/svg", viewBox: "4 4 40 40", width: e, height: e, className: Q()(D.checkmark, n && D.secondary, t && D.fadeOut, o && D.disabled) }, { children: r("path", { d: "M21.05 33.1 35.2 18.95l-2.3-2.25-11.85 11.85-6-6-2.25 2.25ZM24 44q-4.1 0-7.75-1.575-3.65-1.575-6.375-4.3-2.725-2.725-4.3-6.375Q4 28.1 4 24q0-4.15 1.575-7.8 1.575-3.65 4.3-6.35 2.725-2.7 6.375-4.275Q19.9 4 24 4q4.15 0 7.8 1.575 3.65 1.575 6.35 4.275 2.7 2.7 4.275 6.35Q44 19.85 44 24q0 4.1-1.575 7.75-1.575 3.65-4.275 6.375t-6.35 4.3Q28.15 44 24 44Zm0-3q7.1 0 12.05-4.975Q41 31.05 41 24q0-7.1-4.95-12.05Q31.1 7 24 7q-7.05 0-12.025 4.95Q7 16.9 7 24q0 7.05 4.975 12.025Q16.95 41 24 41Zm0-17Z" }) })), or = ({ size: n, secondary: e, disabled: t }) => r("svg", Object.assign({ xmlns: "http://www.w3.org/2000/svg", viewBox: "0 -960 960 960", width: n, height: n, className: Q()(D.icon, e && D.secondary, t && D.disabled) }, { children: r("path", { d: "M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z" }) })), ir = ({ size: n, secondary: e, disabled: t }) => r("svg", Object.assign({ id: "icon-custom-provider", xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", width: n, height: n, className: Q()(D.icon, e && D.secondary, t && D.disabled) }, { children: [r("path", { d: "M0 0h24v24H0z", fill: "none" }), r("path", { d: "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" })] })), sr = ({ size: n, secondary: e, disabled: t }) => r("svg", Object.assign({ id: "icon-discord", fill: "#fff", xmlns: "http://www.w3.org/2000/svg", width: n, height: n, viewBox: "0 0 127.14 96.36", className: Q()(D.icon, e && D.secondary, t && D.disabled) }, { children: r("path", { d: "M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" }) })), rr = ({ size: n, secondary: e, disabled: t }) => r("svg", Object.assign({ id: "icon-exclamation", xmlns: "http://www.w3.org/2000/svg", viewBox: "5 2 13 20", width: n, height: n, className: Q()(D.exclamationMark, e && D.secondary, t && D.disabled) }, { children: r("path", { d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" }) })), ar = ({ size: n, secondary: e, disabled: t }) => r("svg", Object.assign({ width: n, height: n, viewBox: "0 0 666.66668 666.66717", xmlns: "http://www.w3.org/2000/svg" }, { children: [r("defs", Object.assign({ id: "defs13" }, { children: r("clipPath", Object.assign({ clipPathUnits: "userSpaceOnUse", id: "clipPath25" }, { children: r("path", { d: "M 0,700 H 700 V 0 H 0 Z", id: "path23" }) })) })), r("g", Object.assign({ id: "g17", transform: "matrix(1.3333333,0,0,-1.3333333,-133.33333,799.99999)" }, { children: r("g", Object.assign({ id: "g19" }, { children: r("g", Object.assign({ id: "g21", clipPath: "url(#clipPath25)" }, { children: [r("g", Object.assign({ id: "g27", transform: "translate(600,350)" }, { children: r("path", { className: Q()(D.facebookIcon, t ? D.disabledOutline : D.outline), d: "m 0,0 c 0,138.071 -111.929,250 -250,250 -138.071,0 -250,-111.929 -250,-250 0,-117.245 80.715,-215.622 189.606,-242.638 v 166.242 h -51.552 V 0 h 51.552 v 32.919 c 0,85.092 38.508,124.532 122.048,124.532 15.838,0 43.167,-3.105 54.347,-6.211 V 81.986 c -5.901,0.621 -16.149,0.932 -28.882,0.932 -40.993,0 -56.832,-15.528 -56.832,-55.9 V 0 h 81.659 l -14.028,-76.396 h -67.631 V -248.169 C -95.927,-233.218 0,-127.818 0,0", id: "path29" }) })), r("g", Object.assign({ id: "g31", transform: "translate(447.9175,273.6036)" }, { children: r("path", { className: Q()(D.facebookIcon, t ? D.disabledLetter : D.letter), d: "M 0,0 14.029,76.396 H -67.63 v 27.019 c 0,40.372 15.838,55.899 56.831,55.899 12.733,0 22.981,-0.31 28.882,-0.931 v 69.253 c -11.18,3.106 -38.509,6.212 -54.347,6.212 -83.539,0 -122.048,-39.441 -122.048,-124.533 V 76.396 h -51.552 V 0 h 51.552 v -166.242 c 19.343,-4.798 39.568,-7.362 60.394,-7.362 10.254,0 20.358,0.632 30.288,1.831 L -67.63,0 Z", id: "path33" }) }))] })) })) }))] })), lr = ({ size: n, secondary: e, disabled: t }) => r("svg", Object.assign({ id: "icon-github", xmlns: "http://www.w3.org/2000/svg", fill: "#fff", viewBox: "0 0 97.63 96", width: n, height: n, className: Q()(D.icon, e && D.secondary, t && D.disabled) }, { children: [r("path", { d: "M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" }), " "] })), cr = ({ size: n, disabled: e }) => r("svg", Object.assign({ id: "icon-google", xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", width: n, height: n, className: D.googleIcon }, { children: [r("path", { className: Q()(D.googleIcon, e ? D.disabled : D.blue), d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" }), r("path", { className: Q()(D.googleIcon, e ? D.disabled : D.green), d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" }), r("path", { className: Q()(D.googleIcon, e ? D.disabled : D.yellow), d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" }), r("path", { className: Q()(D.googleIcon, e ? D.disabled : D.red), d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" }), r("path", { d: "M1 1h22v22H1z", fill: "none" })] })), dr = ({ size: n, secondary: e, disabled: t }) => r("svg", Object.assign({ id: "icon-linkedin", fill: "#fff", xmlns: "http://www.w3.org/2000/svg", width: n, viewBox: "0 0 24 24", height: n, className: Q()(D.icon, e && D.secondary, t && D.disabled) }, { children: r("path", { d: "M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" }) })), ur = ({ size: n, secondary: e, disabled: t }) => r("svg", Object.assign({ id: "icon-mail", xmlns: "http://www.w3.org/2000/svg", width: n, height: n, viewBox: "0 -960 960 960", className: Q()(D.icon, e && D.secondary, t && D.disabled) }, { children: r("path", { d: "M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm320-280L160-640v400h640v-400L480-440Zm0-80 320-200H160l320 200ZM160-640v-80 480-400Z" }) })), hr = ({ size: n, disabled: e }) => r("svg", Object.assign({ id: "icon-microsoft", xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", width: n, height: n, className: D.microsoftIcon }, { children: [r("rect", { className: Q()(D.microsoftIcon, e ? D.disabled : D.blue), x: "1", y: "1", width: "9", height: "9" }), r("rect", { className: Q()(D.microsoftIcon, e ? D.disabled : D.green), x: "1", y: "11", width: "9", height: "9" }), r("rect", { className: Q()(D.microsoftIcon, e ? D.disabled : D.yellow), x: "11", y: "1", width: "9", height: "9" }), r("rect", { className: Q()(D.microsoftIcon, e ? D.disabled : D.red), x: "11", y: "11", width: "9", height: "9" })] })), pr = ({ size: n, secondary: e, disabled: t }) => r("svg", Object.assign({ id: "icon-passkey", xmlns: "http://www.w3.org/2000/svg", viewBox: "3 1.5 19.5 19", width: n, height: n, className: Q()(D.icon, e && D.secondary, t && D.disabled) }, { children: r("g", Object.assign({ id: "icon-passkey-all" }, { children: [r("circle", { id: "icon-passkey-head", cx: "10.5", cy: "6", r: "4.5" }), r("path", { id: "icon-passkey-key", d: "M22.5,10.5a3.5,3.5,0,1,0-5,3.15V19L19,20.5,21.5,18,20,16.5,21.5,15l-1.24-1.24A3.5,3.5,0,0,0,22.5,10.5Zm-3.5,0a1,1,0,1,1,1-1A1,1,0,0,1,19,10.5Z" }), r("path", { id: "icon-passkey-body", d: "M14.44,12.52A6,6,0,0,0,12,12H9a6,6,0,0,0-6,6v2H16V14.49A5.16,5.16,0,0,1,14.44,12.52Z" })] })) })), fr = ({ size: n, secondary: e, disabled: t }) => r("svg", Object.assign({ id: "icon-password", xmlns: "http://www.w3.org/2000/svg", width: n, height: n, viewBox: "0 -960 960 960", className: Q()(D.icon, e && D.secondary, t && D.disabled) }, { children: r("path", { d: "M80-200v-80h800v80H80Zm46-242-52-30 34-60H40v-60h68l-34-58 52-30 34 58 34-58 52 30-34 58h68v60h-68l34 60-52 30-34-60-34 60Zm320 0-52-30 34-60h-68v-60h68l-34-58 52-30 34 58 34-58 52 30-34 58h68v60h-68l34 60-52 30-34-60-34 60Zm320 0-52-30 34-60h-68v-60h68l-34-58 52-30 34 58 34-58 52 30-34 58h68v60h-68l34 60-52 30-34-60-34 60Z" }) })), mr = ({ size: n, secondary: e, disabled: t }) => r("svg", Object.assign({ xmlns: "http://www.w3.org/2000/svg", viewBox: "0 -960 960 960", width: n, height: n, className: Q()(D.icon, e && D.secondary, t && D.disabled) }, { children: r("path", { d: "M80-680v-200h200v80H160v120H80Zm0 600v-200h80v120h120v80H80Zm600 0v-80h120v-120h80v200H680Zm120-600v-120H680v-80h200v200h-80ZM700-260h60v60h-60v-60Zm0-120h60v60h-60v-60Zm-60 60h60v60h-60v-60Zm-60 60h60v60h-60v-60Zm-60-60h60v60h-60v-60Zm120-120h60v60h-60v-60Zm-60 60h60v60h-60v-60Zm-60-60h60v60h-60v-60Zm240-320v240H520v-240h240ZM440-440v240H200v-240h240Zm0-320v240H200v-240h240Zm-60 500v-120H260v120h120Zm0-320v-120H260v120h120Zm320 0v-120H580v120h120Z" }) })), gr = ({ size: n, secondary: e, disabled: t }) => r("svg", Object.assign({ xmlns: "http://www.w3.org/2000/svg", viewBox: "0 -960 960 960", width: n, height: n, className: Q()(D.icon, e && D.secondary, t && D.disabled) }, { children: r("path", { d: "M280-240q-100 0-170-70T40-480q0-100 70-170t170-70q66 0 121 33t87 87h432v240h-80v120H600v-120H488q-32 54-87 87t-121 33Zm0-80q66 0 106-40.5t48-79.5h246v120h80v-120h80v-80H434q-8-39-48-79.5T280-640q-66 0-113 47t-47 113q0 66 47 113t113 47Zm0-80q33 0 56.5-23.5T360-480q0-33-23.5-56.5T280-560q-33 0-56.5 23.5T200-480q0 33 23.5 56.5T280-400Zm0-80Z" }) })), vr = ({ size: n, disabled: e }) => r("svg", Object.assign({ id: "icon-spinner", xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", width: n, height: n, className: Q()(D.loadingSpinner, e && D.disabled) }, { children: [r("path", { d: "M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z", opacity: ".25" }), r("path", { d: "M10.72,19.9a8,8,0,0,1-6.5-9.79A7.77,7.77,0,0,1,10.4,4.16a8,8,0,0,1,9.49,6.52A1.54,1.54,0,0,0,21.38,12h.13a1.37,1.37,0,0,0,1.38-1.54,11,11,0,1,0-12.7,12.39A1.54,1.54,0,0,0,12,21.34h0A1.47,1.47,0,0,0,10.72,19.9Z" })] })), Wt = ({ name: n, secondary: e, size: t = 18, fadeOut: o, disabled: i }) => r(Vn[n], { size: t, secondary: e, fadeOut: o, disabled: i }), vo = ({ children: n, isLoading: e, isSuccess: t, fadeOut: o, secondary: i, hasIcon: s, maxWidth: a }) => r(A.Fragment, { children: r("div", e ? Object.assign({ className: Q()(D.loadingSpinnerWrapper, D.centerContent, a && D.maxWidth) }, { children: r(Wt, { name: "spinner", secondary: i }) }) : t ? Object.assign({ className: Q()(D.loadingSpinnerWrapper, D.centerContent, a && D.maxWidth) }, { children: r(Wt, { name: "checkmark", secondary: i, fadeOut: o }) }) : Object.assign({ className: s ? D.loadingSpinnerWrapperIcon : D.loadingSpinnerWrapper }, { children: n })) }), _r = () => {
  const { setLoadingAction: n } = (0, _.useContext)(ue);
  return (0, _.useEffect)(() => {
    n(null);
  }, []), r(vo, { isLoading: !0 });
}, Ne = (n) => {
  const [e, t] = (0, _.useState)(n);
  return (0, _.useEffect)(() => {
    n && t(n);
  }, [n]), { flowState: e };
};
var ln = Y(577), St = {};
St.setAttributes = tt(), St.insert = (n) => {
  window._hankoStyle = n;
}, St.domAPI = et(), St.insertStyleElement = nt(), Xe()(ln.A, St);
const Ae = ln.A && ln.A.locals ? ln.A.locals : void 0, yr = () => {
  const { t: n } = (0, _.useContext)(Z.TranslateContext);
  return r("span", Object.assign({ className: Q()(Ae.lastUsed) }, { children: n("labels.lastUsed") }));
}, te = (n) => {
  var { uiAction: e, title: t, children: o, secondary: i, dangerous: s, autofocus: a, showLastUsed: d, onClick: c, icon: l } = n, u = function(S, P) {
    var $ = {};
    for (var N in S) Object.prototype.hasOwnProperty.call(S, N) && P.indexOf(N) < 0 && ($[N] = S[N]);
    if (S != null && typeof Object.getOwnPropertySymbols == "function") {
      var U = 0;
      for (N = Object.getOwnPropertySymbols(S); U < N.length; U++) P.indexOf(N[U]) < 0 && Object.prototype.propertyIsEnumerable.call(S, N[U]) && ($[N[U]] = S[N[U]]);
    }
    return $;
  }(n, ["uiAction", "title", "children", "secondary", "dangerous", "autofocus", "showLastUsed", "onClick", "icon"]);
  const h = (0, _.useRef)(null), { uiState: g, isDisabled: f } = (0, _.useContext)(ue);
  (0, _.useEffect)(() => {
    const { current: S } = h;
    S && a && S.focus();
  }, [a]);
  const x = (0, _.useMemo)(() => e && g.loadingAction === e || u.isLoading, [u, e, g]), O = (0, _.useMemo)(() => e && g.succeededAction === e || u.isSuccess, [u, e, g]), C = (0, _.useMemo)(() => f || u.disabled, [u, f]);
  return r("button", Object.assign({ part: s ? "button dangerous-button" : i ? "button secondary-button" : "button primary-button", title: t, ref: h, type: "submit", disabled: C, onClick: c, className: Q()(Ae.button, s ? Ae.dangerous : i ? Ae.secondary : Ae.primary) }, { children: r(vo, Object.assign({ isLoading: x, isSuccess: O, secondary: !0, hasIcon: !!l, maxWidth: !0 }, { children: [l ? r(Wt, { name: l, secondary: i, disabled: C }) : null, r("div", Object.assign({ className: Ae.caption }, { children: [r("span", { children: o }), d ? r(yr, {}) : null] }))] })) }));
}, Ke = (n) => {
  var e, t, o, i, s, { label: a } = n, d = function(f, x) {
    var O = {};
    for (var C in f) Object.prototype.hasOwnProperty.call(f, C) && x.indexOf(C) < 0 && (O[C] = f[C]);
    if (f != null && typeof Object.getOwnPropertySymbols == "function") {
      var S = 0;
      for (C = Object.getOwnPropertySymbols(f); S < C.length; S++) x.indexOf(C[S]) < 0 && Object.prototype.propertyIsEnumerable.call(f, C[S]) && (O[C[S]] = f[C[S]]);
    }
    return O;
  }(n, ["label"]);
  const c = (0, _.useRef)(null), { isDisabled: l } = (0, _.useContext)(ue), { t: u } = (0, _.useContext)(Z.TranslateContext), h = (0, _.useMemo)(() => l || d.disabled, [d, l]);
  (0, _.useEffect)(() => {
    const { current: f } = c;
    f && d.autofocus && (f.focus(), f.select());
  }, [d.autofocus]);
  const g = (0, _.useMemo)(() => {
    var f;
    return d.markOptional && !(!((f = d.flowInput) === null || f === void 0) && f.required) ? `${d.placeholder} (${u("labels.optional")})` : d.placeholder;
  }, [d.markOptional, d.placeholder, d.flowInput, u]);
  return r("div", Object.assign({ className: Ae.inputWrapper }, { children: r("input", Object.assign({ part: "input text-input", required: (e = d.flowInput) === null || e === void 0 ? void 0 : e.required, maxLength: (t = d.flowInput) === null || t === void 0 ? void 0 : t.max_length, minLength: (o = d.flowInput) === null || o === void 0 ? void 0 : o.min_length, hidden: (i = d.flowInput) === null || i === void 0 ? void 0 : i.hidden }, d, { ref: c, "aria-label": g, placeholder: g, className: Q()(Ae.input, !!(!((s = d.flowInput) === null || s === void 0) && s.error) && d.markError && Ae.error), disabled: h })) }));
}, Oe = ({ children: n }) => r("section", Object.assign({ className: Rt.content }, { children: n })), ne = ({ onSubmit: n, children: e, hidden: t, maxWidth: o }) => t ? null : r("form", Object.assign({ onSubmit: n, className: Ae.form }, { children: r("ul", Object.assign({ className: Ae.ul }, { children: (0, A.toChildArray)(e).map((i, s) => r("li", Object.assign({ part: "form-item", className: Q()(Ae.li, o ? Ae.maxWidth : null) }, { children: i }), s)) })) }));
var cn = Y(111), xt = {};
xt.setAttributes = tt(), xt.insert = (n) => {
  window._hankoStyle = n;
}, xt.domAPI = et(), xt.insertStyleElement = nt(), Xe()(cn.A, xt);
const Lt = cn.A && cn.A.locals ? cn.A.locals : void 0, _o = ({ children: n, hidden: e }) => e ? null : r("section", Object.assign({ part: "divider", className: Lt.divider }, { children: [r("div", { part: "divider-line", className: Lt.line }), n ? r("div", Object.assign({ part: "divider-text", class: Lt.text }, { children: n })) : null, r("div", { part: "divider-line", className: Lt.line })] }));
var dn = Y(905), Ct = {};
Ct.setAttributes = tt(), Ct.insert = (n) => {
  window._hankoStyle = n;
}, Ct.domAPI = et(), Ct.insertStyleElement = nt(), Xe()(dn.A, Ct);
const Di = dn.A && dn.A.locals ? dn.A.locals : void 0, Pe = ({ state: n, error: e, flowError: t }) => {
  var o, i;
  const { t: s } = (0, _.useContext)(Z.TranslateContext), { uiState: a, setUIState: d } = (0, _.useContext)(ue);
  return (0, _.useEffect)(() => {
    var c, l;
    if (((c = n == null ? void 0 : n.error) === null || c === void 0 ? void 0 : c.code) == "form_data_invalid_error") for (const u of Object.values(n == null ? void 0 : n.actions)) {
      const h = u == null ? void 0 : u(null);
      let g = !1;
      for (const f of Object.values(h == null ? void 0 : h.inputs)) if (!((l = f.error) === null || l === void 0) && l.code) return d(Object.assign(Object.assign({}, a), { error: f.error })), void (g = !0);
      g || d(Object.assign(Object.assign({}, a), { error: n.error }));
    }
    else n != null && n.error && d(Object.assign(Object.assign({}, a), { error: n == null ? void 0 : n.error }));
  }, [n]), r("section", Object.assign({ part: "error", className: Di.errorBox, hidden: !(!((o = a.error) === null || o === void 0) && o.code) && !(t != null && t.code) && !e }, { children: [r("span", { children: r(Wt, { name: "exclamation", size: 15 }) }), r("span", Object.assign({ id: "errorMessage", part: "error-text" }, { children: s(e ? `errors.${e.code}` : `flowErrors.${((i = a.error) === null || i === void 0 ? void 0 : i.code) || (t == null ? void 0 : t.code)}`) }))] }));
};
var un = Y(619), At = {};
At.setAttributes = tt(), At.insert = (n) => {
  window._hankoStyle = n;
}, At.domAPI = et(), At.insertStyleElement = nt(), Xe()(un.A, At);
const bn = un.A && un.A.locals ? un.A.locals : void 0, de = ({ children: n }) => r("h1", Object.assign({ part: "headline1", className: Q()(bn.headline, bn.grade1) }, { children: n }));
var hn = Y(995), Ot = {};
Ot.setAttributes = tt(), Ot.insert = (n) => {
  window._hankoStyle = n;
}, Ot.domAPI = et(), Ot.insertStyleElement = nt(), Xe()(hn.A, Ot);
const Zt = hn.A && hn.A.locals ? hn.A.locals : void 0, Jn = (n) => {
  var { loadingSpinnerPosition: e, dangerous: t = !1, onClick: o, uiAction: i } = n, s = function(P, $) {
    var N = {};
    for (var U in P) Object.prototype.hasOwnProperty.call(P, U) && $.indexOf(U) < 0 && (N[U] = P[U]);
    if (P != null && typeof Object.getOwnPropertySymbols == "function") {
      var ie = 0;
      for (U = Object.getOwnPropertySymbols(P); ie < U.length; ie++) $.indexOf(U[ie]) < 0 && Object.prototype.propertyIsEnumerable.call(P, U[ie]) && (N[U[ie]] = P[U[ie]]);
    }
    return N;
  }(n, ["loadingSpinnerPosition", "dangerous", "onClick", "uiAction"]);
  const { t: a } = (0, _.useContext)(Z.TranslateContext), { uiState: d, isDisabled: c } = (0, _.useContext)(ue), [l, u] = (0, _.useState)();
  let h;
  const g = (P) => {
    P.preventDefault(), u(!0);
  }, f = (P) => {
    P.preventDefault(), u(!1);
  }, x = (0, _.useMemo)(() => i && d.loadingAction === i || s.isLoading, [s, i, d]), O = (0, _.useMemo)(() => i && d.succeededAction === i || s.isSuccess, [s, i, d]), C = (0, _.useCallback)((P) => {
    P.preventDefault(), u(!1), o(P);
  }, [o]), S = (0, _.useCallback)(() => r(A.Fragment, { children: [l ? r(A.Fragment, { children: [r(Jn, Object.assign({ onClick: C }, { children: a("labels.yes") })), " / ", r(Jn, Object.assign({ onClick: f }, { children: a("labels.no") })), " "] }) : null, r("button", Object.assign({}, s, { onClick: t ? g : o, disabled: l || s.disabled || c, part: "link", className: Q()(Zt.link, t ? Zt.danger : null) }, { children: s.children }))] }), [l, t, o, C, s, a, c]);
  return r(A.Fragment, { children: r("span", Object.assign({ className: Q()(Zt.linkWrapper, e === "right" ? Zt.reverse : null), hidden: s.hidden, onMouseEnter: () => {
    h && window.clearTimeout(h);
  }, onMouseLeave: () => {
    h = window.setTimeout(() => {
      u(!1);
    }, 1e3);
  } }, { children: r(A.Fragment, e && (x || O) ? { children: [r(vo, { isLoading: x, isSuccess: O, secondary: s.secondary, fadeOut: !0 }), S()] } : { children: S() }) })) });
}, ee = Jn, Ue = ({ children: n, hidden: e = !1 }) => e ? null : r("section", Object.assign({ className: Rt.footer }, { children: n })), yo = (n) => {
  var { label: e } = n, t = function(o, i) {
    var s = {};
    for (var a in o) Object.prototype.hasOwnProperty.call(o, a) && i.indexOf(a) < 0 && (s[a] = o[a]);
    if (o != null && typeof Object.getOwnPropertySymbols == "function") {
      var d = 0;
      for (a = Object.getOwnPropertySymbols(o); d < a.length; d++) i.indexOf(a[d]) < 0 && Object.prototype.propertyIsEnumerable.call(o, a[d]) && (s[a[d]] = o[a[d]]);
    }
    return s;
  }(n, ["label"]);
  return r("div", Object.assign({ className: Ae.inputWrapper }, { children: r("label", Object.assign({ className: Ae.checkboxWrapper }, { children: [r("input", Object.assign({ part: "input checkbox-input", type: "checkbox", "aria-label": e, className: Ae.checkbox }, t)), r("span", Object.assign({ className: Q()(Ae.label, t.disabled ? Ae.disabled : null) }, { children: e }))] })) }));
}, Pn = () => r("section", { className: Lt.spacer });
var Pt = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const br = (n) => {
  var e, t, o, i, s, a, d, c, l;
  const { t: u } = (0, _.useContext)(Z.TranslateContext), { init: h, hanko: g, initialComponentName: f, setLoadingAction: x, uiState: O, setUIState: C, stateHandler: S, hidePasskeyButtonOnLogin: P, lastLogin: $ } = (0, _.useContext)(ue), [N, U] = (0, _.useState)(null), [ie, ye] = (0, _.useState)(O.username || O.email), { flowState: se } = Ne(n.state), ke = mt.supported(), [M, q] = (0, _.useState)(void 0), [ge, De] = (0, _.useState)(null), [Ee, Le] = (0, _.useState)(!1), re = (k) => {
    if (k.preventDefault(), k.target instanceof HTMLInputElement) {
      const { value: p } = k.target;
      ye(p), ae(p);
    }
  }, ae = (k) => {
    const p = () => C((L) => Object.assign(Object.assign({}, L), { email: k, username: null })), y = () => C((L) => Object.assign(Object.assign({}, L), { email: null, username: k }));
    switch (N) {
      case "email":
        p();
        break;
      case "username":
        y();
        break;
      case "identifier":
        k.match(/^[^@]+@[^@]+\.[^@]+$/) ? p() : y();
    }
  }, he = (0, _.useMemo)(() => {
    var k, p, y, L;
    return !!(!((p = (k = se.actions).webauthn_generate_request_options) === null || p === void 0) && p.call(k, null)) || !!(!((L = (y = se.actions).thirdparty_oauth) === null || L === void 0) && L.call(y, null));
  }, [se.actions]), Ie = (t = (e = se.actions).continue_with_login_identifier) === null || t === void 0 ? void 0 : t.call(e, null).inputs;
  return (0, _.useEffect)(() => {
    var k, p;
    const y = (p = (k = se.actions).continue_with_login_identifier) === null || p === void 0 ? void 0 : p.call(k, null).inputs;
    U(y != null && y.email ? "email" : y != null && y.username ? "username" : "identifier");
  }, [se]), (0, _.useEffect)(() => {
    const k = new URLSearchParams(window.location.search);
    if (k.get("error") == null || k.get("error").length === 0) return;
    let p = "";
    p = k.get("error") === "access_denied" ? "thirdPartyAccessDenied" : "somethingWentWrong";
    const y = { name: p, code: p, message: k.get("error_description") };
    q(y), k.delete("error"), k.delete("error_description"), history.replaceState(null, null, window.location.pathname + (k.size < 1 ? "" : `?${k.toString()}`));
  }, []), r(A.Fragment, { children: [r(Oe, { children: [r(de, { children: u("headlines.signIn") }), r(Pe, { state: se, error: M }), Ie ? r(A.Fragment, { children: [r(ne, Object.assign({ onSubmit: (k) => Pt(void 0, void 0, void 0, function* () {
    k.preventDefault(), x("email-submit");
    const p = yield se.actions.continue_with_login_identifier({ [N]: ie }).run();
    ae(ie), x(null), yield g.flow.run(p, S);
  }), maxWidth: !0 }, { children: [Ie.email ? r(Ke, { type: "email", autoComplete: "username webauthn", autoCorrect: "off", flowInput: Ie.email, onInput: re, value: ie, placeholder: u("labels.email"), pattern: "^[^@]+@[^@]+\\.[^@]+$" }) : Ie.username ? r(Ke, { type: "text", autoComplete: "username webauthn", autoCorrect: "off", flowInput: Ie.username, onInput: re, value: ie, placeholder: u("labels.username") }) : r(Ke, { type: "text", autoComplete: "username webauthn", autoCorrect: "off", flowInput: Ie.identifier, onInput: re, value: ie, placeholder: u("labels.emailOrUsername") }), r(te, Object.assign({ uiAction: "email-submit" }, { children: u("labels.continue") }))] })), r(_o, Object.assign({ hidden: !he }, { children: u("labels.or") }))] }) : null, !((i = (o = se.actions).webauthn_generate_request_options) === null || i === void 0) && i.call(o, null) && !P ? r(ne, Object.assign({ onSubmit: (k) => ((p) => Pt(void 0, void 0, void 0, function* () {
    p.preventDefault(), x("passkey-submit");
    const y = yield se.actions.webauthn_generate_request_options(null).run();
    yield g.flow.run(y, S);
  }))(k) }, { children: r(te, Object.assign({ uiAction: "passkey-submit", secondary: !0, title: ke ? null : u("labels.webauthnUnsupported"), disabled: !ke, icon: "passkey" }, { children: u("labels.signInPasskey") })) })) : null, !((a = (s = se.actions).thirdparty_oauth) === null || a === void 0) && a.call(s, null) ? (d = se.actions.thirdparty_oauth(null).inputs.provider.allowed_values) === null || d === void 0 ? void 0 : d.map((k) => r(ne, Object.assign({ onSubmit: (p) => ((y, L) => Pt(void 0, void 0, void 0, function* () {
    y.preventDefault(), De(L);
    const K = yield se.actions.thirdparty_oauth({ provider: L, redirect_to: window.location.toString() }).run();
    K.error && De(null), yield g.flow.run(K, S);
  }))(p, k.value) }, { children: r(te, Object.assign({ isLoading: k.value == ge, secondary: !0, icon: k.value.startsWith("custom_") ? "customProvider" : k.value, showLastUsed: ($ == null ? void 0 : $.login_method) == "third_party" && ($ == null ? void 0 : $.third_party_provider) == k.value }, { children: u("labels.signInWith", { provider: k.name }) })) }), k.value)) : null, ((l = (c = se.actions).remember_me) === null || l === void 0 ? void 0 : l.call(c, null)) && r(A.Fragment, { children: [r(Pn, {}), r(yo, { required: !1, type: "checkbox", label: u("labels.staySignedIn"), checked: Ee, onChange: (k) => Pt(void 0, void 0, void 0, function* () {
    const p = yield se.actions.remember_me({ remember_me: !Ee }).run();
    Le((y) => !y), yield g.flow.run(p, S);
  }) })] })] }), r(Ue, Object.assign({ hidden: f !== "auth" }, { children: [r("span", { hidden: !0 }), r(ee, Object.assign({ uiAction: "switch-flow", onClick: (k) => Pt(void 0, void 0, void 0, function* () {
    k.preventDefault(), h("registration");
  }), loadingSpinnerPosition: "left" }, { children: u("labels.dontHaveAnAccount") }))] }))] });
}, kr = (n) => {
  var { index: e, focus: t, digit: o = "" } = n, i = function(l, u) {
    var h = {};
    for (var g in l) Object.prototype.hasOwnProperty.call(l, g) && u.indexOf(g) < 0 && (h[g] = l[g]);
    if (l != null && typeof Object.getOwnPropertySymbols == "function") {
      var f = 0;
      for (g = Object.getOwnPropertySymbols(l); f < g.length; f++) u.indexOf(g[f]) < 0 && Object.prototype.propertyIsEnumerable.call(l, g[f]) && (h[g[f]] = l[g[f]]);
    }
    return h;
  }(n, ["index", "focus", "digit"]);
  const s = (0, _.useRef)(null), { isDisabled: a } = (0, _.useContext)(ue), d = () => {
    const { current: l } = s;
    l && (l.focus(), l.select());
  }, c = (0, _.useMemo)(() => a || i.disabled, [i, a]);
  return (0, _.useEffect)(() => {
    e === 0 && d();
  }, [e, i.disabled]), (0, _.useMemo)(() => {
    t && d();
  }, [t]), r("div", Object.assign({ className: Ae.passcodeDigitWrapper }, { children: r("input", Object.assign({}, i, { part: "input passcode-input", "aria-label": `${i.name}-digit-${e + 1}`, name: i.name + e.toString(10), type: "text", inputMode: "numeric", maxLength: 1, ref: s, value: o.charAt(0), required: !0, className: Ae.input, disabled: c })) }));
}, bo = ({ passcodeDigits: n = [], numberOfInputs: e = 6, onInput: t, disabled: o = !1 }) => {
  const [i, s] = (0, _.useState)(0), a = () => n.slice(), d = () => {
    i < e - 1 && s(i + 1);
  }, c = () => {
    i > 0 && s(i - 1);
  }, l = (f) => {
    const x = a();
    x[i] = f.charAt(0), t(x);
  }, u = (f) => {
    if (f.preventDefault(), o) return;
    const x = f.clipboardData.getData("text/plain").slice(0, e - i).split(""), O = a();
    let C = i;
    for (let S = 0; S < e; ++S) S >= i && x.length > 0 && (O[S] = x.shift(), C++);
    s(C), t(O);
  }, h = (f) => {
    f.key === "Backspace" ? (f.preventDefault(), l(""), c()) : f.key === "Delete" ? (f.preventDefault(), l("")) : f.key === "ArrowLeft" ? (f.preventDefault(), c()) : f.key === "ArrowRight" ? (f.preventDefault(), d()) : f.key !== " " && f.key !== "Spacebar" && f.key !== "Space" || f.preventDefault();
  }, g = (f) => {
    f.target instanceof HTMLInputElement && l(f.target.value), d();
  };
  return (0, _.useEffect)(() => {
    n.length === 0 && s(0);
  }, [n]), r("div", Object.assign({ className: Ae.passcodeInputWrapper }, { children: Array.from(Array(e)).map((f, x) => r(kr, { name: "passcode", index: x, focus: i === x, digit: n[x], onKeyDown: h, onInput: g, onPaste: u, onFocus: () => ((O) => {
    s(O);
  })(x), disabled: o }, x)) }));
};
var pn = Y(489), Et = {};
Et.setAttributes = tt(), Et.insert = (n) => {
  window._hankoStyle = n;
}, Et.domAPI = et(), Et.insertStyleElement = nt(), Xe()(pn.A, Et);
const wr = pn.A && pn.A.locals ? pn.A.locals : void 0, z = ({ children: n, hidden: e }) => e ? null : r("p", Object.assign({ part: "paragraph", className: wr.paragraph }, { children: n }));
var Jt = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const Sr = (n) => {
  var e, t;
  const { t: o } = (0, _.useContext)(Z.TranslateContext), { flowState: i } = Ne(n.state), { hanko: s, uiState: a, setUIState: d, setLoadingAction: c, setSucceededAction: l, stateHandler: u } = (0, _.useContext)(ue), [h, g] = (0, _.useState)(), [f, x] = (0, _.useState)(i.payload.resend_after), [O, C] = (0, _.useState)([]), S = (0, _.useMemo)(() => {
    var $;
    return (($ = i.error) === null || $ === void 0 ? void 0 : $.code) === "passcode_max_attempts_reached";
  }, [i]), P = (0, _.useCallback)(($) => Jt(void 0, void 0, void 0, function* () {
    c("passcode-submit");
    const N = yield i.actions.verify_passcode({ code: $ }).run();
    c(null), yield s.flow.run(N, u);
  }), [s, i, c, u]);
  return (0, _.useEffect)(() => {
    i.payload.passcode_resent && (l("passcode-resend"), setTimeout(() => l(null), 1e3));
  }, [i, l]), (0, _.useEffect)(() => {
    h <= 0 && a.succeededAction;
  }, [a, h]), (0, _.useEffect)(() => {
    const $ = h > 0 && setInterval(() => g(h - 1), 1e3);
    return () => clearInterval($);
  }, [h]), (0, _.useEffect)(() => {
    const $ = f > 0 && setInterval(() => {
      x(f - 1);
    }, 1e3);
    return () => clearInterval($);
  }, [f]), (0, _.useEffect)(() => {
    var $;
    f == 0 && (($ = i.error) === null || $ === void 0 ? void 0 : $.code) == "rate_limit_exceeded" && d((N) => Object.assign(Object.assign({}, N), { error: null }));
  }, [f]), (0, _.useEffect)(() => {
    var $;
    (($ = i.error) === null || $ === void 0 ? void 0 : $.code) === "passcode_invalid" && C([]), i.payload.resend_after >= 0 && x(i.payload.resend_after);
  }, [i]), r(A.Fragment, { children: [r(Oe, { children: [r(de, { children: o("headlines.loginPasscode") }), r(Pe, { state: i }), r(z, { children: a.email ? o("texts.enterPasscode", { emailAddress: a.email }) : o("texts.enterPasscodeNoEmail") }), r(ne, Object.assign({ onSubmit: ($) => Jt(void 0, void 0, void 0, function* () {
    return $.preventDefault(), P(O.join(""));
  }) }, { children: [r(bo, { onInput: ($) => {
    if (C($), $.filter((N) => N !== "").length === 6) return P($.join(""));
  }, passcodeDigits: O, numberOfInputs: 6, disabled: h <= 0 || S }), r(te, Object.assign({ disabled: h <= 0 || S, uiAction: "passcode-submit" }, { children: o("labels.continue") }))] }))] }), r(Ue, { children: [r(ee, Object.assign({ hidden: !(!((t = (e = i.actions).back) === null || t === void 0) && t.call(e, null)), onClick: ($) => Jt(void 0, void 0, void 0, function* () {
    $.preventDefault(), c("back");
    const N = yield i.actions.back(null).run();
    c(null), yield s.flow.run(N, u);
  }), loadingSpinnerPosition: "right", isLoading: a.loadingAction === "back" }, { children: o("labels.back") })), r(ee, Object.assign({ uiAction: "passcode-resend", disabled: f > 0, onClick: ($) => Jt(void 0, void 0, void 0, function* () {
    $.preventDefault(), c("passcode-resend");
    const N = yield i.actions.resend_passcode(null).run();
    c(null), yield s.flow.run(N, u);
  }), loadingSpinnerPosition: "left" }, { children: f > 0 ? o("labels.passcodeResendAfter", { passcodeResendAfter: f }) : o("labels.sendNewPasscode") }))] })] });
};
var Rn = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const xr = (n) => {
  var e, t, o, i, s, a, d, c;
  const { t: l } = (0, _.useContext)(Z.TranslateContext), { hanko: u, setLoadingAction: h, stateHandler: g } = (0, _.useContext)(ue), { flowState: f } = Ne(n.state);
  return r(A.Fragment, { children: [r(Oe, { children: [r(de, { children: l("headlines.registerAuthenticator") }), r(Pe, { state: f }), r(z, { children: l("texts.setupPasskey") }), r(ne, Object.assign({ onSubmit: (x) => Rn(void 0, void 0, void 0, function* () {
    x.preventDefault(), h("passkey-submit");
    const O = yield f.actions.webauthn_generate_creation_options(null).run();
    yield u.flow.run(O, g);
  }) }, { children: r(te, Object.assign({ uiAction: "passkey-submit", autofocus: !0, icon: "passkey" }, { children: l("labels.registerAuthenticator") })) }))] }), r(Ue, Object.assign({ hidden: !(!((t = (e = f.actions).skip) === null || t === void 0) && t.call(e, null)) && !(!((i = (o = f.actions).back) === null || i === void 0) && i.call(o, null)) }, { children: [r(ee, Object.assign({ uiAction: "back", onClick: (x) => Rn(void 0, void 0, void 0, function* () {
    x.preventDefault(), h("back");
    const O = yield f.actions.back(null).run();
    h(null), yield u.flow.run(O, g);
  }), loadingSpinnerPosition: "right", hidden: !(!((a = (s = f.actions).back) === null || a === void 0) && a.call(s, null)) }, { children: l("labels.back") })), r(ee, Object.assign({ uiAction: "skip", onClick: (x) => Rn(void 0, void 0, void 0, function* () {
    x.preventDefault(), h("skip");
    const O = yield f.actions.skip(null).run();
    h(null), yield u.flow.run(O, g);
  }), loadingSpinnerPosition: "left", hidden: !(!((c = (d = f.actions).skip) === null || c === void 0) && c.call(d, null)) }, { children: l("labels.skip") }))] }))] });
};
var It = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const Cr = (n) => {
  var e, t, o, i;
  const { t: s } = (0, _.useContext)(Z.TranslateContext), { hanko: a, stateHandler: d, setLoadingAction: c } = (0, _.useContext)(ue), { flowState: l } = Ne(n.state), [u, h] = (0, _.useState)(), [g, f] = (0, _.useState)(), x = (P) => It(void 0, void 0, void 0, function* () {
    P.preventDefault(), c("password-recovery");
    const $ = yield l.actions.continue_to_passcode_confirmation_recovery(null).run();
    c(null), yield a.flow.run($, d);
  }), O = (P) => It(void 0, void 0, void 0, function* () {
    P.preventDefault(), c("choose-login-method");
    const $ = yield l.actions.continue_to_login_method_chooser(null).run();
    c(null), yield a.flow.run($, d);
  }), C = (0, _.useMemo)(() => {
    var P, $;
    return r(ee, Object.assign({ hidden: !(!(($ = (P = l.actions).continue_to_passcode_confirmation_recovery) === null || $ === void 0) && $.call(P, null)), uiAction: "password-recovery", onClick: x, loadingSpinnerPosition: "left" }, { children: s("labels.forgotYourPassword") }));
  }, [x, s]), S = (0, _.useMemo)(() => r(ee, Object.assign({ uiAction: "choose-login-method", onClick: O, loadingSpinnerPosition: "left" }, { children: "Choose another method" })), [O]);
  return (0, _.useEffect)(() => {
    const P = g > 0 && setInterval(() => f(g - 1), 1e3);
    return () => clearInterval(P);
  }, [g]), r(A.Fragment, { children: [r(Oe, { children: [r(de, { children: s("headlines.loginPassword") }), r(Pe, { state: l }), r(ne, Object.assign({ onSubmit: (P) => It(void 0, void 0, void 0, function* () {
    P.preventDefault(), c("password-submit");
    const $ = yield l.actions.password_login({ password: u }).run();
    c(null), yield a.flow.run($, d);
  }) }, { children: [r(Ke, { type: "password", flowInput: l.actions.password_login(null).inputs.password, autocomplete: "current-password", placeholder: s("labels.password"), onInput: (P) => It(void 0, void 0, void 0, function* () {
    P.target instanceof HTMLInputElement && h(P.target.value);
  }), autofocus: !0 }), r(te, Object.assign({ uiAction: "password-submit", disabled: g > 0 }, { children: g > 0 ? s("labels.passwordRetryAfter", { passwordRetryAfter: g }) : s("labels.signIn") }))] })), !((t = (e = l.actions).continue_to_login_method_chooser) === null || t === void 0) && t.call(e, null) ? C : null] }), r(Ue, { children: [r(ee, Object.assign({ uiAction: "back", onClick: (P) => It(void 0, void 0, void 0, function* () {
    P.preventDefault(), c("back");
    const $ = yield l.actions.back(null).run();
    c(null), yield a.flow.run($, d);
  }), loadingSpinnerPosition: "right" }, { children: s("labels.back") })), !((i = (o = l.actions).continue_to_login_method_chooser) === null || i === void 0) && i.call(o, null) ? S : C] })] });
};
var Vo = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const Ar = (n) => {
  const { t: e } = (0, _.useContext)(Z.TranslateContext), { hanko: t, stateHandler: o, setLoadingAction: i } = (0, _.useContext)(ue), { flowState: s } = Ne(n.state), [a, d] = (0, _.useState)();
  return r(Oe, { children: [r(de, { children: e("headlines.registerPassword") }), r(Pe, { state: s }), r(z, { children: e("texts.passwordFormatHint", { minLength: s.actions.password_recovery(null).inputs.new_password.min_length, maxLength: 72 }) }), r(ne, Object.assign({ onSubmit: (c) => Vo(void 0, void 0, void 0, function* () {
    c.preventDefault(), i("password-submit");
    const l = yield s.actions.password_recovery({ new_password: a }).run();
    i(null), yield t.flow.run(l, o);
  }) }, { children: [r(Ke, { type: "password", autocomplete: "new-password", flowInput: s.actions.password_recovery(null).inputs.new_password, placeholder: e("labels.newPassword"), onInput: (c) => Vo(void 0, void 0, void 0, function* () {
    c.target instanceof HTMLInputElement && d(c.target.value);
  }), autofocus: !0 }), r(te, Object.assign({ uiAction: "password-submit" }, { children: e("labels.continue") }))] }))] });
};
var Qt = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const Or = (n) => {
  var e, t, o, i, s, a;
  const { t: d } = (0, _.useContext)(Z.TranslateContext), { hanko: c, setLoadingAction: l, stateHandler: u, lastLogin: h } = (0, _.useContext)(ue), { flowState: g } = Ne(n.state);
  return r(A.Fragment, { children: [r(Oe, { children: [r(de, { children: d("headlines.selectLoginMethod") }), r(Pe, { flowError: g == null ? void 0 : g.error }), r(z, { children: d("texts.howDoYouWantToLogin") }), r(ne, Object.assign({ hidden: !(!((t = (e = g.actions).continue_to_passcode_confirmation) === null || t === void 0) && t.call(e, null)), onSubmit: (f) => Qt(void 0, void 0, void 0, function* () {
    f.preventDefault(), l("passcode-submit");
    const x = yield g.actions.continue_to_passcode_confirmation(null).run();
    l(null), yield c.flow.run(x, u);
  }) }, { children: r(te, Object.assign({ secondary: !0, uiAction: "passcode-submit", icon: "mail" }, { children: d("labels.passcode") })) })), r(ne, Object.assign({ hidden: !(!((i = (o = g.actions).continue_to_password_login) === null || i === void 0) && i.call(o, null)), onSubmit: (f) => Qt(void 0, void 0, void 0, function* () {
    f.preventDefault(), l("password-submit");
    const x = yield g.actions.continue_to_password_login(null).run();
    l(null), yield c.flow.run(x, u);
  }) }, { children: r(te, Object.assign({ secondary: !0, uiAction: "password-submit", icon: "password" }, { children: d("labels.password") })) })), r(ne, Object.assign({ hidden: !(!((a = (s = g.actions).webauthn_generate_request_options) === null || a === void 0) && a.call(s, null)), onSubmit: (f) => Qt(void 0, void 0, void 0, function* () {
    f.preventDefault(), l("passkey-submit");
    const x = yield g.actions.webauthn_generate_request_options(null).run();
    l(null), yield c.flow.run(x, u);
  }) }, { children: r(te, Object.assign({ secondary: !0, uiAction: "passkey-submit", icon: "passkey" }, { children: d("labels.passkey") })) }))] }), r(Ue, { children: r(ee, Object.assign({ uiAction: "back", onClick: (f) => Qt(void 0, void 0, void 0, function* () {
    f.preventDefault(), l("back");
    const x = yield g.actions.back(null).run();
    l(null), yield c.flow.run(x, u);
  }), loadingSpinnerPosition: "right" }, { children: d("labels.back") })) })] });
};
var Gt = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const Pr = (n) => {
  var e, t, o, i, s, a, d;
  const { t: c } = (0, _.useContext)(Z.TranslateContext), { init: l, hanko: u, uiState: h, setUIState: g, stateHandler: f, setLoadingAction: x, initialComponentName: O } = (0, _.useContext)(ue), { flowState: C } = Ne(n.state), S = (t = (e = C.actions).register_login_identifier) === null || t === void 0 ? void 0 : t.call(e, null).inputs, P = !(!(S != null && S.email) || !(S != null && S.username)), [$, N] = (0, _.useState)(void 0), [U, ie] = (0, _.useState)(null), [ye, se] = (0, _.useState)(!1), ke = (0, _.useMemo)(() => {
    var M, q;
    return !!(!((q = (M = C.actions).thirdparty_oauth) === null || q === void 0) && q.call(M, null));
  }, [C.actions]);
  return (0, _.useEffect)(() => {
    const M = new URLSearchParams(window.location.search);
    if (M.get("error") == null || M.get("error").length === 0) return;
    let q = "";
    q = M.get("error") === "access_denied" ? "thirdPartyAccessDenied" : "somethingWentWrong";
    const ge = { name: q, code: q, message: M.get("error_description") };
    N(ge), M.delete("error"), M.delete("error_description"), history.replaceState(null, null, window.location.pathname + (M.size < 1 ? "" : `?${M.toString()}`));
  }, []), r(A.Fragment, { children: [r(Oe, { children: [r(de, { children: c("headlines.signUp") }), r(Pe, { state: C, error: $ }), S ? r(A.Fragment, { children: [r(ne, Object.assign({ onSubmit: (M) => Gt(void 0, void 0, void 0, function* () {
    M.preventDefault(), x("email-submit");
    const q = yield C.actions.register_login_identifier({ email: h.email, username: h.username }).run();
    x(null), yield u.flow.run(q, f);
  }), maxWidth: !0 }, { children: [S.username ? r(Ke, { markOptional: P, markError: P, type: "text", autoComplete: "username", autoCorrect: "off", flowInput: S.username, onInput: (M) => {
    if (M.preventDefault(), M.target instanceof HTMLInputElement) {
      const { value: q } = M.target;
      g((ge) => Object.assign(Object.assign({}, ge), { username: q }));
    }
  }, value: h.username, placeholder: c("labels.username") }) : null, S.email ? r(Ke, { markOptional: P, markError: P, type: "email", autoComplete: "email", autoCorrect: "off", flowInput: S.email, onInput: (M) => {
    if (M.preventDefault(), M.target instanceof HTMLInputElement) {
      const { value: q } = M.target;
      g((ge) => Object.assign(Object.assign({}, ge), { email: q }));
    }
  }, value: h.email, placeholder: c("labels.email"), pattern: "^.*[^0-9]+$" }) : null, r(te, Object.assign({ uiAction: "email-submit", autofocus: !0 }, { children: c("labels.continue") }))] })), r(_o, Object.assign({ hidden: !ke }, { children: c("labels.or") }))] }) : null, !((i = (o = C.actions).thirdparty_oauth) === null || i === void 0) && i.call(o, null) ? (s = C.actions.thirdparty_oauth(null).inputs.provider.allowed_values) === null || s === void 0 ? void 0 : s.map((M) => r(ne, Object.assign({ onSubmit: (q) => ((ge, De) => Gt(void 0, void 0, void 0, function* () {
    ge.preventDefault(), ie(De);
    const Ee = yield C.actions.thirdparty_oauth({ provider: De, redirect_to: window.location.toString() }).run();
    ie(null), yield u.flow.run(Ee, f);
  }))(q, M.value) }, { children: r(te, Object.assign({ isLoading: M.value == U, secondary: !0, icon: M.value.startsWith("custom_") ? "customProvider" : M.value }, { children: c("labels.signInWith", { provider: M.name }) })) }), M.value)) : null, ((d = (a = C.actions).remember_me) === null || d === void 0 ? void 0 : d.call(a, null)) && r(A.Fragment, { children: [r(Pn, {}), r(yo, { required: !1, type: "checkbox", label: c("labels.staySignedIn"), checked: ye, onChange: (M) => Gt(void 0, void 0, void 0, function* () {
    const q = yield C.actions.remember_me({ remember_me: !ye }).run();
    se((ge) => !ge), yield u.flow.run(q, f);
  }) })] })] }), r(Ue, Object.assign({ hidden: O !== "auth" }, { children: [r("span", { hidden: !0 }), r(ee, Object.assign({ uiAction: "switch-flow", onClick: (M) => Gt(void 0, void 0, void 0, function* () {
    M.preventDefault(), l("login");
  }), loadingSpinnerPosition: "left" }, { children: c("labels.alreadyHaveAnAccount") }))] }))] });
};
var Yt = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const Er = (n) => {
  var e, t, o, i, s, a, d, c;
  const { t: l } = (0, _.useContext)(Z.TranslateContext), { hanko: u, stateHandler: h, setLoadingAction: g } = (0, _.useContext)(ue), { flowState: f } = Ne(n.state), [x, O] = (0, _.useState)();
  return r(A.Fragment, { children: [r(Oe, { children: [r(de, { children: l("headlines.registerPassword") }), r(Pe, { state: f }), r(z, { children: l("texts.passwordFormatHint", { minLength: f.actions.register_password(null).inputs.new_password.min_length, maxLength: 72 }) }), r(ne, Object.assign({ onSubmit: (C) => Yt(void 0, void 0, void 0, function* () {
    C.preventDefault(), g("password-submit");
    const S = yield f.actions.register_password({ new_password: x }).run();
    g(null), yield u.flow.run(S, h);
  }) }, { children: [r(Ke, { type: "password", autocomplete: "new-password", flowInput: f.actions.register_password(null).inputs.new_password, placeholder: l("labels.newPassword"), onInput: (C) => Yt(void 0, void 0, void 0, function* () {
    C.target instanceof HTMLInputElement && O(C.target.value);
  }), autofocus: !0 }), r(te, Object.assign({ uiAction: "password-submit" }, { children: l("labels.continue") }))] }))] }), r(Ue, Object.assign({ hidden: !(!((t = (e = f.actions).back) === null || t === void 0) && t.call(e, null)) && !(!((i = (o = f.actions).skip) === null || i === void 0) && i.call(o, null)) }, { children: [r(ee, Object.assign({ uiAction: "back", onClick: (C) => Yt(void 0, void 0, void 0, function* () {
    C.preventDefault(), g("back");
    const S = yield f.actions.back(null).run();
    g(null), yield u.flow.run(S, h);
  }), loadingSpinnerPosition: "right", hidden: !(!((a = (s = f.actions).back) === null || a === void 0) && a.call(s, null)) }, { children: l("labels.back") })), r(ee, Object.assign({ uiAction: "skip", onClick: (C) => Yt(void 0, void 0, void 0, function* () {
    C.preventDefault(), g("skip");
    const S = yield f.actions.skip(null).run();
    g(null), yield u.flow.run(S, h);
  }), loadingSpinnerPosition: "left", hidden: !(!((c = (d = f.actions).skip) === null || c === void 0) && c.call(d, null)) }, { children: l("labels.skip") }))] }))] });
};
var fn = Y(21), jt = {};
jt.setAttributes = tt(), jt.insert = (n) => {
  window._hankoStyle = n;
}, jt.domAPI = et(), jt.insertStyleElement = nt(), Xe()(fn.A, jt);
const Ze = fn.A && fn.A.locals ? fn.A.locals : void 0, En = function({ name: n, columnSelector: e, contentSelector: t, data: o, checkedItemID: i, setCheckedItemID: s, dropdown: a = !1 }) {
  const d = (0, _.useCallback)((u) => `${n}-${u}`, [n]), c = (0, _.useCallback)((u) => d(u) === i, [i, d]), l = (u) => {
    if (!(u.target instanceof HTMLInputElement)) return;
    const h = parseInt(u.target.value, 10), g = d(h);
    s(g === i ? null : g);
  };
  return r("div", Object.assign({ className: Ze.accordion }, { children: o.map((u, h) => r("div", Object.assign({ className: Ze.accordionItem }, { children: [r("input", { type: "radio", className: Ze.accordionInput, id: `${n}-${h}`, name: n, onClick: l, value: h, checked: c(h) }), r("label", Object.assign({ className: Q()(Ze.label, a && Ze.dropdown), for: `${n}-${h}` }, { children: r("span", Object.assign({ className: Ze.labelText }, { children: e(u, h) })) })), r("div", Object.assign({ className: Q()(Ze.accordionContent, a && Ze.dropdownContent) }, { children: t(u, h) }))] }), h)) }));
}, Re = ({ children: n }) => r("h2", Object.assign({ part: "headline2", className: Q()(bn.headline, bn.grade2) }, { children: n })), Ir = ({ onEmailDelete: n, onEmailSetPrimary: e, onEmailVerify: t, checkedItemID: o, setCheckedItemID: i, emails: s = [], deletableEmailIDs: a = [] }) => {
  const { t: d } = (0, _.useContext)(Z.TranslateContext), c = (0, _.useMemo)(() => !1, []);
  return r(En, { name: "email-edit-dropdown", columnSelector: (l) => {
    const u = r("span", Object.assign({ className: Ze.description }, { children: l.is_verified ? l.is_primary ? r(A.Fragment, { children: [" -", " ", d("labels.primaryEmail")] }) : null : r(A.Fragment, { children: [" -", " ", d("labels.unverifiedEmail")] }) }));
    return l.is_primary ? r(A.Fragment, { children: [r("b", { children: l.address }), u] }) : r(A.Fragment, { children: [l.address, u] });
  }, data: s, contentSelector: (l) => {
    var u;
    return r(A.Fragment, { children: [l.is_primary ? r(A.Fragment, { children: r(z, { children: [r(Re, { children: d("headlines.isPrimaryEmail") }), d("texts.isPrimaryEmail")] }) }) : r(A.Fragment, { children: r(z, { children: [r(Re, { children: d("headlines.setPrimaryEmail") }), d("texts.setPrimaryEmail"), r("br", {}), r(ee, Object.assign({ uiAction: "email-set-primary", onClick: (h) => e(h, l.id), loadingSpinnerPosition: "right" }, { children: d("labels.setAsPrimaryEmail") }))] }) }), l.is_verified ? r(A.Fragment, { children: r(z, { children: [r(Re, { children: d("headlines.emailVerified") }), d("texts.emailVerified")] }) }) : r(A.Fragment, { children: r(z, { children: [r(Re, { children: d("headlines.emailUnverified") }), d("texts.emailUnverified"), r("br", {}), r(ee, Object.assign({ uiAction: "email-verify", onClick: (h) => t(h, l.id), loadingSpinnerPosition: "right" }, { children: d("labels.verify") }))] }) }), a.includes(l.id) ? r(A.Fragment, { children: r(z, { children: [r(Re, { children: d("headlines.emailDelete") }), d("texts.emailDelete"), r("br", {}), r(ee, Object.assign({ uiAction: "email-delete", dangerous: !0, onClick: (h) => n(h, l.id), disabled: c, loadingSpinnerPosition: "right" }, { children: d("labels.delete") }))] }) }) : null, ((u = l.identities) === null || u === void 0 ? void 0 : u.length) > 0 ? r(A.Fragment, { children: r(z, { children: [r(Re, { children: d("headlines.connectedAccounts") }), l.identities.map((h) => h.provider).join(", ")] }) }) : null] });
  }, checkedItemID: o, setCheckedItemID: i });
}, jr = ({ onCredentialNameSubmit: n, oldName: e, onBack: t, credential: o, credentialType: i }) => {
  const { t: s } = (0, _.useContext)(Z.TranslateContext), [a, d] = (0, _.useState)(e);
  return r(A.Fragment, { children: [r(Oe, { children: [r(de, { children: s(i === "security-key" ? "headlines.renameSecurityKey" : "headlines.renamePasskey") }), r(Pe, { flowError: null }), r(z, { children: s(i === "security-key" ? "texts.renameSecurityKey" : "texts.renamePasskey") }), r(ne, Object.assign({ onSubmit: (c) => n(c, o.id, a) }, { children: [r(Ke, { type: "text", name: i, value: a, minLength: 3, maxLength: 32, required: !0, placeholder: s(i === "security-key" ? "labels.newSecurityKeyName" : "labels.newPasskeyName"), onInput: (c) => {
    return l = void 0, u = void 0, g = function* () {
      c.target instanceof HTMLInputElement && d(c.target.value);
    }, new ((h = void 0) || (h = Promise))(function(f, x) {
      function O(P) {
        try {
          S(g.next(P));
        } catch ($) {
          x($);
        }
      }
      function C(P) {
        try {
          S(g.throw(P));
        } catch ($) {
          x($);
        }
      }
      function S(P) {
        var $;
        P.done ? f(P.value) : ($ = P.value, $ instanceof h ? $ : new h(function(N) {
          N($);
        })).then(O, C);
      }
      S((g = g.apply(l, u || [])).next());
    });
    var l, u, h, g;
  }, autofocus: !0 }), r(te, Object.assign({ uiAction: "webauthn-credential-rename" }, { children: s("labels.save") }))] }))] }), r(Ue, { children: r(ee, Object.assign({ onClick: t, loadingSpinnerPosition: "right" }, { children: s("labels.back") })) })] });
}, Zo = ({ credentials: n = [], checkedItemID: e, setCheckedItemID: t, onBack: o, onCredentialNameSubmit: i, onCredentialDelete: s, allowCredentialDeletion: a, credentialType: d }) => {
  const { t: c } = (0, _.useContext)(Z.TranslateContext), { setPage: l } = (0, _.useContext)(ue), u = (g) => {
    if (g.name) return g.name;
    const f = g.public_key.replace(/[\W_]/g, "");
    return `${d === "security-key" ? "SecurityKey" : "Passkey"}-${f.substring(f.length - 7, f.length)}`;
  }, h = (g) => new Date(g).toLocaleString();
  return r(En, { name: d === "security-key" ? "security-key-edit-dropdown" : "passkey-edit-dropdown", columnSelector: (g) => u(g), data: n, contentSelector: (g) => r(A.Fragment, { children: [r(z, { children: [r(Re, { children: c(d === "security-key" ? "headlines.renameSecurityKey" : "headlines.renamePasskey") }), c(d === "security-key" ? "texts.renameSecurityKey" : "texts.renamePasskey"), r("br", {}), r(ee, Object.assign({ onClick: (f) => ((x, O, C) => {
    x.preventDefault(), l(r(jr, { oldName: u(O), credential: O, credentialType: C, onBack: o, onCredentialNameSubmit: i }));
  })(f, g, d), loadingSpinnerPosition: "right" }, { children: c("labels.rename") }))] }), r(z, Object.assign({ hidden: !a }, { children: [r(Re, { children: c(d === "security-key" ? "headlines.deleteSecurityKey" : "headlines.deletePasskey") }), c(d === "security-key" ? "texts.deleteSecurityKey" : "texts.deletePasskey"), r("br", {}), r(ee, Object.assign({ uiAction: "password-delete", dangerous: !0, onClick: (f) => s(f, g.id), loadingSpinnerPosition: "right" }, { children: c("labels.delete") }))] })), r(z, { children: [r(Re, { children: c("headlines.lastUsedAt") }), g.last_used_at ? h(g.last_used_at) : "-"] }), r(z, { children: [r(Re, { children: c("headlines.createdAt") }), h(g.created_at)] })] }), checkedItemID: e, setCheckedItemID: t });
}, zt = ({ name: n, title: e, children: t, checkedItemID: o, setCheckedItemID: i }) => r(En, { dropdown: !0, name: n, columnSelector: () => e, contentSelector: () => r(A.Fragment, { children: t }), setCheckedItemID: i, checkedItemID: o, data: [{}] }), ko = ({ flowError: n }) => {
  const { t: e } = (0, _.useContext)(Z.TranslateContext);
  return r(A.Fragment, { children: n ? r("div", Object.assign({ className: Di.errorMessage }, { children: e(`flowErrors.${n == null ? void 0 : n.code}`) })) : null });
}, $r = ({ inputs: n, onEmailSubmit: e, checkedItemID: t, setCheckedItemID: o }) => {
  var i;
  const { t: s } = (0, _.useContext)(Z.TranslateContext), [a, d] = (0, _.useState)();
  return r(zt, Object.assign({ name: "email-create-dropdown", title: s("labels.addEmail"), checkedItemID: t, setCheckedItemID: o }, { children: [r(ko, { flowError: (i = n.email) === null || i === void 0 ? void 0 : i.error }), r(ne, Object.assign({ onSubmit: (c) => e(c, a).then(() => d("")) }, { children: [r(Ke, { markError: !0, type: "email", placeholder: s("labels.newEmailAddress"), onInput: (c) => {
    c.preventDefault(), c.target instanceof HTMLInputElement && d(c.target.value);
  }, value: a, flowInput: n.email }), r(te, Object.assign({ uiAction: "email-submit" }, { children: s("labels.save") }))] }))] }));
}, Jo = ({ inputs: n, checkedItemID: e, setCheckedItemID: t, onPasswordSubmit: o, onPasswordDelete: i, allowPasswordDelete: s, passwordExists: a }) => {
  var d, c, l;
  const { t: u } = (0, _.useContext)(Z.TranslateContext), [h, g] = (0, _.useState)("");
  return r(zt, Object.assign({ name: "password-edit-dropdown", title: u(a ? "labels.changePassword" : "labels.setPassword"), checkedItemID: e, setCheckedItemID: t }, { children: [r(z, { children: u("texts.passwordFormatHint", { minLength: (d = n.password.min_length) === null || d === void 0 ? void 0 : d.toString(10), maxLength: (c = n.password.max_length) === null || c === void 0 ? void 0 : c.toString(10) }) }), r(ko, { flowError: (l = n.password) === null || l === void 0 ? void 0 : l.error }), r(ne, Object.assign({ onSubmit: (f) => o(f, h).then(() => g("")) }, { children: [r(Ke, { markError: !0, autoComplete: "new-password", placeholder: u("labels.newPassword"), type: "password", onInput: (f) => {
    f.preventDefault(), f.target instanceof HTMLInputElement && g(f.target.value);
  }, value: h, flowInput: n.password }), r(te, Object.assign({ uiAction: "password-submit" }, { children: u("labels.save") }))] })), r(ee, Object.assign({ hidden: !s, uiAction: "password-delete", dangerous: !0, onClick: (f) => i(f).then(() => g("")), loadingSpinnerPosition: "right" }, { children: u("labels.delete") }))] }));
}, Qo = ({ checkedItemID: n, setCheckedItemID: e, onCredentialSubmit: t, credentialType: o }) => {
  const { t: i } = (0, _.useContext)(Z.TranslateContext), s = mt.supported();
  return r(zt, Object.assign({ name: o === "security-key" ? "security-key-create-dropdown" : "passkey-create-dropdown", title: i(o === "security-key" ? "labels.createSecurityKey" : "labels.createPasskey"), checkedItemID: n, setCheckedItemID: e }, { children: [r(z, { children: i(o === "security-key" ? "texts.securityKeySetUp" : "texts.setupPasskey") }), r(ne, Object.assign({ onSubmit: t }, { children: r(te, Object.assign({ uiAction: o === "security-key" ? "security-key-submit" : "passkey-submit", title: s ? null : i("labels.webauthnUnsupported") }, { children: i(o === "security-key" ? "labels.createSecurityKey" : "labels.createPasskey") })) }))] }));
}, Go = ({ inputs: n, checkedItemID: e, setCheckedItemID: t, onUsernameSubmit: o, onUsernameDelete: i, hasUsername: s, allowUsernameDeletion: a }) => {
  var d;
  const { t: c } = (0, _.useContext)(Z.TranslateContext), [l, u] = (0, _.useState)();
  return r(zt, Object.assign({ name: "username-edit-dropdown", title: c(s ? "labels.changeUsername" : "labels.setUsername"), checkedItemID: e, setCheckedItemID: t }, { children: [r(ko, { flowError: (d = n.username) === null || d === void 0 ? void 0 : d.error }), r(ne, Object.assign({ onSubmit: (h) => o(h, l).then(() => u("")) }, { children: [r(Ke, { markError: !0, placeholder: c("labels.username"), type: "text", onInput: (h) => {
    h.preventDefault(), h.target instanceof HTMLInputElement && u(h.target.value);
  }, value: l, flowInput: n.username }), r(te, Object.assign({ uiAction: "username-set" }, { children: c("labels.save") }))] })), r(ee, Object.assign({ hidden: !a, uiAction: "username-delete", dangerous: !0, onClick: (h) => i(h).then(() => u("")), loadingSpinnerPosition: "right" }, { children: c("labels.delete") }))] }));
}, Dr = ({ onBack: n, onAccountDelete: e }) => {
  const { t } = (0, _.useContext)(Z.TranslateContext);
  return r(A.Fragment, { children: [r(Oe, { children: [r(de, { children: t("headlines.deleteAccount") }), r(Pe, { flowError: null }), r(z, { children: t("texts.deleteAccount") }), r(ne, Object.assign({ onSubmit: e }, { children: [r(yo, { required: !0, type: "checkbox", label: t("labels.deleteAccount") }), r(te, Object.assign({ uiAction: "account_delete" }, { children: t("labels.delete") }))] }))] }), r(Ue, { children: r(ee, Object.assign({ onClick: n }, { children: t("labels.back") })) })] });
}, Lr = ({ sessions: n = [], checkedItemID: e, setCheckedItemID: t, onSessionDelete: o, deletableSessionIDs: i }) => {
  const { t: s } = (0, _.useContext)(Z.TranslateContext), a = (d) => new Date(d).toLocaleString();
  return r(En, { name: "session-edit-dropdown", columnSelector: (d) => {
    const c = r("b", { children: d.user_agent ? d.user_agent : d.id }), l = d.current ? r("span", Object.assign({ className: Ze.description }, { children: r(A.Fragment, { children: [" -", " ", s("labels.currentSession")] }) })) : null;
    return r(A.Fragment, { children: [c, l] });
  }, data: n, contentSelector: (d) => r(A.Fragment, { children: [r(z, Object.assign({ hidden: !d.ip_address }, { children: [r(Re, { children: s("headlines.ipAddress") }), d.ip_address] })), r(z, { children: [r(Re, { children: s("headlines.lastUsed") }), a(d.last_used)] }), r(z, { children: [r(Re, { children: s("headlines.createdAt") }), a(d.created_at)] }), i != null && i.includes(d.id) ? r(z, { children: [r(Re, { children: s("headlines.revokeSession") }), r(ee, Object.assign({ uiAction: "session-delete", dangerous: !0, onClick: (c) => o(c, d.id), loadingSpinnerPosition: "right" }, { children: s("labels.revoke") }))] }) : null] }), checkedItemID: e, setCheckedItemID: t });
}, Tr = ({ checkedItemID: n, setCheckedItemID: e, onDelete: t, onConnect: o, authAppSetUp: i, allowDeletion: s }) => {
  const { t: a } = (0, _.useContext)(Z.TranslateContext), d = r("span", Object.assign({ className: Ze.description }, { children: i ? r(A.Fragment, { children: [" -", " ", a("labels.configured")] }) : null })), c = r(A.Fragment, { children: [a("labels.authenticatorAppManage"), " ", d] });
  return r(zt, Object.assign({ name: "authenticator-app-manage-dropdown", title: c, checkedItemID: n, setCheckedItemID: e }, { children: [r(Re, { children: a(i ? "headlines.authenticatorAppAlreadySetUp" : "headlines.authenticatorAppNotSetUp") }), r(z, { children: [a(i ? "texts.authenticatorAppAlreadySetUp" : "texts.authenticatorAppNotSetUp"), r("br", {}), r(ee, i ? Object.assign({ hidden: !s, uiAction: "auth-app-remove", onClick: (l) => t(l), loadingSpinnerPosition: "right", dangerous: !0 }, { children: a("labels.delete") }) : Object.assign({ uiAction: "auth-app-add", onClick: (l) => o(l), loadingSpinnerPosition: "right" }, { children: a("labels.authenticatorAppAdd") }))] })] }));
};
var je = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const Li = (n) => {
  var e, t, o, i, s, a, d, c, l, u, h, g, f, x, O, C, S, P, $, N, U, ie, ye, se, ke, M, q, ge, De, Ee, Le, re, ae, he, Ie, k, p, y, L, K, pe, We, qe, ze, m, v, b, j, T, I, W, X;
  const { t: G } = (0, _.useContext)(Z.TranslateContext), { hanko: ve, setLoadingAction: w, stateHandler: be, setUIState: J, setPage: H } = (0, _.useContext)(ue), { flowState: E } = Ne(n.state), [we, B] = (0, _.useState)(""), F = (R, V, Qe) => je(void 0, void 0, void 0, function* () {
    R.preventDefault(), w(V);
    const In = yield Qe();
    In != null && In.error || (B(null), yield new Promise((Wi) => setTimeout(Wi, 360))), w(null), yield ve.flow.run(In, be);
  }), Me = (R) => je(void 0, void 0, void 0, function* () {
    return F(R, "password-delete", E.actions.password_delete(null).run);
  }), ot = (R) => je(void 0, void 0, void 0, function* () {
    return F(R, "username-delete", E.actions.username_delete(null).run);
  }), fe = (R, V, Qe) => je(void 0, void 0, void 0, function* () {
    return F(R, "webauthn-credential-rename", E.actions.webauthn_credential_rename({ passkey_id: V, passkey_name: Qe }).run);
  }), Kt = (R) => je(void 0, void 0, void 0, function* () {
    return F(R, "account_delete", E.actions.account_delete(null).run);
  }), it = (R) => (R.preventDefault(), H(r(Li, { state: E, enablePasskeys: n.enablePasskeys })), Promise.resolve());
  return r(Oe, { children: [r(Pe, { state: ((e = E == null ? void 0 : E.error) === null || e === void 0 ? void 0 : e.code) !== "form_data_invalid_error" ? E : null }), !((o = (t = E.actions).username_create) === null || o === void 0) && o.call(t, null) || !((s = (i = E.actions).username_update) === null || s === void 0) && s.call(i, null) || !((d = (a = E.actions).username_delete) === null || d === void 0) && d.call(a, null) ? r(A.Fragment, { children: [r(de, { children: G("labels.username") }), E.payload.user.username ? r(z, { children: r("b", { children: E.payload.user.username.username }) }) : null, r(z, { children: [!((l = (c = E.actions).username_create) === null || l === void 0) && l.call(c, null) ? r(Go, { inputs: E.actions.username_create(null).inputs, hasUsername: !!E.payload.user.username, allowUsernameDeletion: !!(!((h = (u = E.actions).username_delete) === null || h === void 0) && h.call(u, null)), onUsernameSubmit: (R, V) => je(void 0, void 0, void 0, function* () {
    return F(R, "username-set", E.actions.username_create({ username: V }).run);
  }), onUsernameDelete: ot, checkedItemID: we, setCheckedItemID: B }) : null, !((f = (g = E.actions).username_update) === null || f === void 0) && f.call(g, null) ? r(Go, { inputs: E.actions.username_update(null).inputs, hasUsername: !!E.payload.user.username, allowUsernameDeletion: !!(!((O = (x = E.actions).username_delete) === null || O === void 0) && O.call(x, null)), onUsernameSubmit: (R, V) => je(void 0, void 0, void 0, function* () {
    return F(R, "username-set", E.actions.username_update({ username: V }).run);
  }), onUsernameDelete: ot, checkedItemID: we, setCheckedItemID: B }) : null] })] }) : null, !((S = (C = E.payload) === null || C === void 0 ? void 0 : C.user) === null || S === void 0) && S.emails || !(($ = (P = E.actions).email_create) === null || $ === void 0) && $.call(P, null) ? r(A.Fragment, { children: [r(de, { children: G("headlines.profileEmails") }), r(z, { children: [r(Ir, { emails: E.payload.user.emails, onEmailDelete: (R, V) => je(void 0, void 0, void 0, function* () {
    return F(R, "email-delete", E.actions.email_delete({ email_id: V }).run);
  }), onEmailSetPrimary: (R, V) => je(void 0, void 0, void 0, function* () {
    return F(R, "email-set-primary", E.actions.email_set_primary({ email_id: V }).run);
  }), onEmailVerify: (R, V) => je(void 0, void 0, void 0, function* () {
    return F(R, "email-verify", E.actions.email_verify({ email_id: V }).run);
  }), checkedItemID: we, setCheckedItemID: B, deletableEmailIDs: (ie = (U = (N = E.actions).email_delete) === null || U === void 0 ? void 0 : U.call(N, null).inputs.email_id.allowed_values) === null || ie === void 0 ? void 0 : ie.map((R) => R.value) }), !((se = (ye = E.actions).email_create) === null || se === void 0) && se.call(ye, null) ? r($r, { inputs: E.actions.email_create(null).inputs, onEmailSubmit: (R, V) => je(void 0, void 0, void 0, function* () {
    return J((Qe) => Object.assign(Object.assign({}, Qe), { email: V })), F(R, "email-submit", E.actions.email_create({ email: V }).run);
  }), checkedItemID: we, setCheckedItemID: B }) : null] })] }) : null, !((M = (ke = E.actions).password_create) === null || M === void 0) && M.call(ke, null) ? r(A.Fragment, { children: [r(de, { children: G("headlines.profilePassword") }), r(z, { children: r(Jo, { inputs: E.actions.password_create(null).inputs, onPasswordSubmit: (R, V) => je(void 0, void 0, void 0, function* () {
    return F(R, "password-submit", E.actions.password_create({ password: V }).run);
  }), onPasswordDelete: Me, checkedItemID: we, setCheckedItemID: B }) })] }) : null, !((ge = (q = E.actions).password_update) === null || ge === void 0) && ge.call(q, null) ? r(A.Fragment, { children: [r(de, { children: G("headlines.profilePassword") }), r(z, { children: r(Jo, { allowPasswordDelete: !!(!((Ee = (De = E.actions).password_delete) === null || Ee === void 0) && Ee.call(De, null)), inputs: E.actions.password_update(null).inputs, onPasswordSubmit: (R, V) => je(void 0, void 0, void 0, function* () {
    return F(R, "password-submit", E.actions.password_update({ password: V }).run);
  }), onPasswordDelete: Me, checkedItemID: we, setCheckedItemID: B, passwordExists: !0 }) })] }) : null, n.enablePasskeys && (!((re = (Le = E.payload) === null || Le === void 0 ? void 0 : Le.user) === null || re === void 0) && re.passkeys || !((he = (ae = E.actions).webauthn_credential_create) === null || he === void 0) && he.call(ae, null)) ? r(A.Fragment, { children: [r(de, { children: G("headlines.profilePasskeys") }), r(z, { children: [r(Zo, { onBack: it, onCredentialNameSubmit: fe, onCredentialDelete: (R, V) => je(void 0, void 0, void 0, function* () {
    return F(R, "passkey-delete", E.actions.webauthn_credential_delete({ passkey_id: V }).run);
  }), credentials: E.payload.user.passkeys, setError: null, checkedItemID: we, setCheckedItemID: B, allowCredentialDeletion: !!(!((k = (Ie = E.actions).webauthn_credential_delete) === null || k === void 0) && k.call(Ie, null)), credentialType: "passkey" }), !((y = (p = E.actions).webauthn_credential_create) === null || y === void 0) && y.call(p, null) ? r(Qo, { credentialType: "passkey", onCredentialSubmit: (R) => je(void 0, void 0, void 0, function* () {
    return F(R, "passkey-submit", E.actions.webauthn_credential_create(null).run);
  }), setError: null, checkedItemID: we, setCheckedItemID: B }) : null] })] }) : null, !((L = E.payload.user.mfa_config) === null || L === void 0) && L.security_keys_enabled ? r(A.Fragment, { children: [r(de, { children: G("headlines.securityKeys") }), r(z, { children: [r(Zo, { onBack: it, onCredentialNameSubmit: fe, onCredentialDelete: (R, V) => je(void 0, void 0, void 0, function* () {
    return F(R, "security-key-delete", E.actions.security_key_delete({ security_key_id: V }).run);
  }), credentials: E.payload.user.security_keys, setError: null, checkedItemID: we, setCheckedItemID: B, allowCredentialDeletion: !!(!((pe = (K = E.actions).security_key_delete) === null || pe === void 0) && pe.call(K, null)), credentialType: "security-key" }), !((qe = (We = E.actions).security_key_create) === null || qe === void 0) && qe.call(We, null) ? r(Qo, { credentialType: "security-key", onCredentialSubmit: (R) => je(void 0, void 0, void 0, function* () {
    return F(R, "security-key-submit", E.actions.security_key_create(null).run);
  }), setError: null, checkedItemID: we, setCheckedItemID: B }) : null] })] }) : null, !((ze = E.payload.user.mfa_config) === null || ze === void 0) && ze.totp_enabled ? r(A.Fragment, { children: [r(de, { children: G("headlines.authenticatorApp") }), r(z, { children: r(Tr, { onConnect: (R) => je(void 0, void 0, void 0, function* () {
    return F(R, "auth-app-add", E.actions.continue_to_otp_secret_creation(null).run);
  }), onDelete: (R) => je(void 0, void 0, void 0, function* () {
    return F(R, "auth-app-remove", E.actions.otp_secret_delete(null).run);
  }), allowDeletion: !!(!((v = (m = E.actions).otp_secret_delete) === null || v === void 0) && v.call(m, null)), authAppSetUp: (b = E.payload.user.mfa_config) === null || b === void 0 ? void 0 : b.auth_app_set_up, checkedItemID: we, setCheckedItemID: B }) })] }) : null, E.payload.sessions ? r(A.Fragment, { children: [r(de, { children: G("headlines.profileSessions") }), r(z, { children: r(Lr, { sessions: E.payload.sessions, setError: null, checkedItemID: we, setCheckedItemID: B, onSessionDelete: (R, V) => je(void 0, void 0, void 0, function* () {
    return F(R, "session-delete", E.actions.session_delete({ session_id: V }).run);
  }), deletableSessionIDs: (I = (T = (j = E.actions).session_delete) === null || T === void 0 ? void 0 : T.call(j, null).inputs.session_id.allowed_values) === null || I === void 0 ? void 0 : I.map((R) => R.value) }) })] }) : null, !((X = (W = E.actions).account_delete) === null || X === void 0) && X.call(W, null) ? r(A.Fragment, { children: [r(Pn, {}), r(z, { children: r(_o, {}) }), r(z, { children: r(ne, Object.assign({ onSubmit: (R) => (R.preventDefault(), H(r(Dr, { onBack: it, onAccountDelete: Kt })), Promise.resolve()) }, { children: r(te, Object.assign({ dangerous: !0 }, { children: G("headlines.deleteAccount") })) })) })] }) : null] });
}, Nr = Li, Yo = ({ state: n, error: e }) => {
  const { t } = (0, _.useContext)(Z.TranslateContext), { init: o, componentName: i } = (0, _.useContext)(ue), s = (0, _.useCallback)(() => o(i), [i, o]);
  return (0, _.useEffect)(() => (addEventListener("hankoAuthSuccess", s), () => {
    removeEventListener("hankoAuthSuccess", s);
  }), [s]), r(Oe, { children: [r(de, { children: t("headlines.error") }), r(Pe, { state: n, error: e }), r(ne, Object.assign({ onSubmit: (a) => {
    a.preventDefault(), s();
  } }, { children: r(te, Object.assign({ uiAction: "retry" }, { children: t("labels.continue") })) }))] });
};
var Wn = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const Ur = (n) => {
  var e, t, o, i;
  const { t: s } = (0, _.useContext)(Z.TranslateContext), { hanko: a, stateHandler: d, setLoadingAction: c } = (0, _.useContext)(ue), { flowState: l } = Ne(n.state), [u, h] = (0, _.useState)();
  return r(A.Fragment, { children: [r(Oe, { children: [r(de, { children: s("headlines.createEmail") }), r(Pe, { state: l }), r(ne, Object.assign({ onSubmit: (g) => Wn(void 0, void 0, void 0, function* () {
    g.preventDefault(), c("email-submit");
    const f = yield l.actions.email_address_set({ email: u }).run();
    c(null), yield a.flow.run(f, d);
  }) }, { children: [r(Ke, { type: "email", autoComplete: "email", autoCorrect: "off", flowInput: (t = (e = l.actions).email_address_set) === null || t === void 0 ? void 0 : t.call(e, null).inputs.email, onInput: (g) => Wn(void 0, void 0, void 0, function* () {
    g.target instanceof HTMLInputElement && h(g.target.value);
  }), placeholder: s("labels.email"), pattern: "^.*[^0-9]+$", value: u }), r(te, Object.assign({ uiAction: "email-submit" }, { children: s("labels.continue") }))] }))] }), r(Ue, Object.assign({ hidden: !(!((i = (o = l.actions).skip) === null || i === void 0) && i.call(o, null)) }, { children: [r("span", { hidden: !0 }), r(ee, Object.assign({ uiAction: "skip", onClick: (g) => Wn(void 0, void 0, void 0, function* () {
    g.preventDefault(), c("skip");
    const f = yield l.actions.skip(null).run();
    c(null), yield a.flow.run(f, d);
  }), loadingSpinnerPosition: "left" }, { children: s("labels.skip") }))] }))] });
};
var qn = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const Mr = (n) => {
  var e, t, o, i;
  const { t: s } = (0, _.useContext)(Z.TranslateContext), { hanko: a, stateHandler: d, setLoadingAction: c } = (0, _.useContext)(ue), { flowState: l } = Ne(n.state), [u, h] = (0, _.useState)();
  return r(A.Fragment, { children: [r(Oe, { children: [r(de, { children: s("headlines.createUsername") }), r(Pe, { state: l }), r(ne, Object.assign({ onSubmit: (g) => qn(void 0, void 0, void 0, function* () {
    g.preventDefault(), c("username-set");
    const f = yield l.actions.username_create({ username: u }).run();
    c(null), yield a.flow.run(f, d);
  }) }, { children: [r(Ke, { type: "text", autoComplete: "username", autoCorrect: "off", flowInput: (t = (e = l.actions).username_create) === null || t === void 0 ? void 0 : t.call(e, null).inputs.username, onInput: (g) => qn(void 0, void 0, void 0, function* () {
    g.target instanceof HTMLInputElement && h(g.target.value);
  }), value: u, placeholder: s("labels.username") }), r(te, Object.assign({ uiAction: "username-set" }, { children: s("labels.continue") }))] }))] }), r(Ue, Object.assign({ hidden: !(!((i = (o = l.actions).skip) === null || i === void 0) && i.call(o, null)) }, { children: [r("span", { hidden: !0 }), r(ee, Object.assign({ uiAction: "skip", onClick: (g) => qn(void 0, void 0, void 0, function* () {
    g.preventDefault(), c("skip");
    const f = yield l.actions.skip(null).run();
    c(null), yield a.flow.run(f, d);
  }), loadingSpinnerPosition: "left" }, { children: s("labels.skip") }))] }))] });
};
var Xt = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const Hr = (n) => {
  var e, t, o, i, s, a, d, c, l, u, h, g;
  const { t: f } = (0, _.useContext)(Z.TranslateContext), { hanko: x, setLoadingAction: O, stateHandler: C } = (0, _.useContext)(ue), { flowState: S } = Ne(n.state);
  return r(A.Fragment, { children: [r(Oe, { children: [r(de, { children: f("headlines.setupLoginMethod") }), r(Pe, { flowError: S == null ? void 0 : S.error }), r(z, { children: f("texts.selectLoginMethodForFutureLogins") }), r(ne, Object.assign({ hidden: !(!((t = (e = S.actions).continue_to_passkey_registration) === null || t === void 0) && t.call(e, null)), onSubmit: (P) => Xt(void 0, void 0, void 0, function* () {
    P.preventDefault(), O("passkey-submit");
    const $ = yield S.actions.continue_to_passkey_registration(null).run();
    O(null), yield x.flow.run($, C);
  }) }, { children: r(te, Object.assign({ secondary: !0, uiAction: "passkey-submit", icon: "passkey" }, { children: f("labels.passkey") })) })), r(ne, Object.assign({ hidden: !(!((i = (o = S.actions).continue_to_password_registration) === null || i === void 0) && i.call(o, null)), onSubmit: (P) => Xt(void 0, void 0, void 0, function* () {
    P.preventDefault(), O("password-submit");
    const $ = yield S.actions.continue_to_password_registration(null).run();
    O(null), yield x.flow.run($, C);
  }) }, { children: r(te, Object.assign({ secondary: !0, uiAction: "password-submit", icon: "password" }, { children: f("labels.password") })) }))] }), r(Ue, Object.assign({ hidden: !(!((a = (s = S.actions).back) === null || a === void 0) && a.call(s, null)) && !(!((c = (d = S.actions).skip) === null || c === void 0) && c.call(d, null)) }, { children: [r(ee, Object.assign({ uiAction: "back", onClick: (P) => Xt(void 0, void 0, void 0, function* () {
    P.preventDefault(), O("back");
    const $ = yield S.actions.back(null).run();
    O(null), yield x.flow.run($, C);
  }), loadingSpinnerPosition: "right", hidden: !(!((u = (l = S.actions).back) === null || u === void 0) && u.call(l, null)) }, { children: f("labels.back") })), r(ee, Object.assign({ uiAction: "skip", onClick: (P) => Xt(void 0, void 0, void 0, function* () {
    P.preventDefault(), O("skip");
    const $ = yield S.actions.skip(null).run();
    O(null), yield x.flow.run($, C);
  }), loadingSpinnerPosition: "left", hidden: !(!((g = (h = S.actions).skip) === null || g === void 0) && g.call(h, null)) }, { children: f("labels.skip") }))] }))] });
};
var zn = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const Rr = (n) => {
  var e, t, o, i;
  const { t: s } = (0, _.useContext)(Z.TranslateContext), { flowState: a } = Ne(n.state), { hanko: d, setLoadingAction: c, stateHandler: l } = (0, _.useContext)(ue), [u, h] = (0, _.useState)([]), g = (0, _.useCallback)((f) => zn(void 0, void 0, void 0, function* () {
    c("passcode-submit");
    const x = yield a.actions.otp_code_validate({ otp_code: f }).run();
    c(null), yield d.flow.run(x, l);
  }), [d, a, c, l]);
  return (0, _.useEffect)(() => {
    var f;
    ((f = a.error) === null || f === void 0 ? void 0 : f.code) === "passcode_invalid" && h([]);
  }, [a]), r(A.Fragment, { children: [r(Oe, { children: [r(de, { children: s("headlines.otpLogin") }), r(Pe, { state: a }), r(z, { children: s("texts.otpLogin") }), r(ne, Object.assign({ onSubmit: (f) => zn(void 0, void 0, void 0, function* () {
    return f.preventDefault(), g(u.join(""));
  }) }, { children: [r(bo, { onInput: (f) => {
    if (h(f), f.filter((x) => x !== "").length === 6) return g(f.join(""));
  }, passcodeDigits: u, numberOfInputs: 6 }), r(te, Object.assign({ uiAction: "passcode-submit" }, { children: s("labels.continue") }))] }))] }), r(Ue, Object.assign({ hidden: !(!((t = (e = a.actions).continue_to_login_security_key) === null || t === void 0) && t.call(e, null)) }, { children: r(ee, Object.assign({ uiAction: "skip", onClick: (f) => zn(void 0, void 0, void 0, function* () {
    f.preventDefault(), c("skip");
    const x = yield a.actions.continue_to_login_security_key(null).run();
    c(null), yield d.flow.run(x, l);
  }), loadingSpinnerPosition: "right", hidden: !(!((i = (o = a.actions).continue_to_login_security_key) === null || i === void 0) && i.call(o, null)) }, { children: s("labels.useAnotherMethod") })) }))] });
};
var Xo = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const Wr = (n) => {
  var e, t, o, i;
  const { t: s } = (0, _.useContext)(Z.TranslateContext), { hanko: a, setLoadingAction: d, stateHandler: c } = (0, _.useContext)(ue), { flowState: l } = Ne(n.state);
  return r(A.Fragment, { children: [r(Oe, { children: [r(de, { children: s("headlines.securityKeyLogin") }), r(Pe, { state: l }), r(z, { children: s("texts.securityKeyLogin") }), r(ne, Object.assign({ onSubmit: (u) => Xo(void 0, void 0, void 0, function* () {
    u.preventDefault(), d("passkey-submit");
    const h = yield l.actions.webauthn_generate_request_options(null).run();
    yield a.flow.run(h, c);
  }) }, { children: r(te, Object.assign({ uiAction: "passkey-submit", autofocus: !0, icon: "securityKey" }, { children: s("labels.securityKeyUse") })) }))] }), r(Ue, Object.assign({ hidden: !(!((t = (e = l.actions).continue_to_login_otp) === null || t === void 0) && t.call(e, null)) }, { children: r(ee, Object.assign({ uiAction: "skip", onClick: (u) => Xo(void 0, void 0, void 0, function* () {
    u.preventDefault(), d("skip");
    const h = yield l.actions.continue_to_login_otp(null).run();
    d(null), yield a.flow.run(h, c);
  }), loadingSpinnerPosition: "right", hidden: !(!((i = (o = l.actions).continue_to_login_otp) === null || i === void 0) && i.call(o, null)) }, { children: s("labels.useAnotherMethod") })) }))] });
};
var en = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const qr = (n) => {
  var e, t, o, i, s, a, d, c;
  const { t: l } = (0, _.useContext)(Z.TranslateContext), { hanko: u, setLoadingAction: h, stateHandler: g } = (0, _.useContext)(ue), { flowState: f } = Ne(n.state), x = (S) => en(void 0, void 0, void 0, function* () {
    S.preventDefault(), h("passcode-submit");
    const P = yield f.actions.continue_to_security_key_creation(null).run();
    h(null), yield u.flow.run(P, g);
  }), O = (S) => en(void 0, void 0, void 0, function* () {
    S.preventDefault(), h("password-submit");
    const P = yield f.actions.continue_to_otp_secret_creation(null).run();
    h(null), yield u.flow.run(P, g);
  }), C = (0, _.useMemo)(() => {
    const { actions: S } = f;
    return S.continue_to_security_key_creation && !S.continue_to_otp_secret_creation ? x : !S.continue_to_security_key_creation && S.continue_to_otp_secret_creation ? O : void 0;
  }, [f, x, O]);
  return r(A.Fragment, { children: [r(Oe, { children: [r(de, { children: l("headlines.mfaSetUp") }), r(Pe, { flowError: f == null ? void 0 : f.error }), r(z, { children: l("texts.mfaSetUp") }), C ? r(ne, Object.assign({ onSubmit: C }, { children: r(te, Object.assign({ uiAction: "passcode-submit" }, { children: l("labels.continue") })) })) : r(A.Fragment, { children: [r(ne, Object.assign({ hidden: !(!((t = (e = f.actions).continue_to_security_key_creation) === null || t === void 0) && t.call(e, null)), onSubmit: x }, { children: r(te, Object.assign({ secondary: !0, uiAction: "passcode-submit", icon: "securityKey" }, { children: l("labels.securityKey") })) })), r(ne, Object.assign({ hidden: !(!((i = (o = f.actions).continue_to_otp_secret_creation) === null || i === void 0) && i.call(o, null)), onSubmit: O }, { children: r(te, Object.assign({ secondary: !0, uiAction: "password-submit", icon: "qrCodeScanner" }, { children: l("labels.authenticatorApp") })) }))] })] }), r(Ue, { children: [r(ee, Object.assign({ uiAction: "back", onClick: (S) => en(void 0, void 0, void 0, function* () {
    S.preventDefault(), h("back");
    const P = yield f.actions.back(null).run();
    h(null), yield u.flow.run(P, g);
  }), loadingSpinnerPosition: "right", hidden: !(!((a = (s = f.actions).back) === null || a === void 0) && a.call(s, null)) }, { children: l("labels.back") })), r(ee, Object.assign({ uiAction: "skip", onClick: (S) => en(void 0, void 0, void 0, function* () {
    S.preventDefault(), h("skip");
    const P = yield f.actions.skip(null).run();
    h(null), yield u.flow.run(P, g);
  }), loadingSpinnerPosition: "left", hidden: !(!((c = (d = f.actions).skip) === null || c === void 0) && c.call(d, null)) }, { children: l("labels.skip") }))] })] });
};
var mn = Y(560), $t = {};
$t.setAttributes = tt(), $t.insert = (n) => {
  window._hankoStyle = n;
}, $t.domAPI = et(), $t.insertStyleElement = nt(), Xe()(mn.A, $t);
const zr = mn.A && mn.A.locals ? mn.A.locals : void 0, Fr = ({ children: n, text: e }) => {
  const { t } = (0, _.useContext)(Z.TranslateContext), [o, i] = (0, _.useState)(!1);
  return r("section", Object.assign({ className: Rt.clipboardContainer }, { children: [r("div", { children: [n, " "] }), r("div", Object.assign({ className: Rt.clipboardIcon, onClick: (s) => {
    return a = void 0, d = void 0, l = function* () {
      s.preventDefault();
      try {
        yield navigator.clipboard.writeText(e), i(!0), setTimeout(() => i(!1), 1500);
      } catch (u) {
        console.error("Failed to copy: ", u);
      }
    }, new ((c = void 0) || (c = Promise))(function(u, h) {
      function g(O) {
        try {
          x(l.next(O));
        } catch (C) {
          h(C);
        }
      }
      function f(O) {
        try {
          x(l.throw(O));
        } catch (C) {
          h(C);
        }
      }
      function x(O) {
        var C;
        O.done ? u(O.value) : (C = O.value, C instanceof c ? C : new c(function(S) {
          S(C);
        })).then(g, f);
      }
      x((l = l.apply(a, d || [])).next());
    });
    var a, d, c, l;
  } }, { children: o ? r("span", { children: ["- ", t("labels.copied")] }) : r(Wt, { name: "copy", secondary: !0, size: 13 }) }))] }));
}, Kr = ({ src: n, secret: e }) => {
  const { t } = (0, _.useContext)(Z.TranslateContext);
  return r("div", Object.assign({ className: zr.otpCreationDetails }, { children: [r("img", { alt: "QR-Code", src: n }), r(Pn, {}), r(Fr, Object.assign({ text: e }, { children: t("texts.otpSecretKey") })), r("div", { children: e })] }));
};
var Fn = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const Br = (n) => {
  const { t: e } = (0, _.useContext)(Z.TranslateContext), { flowState: t } = Ne(n.state), { hanko: o, uiState: i, setLoadingAction: s, stateHandler: a } = (0, _.useContext)(ue), [d, c] = (0, _.useState)([]), l = (0, _.useCallback)((u) => Fn(void 0, void 0, void 0, function* () {
    s("passcode-submit");
    const h = yield t.actions.otp_code_verify({ otp_code: u }).run();
    s(null), yield o.flow.run(h, a);
  }), [t, s, a]);
  return (0, _.useEffect)(() => {
    var u;
    ((u = t.error) === null || u === void 0 ? void 0 : u.code) === "passcode_invalid" && c([]);
  }, [t]), r(A.Fragment, { children: [r(Oe, { children: [r(de, { children: e("headlines.otpSetUp") }), r(Pe, { state: t }), r(z, { children: e("texts.otpScanQRCode") }), r(Kr, { src: t.payload.otp_image_source, secret: t.payload.otp_secret }), r(z, { children: e("texts.otpEnterVerificationCode") }), r(ne, Object.assign({ onSubmit: (u) => Fn(void 0, void 0, void 0, function* () {
    return u.preventDefault(), l(d.join(""));
  }) }, { children: [r(bo, { onInput: (u) => {
    if (c(u), u.filter((h) => h !== "").length === 6) return l(u.join(""));
  }, passcodeDigits: d, numberOfInputs: 6 }), r(te, Object.assign({ uiAction: "passcode-submit" }, { children: e("labels.continue") }))] }))] }), r(Ue, { children: r(ee, Object.assign({ onClick: (u) => Fn(void 0, void 0, void 0, function* () {
    u.preventDefault(), s("back");
    const h = yield t.actions.back(null).run();
    s(null), yield o.flow.run(h, a);
  }), loadingSpinnerPosition: "right", isLoading: i.loadingAction === "back" }, { children: e("labels.back") })) })] });
};
var ei = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const Vr = (n) => {
  var e, t, o, i;
  const { t: s } = (0, _.useContext)(Z.TranslateContext), { hanko: a, setLoadingAction: d, stateHandler: c } = (0, _.useContext)(ue), { flowState: l } = Ne(n.state);
  return r(A.Fragment, { children: [r(Oe, { children: [r(de, { children: s("headlines.securityKeySetUp") }), r(Pe, { state: l }), r(z, { children: s("texts.securityKeySetUp") }), r(ne, Object.assign({ onSubmit: (u) => ei(void 0, void 0, void 0, function* () {
    u.preventDefault(), d("passkey-submit");
    const h = yield l.actions.webauthn_generate_creation_options(null).run();
    yield a.flow.run(h, c);
  }) }, { children: r(te, Object.assign({ uiAction: "passkey-submit", autofocus: !0, icon: "securityKey" }, { children: s("labels.createSecurityKey") })) }))] }), r(Ue, Object.assign({ hidden: !(!((t = (e = l.actions).back) === null || t === void 0) && t.call(e, null)) }, { children: r(ee, Object.assign({ uiAction: "back", onClick: (u) => ei(void 0, void 0, void 0, function* () {
    u.preventDefault(), d("back");
    const h = yield l.actions.back(null).run();
    d(null), yield a.flow.run(h, c);
  }), loadingSpinnerPosition: "right", hidden: !(!((i = (o = l.actions).back) === null || i === void 0) && i.call(o, null)) }, { children: s("labels.back") })) }))] });
};
var Kn = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const Zr = (n) => {
  var e, t, o, i;
  const { t: s } = (0, _.useContext)(Z.TranslateContext), { hanko: a, setLoadingAction: d, stateHandler: c } = (0, _.useContext)(ue), { flowState: l } = Ne(n.state);
  return r(A.Fragment, { children: [r(Oe, { children: [r(de, { children: s("headlines.trustDevice") }), r(Pe, { flowError: l == null ? void 0 : l.error }), r(z, { children: s("texts.trustDevice") }), r(ne, Object.assign({ onSubmit: (u) => Kn(void 0, void 0, void 0, function* () {
    u.preventDefault(), d("trust-device-submit");
    const h = yield l.actions.trust_device(null).run();
    d(null), yield a.flow.run(h, c);
  }) }, { children: r(te, Object.assign({ uiAction: "trust-device-submit" }, { children: s("labels.trustDevice") })) }))] }), r(Ue, { children: [r(ee, Object.assign({ uiAction: "back", onClick: (u) => Kn(void 0, void 0, void 0, function* () {
    u.preventDefault(), d("back");
    const h = yield l.actions.back(null).run();
    d(null), yield a.flow.run(h, c);
  }), loadingSpinnerPosition: "right", hidden: !(!((t = (e = l.actions).back) === null || t === void 0) && t.call(e, null)) }, { children: s("labels.back") })), r(ee, Object.assign({ uiAction: "skip", onClick: (u) => Kn(void 0, void 0, void 0, function* () {
    u.preventDefault(), d("skip");
    const h = yield l.actions.skip(null).run();
    d(null), yield a.flow.run(h, c);
  }), loadingSpinnerPosition: "left", hidden: !(!((i = (o = l.actions).skip) === null || i === void 0) && i.call(o, null)) }, { children: s("labels.skip") }))] })] });
};
var Fe = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const tn = "flow-state", ue = (0, A.createContext)(null), Jr = (n) => {
  var { lang: e, experimental: t = "", prefilledEmail: o, prefilledUsername: i, globalOptions: s, createWebauthnAbortSignal: a } = n, d = function(p, y) {
    var L = {};
    for (var K in p) Object.prototype.hasOwnProperty.call(p, K) && y.indexOf(K) < 0 && (L[K] = p[K]);
    if (p != null && typeof Object.getOwnPropertySymbols == "function") {
      var pe = 0;
      for (K = Object.getOwnPropertySymbols(p); pe < K.length; pe++) y.indexOf(K[pe]) < 0 && Object.prototype.propertyIsEnumerable.call(p, K[pe]) && (L[K[pe]] = p[K[pe]]);
    }
    return L;
  }(n, ["lang", "experimental", "prefilledEmail", "prefilledUsername", "globalOptions", "createWebauthnAbortSignal"]);
  const { hanko: c, injectStyles: l, hidePasskeyButtonOnLogin: u, translations: h, translationsLocation: g, fallbackLanguage: f } = s;
  c.setLang((e == null ? void 0 : e.toString()) || f);
  const x = (0, _.useRef)(null), O = (0, _.useMemo)(() => `${s.storageKey}_last_login`, [s.storageKey]), [C, S] = (0, _.useState)(d.componentName), P = (0, _.useMemo)(() => t.split(" ").filter((p) => p.length).map((p) => p), [t]), $ = (0, _.useMemo)(() => r(_r, {}), []), [N, U] = (0, _.useState)($), [, ie] = (0, _.useState)(c), [ye, se] = (0, _.useState)(), [ke, M] = (0, _.useState)({ email: o, username: i }), q = (0, _.useCallback)((p) => {
    M((y) => Object.assign(Object.assign({}, y), { loadingAction: p, succeededAction: null, error: null, lastAction: p || y.lastAction }));
  }, []), ge = (0, _.useCallback)((p) => {
    M((y) => Object.assign(Object.assign({}, y), { succeededAction: p, loadingAction: null }));
  }, []), De = (0, _.useCallback)(() => {
    M((p) => Object.assign(Object.assign({}, p), { succeededAction: p.lastAction, loadingAction: null, error: null }));
  }, []), Ee = (0, _.useMemo)(() => !!ke.loadingAction || !!ke.succeededAction, [ke]), Le = function(p, y) {
    var L;
    (L = x.current) === null || L === void 0 || L.dispatchEvent(new CustomEvent(p, { detail: y, bubbles: !1, composed: !0 }));
  }, re = (p) => {
    q(null), U(r(Yo, { error: p instanceof xe ? p : new $e(p) }));
  }, ae = (0, _.useMemo)(() => ({ onError: (p) => {
    re(p);
  }, preflight(p) {
    return Fe(this, void 0, void 0, function* () {
      const y = yield mt.isConditionalMediationAvailable(), L = yield mt.isPlatformAuthenticatorAvailable(), K = yield p.actions.register_client_capabilities({ webauthn_available: k, webauthn_conditional_mediation_available: y, webauthn_platform_authenticator_available: L }).run();
      return c.flow.run(K, ae);
    });
  }, login_init(p) {
    return Fe(this, void 0, void 0, function* () {
      U(r(br, { state: p })), function() {
        Fe(this, void 0, void 0, function* () {
          if (p.payload.request_options) {
            let y;
            try {
              y = yield Ko({ publicKey: p.payload.request_options.publicKey, mediation: "conditional", signal: a() });
            } catch {
              return;
            }
            q("passkey-submit");
            const L = yield p.actions.webauthn_verify_assertion_response({ assertion_response: y }).run();
            q(null), yield c.flow.run(L, ae);
          }
        });
      }();
    });
  }, passcode_confirmation(p) {
    U(r(Sr, { state: p }));
  }, login_otp(p) {
    return Fe(this, void 0, void 0, function* () {
      U(r(Rr, { state: p }));
    });
  }, login_passkey(p) {
    return Fe(this, void 0, void 0, function* () {
      let y;
      q("passkey-submit");
      try {
        y = yield Ko(Object.assign(Object.assign({}, p.payload.request_options), { signal: a() }));
      } catch {
        const pe = yield p.actions.back(null).run();
        return M((We) => Object.assign(Object.assign({}, We), { error: p.error, loadingAction: null })), c.flow.run(pe, ae);
      }
      const L = yield p.actions.webauthn_verify_assertion_response({ assertion_response: y }).run();
      q(null), yield c.flow.run(L, ae);
    });
  }, onboarding_create_passkey(p) {
    U(r(xr, { state: p }));
  }, onboarding_verify_passkey_attestation(p) {
    return Fe(this, void 0, void 0, function* () {
      let y;
      try {
        y = yield Fo(Object.assign(Object.assign({}, p.payload.creation_options), { signal: a() }));
      } catch {
        const pe = yield p.actions.back(null).run();
        return q(null), yield c.flow.run(pe, ae), void M((We) => Object.assign(Object.assign({}, We), { error: { code: "webauthn_credential_already_exists", message: "Webauthn credential already exists" } }));
      }
      const L = yield p.actions.webauthn_verify_attestation_response({ public_key: y }).run();
      q(null), yield c.flow.run(L, ae);
    });
  }, webauthn_credential_verification(p) {
    return Fe(this, void 0, void 0, function* () {
      let y;
      try {
        y = yield Fo(Object.assign(Object.assign({}, p.payload.creation_options), { signal: a() }));
      } catch {
        const pe = yield p.actions.back(null).run();
        return q(null), yield c.flow.run(pe, ae), void M((We) => Object.assign(Object.assign({}, We), { error: { code: "webauthn_credential_already_exists", message: "Webauthn credential already exists" } }));
      }
      const L = yield p.actions.webauthn_verify_attestation_response({ public_key: y }).run();
      yield c.flow.run(L, ae);
    });
  }, login_password(p) {
    U(r(Cr, { state: p }));
  }, login_password_recovery(p) {
    U(r(Ar, { state: p }));
  }, login_security_key(p) {
    return Fe(this, void 0, void 0, function* () {
      U(r(Wr, { state: p }));
    });
  }, mfa_method_chooser(p) {
    return Fe(this, void 0, void 0, function* () {
      U(r(qr, { state: p }));
    });
  }, mfa_otp_secret_creation(p) {
    return Fe(this, void 0, void 0, function* () {
      U(r(Br, { state: p }));
    });
  }, mfa_security_key_creation(p) {
    return Fe(this, void 0, void 0, function* () {
      U(r(Vr, { state: p }));
    });
  }, login_method_chooser(p) {
    U(r(Or, { state: p }));
  }, registration_init(p) {
    U(r(Pr, { state: p }));
  }, password_creation(p) {
    U(r(Er, { state: p }));
  }, success(p) {
    var y;
    !((y = p.payload) === null || y === void 0) && y.last_login && localStorage.setItem(O, JSON.stringify(p.payload.last_login));
    const { claims: L } = p.payload, K = Date.parse(L.expiration) - Date.now();
    c.relay.dispatchSessionCreatedEvent({ claims: L, expirationSeconds: K }), De();
  }, profile_init(p) {
    U(r(Nr, { state: p, enablePasskeys: s.enablePasskeys }));
  }, thirdparty(p) {
    return Fe(this, void 0, void 0, function* () {
      const y = new URLSearchParams(window.location.search).get("hanko_token");
      if (y && y.length > 0) {
        const L = new URLSearchParams(window.location.search), K = yield p.actions.exchange_token({ token: L.get("hanko_token") }).run();
        L.delete("hanko_token"), L.delete("saml_hint"), history.replaceState(null, null, window.location.pathname + (L.size < 1 ? "" : `?${L.toString()}`)), yield c.flow.run(K, ae);
      } else M((L) => Object.assign(Object.assign({}, L), { lastAction: null })), localStorage.setItem(tn, JSON.stringify(p.toJSON())), window.location.assign(p.payload.redirect_url);
    });
  }, error(p) {
    q(null), U(r(Yo, { state: p }));
  }, onboarding_email(p) {
    U(r(Ur, { state: p }));
  }, onboarding_username(p) {
    U(r(Mr, { state: p }));
  }, credential_onboarding_chooser(p) {
    U(r(Hr, { state: p }));
  }, account_deleted(p) {
    return Fe(this, void 0, void 0, function* () {
      yield c.user.logout(), c.relay.dispatchUserDeletedEvent();
    });
  }, device_trust(p) {
    U(r(Zr, { state: p }));
  } }), [s.enablePasskeys, c, De, q]), he = (0, _.useCallback)((p) => Fe(void 0, void 0, void 0, function* () {
    q("switch-flow");
    const y = localStorage.getItem(O);
    y && se(JSON.parse(y));
    const L = new URLSearchParams(window.location.search).get("hanko_token"), K = localStorage.getItem(tn);
    new URLSearchParams(window.location.search).get("saml_hint") === "idp_initiated" ? yield c.flow.init("/token_exchange", Object.assign({}, ae)) : K && K.length > 0 && L && L.length > 0 ? (yield c.flow.fromString(localStorage.getItem(tn), Object.assign({}, ae)), localStorage.removeItem(tn)) : yield c.flow.init(p, Object.assign({}, ae)), q(null);
  }), [ae]), Ie = (0, _.useCallback)((p) => {
    switch (p) {
      case "auth":
      case "login":
        he("/login").catch(re);
        break;
      case "registration":
        he("/registration").catch(re);
        break;
      case "profile":
        he("/profile").catch(re);
    }
  }, [he]);
  (0, _.useEffect)(() => Ie(C), []), (0, _.useEffect)(() => {
    c.onUserDeleted(() => {
      Le("onUserDeleted");
    }), c.onSessionCreated((p) => {
      Le("onSessionCreated", p);
    }), c.onSessionExpired(() => {
      Le("onSessionExpired");
    }), c.onUserLoggedOut(() => {
      Le("onUserLoggedOut");
    });
  }, [c]), (0, _.useMemo)(() => {
    const p = () => {
      Ie(C);
    };
    ["auth", "login", "registration"].includes(C) ? (c.onUserLoggedOut(p), c.onSessionExpired(p), c.onUserDeleted(p)) : C === "profile" && c.onSessionCreated(p);
  }, []);
  const k = mt.supported();
  return r(ue.Provider, Object.assign({ value: { init: Ie, initialComponentName: d.componentName, isDisabled: Ee, setUIState: M, setLoadingAction: q, setSucceededAction: ge, uiState: ke, hanko: c, setHanko: ie, lang: (e == null ? void 0 : e.toString()) || f, prefilledEmail: o, prefilledUsername: i, componentName: C, setComponentName: S, experimentalFeatures: P, hidePasskeyButtonOnLogin: u, page: N, setPage: U, stateHandler: ae, lastLogin: ye } }, { children: r(Z.TranslateProvider, Object.assign({ translations: h, fallbackLang: f, root: g }, { children: r(Xs, Object.assign({ ref: x }, { children: C !== "events" ? r(A.Fragment, { children: [l ? r("style", { dangerouslySetInnerHTML: { __html: window._hankoStyle.innerHTML } }) : null, N] }) : null })) })) }));
}, Qr = { en: Y(6).en };
var Ti = function(n, e, t, o) {
  return new (t || (t = Promise))(function(i, s) {
    function a(l) {
      try {
        c(o.next(l));
      } catch (u) {
        s(u);
      }
    }
    function d(l) {
      try {
        c(o.throw(l));
      } catch (u) {
        s(u);
      }
    }
    function c(l) {
      var u;
      l.done ? i(l.value) : (u = l.value, u instanceof t ? u : new t(function(h) {
        h(u);
      })).then(a, d);
    }
    c((o = o.apply(n, [])).next());
  });
};
const Ge = {}, Ft = (n, e) => r(Jr, Object.assign({ componentName: n, globalOptions: Ge, createWebauthnAbortSignal: na }, e)), Gr = (n) => Ft("auth", n), Yr = (n) => Ft("login", n), Xr = (n) => Ft("registration", n), ea = (n) => Ft("profile", n), ta = (n) => Ft("events", n);
let nn = new AbortController();
const na = () => (nn && nn.abort(), nn = new AbortController(), nn.signal), Dt = ({ tagName: n, entryComponent: e, shadow: t = !0, observedAttributes: o }) => Ti(void 0, void 0, void 0, function* () {
  customElements.get(n) || function(i, s, a, d) {
    function c() {
      var l = Reflect.construct(HTMLElement, [], c);
      return l._vdomComponent = i, l._root = d && d.shadow ? l.attachShadow({ mode: "open" }) : l, l;
    }
    (c.prototype = Object.create(HTMLElement.prototype)).constructor = c, c.prototype.connectedCallback = ms, c.prototype.attributeChangedCallback = gs, c.prototype.disconnectedCallback = vs, a = a || i.observedAttributes || Object.keys(i.propTypes || {}), c.observedAttributes = a, a.forEach(function(l) {
      Object.defineProperty(c.prototype, l, { get: function() {
        var u, h, g, f;
        return (u = (h = this._vdom) == null || (g = h.props) == null ? void 0 : g[l]) != null ? u : (f = this._props) == null ? void 0 : f[l];
      }, set: function(u) {
        this._vdom ? this.attributeChangedCallback(l, null, u) : (this._props || (this._props = {}), this._props[l] = u, this.connectedCallback());
        var h = typeof u;
        u != null && h !== "string" && h !== "boolean" && h !== "number" || this.setAttribute(l, u);
      } });
    }), customElements.define(s || i.tagName || i.displayName || i.name, c);
  }(e, n, o, { shadow: t });
}), oa = (n, e = {}) => Ti(void 0, void 0, void 0, function* () {
  const t = ["api", "lang", "experimental", "prefilled-email", "entry"];
  return e = Object.assign({ shadow: !0, injectStyles: !0, enablePasskeys: !0, hidePasskeyButtonOnLogin: !1, translations: null, translationsLocation: "/i18n", fallbackLanguage: "en", storageKey: "hanko", sessionCheckInterval: 3e4 }, e), Ge.hanko = new $i(n, { cookieName: e.storageKey, cookieDomain: e.cookieDomain, cookieSameSite: e.cookieSameSite, localStorageKey: e.storageKey, sessionCheckInterval: e.sessionCheckInterval, sessionTokenLocation: e.sessionTokenLocation }), Ge.injectStyles = e.injectStyles, Ge.enablePasskeys = e.enablePasskeys, Ge.hidePasskeyButtonOnLogin = e.hidePasskeyButtonOnLogin, Ge.translations = e.translations || Qr, Ge.translationsLocation = e.translationsLocation, Ge.fallbackLanguage = e.fallbackLanguage, Ge.storageKey = e.storageKey, yield Promise.all([Dt(Object.assign(Object.assign({}, e), { tagName: "hanko-auth", entryComponent: Gr, observedAttributes: t })), Dt(Object.assign(Object.assign({}, e), { tagName: "hanko-login", entryComponent: Yr, observedAttributes: t })), Dt(Object.assign(Object.assign({}, e), { tagName: "hanko-registration", entryComponent: Xr, observedAttributes: t })), Dt(Object.assign(Object.assign({}, e), { tagName: "hanko-profile", entryComponent: ea, observedAttributes: t.filter((o) => ["api", "lang"].includes(o)) })), Dt(Object.assign(Object.assign({}, e), { tagName: "hanko-events", entryComponent: ta, observedAttributes: [] }))]), { hanko: Ge.hanko };
});
oe.fK;
oe.tJ;
oe.Z7;
oe.Q9;
oe.Lv;
oe.qQ;
var ia = oe.I4;
oe.O8;
oe.ku;
oe.ls;
oe.bO;
oe.yv;
oe.AT;
oe.m_;
oe.KG;
oe.DH;
oe.kf;
oe.oY;
oe.xg;
oe.Wg;
oe.J;
oe.AC;
oe.D_;
oe.jx;
oe.nX;
oe.Nx;
oe.Sd;
var Ni = oe.kz;
oe.fX;
oe.qA;
oe.tz;
oe.gN;
const sa = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Hanko: ia,
  register: Ni
}, Symbol.toStringTag, { value: "Module" }));
var Qn = "";
function ti(n) {
  Qn = n;
}
function ra(n = "") {
  if (!Qn) {
    const e = document.querySelector("[data-webawesome]");
    if (e != null && e.hasAttribute("data-webawesome")) {
      const t = new URL(e.getAttribute("data-webawesome") ?? "", window.location.href).pathname;
      ti(t);
    } else {
      const o = [...document.getElementsByTagName("script")].find(
        (i) => i.src.endsWith("webawesome.js") || i.src.endsWith("webawesome.loader.js") || i.src.endsWith("webawesome.ssr-loader.js")
      );
      if (o) {
        const i = String(o.getAttribute("src"));
        ti(i.split("/").slice(0, -1).join("/"));
      }
    }
  }
  return Qn.replace(/\/$/, "") + (n ? `/${n.replace(/^\//, "")}` : "");
}
new MutationObserver((n) => {
  for (const { addedNodes: e } of n)
    for (const t of e)
      t.nodeType === Node.ELEMENT_NODE && aa(t);
});
async function aa(n) {
  const e = n instanceof Element ? n.tagName.toLowerCase() : "", t = e == null ? void 0 : e.startsWith("wa-"), o = [...n.querySelectorAll(":not(:defined)")].map((a) => a.tagName.toLowerCase()).filter((a) => a.startsWith("wa-"));
  t && !customElements.get(e) && o.push(e);
  const i = [...new Set(o)], s = await Promise.allSettled(i.map((a) => la(a)));
  for (const a of s)
    a.status === "rejected" && console.warn(a.reason);
  await new Promise(requestAnimationFrame), n.dispatchEvent(
    new CustomEvent("wa-discovery-complete", {
      bubbles: !1,
      cancelable: !1,
      composed: !0
    })
  );
}
function la(n) {
  if (customElements.get(n))
    return Promise.resolve();
  const e = n.replace(/^wa-/i, ""), t = ra(`components/${e}/${e}.js`);
  return new Promise((o, i) => {
    import(t).then(() => o()).catch(() => i(new Error(`Unable to autoload <${n}> from ${t}`)));
  });
}
const ca = /* @__PURE__ */ new Set(), on = /* @__PURE__ */ new Map(), Ui = typeof MutationObserver < "u" && typeof document < "u" && typeof document.documentElement < "u";
if (Ui) {
  const n = new MutationObserver(Hi);
  document.documentElement.dir, document.documentElement.lang || navigator.language, n.observe(document.documentElement, {
    attributes: !0,
    attributeFilter: ["dir", "lang"]
  });
}
function Mi(...n) {
  n.map((e) => {
    const t = e.$code.toLowerCase();
    on.has(t) ? on.set(t, Object.assign(Object.assign({}, on.get(t)), e)) : on.set(t, e);
  }), Hi();
}
function Hi() {
  Ui && (document.documentElement.dir, document.documentElement.lang || navigator.language), [...ca.keys()].map((n) => {
    typeof n.requestUpdate == "function" && n.requestUpdate();
  });
}
var Ri = {
  $code: "en",
  $name: "English",
  $dir: "ltr",
  carousel: "Carousel",
  clearEntry: "Clear entry",
  close: "Close",
  copied: "Copied",
  copy: "Copy",
  currentValue: "Current value",
  error: "Error",
  goToSlide: (n, e) => `Go to slide ${n} of ${e}`,
  hidePassword: "Hide password",
  loading: "Loading",
  nextSlide: "Next slide",
  numOptionsSelected: (n) => n === 0 ? "No options selected" : n === 1 ? "1 option selected" : `${n} options selected`,
  previousSlide: "Previous slide",
  progress: "Progress",
  remove: "Remove",
  resize: "Resize",
  scrollableRegion: "Scrollable region",
  scrollToEnd: "Scroll to end",
  scrollToStart: "Scroll to start",
  selectAColorFromTheScreen: "Select a color from the screen",
  showPassword: "Show password",
  slideNum: (n) => `Slide ${n}`,
  toggleColorFormat: "Toggle color format",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out"
};
Mi(Ri);
var da = Ri;
Mi(da);
var ua = Object.defineProperty, ha = Object.getOwnPropertyDescriptor, Ce = (n, e, t, o) => {
  for (var i = o > 1 ? void 0 : o ? ha(e, t) : e, s = n.length - 1, a; s >= 0; s--)
    (a = n[s]) && (i = (o ? a(e, t, i) : a(i)) || i);
  return o && i && ua(e, t, i), i;
};
const ce = {
  primary: null,
  // The primary instance that makes API calls
  user: null,
  osmConnected: !1,
  osmData: null,
  loading: !0,
  hanko: null,
  initialized: !1,
  instances: /* @__PURE__ */ new Set()
}, ni = (n) => `hanko-verified-${n}`, oi = (n) => `hanko-onboarding-${n}`;
let _e = class extends Ut {
  constructor() {
    super(...arguments), this.hankoUrlAttr = "", this.basePath = "", this.authPath = "/api/auth/osm", this.osmRequired = !1, this.osmScopes = "read_prefs", this.showProfile = !1, this.redirectAfterLogin = "", this.autoConnect = !1, this.verifySession = !1, this.redirectAfterLogout = "", this.displayNameAttr = "", this.mappingCheckUrl = "", this.appId = "", this.user = null, this.osmConnected = !1, this.osmData = null, this.osmLoading = !1, this.loading = !0, this.error = null, this.profileDisplayName = "", this.hasAppMapping = !1, this._trailingSlashCache = {}, this._debugMode = !1, this._sessionJWT = null, this._lastSessionId = null, this._hanko = null, this._isPrimary = !1, this._handleVisibilityChange = () => {
      this._isPrimary && !document.hidden && !this.showProfile && !this.user && (this.log("👁️ Page visible, re-checking session..."), this.checkSession());
    }, this._handleWindowFocus = () => {
      this._isPrimary && !this.showProfile && !this.user && (this.log("🎯 Window focused, re-checking session..."), this.checkSession());
    }, this._handleExternalLogin = (n) => {
      var t;
      if (!this._isPrimary) return;
      const e = n;
      !this.showProfile && !this.user && ((t = e.detail) != null && t.user) && (this.log("🔔 External login detected, updating user state..."), this.user = e.detail.user, this._broadcastState(), this.checkOSMConnection());
    };
  }
  // Get computed hankoUrl (priority: attribute > meta tag > window.HANKO_URL > origin)
  get hankoUrl() {
    if (this.hankoUrlAttr)
      return this.hankoUrlAttr;
    const n = document.querySelector('meta[name="hanko-url"]');
    if (n) {
      const t = n.getAttribute("content");
      if (t)
        return this.log("🔍 hanko-url auto-detected from <meta> tag:", t), t;
    }
    if (window.HANKO_URL)
      return this.log(
        "🔍 hanko-url auto-detected from window.HANKO_URL:",
        window.HANKO_URL
      ), window.HANKO_URL;
    const e = window.location.origin;
    return this.log("🔍 hanko-url auto-detected from window.location.origin:", e), e;
  }
  connectedCallback() {
    super.connectedCallback(), this._debugMode = this._checkDebugMode(), this.log("🔌 hanko-auth connectedCallback called"), ce.instances.add(this), document.addEventListener("visibilitychange", this._handleVisibilityChange), window.addEventListener("focus", this._handleWindowFocus), document.addEventListener("hanko-login", this._handleExternalLogin);
  }
  // Use firstUpdated instead of connectedCallback to ensure React props are set
  firstUpdated() {
    this.log("🔌 hanko-auth firstUpdated called"), this.log("  hankoUrl:", this.hankoUrl), this.log("  basePath:", this.basePath), ce.initialized || ce.primary ? (this.log("🔄 Using shared state from primary instance"), this._syncFromShared(), this._isPrimary = !1) : (this.log("👑 This is the primary instance"), this._isPrimary = !0, ce.primary = this, ce.initialized = !0, this.init());
  }
  disconnectedCallback() {
    if (super.disconnectedCallback(), document.removeEventListener(
      "visibilitychange",
      this._handleVisibilityChange
    ), window.removeEventListener("focus", this._handleWindowFocus), document.removeEventListener("hanko-login", this._handleExternalLogin), ce.instances.delete(this), this._isPrimary && ce.instances.size > 0) {
      const n = ce.instances.values().next().value;
      n && (this.log("👑 Promoting new primary instance"), n._isPrimary = !0, ce.primary = n);
    }
    ce.instances.size === 0 && (ce.initialized = !1, ce.primary = null);
  }
  // Sync local state from shared state (only if values changed to prevent render loops)
  _syncFromShared() {
    this.user !== ce.user && (this.user = ce.user), this.osmConnected !== ce.osmConnected && (this.osmConnected = ce.osmConnected), this.osmData !== ce.osmData && (this.osmData = ce.osmData), this.loading !== ce.loading && (this.loading = ce.loading), this._hanko !== ce.hanko && (this._hanko = ce.hanko);
  }
  // Update shared state and broadcast to all instances
  _broadcastState() {
    ce.user = this.user, ce.osmConnected = this.osmConnected, ce.osmData = this.osmData, ce.loading = this.loading, ce.instances.forEach((n) => {
      n !== this && n._syncFromShared();
    });
  }
  _checkDebugMode() {
    if (new URLSearchParams(window.location.search).get("debug") === "true")
      return !0;
    try {
      return localStorage.getItem("hanko-auth-debug") === "true";
    } catch {
      return !1;
    }
  }
  log(...n) {
    this._debugMode && console.log(...n);
  }
  warn(...n) {
    console.warn(...n);
  }
  logError(...n) {
    console.error(...n);
  }
  getBasePath() {
    return this.basePath ? (this.log("🔍 getBasePath() using basePath:", this.basePath), this.basePath) : (this.log("🔍 getBasePath() using default: empty string"), "");
  }
  addTrailingSlash(n, e) {
    const t = this._trailingSlashCache[e];
    return t !== void 0 && t && !n.endsWith("/") ? n + "/" : n;
  }
  async detectTrailingSlash(n, e) {
    if (this._trailingSlashCache[n] !== void 0)
      return this.log(
        `🔍 Using cached trailing slash preference for ${n}: ${this._trailingSlashCache[n]}`
      ), this._trailingSlashCache[n];
    const t = window.location.origin, o = `${n}${e}`;
    this.log("🔍 Auto-detecting trailing slash preference..."), this.log(`  Testing: ${t}${o}`);
    try {
      const i = await fetch(`${t}${o}`, {
        method: "GET",
        credentials: "include",
        redirect: "follow"
      }), a = new URL(i.url).pathname;
      return this.log(`  Original path: ${o}`), this.log(`  Final path: ${a}`), !o.endsWith("/") && a.endsWith("/") ? (this.log(
        `  ✅ Detected trailing slash needed (redirected to ${a})`
      ), this._trailingSlashCache[n] = !0, !0) : (this.log("  ✅ Detected no trailing slash needed"), this._trailingSlashCache[n] = !1, !1);
    } catch (i) {
      return this.logError("  ❌ Error during trailing slash detection:", i), this._trailingSlashCache[n] = !1, !1;
    }
  }
  async init() {
    if (!this._isPrimary) {
      this.log("⏭️ Not primary, skipping init...");
      return;
    }
    try {
      await Ni(this.hankoUrl, {
        enablePasskeys: !1,
        hidePasskeyButtonOnLogin: !0
      });
      const { Hanko: n } = await Promise.resolve().then(() => sa), e = window.location.hostname, o = e === "localhost" || e === "127.0.0.1" ? {} : {
        cookieDomain: ".hotosm.org",
        cookieName: "hanko",
        cookieSameSite: "lax"
      };
      this._hanko = new n(this.hankoUrl, o), ce.hanko = this._hanko, this._hanko.onSessionExpired(() => {
        this.log("🕒 Hanko session expired event received"), this.handleSessionExpired();
      }), this._hanko.onUserLoggedOut(() => {
        this.log("🚪 Hanko user logged out event received"), this.handleUserLoggedOut();
      }), await this.checkSession(), await this.checkOSMConnection(), await this.fetchProfileDisplayName(), this.loading = !1, this._broadcastState(), this.setupEventListeners();
    } catch (n) {
      this.logError("Failed to initialize hanko-auth:", n), this.error = n.message, this.loading = !1, this._broadcastState();
    }
  }
  async checkSession() {
    if (this.log("🔍 Checking for existing Hanko session..."), !this._hanko) {
      this.log("⚠️ Hanko instance not initialized yet");
      return;
    }
    try {
      this.log("📡 Checking session validity via cookie...");
      try {
        const n = await fetch(
          `${this.hankoUrl}/sessions/validate`,
          {
            method: "GET",
            credentials: "include",
            // Include httpOnly cookies
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
        if (n.ok) {
          const e = await n.json();
          if (e.is_valid === !1) {
            this.log(
              "ℹ️ Session validation returned is_valid:false - no valid session"
            );
            return;
          }
          this.log("✅ Valid Hanko session found via cookie"), this.log("📋 Session data:", e);
          try {
            const t = await fetch(`${this.hankoUrl}/me`, {
              method: "GET",
              credentials: "include",
              // Include httpOnly cookies
              headers: {
                "Content-Type": "application/json"
              }
            });
            if (t.ok) {
              const o = await t.json();
              this.log("👤 User data retrieved from /me:", o), this.user = {
                id: o.user_id,
                email: o.email || null,
                username: o.username || null,
                emailVerified: !1
              };
            } else {
              this.log("⚠️ /me endpoint failed, trying SDK fallback");
              const o = await this._hanko.user.getCurrent();
              this.user = {
                id: o.id,
                email: o.email,
                username: o.username,
                emailVerified: o.email_verified || !1
              };
            }
          } catch (t) {
            this.log("⚠️ Failed to get user data:", t), e.user_id && (this.user = {
              id: e.user_id,
              email: e.email || null,
              username: null,
              emailVerified: !1
            });
          }
          if (this.user) {
            const t = ni(window.location.hostname), o = sessionStorage.getItem(t);
            if (this.verifySession && this.redirectAfterLogin && !o) {
              this.log(
                "🔄 verify-session enabled, redirecting to callback for app verification..."
              ), sessionStorage.setItem(t, "true"), window.location.href = this.redirectAfterLogin;
              return;
            }
            if (!await this.checkAppMapping())
              return;
            this.dispatchEvent(
              new CustomEvent("hanko-login", {
                detail: { user: this.user },
                bubbles: !0,
                composed: !0
              })
            ), this.dispatchEvent(
              new CustomEvent("auth-complete", {
                bubbles: !0,
                composed: !0
              })
            ), await this.checkOSMConnection(), await this.fetchProfileDisplayName(), this.osmRequired && this.autoConnect && !this.osmConnected && (this.log(
              "🔄 Auto-connecting to OSM (from existing session)..."
            ), this.handleOSMConnect());
          }
        } else
          this.log("ℹ️ No valid session cookie found - user needs to login");
      } catch (n) {
        this.log("⚠️ Session validation failed:", n), this.log("ℹ️ No valid session - user needs to login");
      }
    } catch (n) {
      this.log("⚠️ Session check error:", n), this.log("ℹ️ No existing session - user needs to login");
    } finally {
      this._isPrimary && this._broadcastState();
    }
  }
  async syncJWTToCookie() {
    try {
      const n = this._sessionJWT;
      if (n) {
        const e = window.location.hostname, t = e === "localhost" || e === "127.0.0.1", o = t ? `; domain=${e}` : "; domain=.hotosm.org";
        document.cookie = `hanko=${n}; path=/${o}; max-age=86400; SameSite=Lax; Secure`, this.log(
          `🔐 JWT synced to cookie for SSO${t ? ` (domain=${e})` : " (domain=.hotosm.org)"}`
        );
      } else
        this.log("⚠️ No JWT found in session event");
    } catch (n) {
      this.logError("Failed to sync JWT to cookie:", n);
    }
  }
  async checkOSMConnection() {
    if (this.osmConnected) {
      this.log("⏭️ Already connected to OSM, skipping check");
      return;
    }
    const n = this.loading;
    n || (this.osmLoading = !0);
    try {
      const e = this.getBasePath(), t = this.authPath, i = `${`${e}${t}/status`}`;
      this.log("🔍 Checking OSM connection at:", i), this.log("  basePath:", e), this.log("  authPath:", t), this.log("🍪 Current cookies:", document.cookie);
      const s = await fetch(i, {
        credentials: "include",
        redirect: "follow"
      });
      if (this.log("📡 OSM status response:", s.status), this.log("📡 Final URL after redirects:", s.url), this.log("📡 Response headers:", [...s.headers.entries()]), s.ok) {
        const a = await s.text();
        this.log("📡 OSM raw response:", a.substring(0, 200));
        let d;
        try {
          d = JSON.parse(a);
        } catch {
          throw this.logError(
            "Failed to parse OSM response as JSON:",
            a.substring(0, 500)
          ), new Error("Invalid JSON response from OSM status endpoint");
        }
        this.log("📡 OSM status data:", d), d.connected ? (this.log("✅ OSM is connected:", d.osm_username), this.osmConnected = !0, this.osmData = d, this.dispatchEvent(
          new CustomEvent("osm-connected", {
            detail: { osmData: d },
            bubbles: !0,
            composed: !0
          })
        )) : (this.log("❌ OSM is NOT connected"), this.osmConnected = !1, this.osmData = null);
      }
    } catch (e) {
      this.logError("OSM connection check failed:", e);
    } finally {
      n || (this.osmLoading = !1), this._isPrimary && this._broadcastState();
    }
  }
  // Check app mapping status (for cross-app auth scenarios)
  // Only used when mapping-check-url is configured
  async checkAppMapping() {
    if (!this.mappingCheckUrl || !this.user)
      return !0;
    const n = oi(window.location.hostname), e = sessionStorage.getItem(n);
    this.log("🔍 Checking app mapping at:", this.mappingCheckUrl);
    try {
      const t = await fetch(this.mappingCheckUrl, {
        credentials: "include"
      });
      if (t.ok) {
        const o = await t.json();
        if (this.log("📡 Mapping check response:", o), o.needs_onboarding) {
          if (e)
            return this.log("⚠️ Already tried onboarding this session, skipping redirect"), !0;
          this.log("⚠️ User needs onboarding, redirecting..."), sessionStorage.setItem(n, "true");
          const i = encodeURIComponent(window.location.origin), s = this.appId ? `onboarding=${this.appId}` : "";
          return window.location.href = `${this.hankoUrl}/app?${s}&return_to=${i}`, !1;
        }
        return sessionStorage.removeItem(n), this.hasAppMapping = !0, this.log("✅ User has app mapping"), !0;
      } else if (t.status === 401 || t.status === 403) {
        if (e)
          return this.log("⚠️ Already tried onboarding this session, skipping redirect"), !0;
        this.log("⚠️ 401/403 - User needs onboarding, redirecting..."), sessionStorage.setItem(n, "true");
        const o = encodeURIComponent(window.location.origin), i = this.appId ? `onboarding=${this.appId}` : "";
        return window.location.href = `${this.hankoUrl}/app?${i}&return_to=${o}`, !1;
      }
      return this.log("⚠️ Unexpected status from mapping check:", t.status), !0;
    } catch (t) {
      return this.log("⚠️ App mapping check failed:", t), !0;
    }
  }
  // Fetch profile display name from login backend
  async fetchProfileDisplayName() {
    try {
      const n = `${this.hankoUrl}/api/profile/me`;
      this.log("👤 Fetching profile from:", n);
      const e = await fetch(n, {
        credentials: "include"
      });
      if (e.ok) {
        const t = await e.json();
        this.log("👤 Profile data:", t), (t.first_name || t.last_name) && (this.profileDisplayName = `${t.first_name || ""} ${t.last_name || ""}`.trim(), this.log("👤 Display name set to:", this.profileDisplayName));
      }
    } catch (n) {
      this.log("⚠️ Could not fetch profile:", n);
    }
  }
  setupEventListeners() {
    this.updateComplete.then(() => {
      var e;
      const n = (e = this.shadowRoot) == null ? void 0 : e.querySelector("hanko-auth");
      n && (n.addEventListener("onSessionCreated", (t) => {
        var i, s;
        this.log("🎯 Hanko event: onSessionCreated", t.detail);
        const o = (s = (i = t.detail) == null ? void 0 : i.claims) == null ? void 0 : s.session_id;
        if (o && this._lastSessionId === o) {
          this.log("⏭️ Skipping duplicate session event");
          return;
        }
        this._lastSessionId = o, this.handleHankoSuccess(t);
      }), n.addEventListener(
        "hankoAuthLogout",
        () => this.handleLogout()
      ));
    });
  }
  async handleHankoSuccess(n) {
    var o, i;
    if (this.log("Hanko auth success:", n.detail), this._sessionJWT = ((o = n.detail) == null ? void 0 : o.jwt) || null, !this._hanko) {
      this.logError("Hanko instance not initialized");
      return;
    }
    let e = !1;
    try {
      const s = new AbortController(), a = setTimeout(() => s.abort(), 5e3), d = await fetch(`${this.hankoUrl}/me`, {
        method: "GET",
        credentials: "include",
        // Include httpOnly cookies
        headers: {
          "Content-Type": "application/json"
        },
        signal: s.signal
      });
      if (clearTimeout(a), d.ok) {
        const c = await d.json();
        this.log("👤 User data retrieved from /me:", c), this.user = {
          id: c.user_id,
          email: c.email || null,
          username: c.username || null,
          emailVerified: !1
        }, e = !0;
      } else
        this.log("⚠️ /me endpoint returned non-OK status, will try SDK fallback");
    } catch (s) {
      this.log("⚠️ /me endpoint fetch failed (timeout or cross-origin TLS issue):", s);
    }
    if (!e)
      try {
        this.log("🔄 Trying SDK fallback for user info...");
        const s = new Promise(
          (d, c) => setTimeout(() => c(new Error("SDK timeout")), 5e3)
        ), a = await Promise.race([
          this._hanko.user.getCurrent(),
          s
        ]);
        this.user = {
          id: a.id,
          email: a.email,
          username: a.username,
          emailVerified: a.email_verified || !1
        }, e = !0, this.log("✅ User info retrieved via SDK fallback");
      } catch (s) {
        this.log("⚠️ SDK fallback failed, trying JWT claims:", s);
        try {
          const a = (i = n.detail) == null ? void 0 : i.claims;
          if (a != null && a.sub)
            this.user = {
              id: a.sub,
              email: a.email || null,
              username: null,
              emailVerified: a.email_verified || !1
            }, e = !0, this.log("✅ User info extracted from JWT claims");
          else {
            this.logError("No user claims available in event"), this.user = null;
            return;
          }
        } catch (a) {
          this.logError("Failed to extract user info from claims:", a), this.user = null;
          return;
        }
      }
    if (this.log("✅ User state updated:", this.user), this._isPrimary && this._broadcastState(), this.dispatchEvent(
      new CustomEvent("hanko-login", {
        detail: { user: this.user },
        bubbles: !0,
        composed: !0
      })
    ), await this.checkOSMConnection(), await this.fetchProfileDisplayName(), this.osmRequired && this.autoConnect && !this.osmConnected) {
      this.log("🔄 Auto-connecting to OSM..."), this.handleOSMConnect();
      return;
    }
    const t = !this.osmRequired || this.osmConnected;
    this.log(
      "🔄 Checking redirect-after-login:",
      this.redirectAfterLogin,
      "showProfile:",
      this.showProfile,
      "canRedirect:",
      t
    ), t ? (this.dispatchEvent(
      new CustomEvent("auth-complete", {
        bubbles: !0,
        composed: !0
      })
    ), this.redirectAfterLogin ? (this.log("✅ Redirecting to:", this.redirectAfterLogin), window.location.href = this.redirectAfterLogin) : this.log("❌ No redirect (redirectAfterLogin not set)")) : this.log("⏸️ Waiting for OSM connection before redirect");
  }
  async handleOSMConnect() {
    const n = this.osmScopes.split(" ").join("+"), e = this.getBasePath(), t = this.authPath, i = `${`${e}${t}/login`}?scopes=${n}`;
    this.log("🔗 OSM Connect clicked!"), this.log("  basePath:", e), this.log("  authPath:", t), this.log("  Login path:", i), this.log("  Fetching redirect URL from backend...");
    try {
      const s = await fetch(i, {
        method: "GET",
        credentials: "include",
        redirect: "manual"
        // Don't follow redirect, we'll do it manually
      });
      if (this.log("  Response status:", s.status), this.log("  Response type:", s.type), s.status === 0 || s.type === "opaqueredirect") {
        const a = s.headers.get("Location") || s.url;
        this.log("  ✅ Got redirect URL:", a), window.location.href = a;
      } else if (s.status >= 300 && s.status < 400) {
        const a = s.headers.get("Location");
        this.log("  ✅ Got redirect URL from header:", a), a && (window.location.href = a);
      } else {
        this.logError("  ❌ Unexpected response:", s.status);
        const a = await s.text();
        this.logError("  Response body:", a.substring(0, 200));
      }
    } catch (s) {
      this.logError("  ❌ Failed to fetch redirect URL:", s);
    }
  }
  async handleLogout() {
    this.log("🚪 Logout initiated"), this.log("📊 Current state before logout:", {
      user: this.user,
      osmConnected: this.osmConnected,
      osmData: this.osmData
    }), this.log("🍪 Cookies before logout:", document.cookie);
    try {
      const n = this.getBasePath(), e = this.authPath, t = window.location.origin, o = this.addTrailingSlash(
        `${n}${e}/disconnect`,
        n
      ), i = `${t}${o}`;
      this.log("🔌 Calling OSM disconnect:", i);
      const s = await fetch(i, {
        method: "POST",
        credentials: "include"
      });
      this.log("📡 Disconnect response status:", s.status);
      const a = await s.json();
      this.log("📡 Disconnect response data:", a), this.log("✅ OSM disconnected");
    } catch (n) {
      this.logError("❌ OSM disconnect failed:", n);
    }
    if (this._hanko)
      try {
        await this._hanko.user.logout(), this.log("✅ Hanko logout successful");
      } catch (n) {
        this.logError("Hanko logout failed:", n);
      }
    this._clearAuthState(), this.log(
      "✅ Logout complete - component will re-render with updated state"
    ), this.redirectAfterLogout && (this.log("🔄 Redirecting after logout to:", this.redirectAfterLogout), window.location.href = this.redirectAfterLogout);
  }
  /**
   * Clear all auth state - shared between logout and session expired handlers
   */
  _clearAuthState() {
    const n = window.location.hostname;
    document.cookie = `hanko=; path=/; domain=${n}; max-age=0`, document.cookie = "hanko=; path=/; max-age=0", document.cookie = `osm_connection=; path=/; domain=${n}; max-age=0`, document.cookie = "osm_connection=; path=/; max-age=0", this.log("🍪 Cookies cleared");
    const e = ni(n), t = oi(n);
    sessionStorage.removeItem(e), sessionStorage.removeItem(t), this.log("🔄 Session flags cleared"), this.user = null, this.osmConnected = !1, this.osmData = null, this.hasAppMapping = !1, this._isPrimary && this._broadcastState(), this.dispatchEvent(
      new CustomEvent("logout", {
        bubbles: !0,
        composed: !0
      })
    );
  }
  async handleSessionExpired() {
    if (this.log("🕒 Session expired event received"), this.log("📊 Current state:", {
      user: this.user,
      osmConnected: this.osmConnected
    }), this.user) {
      this.log("✅ User is logged in, ignoring stale session expired event");
      return;
    }
    this.log("🧹 No active user - cleaning up state");
    try {
      const n = this.getBasePath(), e = this.authPath, t = window.location.origin, o = this.addTrailingSlash(
        `${n}${e}/disconnect`,
        n
      ), i = `${t}${o}`;
      this.log(
        "🔌 Calling OSM disconnect (session expired):",
        i
      );
      const s = await fetch(i, {
        method: "POST",
        credentials: "include"
      });
      this.log("📡 Disconnect response status:", s.status);
      const a = await s.json();
      this.log("📡 Disconnect response data:", a), this.log("✅ OSM disconnected");
    } catch (n) {
      this.logError("❌ OSM disconnect failed:", n);
    }
    this._clearAuthState(), this.log("✅ Session cleanup complete"), this.redirectAfterLogout && (this.log(
      "🔄 Redirecting after session expired to:",
      this.redirectAfterLogout
    ), window.location.href = this.redirectAfterLogout);
  }
  handleUserLoggedOut() {
    this.log("🚪 User logged out in another window/tab"), this.handleSessionExpired();
  }
  handleDropdownSelect(n) {
    const e = n.detail.item.value;
    if (this.log("🎯 Dropdown item selected:", e), e === "profile") {
      const t = this.hankoUrl, o = this.redirectAfterLogin || window.location.origin;
      window.location.href = `${t}/app/profile?return_to=${encodeURIComponent(o)}`;
    } else if (e === "connect-osm") {
      const i = window.location.pathname.includes("/app") ? window.location.origin : window.location.href, s = this.hankoUrl;
      window.location.href = `${s}/app?return_to=${encodeURIComponent(
        i
      )}&osm_required=true`;
    } else e === "logout" && this.handleLogout();
  }
  handleSkipOSM() {
    this.dispatchEvent(new CustomEvent("osm-skipped")), this.dispatchEvent(new CustomEvent("auth-complete")), this.redirectAfterLogin && (window.location.href = this.redirectAfterLogin);
  }
  render() {
    var n, e, t;
    if (this.log(
      "🎨 RENDER - showProfile:",
      this.showProfile,
      "user:",
      !!this.user,
      "loading:",
      this.loading
    ), this.loading)
      return He`
        <wa-button appearance="plain" size="small" disabled>Log in</wa-button>
      `;
    if (this.error)
      return He`
        <div class="container">
          <div class="error">${this.error}</div>
        </div>
      `;
    if (this.user) {
      const o = this.osmRequired && !this.osmConnected && !this.osmLoading, i = this.displayNameAttr || this.profileDisplayName || this.user.username || this.user.email || this.user.id, s = i ? i[0].toUpperCase() : "U";
      return this.showProfile ? He`
          <div class="container">
            <div class="profile">
              <div class="profile-header">
                <div class="profile-avatar">${s}</div>
                <div class="profile-info">
                  <div class="profile-name">
                    ${i}
                  </div>
                  <div class="profile-email">
                    ${this.user.email || this.user.id}
                  </div>
                </div>
              </div>

              ${this.osmRequired && this.osmLoading ? He`
                    <div class="osm-section">
                      <div class="loading">Checking OSM connection...</div>
                    </div>
                  ` : this.osmRequired && this.osmConnected ? He`
                    <div class="osm-section">
                      <div class="osm-connected">
                        <div class="osm-badge">
                          <span class="osm-badge-icon">🗺️</span>
                          <div>
                            <div>Connected to OpenStreetMap</div>
                            ${(n = this.osmData) != null && n.osm_username ? He`
                                  <div class="osm-username">
                                    @${this.osmData.osm_username}
                                  </div>
                                ` : ""}
                          </div>
                        </div>
                      </div>
                    </div>
                  ` : ""}
              ${o ? He`
                    <div class="osm-section">
                      ${this.autoConnect ? He`
                            <div class="osm-connecting">
                              <div class="spinner"></div>
                              <div class="connecting-text">
                                🗺️ Connecting to OpenStreetMap...
                              </div>
                            </div>
                          ` : He`
                            <div class="osm-prompt-title">🌍 OSM Required</div>
                            <div class="osm-prompt-text">
                              This endpoint requires OSM connection.
                            </div>
                            <button
                              @click=${this.handleOSMConnect}
                              class="btn-primary"
                            >
                              Connect OSM Account
                            </button>
                          `}
                    </div>
                  ` : ""}

              <button @click=${this.handleLogout} class="btn-logout">
                Logout
              </button>
            </div>
          </div>
        ` : He`
          <wa-dropdown
            placement="bottom-start"
            distance="4"
            @wa-select=${this.handleDropdownSelect}
          >
            <wa-button
              slot="trigger"
              class="no-hover"
              appearance="plain"
              size="small"
              style="position: relative;"
            >
              <span class="header-avatar">${s}</span>
              ${this.osmConnected ? He`
                    <span
                      class="osm-status-badge connected"
                      title="Connected to OSM as @${(e = this.osmData) == null ? void 0 : e.osm_username}"
                      >✓</span
                    >
                  ` : this.osmRequired ? He`
                    <span
                      class="osm-status-badge required"
                      title="OSM connection required"
                      >!</span
                    >
                  ` : ""}
            </wa-button>
            <div class="profile-info">
              <div class="profile-name">${i}</div>
              <div class="profile-email">
                ${this.user.email || this.user.id}
              </div>
            </div>
            <wa-dropdown-item value="profile">
              <wa-icon slot="icon" name="user"></wa-icon>
              My Profile
            </wa-dropdown-item>
            ${this.osmConnected ? He`
                  <wa-dropdown-item value="osm-connected" disabled>
                    <wa-icon slot="icon" name="check"></wa-icon>
                    Connected to OSM (@${(t = this.osmData) == null ? void 0 : t.osm_username})
                  </wa-dropdown-item>
                ` : He`
                  <wa-dropdown-item value="connect-osm">
                    <wa-icon slot="icon" name="map"></wa-icon>
                    Connect OSM
                  </wa-dropdown-item>
                `}
            <wa-dropdown-item value="logout" variant="danger">
              <wa-icon slot="icon" name="right-from-bracket"></wa-icon>
              Sign Out
            </wa-dropdown-item>
          </wa-dropdown>
        `;
    } else {
      if (this.showProfile)
        return He`
          <div class="container">
            <hanko-auth></hanko-auth>
          </div>
        `;
      {
        const i = window.location.pathname.includes("/app"), s = this.redirectAfterLogin || (i ? window.location.origin : window.location.href), d = new URLSearchParams(window.location.search).get("auto_connect") === "true" ? "&auto_connect=true" : "", c = this.hankoUrl;
        this.log("🔗 Login URL base:", c);
        const l = `${c}/app?return_to=${encodeURIComponent(
          s
        )}${this.osmRequired ? "&osm_required=true" : ""}${d}`;
        return He`<wa-button
          appearance="plain"
          size="small"
          href="${l}"
          >Log in
        </wa-button> `;
      }
    }
  }
};
_e.styles = zi`
    :host {
      display: block;
      font-family: system-ui, -apple-system, sans-serif;
    }

    .container {
      max-width: 400px;
      margin: 0 auto;
      padding: 20px;
    }

    .loading {
      text-align: center;
      padding: 40px;
      color: #666;
    }

    .osm-connecting {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 20px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #d73f3f;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }

    .connecting-text {
      font-size: 14px;
      color: #666;
      font-weight: 500;
    }

    .error {
      background: #fee;
      border: 1px solid #fcc;
      border-radius: 4px;
      padding: 12px;
      color: #c33;
      margin-bottom: 16px;
    }

    .profile {
      background: #f9f9f9;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
    }

    .profile-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .profile-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #ddd;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: bold;
      color: #666;
    }

    .profile-info {
      padding: 8px 16px;
    }

    .profile-name {
      font-weight: 600;
    }

    .profile-email {
      font-size: 14px;
      color: #666;
    }

    .osm-section {
      border-top: 1px solid #e5e5e5;
      padding-top: 16px;
      padding-bottom: 16px;
      margin-top: 16px;
      margin-bottom: 16px;
      text-align: center;
    }

    .osm-connected {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
      background: linear-gradient(135deg, #e8f5e8 0%, #f0f9f0 100%);
      border-radius: 8px;
      border: 1px solid #c3e6c3;
    }

    .osm-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #2d7a2d;
      font-weight: 500;
      font-size: 14px;
      text-align: left;
    }

    .osm-badge-icon {
      font-size: 18px;
    }

    .osm-username {
      font-size: 13px;
      color: #5a905a;
      margin-top: 4px;
    }

    button {
      width: 100%;
      padding: 12px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #d73f3f;
      color: white;
    }

    .btn-primary:hover {
      background: #c23535;
    }

    .btn-secondary {
      background: #f0f0f0;
      color: #333;
      margin-top: 8px;
    }

    .btn-secondary:hover {
      background: #e0e0e0;
    }

    .osm-prompt {
      background: #fff8e6;
      border: 1px solid #ffe066;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
      text-align: center;
    }

    .osm-prompt-title {
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 12px;
      color: #333;
      text-align: center;
    }

    .osm-prompt-text {
      font-size: 14px;
      color: #666;
      margin-bottom: 16px;
      line-height: 1.5;
      text-align: center;
    }

    .osm-status-badge {
      position: absolute;
      top: -4px;
      right: 10px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      color: white;
      font-weight: bold;
    }

    .osm-status-badge.connected {
      background-color: #10b981;
    }

    .osm-status-badge.required {
      background-color: #f59e0b;
    }
    .header-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #515057;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 600;
      color: white;
    }

    /* Remove hover styles from the dropdown trigger button */
    wa-button.no-hover::part(base) {
      transition: none;
    }
    wa-button.no-hover::part(base):hover,
    wa-button.no-hover::part(base):focus,
    wa-button.no-hover::part(base):active {
      background: transparent !important;
      box-shadow: none !important;
    }
  `;
Ce([
  Be({ type: String, attribute: "hanko-url" })
], _e.prototype, "hankoUrlAttr", 2);
Ce([
  Be({ type: String, attribute: "base-path" })
], _e.prototype, "basePath", 2);
Ce([
  Be({ type: String, attribute: "auth-path" })
], _e.prototype, "authPath", 2);
Ce([
  Be({ type: Boolean, attribute: "osm-required" })
], _e.prototype, "osmRequired", 2);
Ce([
  Be({ type: String, attribute: "osm-scopes" })
], _e.prototype, "osmScopes", 2);
Ce([
  Be({ type: Boolean, attribute: "show-profile" })
], _e.prototype, "showProfile", 2);
Ce([
  Be({ type: String, attribute: "redirect-after-login" })
], _e.prototype, "redirectAfterLogin", 2);
Ce([
  Be({ type: Boolean, attribute: "auto-connect" })
], _e.prototype, "autoConnect", 2);
Ce([
  Be({ type: Boolean, attribute: "verify-session" })
], _e.prototype, "verifySession", 2);
Ce([
  Be({ type: String, attribute: "redirect-after-logout" })
], _e.prototype, "redirectAfterLogout", 2);
Ce([
  Be({ type: String, attribute: "display-name" })
], _e.prototype, "displayNameAttr", 2);
Ce([
  Be({ type: String, attribute: "mapping-check-url" })
], _e.prototype, "mappingCheckUrl", 2);
Ce([
  Be({ type: String, attribute: "app-id" })
], _e.prototype, "appId", 2);
Ce([
  at()
], _e.prototype, "user", 2);
Ce([
  at()
], _e.prototype, "osmConnected", 2);
Ce([
  at()
], _e.prototype, "osmData", 2);
Ce([
  at()
], _e.prototype, "osmLoading", 2);
Ce([
  at()
], _e.prototype, "loading", 2);
Ce([
  at()
], _e.prototype, "error", 2);
Ce([
  at()
], _e.prototype, "profileDisplayName", 2);
Ce([
  at()
], _e.prototype, "hasAppMapping", 2);
_e = Ce([
  ls("hotosm-auth")
], _e);
export {
  _e as HankoAuth
};
