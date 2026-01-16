/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Jt = globalThis, Pn = Jt.ShadowRoot && (Jt.ShadyCSS === void 0 || Jt.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, In = Symbol(), ao = /* @__PURE__ */ new WeakMap();
let Yo = class {
  constructor(t, e, o) {
    if (this._$cssResult$ = !0, o !== In) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t, this.t = e;
  }
  get styleSheet() {
    let t = this.o;
    const e = this.t;
    if (Pn && t === void 0) {
      const o = e !== void 0 && e.length === 1;
      o && (t = ao.get(e)), t === void 0 && ((this.o = t = new CSSStyleSheet()).replaceSync(this.cssText), o && ao.set(e, t));
    }
    return t;
  }
  toString() {
    return this.cssText;
  }
};
const Ti = (n) => new Yo(typeof n == "string" ? n : n + "", void 0, In), Li = (n, ...t) => {
  const e = n.length === 1 ? n[0] : t.reduce((o, i, a) => o + ((s) => {
    if (s._$cssResult$ === !0) return s.cssText;
    if (typeof s == "number") return s;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + s + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(i) + n[a + 1], n[0]);
  return new Yo(e, n, In);
}, Ni = (n, t) => {
  if (Pn) n.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
  else for (const e of t) {
    const o = document.createElement("style"), i = Jt.litNonce;
    i !== void 0 && o.setAttribute("nonce", i), o.textContent = e.cssText, n.appendChild(o);
  }
}, so = Pn ? (n) => n : (n) => n instanceof CSSStyleSheet ? ((t) => {
  let e = "";
  for (const o of t.cssRules) e += o.cssText;
  return Ti(e);
})(n) : n;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: Ui, defineProperty: Mi, getOwnPropertyDescriptor: Ri, getOwnPropertyNames: Hi, getOwnPropertySymbols: Wi, getPrototypeOf: Fi } = Object, tt = globalThis, co = tt.trustedTypes, zi = co ? co.emptyScript : "", gn = tt.reactiveElementPolyfillSupport, Ot = (n, t) => n, sn = { toAttribute(n, t) {
  switch (t) {
    case Boolean:
      n = n ? zi : null;
      break;
    case Object:
    case Array:
      n = n == null ? n : JSON.stringify(n);
  }
  return n;
}, fromAttribute(n, t) {
  let e = n;
  switch (t) {
    case Boolean:
      e = n !== null;
      break;
    case Number:
      e = n === null ? null : Number(n);
      break;
    case Object:
    case Array:
      try {
        e = JSON.parse(n);
      } catch {
        e = null;
      }
  }
  return e;
} }, jn = (n, t) => !Ui(n, t), lo = { attribute: !0, type: String, converter: sn, reflect: !1, useDefault: !1, hasChanged: jn };
Symbol.metadata ?? (Symbol.metadata = Symbol("metadata")), tt.litPropertyMetadata ?? (tt.litPropertyMetadata = /* @__PURE__ */ new WeakMap());
let ct = class extends HTMLElement {
  static addInitializer(t) {
    this._$Ei(), (this.l ?? (this.l = [])).push(t);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t, e = lo) {
    if (e.state && (e.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(t) && ((e = Object.create(e)).wrapped = !0), this.elementProperties.set(t, e), !e.noAccessor) {
      const o = Symbol(), i = this.getPropertyDescriptor(t, o, e);
      i !== void 0 && Mi(this.prototype, t, i);
    }
  }
  static getPropertyDescriptor(t, e, o) {
    const { get: i, set: a } = Ri(this.prototype, t) ?? { get() {
      return this[e];
    }, set(s) {
      this[e] = s;
    } };
    return { get: i, set(s) {
      const c = i == null ? void 0 : i.call(this);
      a == null || a.call(this, s), this.requestUpdate(t, c, o);
    }, configurable: !0, enumerable: !0 };
  }
  static getPropertyOptions(t) {
    return this.elementProperties.get(t) ?? lo;
  }
  static _$Ei() {
    if (this.hasOwnProperty(Ot("elementProperties"))) return;
    const t = Fi(this);
    t.finalize(), t.l !== void 0 && (this.l = [...t.l]), this.elementProperties = new Map(t.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(Ot("finalized"))) return;
    if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(Ot("properties"))) {
      const e = this.properties, o = [...Hi(e), ...Wi(e)];
      for (const i of o) this.createProperty(i, e[i]);
    }
    const t = this[Symbol.metadata];
    if (t !== null) {
      const e = litPropertyMetadata.get(t);
      if (e !== void 0) for (const [o, i] of e) this.elementProperties.set(o, i);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [e, o] of this.elementProperties) {
      const i = this._$Eu(e, o);
      i !== void 0 && this._$Eh.set(i, e);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(t) {
    const e = [];
    if (Array.isArray(t)) {
      const o = new Set(t.flat(1 / 0).reverse());
      for (const i of o) e.unshift(so(i));
    } else t !== void 0 && e.push(so(t));
    return e;
  }
  static _$Eu(t, e) {
    const o = e.attribute;
    return o === !1 ? void 0 : typeof o == "string" ? o : typeof t == "string" ? t.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    var t;
    this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), (t = this.constructor.l) == null || t.forEach((e) => e(this));
  }
  addController(t) {
    var e;
    (this._$EO ?? (this._$EO = /* @__PURE__ */ new Set())).add(t), this.renderRoot !== void 0 && this.isConnected && ((e = t.hostConnected) == null || e.call(t));
  }
  removeController(t) {
    var e;
    (e = this._$EO) == null || e.delete(t);
  }
  _$E_() {
    const t = /* @__PURE__ */ new Map(), e = this.constructor.elementProperties;
    for (const o of e.keys()) this.hasOwnProperty(o) && (t.set(o, this[o]), delete this[o]);
    t.size > 0 && (this._$Ep = t);
  }
  createRenderRoot() {
    const t = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return Ni(t, this.constructor.elementStyles), t;
  }
  connectedCallback() {
    var t;
    this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this.enableUpdating(!0), (t = this._$EO) == null || t.forEach((e) => {
      var o;
      return (o = e.hostConnected) == null ? void 0 : o.call(e);
    });
  }
  enableUpdating(t) {
  }
  disconnectedCallback() {
    var t;
    (t = this._$EO) == null || t.forEach((e) => {
      var o;
      return (o = e.hostDisconnected) == null ? void 0 : o.call(e);
    });
  }
  attributeChangedCallback(t, e, o) {
    this._$AK(t, o);
  }
  _$ET(t, e) {
    var a;
    const o = this.constructor.elementProperties.get(t), i = this.constructor._$Eu(t, o);
    if (i !== void 0 && o.reflect === !0) {
      const s = (((a = o.converter) == null ? void 0 : a.toAttribute) !== void 0 ? o.converter : sn).toAttribute(e, o.type);
      this._$Em = t, s == null ? this.removeAttribute(i) : this.setAttribute(i, s), this._$Em = null;
    }
  }
  _$AK(t, e) {
    var a, s;
    const o = this.constructor, i = o._$Eh.get(t);
    if (i !== void 0 && this._$Em !== i) {
      const c = o.getPropertyOptions(i), h = typeof c.converter == "function" ? { fromAttribute: c.converter } : ((a = c.converter) == null ? void 0 : a.fromAttribute) !== void 0 ? c.converter : sn;
      this._$Em = i;
      const l = h.fromAttribute(e, c.type);
      this[i] = l ?? ((s = this._$Ej) == null ? void 0 : s.get(i)) ?? l, this._$Em = null;
    }
  }
  requestUpdate(t, e, o) {
    var i;
    if (t !== void 0) {
      const a = this.constructor, s = this[t];
      if (o ?? (o = a.getPropertyOptions(t)), !((o.hasChanged ?? jn)(s, e) || o.useDefault && o.reflect && s === ((i = this._$Ej) == null ? void 0 : i.get(t)) && !this.hasAttribute(a._$Eu(t, o)))) return;
      this.C(t, e, o);
    }
    this.isUpdatePending === !1 && (this._$ES = this._$EP());
  }
  C(t, e, { useDefault: o, reflect: i, wrapped: a }, s) {
    o && !(this._$Ej ?? (this._$Ej = /* @__PURE__ */ new Map())).has(t) && (this._$Ej.set(t, s ?? e ?? this[t]), a !== !0 || s !== void 0) || (this._$AL.has(t) || (this.hasUpdated || o || (e = void 0), this._$AL.set(t, e)), i === !0 && this._$Em !== t && (this._$Eq ?? (this._$Eq = /* @__PURE__ */ new Set())).add(t));
  }
  async _$EP() {
    this.isUpdatePending = !0;
    try {
      await this._$ES;
    } catch (e) {
      Promise.reject(e);
    }
    const t = this.scheduleUpdate();
    return t != null && await t, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    var o;
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this._$Ep) {
        for (const [a, s] of this._$Ep) this[a] = s;
        this._$Ep = void 0;
      }
      const i = this.constructor.elementProperties;
      if (i.size > 0) for (const [a, s] of i) {
        const { wrapped: c } = s, h = this[a];
        c !== !0 || this._$AL.has(a) || h === void 0 || this.C(a, void 0, s, h);
      }
    }
    let t = !1;
    const e = this._$AL;
    try {
      t = this.shouldUpdate(e), t ? (this.willUpdate(e), (o = this._$EO) == null || o.forEach((i) => {
        var a;
        return (a = i.hostUpdate) == null ? void 0 : a.call(i);
      }), this.update(e)) : this._$EM();
    } catch (i) {
      throw t = !1, this._$EM(), i;
    }
    t && this._$AE(e);
  }
  willUpdate(t) {
  }
  _$AE(t) {
    var e;
    (e = this._$EO) == null || e.forEach((o) => {
      var i;
      return (i = o.hostUpdated) == null ? void 0 : i.call(o);
    }), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(t)), this.updated(t);
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
  shouldUpdate(t) {
    return !0;
  }
  update(t) {
    this._$Eq && (this._$Eq = this._$Eq.forEach((e) => this._$ET(e, this[e]))), this._$EM();
  }
  updated(t) {
  }
  firstUpdated(t) {
  }
};
ct.elementStyles = [], ct.shadowRootOptions = { mode: "open" }, ct[Ot("elementProperties")] = /* @__PURE__ */ new Map(), ct[Ot("finalized")] = /* @__PURE__ */ new Map(), gn == null || gn({ ReactiveElement: ct }), (tt.reactiveElementVersions ?? (tt.reactiveElementVersions = [])).push("2.1.1");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const Et = globalThis, cn = Et.trustedTypes, ho = cn ? cn.createPolicy("lit-html", { createHTML: (n) => n }) : void 0, Xo = "$lit$", et = `lit$${Math.random().toFixed(9).slice(2)}$`, ei = "?" + et, qi = `<${ei}>`, at = document, It = () => at.createComment(""), jt = (n) => n === null || typeof n != "object" && typeof n != "function", $n = Array.isArray, Ki = (n) => $n(n) || typeof (n == null ? void 0 : n[Symbol.iterator]) == "function", _n = `[ 	
\f\r]`, ft = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, uo = /-->/g, po = />/g, ot = RegExp(`>|${_n}(?:([^\\s"'>=/]+)(${_n}*=${_n}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), fo = /'/g, mo = /"/g, ti = /^(?:script|style|textarea|title)$/i, Bi = (n) => (t, ...e) => ({ _$litType$: n, strings: t, values: e }), Ie = Bi(1), dt = Symbol.for("lit-noChange"), Oe = Symbol.for("lit-nothing"), go = /* @__PURE__ */ new WeakMap(), it = at.createTreeWalker(at, 129);
function ni(n, t) {
  if (!$n(n) || !n.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return ho !== void 0 ? ho.createHTML(t) : t;
}
const Vi = (n, t) => {
  const e = n.length - 1, o = [];
  let i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", s = ft;
  for (let c = 0; c < e; c++) {
    const h = n[c];
    let l, d, u = -1, _ = 0;
    for (; _ < h.length && (s.lastIndex = _, d = s.exec(h), d !== null); ) _ = s.lastIndex, s === ft ? d[1] === "!--" ? s = uo : d[1] !== void 0 ? s = po : d[2] !== void 0 ? (ti.test(d[2]) && (i = RegExp("</" + d[2], "g")), s = ot) : d[3] !== void 0 && (s = ot) : s === ot ? d[0] === ">" ? (s = i ?? ft, u = -1) : d[1] === void 0 ? u = -2 : (u = s.lastIndex - d[2].length, l = d[1], s = d[3] === void 0 ? ot : d[3] === '"' ? mo : fo) : s === mo || s === fo ? s = ot : s === uo || s === po ? s = ft : (s = ot, i = void 0);
    const f = s === ot && n[c + 1].startsWith("/>") ? " " : "";
    a += s === ft ? h + qi : u >= 0 ? (o.push(l), h.slice(0, u) + Xo + h.slice(u) + et + f) : h + et + (u === -2 ? c : f);
  }
  return [ni(n, a + (n[e] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), o];
};
let xn = class oi {
  constructor({ strings: t, _$litType$: e }, o) {
    let i;
    this.parts = [];
    let a = 0, s = 0;
    const c = t.length - 1, h = this.parts, [l, d] = Vi(t, e);
    if (this.el = oi.createElement(l, o), it.currentNode = this.el.content, e === 2 || e === 3) {
      const u = this.el.content.firstChild;
      u.replaceWith(...u.childNodes);
    }
    for (; (i = it.nextNode()) !== null && h.length < c; ) {
      if (i.nodeType === 1) {
        if (i.hasAttributes()) for (const u of i.getAttributeNames()) if (u.endsWith(Xo)) {
          const _ = d[s++], f = i.getAttribute(u).split(et), w = /([.?@])?(.*)/.exec(_);
          h.push({ type: 1, index: a, name: w[2], strings: f, ctor: w[1] === "." ? Ji : w[1] === "?" ? Qi : w[1] === "@" ? Gi : hn }), i.removeAttribute(u);
        } else u.startsWith(et) && (h.push({ type: 6, index: a }), i.removeAttribute(u));
        if (ti.test(i.tagName)) {
          const u = i.textContent.split(et), _ = u.length - 1;
          if (_ > 0) {
            i.textContent = cn ? cn.emptyScript : "";
            for (let f = 0; f < _; f++) i.append(u[f], It()), it.nextNode(), h.push({ type: 2, index: ++a });
            i.append(u[_], It());
          }
        }
      } else if (i.nodeType === 8) if (i.data === ei) h.push({ type: 2, index: a });
      else {
        let u = -1;
        for (; (u = i.data.indexOf(et, u + 1)) !== -1; ) h.push({ type: 7, index: a }), u += et.length - 1;
      }
      a++;
    }
  }
  static createElement(t, e) {
    const o = at.createElement("template");
    return o.innerHTML = t, o;
  }
};
function ht(n, t, e = n, o) {
  var s, c;
  if (t === dt) return t;
  let i = o !== void 0 ? (s = e._$Co) == null ? void 0 : s[o] : e._$Cl;
  const a = jt(t) ? void 0 : t._$litDirective$;
  return (i == null ? void 0 : i.constructor) !== a && ((c = i == null ? void 0 : i._$AO) == null || c.call(i, !1), a === void 0 ? i = void 0 : (i = new a(n), i._$AT(n, e, o)), o !== void 0 ? (e._$Co ?? (e._$Co = []))[o] = i : e._$Cl = i), i !== void 0 && (t = ht(n, i._$AS(n, t.values), i, o)), t;
}
let Zi = class {
  constructor(t, e) {
    this._$AV = [], this._$AN = void 0, this._$AD = t, this._$AM = e;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t) {
    const { el: { content: e }, parts: o } = this._$AD, i = ((t == null ? void 0 : t.creationScope) ?? at).importNode(e, !0);
    it.currentNode = i;
    let a = it.nextNode(), s = 0, c = 0, h = o[0];
    for (; h !== void 0; ) {
      if (s === h.index) {
        let l;
        h.type === 2 ? l = new Dn(a, a.nextSibling, this, t) : h.type === 1 ? l = new h.ctor(a, h.name, h.strings, this, t) : h.type === 6 && (l = new Yi(a, this, t)), this._$AV.push(l), h = o[++c];
      }
      s !== (h == null ? void 0 : h.index) && (a = it.nextNode(), s++);
    }
    return it.currentNode = at, i;
  }
  p(t) {
    let e = 0;
    for (const o of this._$AV) o !== void 0 && (o.strings !== void 0 ? (o._$AI(t, o, e), e += o.strings.length - 2) : o._$AI(t[e])), e++;
  }
}, Dn = class ii {
  get _$AU() {
    var t;
    return ((t = this._$AM) == null ? void 0 : t._$AU) ?? this._$Cv;
  }
  constructor(t, e, o, i) {
    this.type = 2, this._$AH = Oe, this._$AN = void 0, this._$AA = t, this._$AB = e, this._$AM = o, this.options = i, this._$Cv = (i == null ? void 0 : i.isConnected) ?? !0;
  }
  get parentNode() {
    let t = this._$AA.parentNode;
    const e = this._$AM;
    return e !== void 0 && (t == null ? void 0 : t.nodeType) === 11 && (t = e.parentNode), t;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t, e = this) {
    t = ht(this, t, e), jt(t) ? t === Oe || t == null || t === "" ? (this._$AH !== Oe && this._$AR(), this._$AH = Oe) : t !== this._$AH && t !== dt && this._(t) : t._$litType$ !== void 0 ? this.$(t) : t.nodeType !== void 0 ? this.T(t) : Ki(t) ? this.k(t) : this._(t);
  }
  O(t) {
    return this._$AA.parentNode.insertBefore(t, this._$AB);
  }
  T(t) {
    this._$AH !== t && (this._$AR(), this._$AH = this.O(t));
  }
  _(t) {
    this._$AH !== Oe && jt(this._$AH) ? this._$AA.nextSibling.data = t : this.T(at.createTextNode(t)), this._$AH = t;
  }
  $(t) {
    var a;
    const { values: e, _$litType$: o } = t, i = typeof o == "number" ? this._$AC(t) : (o.el === void 0 && (o.el = xn.createElement(ni(o.h, o.h[0]), this.options)), o);
    if (((a = this._$AH) == null ? void 0 : a._$AD) === i) this._$AH.p(e);
    else {
      const s = new Zi(i, this), c = s.u(this.options);
      s.p(e), this.T(c), this._$AH = s;
    }
  }
  _$AC(t) {
    let e = go.get(t.strings);
    return e === void 0 && go.set(t.strings, e = new xn(t)), e;
  }
  k(t) {
    $n(this._$AH) || (this._$AH = [], this._$AR());
    const e = this._$AH;
    let o, i = 0;
    for (const a of t) i === e.length ? e.push(o = new ii(this.O(It()), this.O(It()), this, this.options)) : o = e[i], o._$AI(a), i++;
    i < e.length && (this._$AR(o && o._$AB.nextSibling, i), e.length = i);
  }
  _$AR(t = this._$AA.nextSibling, e) {
    var o;
    for ((o = this._$AP) == null ? void 0 : o.call(this, !1, !0, e); t !== this._$AB; ) {
      const i = t.nextSibling;
      t.remove(), t = i;
    }
  }
  setConnected(t) {
    var e;
    this._$AM === void 0 && (this._$Cv = t, (e = this._$AP) == null || e.call(this, t));
  }
}, hn = class {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t, e, o, i, a) {
    this.type = 1, this._$AH = Oe, this._$AN = void 0, this.element = t, this.name = e, this._$AM = i, this.options = a, o.length > 2 || o[0] !== "" || o[1] !== "" ? (this._$AH = Array(o.length - 1).fill(new String()), this.strings = o) : this._$AH = Oe;
  }
  _$AI(t, e = this, o, i) {
    const a = this.strings;
    let s = !1;
    if (a === void 0) t = ht(this, t, e, 0), s = !jt(t) || t !== this._$AH && t !== dt, s && (this._$AH = t);
    else {
      const c = t;
      let h, l;
      for (t = a[0], h = 0; h < a.length - 1; h++) l = ht(this, c[o + h], e, h), l === dt && (l = this._$AH[h]), s || (s = !jt(l) || l !== this._$AH[h]), l === Oe ? t = Oe : t !== Oe && (t += (l ?? "") + a[h + 1]), this._$AH[h] = l;
    }
    s && !i && this.j(t);
  }
  j(t) {
    t === Oe ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t ?? "");
  }
}, Ji = class extends hn {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t) {
    this.element[this.name] = t === Oe ? void 0 : t;
  }
}, Qi = class extends hn {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t) {
    this.element.toggleAttribute(this.name, !!t && t !== Oe);
  }
}, Gi = class extends hn {
  constructor(t, e, o, i, a) {
    super(t, e, o, i, a), this.type = 5;
  }
  _$AI(t, e = this) {
    if ((t = ht(this, t, e, 0) ?? Oe) === dt) return;
    const o = this._$AH, i = t === Oe && o !== Oe || t.capture !== o.capture || t.once !== o.once || t.passive !== o.passive, a = t !== Oe && (o === Oe || i);
    i && this.element.removeEventListener(this.name, this, o), a && this.element.addEventListener(this.name, this, t), this._$AH = t;
  }
  handleEvent(t) {
    var e;
    typeof this._$AH == "function" ? this._$AH.call(((e = this.options) == null ? void 0 : e.host) ?? this.element, t) : this._$AH.handleEvent(t);
  }
}, Yi = class {
  constructor(t, e, o) {
    this.element = t, this.type = 6, this._$AN = void 0, this._$AM = e, this.options = o;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t) {
    ht(this, t);
  }
};
const vn = Et.litHtmlPolyfillSupport;
vn == null || vn(xn, Dn), (Et.litHtmlVersions ?? (Et.litHtmlVersions = [])).push("3.3.1");
const Xi = (n, t, e) => {
  const o = (e == null ? void 0 : e.renderBefore) ?? t;
  let i = o._$litPart$;
  if (i === void 0) {
    const a = (e == null ? void 0 : e.renderBefore) ?? null;
    o._$litPart$ = i = new Dn(t.insertBefore(It(), a), a, void 0, e ?? {});
  }
  return i._$AI(n), i;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const rt = globalThis;
let Pt = class extends ct {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    var e;
    const t = super.createRenderRoot();
    return (e = this.renderOptions).renderBefore ?? (e.renderBefore = t.firstChild), t;
  }
  update(t) {
    const e = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t), this._$Do = Xi(e, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    var t;
    super.connectedCallback(), (t = this._$Do) == null || t.setConnected(!0);
  }
  disconnectedCallback() {
    var t;
    super.disconnectedCallback(), (t = this._$Do) == null || t.setConnected(!1);
  }
  render() {
    return dt;
  }
};
var Go;
Pt._$litElement$ = !0, Pt.finalized = !0, (Go = rt.litElementHydrateSupport) == null || Go.call(rt, { LitElement: Pt });
const bn = rt.litElementPolyfillSupport;
bn == null || bn({ LitElement: Pt });
(rt.litElementVersions ?? (rt.litElementVersions = [])).push("4.2.1");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const er = (n) => (t, e) => {
  e !== void 0 ? e.addInitializer(() => {
    customElements.define(n, t);
  }) : customElements.define(n, t);
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const tr = { attribute: !0, type: String, converter: sn, reflect: !1, hasChanged: jn }, nr = (n = tr, t, e) => {
  const { kind: o, metadata: i } = e;
  let a = globalThis.litPropertyMetadata.get(i);
  if (a === void 0 && globalThis.litPropertyMetadata.set(i, a = /* @__PURE__ */ new Map()), o === "setter" && ((n = Object.create(n)).wrapped = !0), a.set(e.name, n), o === "accessor") {
    const { name: s } = e;
    return { set(c) {
      const h = t.get.call(this);
      t.set.call(this, c), this.requestUpdate(s, h, n);
    }, init(c) {
      return c !== void 0 && this.C(s, void 0, n, c), c;
    } };
  }
  if (o === "setter") {
    const { name: s } = e;
    return function(c) {
      const h = this[s];
      t.call(this, c), this.requestUpdate(s, h, n);
    };
  }
  throw Error("Unsupported decorator location: " + o);
};
function Te(n) {
  return (t, e) => typeof e == "object" ? nr(n, t, e) : ((o, i, a) => {
    const s = i.hasOwnProperty(a);
    return i.constructor.createProperty(a, o), s ? Object.getOwnPropertyDescriptor(i, a) : void 0;
  })(n, t, e);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function nt(n) {
  return Te({ ...n, state: !0, attribute: !1 });
}
/*! For license information please see elements.js.LICENSE.txt */
var or = { 7: function(n, t, e) {
  (function(o, i, a) {
    var s = function() {
      return s = Object.assign || function(w) {
        for (var y, S = 1, C = arguments.length; S < C; S++) for (var T in y = arguments[S]) Object.prototype.hasOwnProperty.call(y, T) && (w[T] = y[T]);
        return w;
      }, s.apply(this, arguments);
    };
    function c(w, y) {
      var S = typeof Symbol == "function" && w[Symbol.iterator];
      if (!S) return w;
      var C, T, E = S.call(w), $ = [];
      try {
        for (; (y === void 0 || y-- > 0) && !(C = E.next()).done; ) $.push(C.value);
      } catch (L) {
        T = { error: L };
      } finally {
        try {
          C && !C.done && (S = E.return) && S.call(E);
        } finally {
          if (T) throw T.error;
        }
      }
      return $;
    }
    function h(w, y) {
      return [w, !w || w.endsWith("/") ? "" : "/", y, ".json"].join("");
    }
    function l(w, y) {
      var S = w;
      return y && Object.keys(y).forEach(function(C) {
        var T = y[C], E = new RegExp("{".concat(C, "}"), "gm");
        S = S.replace(E, T.toString());
      }), S;
    }
    function d(w, y, S) {
      var C = w[y];
      if (!C) return S;
      var T = S.split("."), E = "";
      do {
        var $ = C[E += T.shift()];
        $ === void 0 || typeof $ != "object" && T.length ? T.length ? E += "." : C = S : (C = $, E = "");
      } while (T.length);
      return C;
    }
    var u = {}, _ = { root: "", lang: "en", fallbackLang: "en" }, f = i.createContext(null);
    o.TranslateContext = f, o.TranslateProvider = function(w) {
      var y = function($, L) {
        $ = Object.assign({}, _, $), u = L || u;
        var N = c(a.useState($.lang), 2), F = N[0], B = N[1], V = c(a.useState(u), 2), ee = V[0], U = V[1], ge = c(a.useState(!1), 2), De = ge[0], xe = ge[1], Pe = function(te) {
          if (!ee.hasOwnProperty(te)) {
            xe(!1);
            var se = h($.root, te);
            fetch(se).then(function(pe) {
              return pe.json();
            }).then(function(pe) {
              u[te] = pe, U(s({}, u)), xe(!0);
            }).catch(function(pe) {
              console.log("Aww, snap.", pe), U(s({}, u)), xe(!0);
            });
          }
        };
        return a.useEffect(function() {
          Pe($.fallbackLang), Pe(F);
        }, [F]), { lang: F, setLang: B, t: function(te, se) {
          if (!ee.hasOwnProperty(F)) return te;
          var pe = d(ee, F, te);
          return pe === te && F !== $.fallbackLang && (pe = d(ee, $.fallbackLang, te)), l(pe, se);
        }, isReady: De };
      }({ root: w.root || "assets", lang: w.lang || "en", fallbackLang: w.fallbackLang || "en" }, w.translations), S = y.t, C = y.setLang, T = y.lang, E = y.isReady;
      return i.h(f.Provider, { value: { t: S, setLang: C, lang: T, isReady: E } }, w.children);
    }, o.format = l, o.getResourceUrl = h, o.getValue = d, Object.defineProperty(o, "__esModule", { value: !0 });
  })(t, e(616), e(78));
}, 633: (n, t) => {
  var e;
  (function() {
    var o = {}.hasOwnProperty;
    function i() {
      for (var a = [], s = 0; s < arguments.length; s++) {
        var c = arguments[s];
        if (c) {
          var h = typeof c;
          if (h === "string" || h === "number") a.push(c);
          else if (Array.isArray(c)) {
            if (c.length) {
              var l = i.apply(null, c);
              l && a.push(l);
            }
          } else if (h === "object") {
            if (c.toString !== Object.prototype.toString && !c.toString.toString().includes("[native code]")) {
              a.push(c.toString());
              continue;
            }
            for (var d in c) o.call(c, d) && c[d] && a.push(d);
          }
        }
      }
      return a.join(" ");
    }
    n.exports ? (i.default = i, n.exports = i) : (e = (function() {
      return i;
    }).apply(t, [])) === void 0 || (n.exports = e);
  })();
}, 21: (n, t, e) => {
  e.d(t, { A: () => c });
  var o = e(645), i = e.n(o), a = e(278), s = e.n(a)()(i());
  s.push([n.id, '.hanko_accordion{font-weight:var(--font-weight, 400);font-size:var(--font-size, 16px);font-family:var(--font-family, sans-serif);line-height:var(--line-height, 1.4rem);width:100%;overflow:hidden}.hanko_accordion .hanko_accordionItem{color:var(--color, #333333);margin:.25rem 0;overflow:hidden}.hanko_accordion .hanko_accordionItem.hanko_dropdown{margin:0}.hanko_accordion .hanko_accordionItem .hanko_label{border-radius:var(--border-radius, 8px);border-style:none;height:var(--item-height, 42px);background:var(--background-color, white);box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:0 1rem;margin:0;cursor:pointer;transition:all .35s}.hanko_accordion .hanko_accordionItem .hanko_label .hanko_labelText{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hanko_accordion .hanko_accordionItem .hanko_label .hanko_labelText .hanko_description{color:var(--color-shade-1, #8f9095)}.hanko_accordion .hanko_accordionItem .hanko_label.hanko_dropdown{margin:0;color:var(--link-color, #506cf0);justify-content:flex-start}.hanko_accordion .hanko_accordionItem .hanko_label:hover{color:var(--brand-contrast-color, white);background:var(--brand-color-shade-1, #6b84fb)}.hanko_accordion .hanko_accordionItem .hanko_label:hover .hanko_description{color:var(--brand-contrast-color, white)}.hanko_accordion .hanko_accordionItem .hanko_label:hover.hanko_dropdown{color:var(--link-color, #506cf0);background:none}.hanko_accordion .hanko_accordionItem .hanko_label:not(.hanko_dropdown)::after{content:"❯";width:1rem;text-align:center;transition:all .35s}.hanko_accordion .hanko_accordionItem .hanko_accordionInput{position:absolute;opacity:0;z-index:-1}.hanko_accordion .hanko_accordionItem .hanko_accordionInput:checked+.hanko_label{color:var(--brand-contrast-color, white);background:var(--brand-color, #506cf0)}.hanko_accordion .hanko_accordionItem .hanko_accordionInput:checked+.hanko_label .hanko_description{color:var(--brand-contrast-color, white)}.hanko_accordion .hanko_accordionItem .hanko_accordionInput:checked+.hanko_label.hanko_dropdown{color:var(--link-color, #506cf0);background:none}.hanko_accordion .hanko_accordionItem .hanko_accordionInput:checked+.hanko_label:not(.hanko_dropdown)::after{transform:rotate(90deg)}.hanko_accordion .hanko_accordionItem .hanko_accordionInput:checked+.hanko_label~.hanko_accordionContent{margin:.25rem 1rem;opacity:1;max-height:100vh}.hanko_accordion .hanko_accordionItem .hanko_accordionContent{max-height:0;margin:0 1rem;opacity:0;overflow:hidden;transition:all .35s}.hanko_accordion .hanko_accordionItem .hanko_accordionContent.hanko_dropdownContent{border-style:none}', ""]), s.locals = { accordion: "hanko_accordion", accordionItem: "hanko_accordionItem", dropdown: "hanko_dropdown", label: "hanko_label", labelText: "hanko_labelText", description: "hanko_description", accordionInput: "hanko_accordionInput", accordionContent: "hanko_accordionContent", dropdownContent: "hanko_dropdownContent" };
  const c = s;
}, 905: (n, t, e) => {
  e.d(t, { A: () => c });
  var o = e(645), i = e.n(o), a = e(278), s = e.n(a)()(i());
  s.push([n.id, ".hanko_errorBox{font-weight:var(--font-weight, 400);font-size:var(--font-size, 16px);font-family:var(--font-family, sans-serif);line-height:var(--line-height, 1.4rem);border-radius:var(--border-radius, 8px);border-style:var(--border-style, solid);border-width:var(--border-width, 1px);color:var(--error-color, #e82020);background:var(--background-color, white);margin:var(--item-margin, 0.5rem 0);display:flex;align-items:start;box-sizing:border-box;line-height:1.5rem;padding:.25em;gap:.2em}.hanko_errorBox>span{display:inline-flex}.hanko_errorBox>span:first-child{padding:.25em 0 .25em .19em}.hanko_errorBox[hidden]{display:none}.hanko_errorMessage{color:var(--error-color, #e82020)}", ""]), s.locals = { errorBox: "hanko_errorBox", errorMessage: "hanko_errorMessage" };
  const c = s;
}, 577: (n, t, e) => {
  e.d(t, { A: () => c });
  var o = e(645), i = e.n(o), a = e(278), s = e.n(a)()(i());
  s.push([n.id, '.hanko_form{display:flex;flex-grow:1}.hanko_form .hanko_ul{flex-grow:1;margin:var(--item-margin, 0.5rem 0);padding-inline-start:0;list-style-type:none;display:flex;flex-wrap:wrap;gap:1em}.hanko_form .hanko_li{display:flex;max-width:100%;flex-grow:1;flex-basis:min-content}.hanko_form .hanko_li.hanko_maxWidth{min-width:100%}.hanko_button{font-weight:var(--font-weight, 400);font-size:var(--font-size, 16px);font-family:var(--font-family, sans-serif);line-height:var(--line-height, 1.4rem);border-radius:var(--border-radius, 8px);border-style:var(--border-style, solid);border-width:var(--border-width, 1px);white-space:nowrap;width:100%;min-width:var(--button-min-width, 7em);min-height:var(--item-height, 42px);outline:none;cursor:pointer;transition:.1s ease-out;flex-grow:1;flex-shrink:1;display:inline-flex;position:relative}.hanko_button[data-bubble]:before{font-weight:var(--font-weight, 400);font-size:var(--font-size, 16px);font-family:var(--font-family, sans-serif);line-height:var(--line-height, 1.4rem);border-radius:var(--border-radius, 8px);border-style:var(--border-style, solid);border-width:var(--border-width, 1px);padding:2px 8px;font-size:9px;line-height:normal;content:attr(data-bubble);display:block;position:absolute;bottom:80%;left:80%;white-space:nowrap;width:max-content;text-align:center;background-color:inherit;color:var(--brand-color-shade-1, #6b84fb);border-color:var(--brand-color-shade-1, #6b84fb)}.hanko_button:disabled{cursor:default}.hanko_button.hanko_primary{color:var(--brand-contrast-color, white);background:var(--brand-color, #506cf0);border-color:var(--brand-color, #506cf0);justify-content:center}.hanko_button.hanko_primary:hover{color:var(--brand-contrast-color, white);background:var(--brand-color-shade-1, #6b84fb);border-color:var(--brand-color, #506cf0)}.hanko_button.hanko_primary:focus{color:var(--brand-contrast-color, white);background:var(--brand-color, #506cf0);border-color:var(--color, #333333)}.hanko_button.hanko_primary:disabled{color:var(--color-shade-1, #8f9095);background:var(--color-shade-2, #e5e6ef);border-color:var(--color-shade-2, #e5e6ef)}.hanko_button.hanko_secondary{color:var(--color, #333333);background:var(--background-color, white);border-color:var(--color-shade-1, #8f9095);justify-content:center}.hanko_button.hanko_secondary:hover{color:var(--color, #333333);background:var(--color-shade-2, #e5e6ef);border-color:var(--color, #333333)}.hanko_button.hanko_secondary:focus{color:var(--color, #333333);background:var(--background-color, white);border-color:var(--brand-color, #506cf0)}.hanko_button.hanko_secondary:disabled{color:var(--color-shade-1, #8f9095);background:var(--color-shade-2, #e5e6ef);border-color:var(--color-shade-1, #8f9095)}.hanko_button.hanko_dangerous{color:var(--error-color, #e82020);background:var(--background-color, white);border-color:var(--error-color, #e82020);flex-grow:0;width:auto}.hanko_caption{flex-wrap:wrap;display:flex;justify-content:space-between;align-items:baseline}.hanko_inputWrapper{flex-grow:1;position:relative;display:flex;min-width:var(--input-min-width, 14em);max-width:100%}.hanko_input{font-weight:var(--font-weight, 400);font-size:var(--font-size, 16px);font-family:var(--font-family, sans-serif);line-height:var(--line-height, 1.4rem);border-radius:var(--border-radius, 8px);border-style:var(--border-style, solid);border-width:var(--border-width, 1px);height:var(--item-height, 42px);color:var(--color, #333333);border-color:var(--color-shade-1, #8f9095);background:var(--background-color, white);padding:0 .5rem;outline:none;width:100%;box-sizing:border-box;transition:.1s ease-out}.hanko_input.hanko_error{border-color:var(--error-color, #e82020)}.hanko_input:-webkit-autofill,.hanko_input:-webkit-autofill:hover,.hanko_input:-webkit-autofill:focus{-webkit-text-fill-color:var(--color, #333333);-webkit-box-shadow:0 0 0 50px var(--background-color, white) inset}.hanko_input::-ms-reveal,.hanko_input::-ms-clear{display:none}.hanko_input::placeholder{color:var(--color-shade-1, #8f9095)}.hanko_input:focus{color:var(--color, #333333);border-color:var(--color, #333333)}.hanko_input:disabled{color:var(--color-shade-1, #8f9095);background:var(--color-shade-2, #e5e6ef);border-color:var(--color-shade-1, #8f9095)}.hanko_passcodeInputWrapper{flex-grow:1;min-width:var(--input-min-width, 14em);max-width:fit-content;position:relative;display:flex;justify-content:space-between}.hanko_passcodeInputWrapper .hanko_passcodeDigitWrapper{flex-grow:1;margin:0 .5rem 0 0}.hanko_passcodeInputWrapper .hanko_passcodeDigitWrapper:last-child{margin:0}.hanko_passcodeInputWrapper .hanko_passcodeDigitWrapper .hanko_input{text-align:center}.hanko_checkboxWrapper{font-weight:var(--font-weight, 400);font-size:var(--font-size, 16px);font-family:var(--font-family, sans-serif);line-height:var(--line-height, 1.4rem);color:var(--color, #333333);align-items:center;display:flex}.hanko_checkboxWrapper .hanko_label{color:inherit;padding-left:.5rem;cursor:pointer}.hanko_checkboxWrapper .hanko_label.hanko_disabled{cursor:default;color:var(--color-shade-1, #8f9095)}.hanko_checkboxWrapper .hanko_checkbox{border:currentColor solid 1px;border-radius:.15em;appearance:none;-webkit-appearance:none;width:1.1rem;height:1.1rem;margin:0;color:currentColor;background-color:var(--background-color, white);font:inherit;box-shadow:none;display:inline-flex;place-content:center;cursor:pointer}.hanko_checkboxWrapper .hanko_checkbox:checked{background-color:var(--color, #333333)}.hanko_checkboxWrapper .hanko_checkbox:disabled{cursor:default;background-color:var(--color-shade-2, #e5e6ef);border-color:var(--color-shade-1, #8f9095)}.hanko_checkboxWrapper .hanko_checkbox:checked:after{content:"✓";color:var(--background-color, white);position:absolute;line-height:1.1rem}.hanko_checkboxWrapper .hanko_checkbox:disabled:after{color:var(--color-shade-1, #8f9095)}', ""]), s.locals = { form: "hanko_form", ul: "hanko_ul", li: "hanko_li", maxWidth: "hanko_maxWidth", button: "hanko_button", primary: "hanko_primary", secondary: "hanko_secondary", dangerous: "hanko_dangerous", caption: "hanko_caption", inputWrapper: "hanko_inputWrapper", input: "hanko_input", error: "hanko_error", passcodeInputWrapper: "hanko_passcodeInputWrapper", passcodeDigitWrapper: "hanko_passcodeDigitWrapper", checkboxWrapper: "hanko_checkboxWrapper", label: "hanko_label", disabled: "hanko_disabled", checkbox: "hanko_checkbox" };
  const c = s;
}, 619: (n, t, e) => {
  e.d(t, { A: () => c });
  var o = e(645), i = e.n(o), a = e(278), s = e.n(a)()(i());
  s.push([n.id, ".hanko_headline{color:var(--color, #333333);font-family:var(--font-family, sans-serif);text-align:left;letter-spacing:0;font-style:normal;line-height:1.1}.hanko_headline.hanko_grade1{font-size:var(--headline1-font-size, 24px);font-weight:var(--headline1-font-weight, 600);margin:var(--headline1-margin, 0 0 0.5rem)}.hanko_headline.hanko_grade2{font-size:var(--headline2-font-size, 16px);font-weight:var(--headline2-font-weight, 600);margin:var(--headline2-margin, 1rem 0 0.5rem)}", ""]), s.locals = { headline: "hanko_headline", grade1: "hanko_grade1", grade2: "hanko_grade2" };
  const c = s;
}, 697: (n, t, e) => {
  e.d(t, { A: () => c });
  var o = e(645), i = e.n(o), a = e(278), s = e.n(a)()(i());
  s.push([n.id, ".hanko_icon,.hanko_loadingSpinnerWrapper .hanko_loadingSpinner,.hanko_loadingSpinnerWrapperIcon .hanko_loadingSpinner,.hanko_exclamationMark,.hanko_checkmark{display:inline-block;fill:var(--brand-contrast-color, white);width:18px}.hanko_icon.hanko_secondary,.hanko_loadingSpinnerWrapper .hanko_secondary.hanko_loadingSpinner,.hanko_loadingSpinnerWrapperIcon .hanko_secondary.hanko_loadingSpinner,.hanko_secondary.hanko_exclamationMark,.hanko_secondary.hanko_checkmark{fill:var(--color, #333333)}.hanko_icon.hanko_disabled,.hanko_loadingSpinnerWrapper .hanko_disabled.hanko_loadingSpinner,.hanko_loadingSpinnerWrapperIcon .hanko_disabled.hanko_loadingSpinner,.hanko_disabled.hanko_exclamationMark,.hanko_disabled.hanko_checkmark{fill:var(--color-shade-1, #8f9095)}.hanko_checkmark{fill:var(--brand-color, #506cf0)}.hanko_checkmark.hanko_secondary{fill:var(--color-shade-1, #8f9095)}.hanko_checkmark.hanko_fadeOut{animation:hanko_fadeOut ease-out 1.5s forwards !important}@keyframes hanko_fadeOut{0%{opacity:1}100%{opacity:0}}.hanko_exclamationMark{fill:var(--error-color, #e82020)}.hanko_loadingSpinnerWrapperIcon{width:100%;column-gap:10px;margin-left:10px}.hanko_loadingSpinnerWrapper,.hanko_loadingSpinnerWrapperIcon{display:inline-flex;align-items:center;height:100%;margin:0 5px;justify-content:inherit;flex-wrap:inherit}.hanko_loadingSpinnerWrapper.hanko_centerContent,.hanko_centerContent.hanko_loadingSpinnerWrapperIcon{justify-content:center}.hanko_loadingSpinnerWrapper.hanko_maxWidth,.hanko_maxWidth.hanko_loadingSpinnerWrapperIcon{width:100%}.hanko_loadingSpinnerWrapper .hanko_loadingSpinner,.hanko_loadingSpinnerWrapperIcon .hanko_loadingSpinner{fill:var(--brand-color, #506cf0);animation:hanko_spin 500ms ease-in-out infinite}.hanko_loadingSpinnerWrapper.hanko_secondary,.hanko_secondary.hanko_loadingSpinnerWrapperIcon{fill:var(--color-shade-1, #8f9095)}@keyframes hanko_spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}.hanko_googleIcon.hanko_disabled{fill:var(--color-shade-1, #8f9095)}.hanko_googleIcon.hanko_blue{fill:#4285f4}.hanko_googleIcon.hanko_green{fill:#34a853}.hanko_googleIcon.hanko_yellow{fill:#fbbc05}.hanko_googleIcon.hanko_red{fill:#ea4335}.hanko_microsoftIcon.hanko_disabled{fill:var(--color-shade-1, #8f9095)}.hanko_microsoftIcon.hanko_blue{fill:#00a4ef}.hanko_microsoftIcon.hanko_green{fill:#7fba00}.hanko_microsoftIcon.hanko_yellow{fill:#ffb900}.hanko_microsoftIcon.hanko_red{fill:#f25022}.hanko_facebookIcon.hanko_outline{fill:#0866ff}.hanko_facebookIcon.hanko_disabledOutline{fill:var(--color-shade-1, #8f9095)}.hanko_facebookIcon.hanko_letter{fill:#fff}.hanko_facebookIcon.hanko_disabledLetter{fill:var(--color-shade-2, #e5e6ef)}", ""]), s.locals = { icon: "hanko_icon", loadingSpinnerWrapper: "hanko_loadingSpinnerWrapper", loadingSpinner: "hanko_loadingSpinner", loadingSpinnerWrapperIcon: "hanko_loadingSpinnerWrapperIcon", exclamationMark: "hanko_exclamationMark", checkmark: "hanko_checkmark", secondary: "hanko_secondary", disabled: "hanko_disabled", fadeOut: "hanko_fadeOut", centerContent: "hanko_centerContent", maxWidth: "hanko_maxWidth", spin: "hanko_spin", googleIcon: "hanko_googleIcon", blue: "hanko_blue", green: "hanko_green", yellow: "hanko_yellow", red: "hanko_red", microsoftIcon: "hanko_microsoftIcon", facebookIcon: "hanko_facebookIcon", outline: "hanko_outline", disabledOutline: "hanko_disabledOutline", letter: "hanko_letter", disabledLetter: "hanko_disabledLetter" };
  const c = s;
}, 995: (n, t, e) => {
  e.d(t, { A: () => c });
  var o = e(645), i = e.n(o), a = e(278), s = e.n(a)()(i());
  s.push([n.id, ".hanko_link{font-weight:var(--font-weight, 400);font-size:var(--font-size, 16px);font-family:var(--font-family, sans-serif);line-height:var(--line-height, 1.4rem);color:var(--link-color, #506cf0);text-decoration:var(--link-text-decoration, none);cursor:pointer;background:none !important;border:none;padding:0 !important;transition:all .1s}.hanko_link:hover{text-decoration:var(--link-text-decoration-hover, underline)}.hanko_link:disabled{color:var(--color, #333333) !important;pointer-events:none;cursor:default}.hanko_link.hanko_danger{color:var(--error-color, #e82020)}.hanko_linkWrapper{display:inline-flex;flex-direction:row;justify-content:space-between;align-items:center;overflow:hidden}.hanko_linkWrapper.hanko_reverse{flex-direction:row-reverse}", ""]), s.locals = { link: "hanko_link", danger: "hanko_danger", linkWrapper: "hanko_linkWrapper", reverse: "hanko_reverse" };
  const c = s;
}, 560: (n, t, e) => {
  e.d(t, { A: () => c });
  var o = e(645), i = e.n(o), a = e(278), s = e.n(a)()(i());
  s.push([n.id, ".hanko_otpCreationDetails{font-weight:var(--font-weight, 400);font-size:var(--font-size, 16px);font-family:var(--font-family, sans-serif);line-height:var(--line-height, 1.4rem);color:var(--color, #333333);margin:var(--item-margin, 0.5rem 0);display:flex;justify-content:center;align-items:center;flex-direction:column;font-size:smaller}", ""]), s.locals = { otpCreationDetails: "hanko_otpCreationDetails" };
  const c = s;
}, 489: (n, t, e) => {
  e.d(t, { A: () => c });
  var o = e(645), i = e.n(o), a = e(278), s = e.n(a)()(i());
  s.push([n.id, ".hanko_paragraph{font-weight:var(--font-weight, 400);font-size:var(--font-size, 16px);font-family:var(--font-family, sans-serif);line-height:var(--line-height, 1.4rem);color:var(--color, #333333);margin:var(--item-margin, 0.5rem 0);text-align:left;word-break:break-word}.hanko_paragraph.hanko_center{align-items:center}.hanko_paragraph.hanko_column{display:flex;flex-direction:column;width:100%}", ""]), s.locals = { paragraph: "hanko_paragraph", center: "hanko_center", column: "hanko_column" };
  const c = s;
}, 111: (n, t, e) => {
  e.d(t, { A: () => c });
  var o = e(645), i = e.n(o), a = e(278), s = e.n(a)()(i());
  s.push([n.id, ".hanko_spacer{height:1em}.hanko_divider{font-weight:var(--font-weight, 400);font-size:var(--font-size, 16px);font-family:var(--font-family, sans-serif);line-height:var(--line-height, 1.4rem);display:flex;visibility:var(--divider-visibility, visible);color:var(--color-shade-1, #8f9095);margin:var(--item-margin, 0.5rem 0);padding:.5em 0}.hanko_divider .hanko_line{border-bottom-style:var(--border-style, solid);border-bottom-width:var(--border-width, 1px);color:inherit;font:inherit;width:100%}.hanko_divider .hanko_text{font:inherit;color:inherit;background:var(--background-color, white);padding:var(--divider-padding, 0 42px);line-height:.1em}", ""]), s.locals = { spacer: "hanko_spacer", divider: "hanko_divider", line: "hanko_line", text: "hanko_text" };
  const c = s;
}, 914: (n, t, e) => {
  e.d(t, { A: () => c });
  var o = e(645), i = e.n(o), a = e(278), s = e.n(a)()(i());
  s.push([n.id, ".hanko_container{background-color:var(--background-color, white);padding:var(--container-padding, 30px);max-width:var(--container-max-width, 410px);display:flex;flex-direction:column;flex-wrap:nowrap;justify-content:center;align-items:center;align-content:flex-start;box-sizing:border-box}.hanko_content{box-sizing:border-box;flex:0 1 auto;width:100%;height:100%}.hanko_footer{padding:.5rem 0 0;box-sizing:border-box;width:100%}.hanko_footer :nth-child(1){float:left}.hanko_footer :nth-child(2){float:right}.hanko_clipboardContainer{display:flex}.hanko_clipboardIcon{display:flex;margin:auto;cursor:pointer}", ""]), s.locals = { container: "hanko_container", content: "hanko_content", footer: "hanko_footer", clipboardContainer: "hanko_clipboardContainer", clipboardIcon: "hanko_clipboardIcon" };
  const c = s;
}, 278: (n) => {
  n.exports = function(t) {
    var e = [];
    return e.toString = function() {
      return this.map(function(o) {
        var i = "", a = o[5] !== void 0;
        return o[4] && (i += "@supports (".concat(o[4], ") {")), o[2] && (i += "@media ".concat(o[2], " {")), a && (i += "@layer".concat(o[5].length > 0 ? " ".concat(o[5]) : "", " {")), i += t(o), a && (i += "}"), o[2] && (i += "}"), o[4] && (i += "}"), i;
      }).join("");
    }, e.i = function(o, i, a, s, c) {
      typeof o == "string" && (o = [[null, o, void 0]]);
      var h = {};
      if (a) for (var l = 0; l < this.length; l++) {
        var d = this[l][0];
        d != null && (h[d] = !0);
      }
      for (var u = 0; u < o.length; u++) {
        var _ = [].concat(o[u]);
        a && h[_[0]] || (c !== void 0 && (_[5] === void 0 || (_[1] = "@layer".concat(_[5].length > 0 ? " ".concat(_[5]) : "", " {").concat(_[1], "}")), _[5] = c), i && (_[2] && (_[1] = "@media ".concat(_[2], " {").concat(_[1], "}")), _[2] = i), s && (_[4] ? (_[1] = "@supports (".concat(_[4], ") {").concat(_[1], "}"), _[4] = s) : _[4] = "".concat(s)), e.push(_));
      }
    }, e;
  };
}, 645: (n) => {
  n.exports = function(t) {
    return t[1];
  };
}, 616: (n, t, e) => {
  e.r(t), e.d(t, { Component: () => L, Fragment: () => $, cloneElement: () => ze, createContext: () => qe, createElement: () => C, createRef: () => E, h: () => C, hydrate: () => Me, isValidElement: () => s, options: () => i, render: () => ce, toChildArray: () => ge });
  var o, i, a, s, c, h, l, d, u, _ = {}, f = [], w = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
  function y(p, m) {
    for (var b in m) p[b] = m[b];
    return p;
  }
  function S(p) {
    var m = p.parentNode;
    m && m.removeChild(p);
  }
  function C(p, m, b) {
    var A, D, O, W = {};
    for (O in m) O == "key" ? A = m[O] : O == "ref" ? D = m[O] : W[O] = m[O];
    if (arguments.length > 2 && (W.children = arguments.length > 3 ? o.call(arguments, 2) : b), typeof p == "function" && p.defaultProps != null) for (O in p.defaultProps) W[O] === void 0 && (W[O] = p.defaultProps[O]);
    return T(p, W, A, D, null);
  }
  function T(p, m, b, A, D) {
    var O = { type: p, props: m, key: b, ref: A, __k: null, __: null, __b: 0, __e: null, __d: void 0, __c: null, __h: null, constructor: void 0, __v: D ?? ++a };
    return D == null && i.vnode != null && i.vnode(O), O;
  }
  function E() {
    return { current: null };
  }
  function $(p) {
    return p.children;
  }
  function L(p, m) {
    this.props = p, this.context = m;
  }
  function N(p, m) {
    if (m == null) return p.__ ? N(p.__, p.__.__k.indexOf(p) + 1) : null;
    for (var b; m < p.__k.length; m++) if ((b = p.__k[m]) != null && b.__e != null) return b.__e;
    return typeof p.type == "function" ? N(p) : null;
  }
  function F(p) {
    var m, b;
    if ((p = p.__) != null && p.__c != null) {
      for (p.__e = p.__c.base = null, m = 0; m < p.__k.length; m++) if ((b = p.__k[m]) != null && b.__e != null) {
        p.__e = p.__c.base = b.__e;
        break;
      }
      return F(p);
    }
  }
  function B(p) {
    (!p.__d && (p.__d = !0) && c.push(p) && !V.__r++ || h !== i.debounceRendering) && ((h = i.debounceRendering) || l)(V);
  }
  function V() {
    var p, m, b, A, D, O, W, ne;
    for (c.sort(d); p = c.shift(); ) p.__d && (m = c.length, A = void 0, D = void 0, W = (O = (b = p).__v).__e, (ne = b.__P) && (A = [], (D = y({}, O)).__v = O.__v + 1, Xe(ne, O, D, b.__n, ne.ownerSVGElement !== void 0, O.__h != null ? [W] : null, A, W ?? N(O), O.__h), j(A, O), O.__e != W && F(O)), c.length > m && c.sort(d));
    V.__r = 0;
  }
  function ee(p, m, b, A, D, O, W, ne, le, _e) {
    var k, ye, J, R, Q, Ye, ae, ve = A && A.__k || f, Le = ve.length;
    for (b.__k = [], k = 0; k < m.length; k++) if ((R = b.__k[k] = (R = m[k]) == null || typeof R == "boolean" || typeof R == "function" ? null : typeof R == "string" || typeof R == "number" || typeof R == "bigint" ? T(null, R, null, null, R) : Array.isArray(R) ? T($, { children: R }, null, null, null) : R.__b > 0 ? T(R.type, R.props, R.key, R.ref ? R.ref : null, R.__v) : R) != null) {
      if (R.__ = b, R.__b = b.__b + 1, (J = ve[k]) === null || J && R.key == J.key && R.type === J.type) ve[k] = void 0;
      else for (ye = 0; ye < Le; ye++) {
        if ((J = ve[ye]) && R.key == J.key && R.type === J.type) {
          ve[ye] = void 0;
          break;
        }
        J = null;
      }
      Xe(p, R, J = J || _, D, O, W, ne, le, _e), Q = R.__e, (ye = R.ref) && J.ref != ye && (ae || (ae = []), J.ref && ae.push(J.ref, null, R), ae.push(ye, R.__c || Q, R)), Q != null ? (Ye == null && (Ye = Q), typeof R.type == "function" && R.__k === J.__k ? R.__d = le = U(R, le, p) : le = De(p, R, J, ve, Q, le), typeof b.type == "function" && (b.__d = le)) : le && J.__e == le && le.parentNode != p && (le = N(J));
    }
    for (b.__e = Ye, k = Le; k--; ) ve[k] != null && (typeof b.type == "function" && ve[k].__e != null && ve[k].__e == b.__d && (b.__d = xe(A).nextSibling), M(ve[k], ve[k]));
    if (ae) for (k = 0; k < ae.length; k++) v(ae[k], ae[++k], ae[++k]);
  }
  function U(p, m, b) {
    for (var A, D = p.__k, O = 0; D && O < D.length; O++) (A = D[O]) && (A.__ = p, m = typeof A.type == "function" ? U(A, m, b) : De(b, A, A, D, A.__e, m));
    return m;
  }
  function ge(p, m) {
    return m = m || [], p == null || typeof p == "boolean" || (Array.isArray(p) ? p.some(function(b) {
      ge(b, m);
    }) : m.push(p)), m;
  }
  function De(p, m, b, A, D, O) {
    var W, ne, le;
    if (m.__d !== void 0) W = m.__d, m.__d = void 0;
    else if (b == null || D != O || D.parentNode == null) e: if (O == null || O.parentNode !== p) p.appendChild(D), W = null;
    else {
      for (ne = O, le = 0; (ne = ne.nextSibling) && le < A.length; le += 1) if (ne == D) break e;
      p.insertBefore(D, O), W = O;
    }
    return W !== void 0 ? W : D.nextSibling;
  }
  function xe(p) {
    var m, b, A;
    if (p.type == null || typeof p.type == "string") return p.__e;
    if (p.__k) {
      for (m = p.__k.length - 1; m >= 0; m--) if ((b = p.__k[m]) && (A = xe(b))) return A;
    }
    return null;
  }
  function Pe(p, m, b) {
    m[0] === "-" ? p.setProperty(m, b ?? "") : p[m] = b == null ? "" : typeof b != "number" || w.test(m) ? b : b + "px";
  }
  function te(p, m, b, A, D) {
    var O;
    e: if (m === "style") if (typeof b == "string") p.style.cssText = b;
    else {
      if (typeof A == "string" && (p.style.cssText = A = ""), A) for (m in A) b && m in b || Pe(p.style, m, "");
      if (b) for (m in b) A && b[m] === A[m] || Pe(p.style, m, b[m]);
    }
    else if (m[0] === "o" && m[1] === "n") O = m !== (m = m.replace(/Capture$/, "")), m = m.toLowerCase() in p ? m.toLowerCase().slice(2) : m.slice(2), p.l || (p.l = {}), p.l[m + O] = b, b ? A || p.addEventListener(m, O ? pe : se, O) : p.removeEventListener(m, O ? pe : se, O);
    else if (m !== "dangerouslySetInnerHTML") {
      if (D) m = m.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
      else if (m !== "width" && m !== "height" && m !== "href" && m !== "list" && m !== "form" && m !== "tabIndex" && m !== "download" && m in p) try {
        p[m] = b ?? "";
        break e;
      } catch {
      }
      typeof b == "function" || (b == null || b === !1 && m.indexOf("-") == -1 ? p.removeAttribute(m) : p.setAttribute(m, b));
    }
  }
  function se(p) {
    return this.l[p.type + !1](i.event ? i.event(p) : p);
  }
  function pe(p) {
    return this.l[p.type + !0](i.event ? i.event(p) : p);
  }
  function Xe(p, m, b, A, D, O, W, ne, le) {
    var _e, k, ye, J, R, Q, Ye, ae, ve, Le, st, fe, ro, Mt, Rt, Re = m.type;
    if (m.constructor !== void 0) return null;
    b.__h != null && (le = b.__h, ne = m.__e = b.__e, m.__h = null, O = [ne]), (_e = i.__b) && _e(m);
    try {
      e: if (typeof Re == "function") {
        if (ae = m.props, ve = (_e = Re.contextType) && A[_e.__c], Le = _e ? ve ? ve.props.value : _e.__ : A, b.__c ? Ye = (k = m.__c = b.__c).__ = k.__E : ("prototype" in Re && Re.prototype.render ? m.__c = k = new Re(ae, Le) : (m.__c = k = new L(ae, Le), k.constructor = Re, k.render = ue), ve && ve.sub(k), k.props = ae, k.state || (k.state = {}), k.context = Le, k.__n = A, ye = k.__d = !0, k.__h = [], k._sb = []), k.__s == null && (k.__s = k.state), Re.getDerivedStateFromProps != null && (k.__s == k.state && (k.__s = y({}, k.__s)), y(k.__s, Re.getDerivedStateFromProps(ae, k.__s))), J = k.props, R = k.state, k.__v = m, ye) Re.getDerivedStateFromProps == null && k.componentWillMount != null && k.componentWillMount(), k.componentDidMount != null && k.__h.push(k.componentDidMount);
        else {
          if (Re.getDerivedStateFromProps == null && ae !== J && k.componentWillReceiveProps != null && k.componentWillReceiveProps(ae, Le), !k.__e && k.shouldComponentUpdate != null && k.shouldComponentUpdate(ae, k.__s, Le) === !1 || m.__v === b.__v) {
            for (m.__v !== b.__v && (k.props = ae, k.state = k.__s, k.__d = !1), k.__e = !1, m.__e = b.__e, m.__k = b.__k, m.__k.forEach(function(Ht) {
              Ht && (Ht.__ = m);
            }), st = 0; st < k._sb.length; st++) k.__h.push(k._sb[st]);
            k._sb = [], k.__h.length && W.push(k);
            break e;
          }
          k.componentWillUpdate != null && k.componentWillUpdate(ae, k.__s, Le), k.componentDidUpdate != null && k.__h.push(function() {
            k.componentDidUpdate(J, R, Q);
          });
        }
        if (k.context = Le, k.props = ae, k.__P = p, fe = i.__r, ro = 0, "prototype" in Re && Re.prototype.render) {
          for (k.state = k.__s, k.__d = !1, fe && fe(m), _e = k.render(k.props, k.state, k.context), Mt = 0; Mt < k._sb.length; Mt++) k.__h.push(k._sb[Mt]);
          k._sb = [];
        } else do
          k.__d = !1, fe && fe(m), _e = k.render(k.props, k.state, k.context), k.state = k.__s;
        while (k.__d && ++ro < 25);
        k.state = k.__s, k.getChildContext != null && (A = y(y({}, A), k.getChildContext())), ye || k.getSnapshotBeforeUpdate == null || (Q = k.getSnapshotBeforeUpdate(J, R)), Rt = _e != null && _e.type === $ && _e.key == null ? _e.props.children : _e, ee(p, Array.isArray(Rt) ? Rt : [Rt], m, b, A, D, O, W, ne, le), k.base = m.__e, m.__h = null, k.__h.length && W.push(k), Ye && (k.__E = k.__ = null), k.__e = !1;
      } else O == null && m.__v === b.__v ? (m.__k = b.__k, m.__e = b.__e) : m.__e = P(b.__e, m, b, A, D, O, W, le);
      (_e = i.diffed) && _e(m);
    } catch (Ht) {
      m.__v = null, (le || O != null) && (m.__e = ne, m.__h = !!le, O[O.indexOf(ne)] = null), i.__e(Ht, m, b);
    }
  }
  function j(p, m) {
    i.__c && i.__c(m, p), p.some(function(b) {
      try {
        p = b.__h, b.__h = [], p.some(function(A) {
          A.call(b);
        });
      } catch (A) {
        i.__e(A, b.__v);
      }
    });
  }
  function P(p, m, b, A, D, O, W, ne) {
    var le, _e, k, ye = b.props, J = m.props, R = m.type, Q = 0;
    if (R === "svg" && (D = !0), O != null) {
      for (; Q < O.length; Q++) if ((le = O[Q]) && "setAttribute" in le == !!R && (R ? le.localName === R : le.nodeType === 3)) {
        p = le, O[Q] = null;
        break;
      }
    }
    if (p == null) {
      if (R === null) return document.createTextNode(J);
      p = D ? document.createElementNS("http://www.w3.org/2000/svg", R) : document.createElement(R, J.is && J), O = null, ne = !1;
    }
    if (R === null) ye === J || ne && p.data === J || (p.data = J);
    else {
      if (O = O && o.call(p.childNodes), _e = (ye = b.props || _).dangerouslySetInnerHTML, k = J.dangerouslySetInnerHTML, !ne) {
        if (O != null) for (ye = {}, Q = 0; Q < p.attributes.length; Q++) ye[p.attributes[Q].name] = p.attributes[Q].value;
        (k || _e) && (k && (_e && k.__html == _e.__html || k.__html === p.innerHTML) || (p.innerHTML = k && k.__html || ""));
      }
      if (function(Ye, ae, ve, Le, st) {
        var fe;
        for (fe in ve) fe === "children" || fe === "key" || fe in ae || te(Ye, fe, null, ve[fe], Le);
        for (fe in ae) st && typeof ae[fe] != "function" || fe === "children" || fe === "key" || fe === "value" || fe === "checked" || ve[fe] === ae[fe] || te(Ye, fe, ae[fe], ve[fe], Le);
      }(p, J, ye, D, ne), k) m.__k = [];
      else if (Q = m.props.children, ee(p, Array.isArray(Q) ? Q : [Q], m, b, A, D && R !== "foreignObject", O, W, O ? O[0] : b.__k && N(b, 0), ne), O != null) for (Q = O.length; Q--; ) O[Q] != null && S(O[Q]);
      ne || ("value" in J && (Q = J.value) !== void 0 && (Q !== p.value || R === "progress" && !Q || R === "option" && Q !== ye.value) && te(p, "value", Q, ye.value, !1), "checked" in J && (Q = J.checked) !== void 0 && Q !== p.checked && te(p, "checked", Q, ye.checked, !1));
    }
    return p;
  }
  function v(p, m, b) {
    try {
      typeof p == "function" ? p(m) : p.current = m;
    } catch (A) {
      i.__e(A, b);
    }
  }
  function M(p, m, b) {
    var A, D;
    if (i.unmount && i.unmount(p), (A = p.ref) && (A.current && A.current !== p.__e || v(A, null, m)), (A = p.__c) != null) {
      if (A.componentWillUnmount) try {
        A.componentWillUnmount();
      } catch (O) {
        i.__e(O, m);
      }
      A.base = A.__P = null, p.__c = void 0;
    }
    if (A = p.__k) for (D = 0; D < A.length; D++) A[D] && M(A[D], m, b || typeof p.type != "function");
    b || p.__e == null || S(p.__e), p.__ = p.__e = p.__d = void 0;
  }
  function ue(p, m, b) {
    return this.constructor(p, b);
  }
  function ce(p, m, b) {
    var A, D, O;
    i.__ && i.__(p, m), D = (A = typeof b == "function") ? null : b && b.__k || m.__k, O = [], Xe(m, p = (!A && b || m).__k = C($, null, [p]), D || _, _, m.ownerSVGElement !== void 0, !A && b ? [b] : D ? null : m.firstChild ? o.call(m.childNodes) : null, O, !A && b ? b : D ? D.__e : m.firstChild, A), j(O, p);
  }
  function Me(p, m) {
    ce(p, m, Me);
  }
  function ze(p, m, b) {
    var A, D, O, W = y({}, p.props);
    for (O in m) O == "key" ? A = m[O] : O == "ref" ? D = m[O] : W[O] = m[O];
    return arguments.length > 2 && (W.children = arguments.length > 3 ? o.call(arguments, 2) : b), T(p.type, W, A || p.key, D || p.ref, null);
  }
  function qe(p, m) {
    var b = { __c: m = "__cC" + u++, __: p, Consumer: function(A, D) {
      return A.children(D);
    }, Provider: function(A) {
      var D, O;
      return this.getChildContext || (D = [], (O = {})[m] = this, this.getChildContext = function() {
        return O;
      }, this.shouldComponentUpdate = function(W) {
        this.props.value !== W.value && D.some(function(ne) {
          ne.__e = !0, B(ne);
        });
      }, this.sub = function(W) {
        D.push(W);
        var ne = W.componentWillUnmount;
        W.componentWillUnmount = function() {
          D.splice(D.indexOf(W), 1), ne && ne.call(W);
        };
      }), A.children;
    } };
    return b.Provider.__ = b.Consumer.contextType = b;
  }
  o = f.slice, i = { __e: function(p, m, b, A) {
    for (var D, O, W; m = m.__; ) if ((D = m.__c) && !D.__) try {
      if ((O = D.constructor) && O.getDerivedStateFromError != null && (D.setState(O.getDerivedStateFromError(p)), W = D.__d), D.componentDidCatch != null && (D.componentDidCatch(p, A || {}), W = D.__d), W) return D.__E = D;
    } catch (ne) {
      p = ne;
    }
    throw p;
  } }, a = 0, s = function(p) {
    return p != null && p.constructor === void 0;
  }, L.prototype.setState = function(p, m) {
    var b;
    b = this.__s != null && this.__s !== this.state ? this.__s : this.__s = y({}, this.state), typeof p == "function" && (p = p(y({}, b), this.props)), p && y(b, p), p != null && this.__v && (m && this._sb.push(m), B(this));
  }, L.prototype.forceUpdate = function(p) {
    this.__v && (this.__e = !0, p && this.__h.push(p), B(this));
  }, L.prototype.render = $, c = [], l = typeof Promise == "function" ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, d = function(p, m) {
    return p.__v.__b - m.__v.__b;
  }, V.__r = 0, u = 0;
}, 78: (n, t, e) => {
  e.r(t), e.d(t, { useCallback: () => B, useContext: () => V, useDebugValue: () => ee, useEffect: () => E, useErrorBoundary: () => U, useId: () => ge, useImperativeHandle: () => N, useLayoutEffect: () => $, useMemo: () => F, useReducer: () => T, useRef: () => L, useState: () => C });
  var o, i, a, s, c = e(616), h = 0, l = [], d = [], u = c.options.__b, _ = c.options.__r, f = c.options.diffed, w = c.options.__c, y = c.options.unmount;
  function S(j, P) {
    c.options.__h && c.options.__h(i, j, h || P), h = 0;
    var v = i.__H || (i.__H = { __: [], __h: [] });
    return j >= v.__.length && v.__.push({ __V: d }), v.__[j];
  }
  function C(j) {
    return h = 1, T(Xe, j);
  }
  function T(j, P, v) {
    var M = S(o++, 2);
    if (M.t = j, !M.__c && (M.__ = [v ? v(P) : Xe(void 0, P), function(ze) {
      var qe = M.__N ? M.__N[0] : M.__[0], p = M.t(qe, ze);
      qe !== p && (M.__N = [p, M.__[1]], M.__c.setState({}));
    }], M.__c = i, !i.u)) {
      var ue = function(ze, qe, p) {
        if (!M.__c.__H) return !0;
        var m = M.__c.__H.__.filter(function(A) {
          return A.__c;
        });
        if (m.every(function(A) {
          return !A.__N;
        })) return !ce || ce.call(this, ze, qe, p);
        var b = !1;
        return m.forEach(function(A) {
          if (A.__N) {
            var D = A.__[0];
            A.__ = A.__N, A.__N = void 0, D !== A.__[0] && (b = !0);
          }
        }), !(!b && M.__c.props === ze) && (!ce || ce.call(this, ze, qe, p));
      };
      i.u = !0;
      var ce = i.shouldComponentUpdate, Me = i.componentWillUpdate;
      i.componentWillUpdate = function(ze, qe, p) {
        if (this.__e) {
          var m = ce;
          ce = void 0, ue(ze, qe, p), ce = m;
        }
        Me && Me.call(this, ze, qe, p);
      }, i.shouldComponentUpdate = ue;
    }
    return M.__N || M.__;
  }
  function E(j, P) {
    var v = S(o++, 3);
    !c.options.__s && pe(v.__H, P) && (v.__ = j, v.i = P, i.__H.__h.push(v));
  }
  function $(j, P) {
    var v = S(o++, 4);
    !c.options.__s && pe(v.__H, P) && (v.__ = j, v.i = P, i.__h.push(v));
  }
  function L(j) {
    return h = 5, F(function() {
      return { current: j };
    }, []);
  }
  function N(j, P, v) {
    h = 6, $(function() {
      return typeof j == "function" ? (j(P()), function() {
        return j(null);
      }) : j ? (j.current = P(), function() {
        return j.current = null;
      }) : void 0;
    }, v == null ? v : v.concat(j));
  }
  function F(j, P) {
    var v = S(o++, 7);
    return pe(v.__H, P) ? (v.__V = j(), v.i = P, v.__h = j, v.__V) : v.__;
  }
  function B(j, P) {
    return h = 8, F(function() {
      return j;
    }, P);
  }
  function V(j) {
    var P = i.context[j.__c], v = S(o++, 9);
    return v.c = j, P ? (v.__ == null && (v.__ = !0, P.sub(i)), P.props.value) : j.__;
  }
  function ee(j, P) {
    c.options.useDebugValue && c.options.useDebugValue(P ? P(j) : j);
  }
  function U(j) {
    var P = S(o++, 10), v = C();
    return P.__ = j, i.componentDidCatch || (i.componentDidCatch = function(M, ue) {
      P.__ && P.__(M, ue), v[1](M);
    }), [v[0], function() {
      v[1](void 0);
    }];
  }
  function ge() {
    var j = S(o++, 11);
    if (!j.__) {
      for (var P = i.__v; P !== null && !P.__m && P.__ !== null; ) P = P.__;
      var v = P.__m || (P.__m = [0, 0]);
      j.__ = "P" + v[0] + "-" + v[1]++;
    }
    return j.__;
  }
  function De() {
    for (var j; j = l.shift(); ) if (j.__P && j.__H) try {
      j.__H.__h.forEach(te), j.__H.__h.forEach(se), j.__H.__h = [];
    } catch (P) {
      j.__H.__h = [], c.options.__e(P, j.__v);
    }
  }
  c.options.__b = function(j) {
    i = null, u && u(j);
  }, c.options.__r = function(j) {
    _ && _(j), o = 0;
    var P = (i = j.__c).__H;
    P && (a === i ? (P.__h = [], i.__h = [], P.__.forEach(function(v) {
      v.__N && (v.__ = v.__N), v.__V = d, v.__N = v.i = void 0;
    })) : (P.__h.forEach(te), P.__h.forEach(se), P.__h = [])), a = i;
  }, c.options.diffed = function(j) {
    f && f(j);
    var P = j.__c;
    P && P.__H && (P.__H.__h.length && (l.push(P) !== 1 && s === c.options.requestAnimationFrame || ((s = c.options.requestAnimationFrame) || Pe)(De)), P.__H.__.forEach(function(v) {
      v.i && (v.__H = v.i), v.__V !== d && (v.__ = v.__V), v.i = void 0, v.__V = d;
    })), a = i = null;
  }, c.options.__c = function(j, P) {
    P.some(function(v) {
      try {
        v.__h.forEach(te), v.__h = v.__h.filter(function(M) {
          return !M.__ || se(M);
        });
      } catch (M) {
        P.some(function(ue) {
          ue.__h && (ue.__h = []);
        }), P = [], c.options.__e(M, v.__v);
      }
    }), w && w(j, P);
  }, c.options.unmount = function(j) {
    y && y(j);
    var P, v = j.__c;
    v && v.__H && (v.__H.__.forEach(function(M) {
      try {
        te(M);
      } catch (ue) {
        P = ue;
      }
    }), v.__H = void 0, P && c.options.__e(P, v.__v));
  };
  var xe = typeof requestAnimationFrame == "function";
  function Pe(j) {
    var P, v = function() {
      clearTimeout(M), xe && cancelAnimationFrame(P), setTimeout(j);
    }, M = setTimeout(v, 100);
    xe && (P = requestAnimationFrame(v));
  }
  function te(j) {
    var P = i, v = j.__c;
    typeof v == "function" && (j.__c = void 0, v()), i = P;
  }
  function se(j) {
    var P = i;
    j.__c = j.__(), i = P;
  }
  function pe(j, P) {
    return !j || j.length !== P.length || P.some(function(v, M) {
      return v !== j[M];
    });
  }
  function Xe(j, P) {
    return typeof P == "function" ? P(j) : P;
  }
}, 292: (n) => {
  var t = [];
  function e(a) {
    for (var s = -1, c = 0; c < t.length; c++) if (t[c].identifier === a) {
      s = c;
      break;
    }
    return s;
  }
  function o(a, s) {
    for (var c = {}, h = [], l = 0; l < a.length; l++) {
      var d = a[l], u = s.base ? d[0] + s.base : d[0], _ = c[u] || 0, f = "".concat(u, " ").concat(_);
      c[u] = _ + 1;
      var w = e(f), y = { css: d[1], media: d[2], sourceMap: d[3], supports: d[4], layer: d[5] };
      if (w !== -1) t[w].references++, t[w].updater(y);
      else {
        var S = i(y, s);
        s.byIndex = l, t.splice(l, 0, { identifier: f, updater: S, references: 1 });
      }
      h.push(f);
    }
    return h;
  }
  function i(a, s) {
    var c = s.domAPI(s);
    return c.update(a), function(h) {
      if (h) {
        if (h.css === a.css && h.media === a.media && h.sourceMap === a.sourceMap && h.supports === a.supports && h.layer === a.layer) return;
        c.update(a = h);
      } else c.remove();
    };
  }
  n.exports = function(a, s) {
    var c = o(a = a || [], s = s || {});
    return function(h) {
      h = h || [];
      for (var l = 0; l < c.length; l++) {
        var d = e(c[l]);
        t[d].references--;
      }
      for (var u = o(h, s), _ = 0; _ < c.length; _++) {
        var f = e(c[_]);
        t[f].references === 0 && (t[f].updater(), t.splice(f, 1));
      }
      c = u;
    };
  };
}, 88: (n) => {
  n.exports = function(t) {
    var e = document.createElement("style");
    return t.setAttributes(e, t.attributes), t.insert(e, t.options), e;
  };
}, 884: (n, t, e) => {
  n.exports = function(o) {
    var i = e.nc;
    i && o.setAttribute("nonce", i);
  };
}, 360: (n) => {
  var t, e = (t = [], function(a, s) {
    return t[a] = s, t.filter(Boolean).join(`
`);
  });
  function o(a, s, c, h) {
    var l;
    if (c) l = "";
    else {
      l = "", h.supports && (l += "@supports (".concat(h.supports, ") {")), h.media && (l += "@media ".concat(h.media, " {"));
      var d = h.layer !== void 0;
      d && (l += "@layer".concat(h.layer.length > 0 ? " ".concat(h.layer) : "", " {")), l += h.css, d && (l += "}"), h.media && (l += "}"), h.supports && (l += "}");
    }
    if (a.styleSheet) a.styleSheet.cssText = e(s, l);
    else {
      var u = document.createTextNode(l), _ = a.childNodes;
      _[s] && a.removeChild(_[s]), _.length ? a.insertBefore(u, _[s]) : a.appendChild(u);
    }
  }
  var i = { singleton: null, singletonCounter: 0 };
  n.exports = function(a) {
    if (typeof document > "u") return { update: function() {
    }, remove: function() {
    } };
    var s = i.singletonCounter++, c = i.singleton || (i.singleton = a.insertStyleElement(a));
    return { update: function(h) {
      o(c, s, !1, h);
    }, remove: function(h) {
      o(c, s, !0, h);
    } };
  };
}, 6: (n, t, e) => {
  e.d(t, { en: () => o });
  const o = { headlines: { error: "An error has occurred", loginEmail: "Sign in or create account", loginEmailNoSignup: "Sign in", loginFinished: "Login successful", loginPasscode: "Enter passcode", loginPassword: "Enter password", registerAuthenticator: "Create a passkey", registerConfirm: "Create account?", registerPassword: "Set new password", otpSetUp: "Set up authenticator app", profileEmails: "Emails", profilePassword: "Password", profilePasskeys: "Passkeys", isPrimaryEmail: "Primary email address", setPrimaryEmail: "Set primary email address", createEmail: "Enter a new email", createUsername: "Enter a new username", emailVerified: "Verified", emailUnverified: "Unverified", emailDelete: "Delete", renamePasskey: "Rename passkey", deletePasskey: "Delete passkey", lastUsedAt: "Last used at", createdAt: "Created at", connectedAccounts: "Connected accounts", deleteAccount: "Delete account", accountNotFound: "Account not found", signIn: "Sign in", signUp: "Create account", selectLoginMethod: "Select login method", setupLoginMethod: "Set up login method", lastUsed: "Last seen", ipAddress: "IP address", revokeSession: "Revoke session", profileSessions: "Sessions", mfaSetUp: "Set up MFA", securityKeySetUp: "Add security key", securityKeyLogin: "Security key", otpLogin: "Authentication code", renameSecurityKey: "Rename security key", deleteSecurityKey: "Delete security key", securityKeys: "Security keys", authenticatorApp: "Authenticator app", authenticatorAppAlreadySetUp: "Authenticator app is set up", authenticatorAppNotSetUp: "Set up authenticator app", trustDevice: "Trust this browser?", deleteIdentity: "Delete connection" }, texts: { enterPasscode: "Enter the passcode sent to your email address.", enterPasscodeNoEmail: "Enter the passcode that was sent to your primary email address.", setupPasskey: "Sign in to your account easily and securely with a passkey. Note: Your biometric data is only stored on your devices and will never be shared with anyone.", createAccount: 'No account exists for "{emailAddress}". Do you want to create a new account?', otpEnterVerificationCode: "Enter the one-time password (OTP) obtained from your authenticator app below:", otpScanQRCode: "Scan the QR code using your authenticator app (such as Google Authenticator or any other TOTP app). Alternatively, you can manually enter the OTP secret key into the app.", otpSecretKey: "OTP secret key", passwordFormatHint: "Must be between {minLength} and {maxLength} characters long.", securityKeySetUp: "Use a dedicated security key via USB, Bluetooth, or NFC, or your mobile phone. Connect or activate your security key, then click the button below and follow the prompts to complete the registration.", setPrimaryEmail: "Set this email address to be used for contacting you.", isPrimaryEmail: "This email address will be used to contact you if necessary.", emailVerified: "This email address has been verified.", emailUnverified: "This email address has not been verified.", emailDelete: "If you delete this email address, it can no longer be used to sign in.", renamePasskey: "Set a name for the passkey.", deletePasskey: "Delete this passkey from your account.", deleteAccount: "Are you sure you want to delete this account? All data will be deleted immediately and cannot be recovered.", noAccountExists: 'No account exists for "{emailAddress}".', selectLoginMethodForFutureLogins: "Select one of the following login methods to use for future logins.", howDoYouWantToLogin: "How do you want to login?", mfaSetUp: "Protect your account with Multi-Factor Authentication (MFA). MFA adds an additional step to your login process, ensuring that even if your password or email account is compromised, your account stays secure.", securityKeyLogin: "Connect or activate your security key, then click the button below. Once ready, use it via USB, NFC, your mobile phone. Follow the prompts to complete the login process.", otpLogin: "Open your authenticator app to obtain the one-time password (OTP). Enter the code in the field below to complete your login.", renameSecurityKey: "Set a name for the security key.", deleteSecurityKey: "Delete this security key from your account.", authenticatorAppAlreadySetUp: "Your account is secured with an authenticator app that generates time-based one-time passwords (TOTP) for multi-factor authentication.", authenticatorAppNotSetUp: "Secure your account with an authenticator app that generates time-based one-time passwords (TOTP) for multi-factor authentication.", trustDevice: "If you trust this browser, you won’t need to enter your OTP (One-Time-Password) or use your security key for multi-factor authentication (MFA) the next time you log in." }, labels: { or: "or", no: "no", yes: "yes", email: "Email", continue: "Continue", copied: "copied", skip: "Skip", save: "Save", password: "Password", passkey: "Passkey", passcode: "Passcode", signInPassword: "Sign in with a password", signInPasscode: "Sign in with a passcode", forgotYourPassword: "Forgot your password?", back: "Back", signInPasskey: "Sign in with a passkey", registerAuthenticator: "Create a passkey", signIn: "Sign in", signUp: "Create account", sendNewPasscode: "Send new code", passwordRetryAfter: "Retry in {passwordRetryAfter}", passcodeResendAfter: "Request a new code in {passcodeResendAfter}", unverifiedEmail: "unverified", primaryEmail: "primary", setAsPrimaryEmail: "Set as primary", verify: "Verify", delete: "Delete", newEmailAddress: "New email address", newPassword: "New password", rename: "Rename", newPasskeyName: "New passkey name", addEmail: "Add email", createPasskey: "Create a passkey", webauthnUnsupported: "Passkeys are not supported by your browser", signInWith: "Continue with {provider}", deleteAccount: "Yes, delete this account.", emailOrUsername: "Email or username", username: "Username", optional: "optional", dontHaveAnAccount: "Don't have an account?", alreadyHaveAnAccount: "Already have an account?", changeUsername: "Change username", setUsername: "Set username", changePassword: "Change password", setPassword: "Set password", revoke: "Revoke", currentSession: "Current session", authenticatorApp: "Authenticator app", securityKey: "Security key", securityKeyUse: "Use security key", newSecurityKeyName: "New security key name", createSecurityKey: "Add a security key", authenticatorAppManage: "Manage authenticator app", authenticatorAppAdd: "Set up", configured: "configured", useAnotherMethod: "Use another method", lastUsed: "Last used", trustDevice: "Trust this browser", staySignedIn: "Stay signed in", connectAccount: "Connect account" }, errors: { somethingWentWrong: "A technical error has occurred. Please try again later.", requestTimeout: "The request timed out.", invalidPassword: "Wrong email or password.", invalidPasscode: "The passcode provided was not correct.", passcodeAttemptsReached: "The passcode was entered incorrectly too many times. Please request a new code.", tooManyRequests: "Too many requests have been made. Please wait to repeat the requested operation.", unauthorized: "Your session has expired. Please log in again.", invalidWebauthnCredential: "This passkey cannot be used anymore.", passcodeExpired: "The passcode has expired. Please request a new one.", userVerification: "User verification required. Please ensure your authenticator device is protected with a PIN or biometric.", emailAddressAlreadyExistsError: "The email address already exists.", maxNumOfEmailAddressesReached: "No further email addresses can be added.", thirdPartyAccessDenied: "Access denied. The request was cancelled by the user or the provider has denied access for other reasons.", thirdPartyMultipleAccounts: "Cannot identify account. The email address is used by multiple accounts.", thirdPartyUnverifiedEmail: "Email verification required. Please verify the used email address with your provider.", signupDisabled: "Account registration is disabled.", handlerNotFoundError: "The current step in your process is not supported by this application version. Please try again later or contact support if the issue persists." }, flowErrors: { technical_error: "A technical error has occurred. Please try again later.", flow_expired_error: "The session has expired, please click the button to restart.", value_invalid_error: "The entered value is invalid.", passcode_invalid: "The passcode provided was not correct.", passkey_invalid: "This passkey cannot be used anymore.", passcode_max_attempts_reached: "The passcode was entered incorrectly too many times. Please request a new code.", rate_limit_exceeded: "Too many requests have been made. Please wait to repeat the requested operation.", unknown_username_error: "The username is unknown.", unknown_email_error: "The email address is unknown.", username_already_exists: "The username is already taken.", invalid_username_error: "The username must contain only letters, numbers, and underscores.", email_already_exists: "The email is already taken.", not_found: "The requested resource was not found.", operation_not_permitted_error: "The operation is not permitted.", flow_discontinuity_error: "The process cannot be continued due to user settings or the provider's configuration.", form_data_invalid_error: "The submitted form data contains errors.", unauthorized: "Your session has expired. Please log in again.", value_missing_error: "The value is missing.", value_too_long_error: "Value is too long.", value_too_short_error: "The value is too short.", webauthn_credential_invalid_mfa_only: "This credential can be used as a second factor security key only.", webauthn_credential_already_exists: "The request either timed out, was canceled or the device is already registered. Please try again or try using another device.", platform_authenticator_required: "Your account is configured to use platform authenticators, but your current device or browser does not support this feature. Please try again with a compatible device or browser.", third_party_access_denied: "Access denied. The request was cancelled by the user or the provider has denied access for other reasons." } };
} }, _o = {};
function Z(n) {
  var t = _o[n];
  if (t !== void 0) return t.exports;
  var e = _o[n] = { id: n, exports: {} };
  return or[n].call(e.exports, e, e.exports, Z), e.exports;
}
Z.n = (n) => {
  var t = n && n.__esModule ? () => n.default : () => n;
  return Z.d(t, { a: t }), t;
}, Z.d = (n, t) => {
  for (var e in t) Z.o(t, e) && !Z.o(n, e) && Object.defineProperty(n, e, { enumerable: !0, get: t[e] });
}, Z.o = (n, t) => Object.prototype.hasOwnProperty.call(n, t), Z.r = (n) => {
  typeof Symbol < "u" && Symbol.toStringTag && Object.defineProperty(n, Symbol.toStringTag, { value: "Module" }), Object.defineProperty(n, "__esModule", { value: !0 });
}, Z.nc = void 0;
var X = {};
Z.d(X, { rc: () => Dt, Kj: () => Xn, fK: () => Mn, tJ: () => pi, Z7: () => Qn, qQ: () => Vn, I4: () => Si, O8: () => ke, Qq: () => Yn, ku: () => Wn, ls: () => Hn, bO: () => Fn, yv: () => Jn, AT: () => qn, m_: () => Kn, KG: () => zn, Wj: () => gi, DH: () => pn, kf: () => eo, Uw: () => He, oY: () => Ve, Wg: () => Gn, AC: () => Bn, D_: () => $t, jx: () => wi, nX: () => Zn, Nx: () => Rn, Sd: () => lt, kz: () => za, fX: () => Tn, qA: () => Ln, tz: () => Un, gN: () => Nn });
var Cn = {};
Z.r(Cn), Z.d(Cn, { apple: () => Rr, checkmark: () => Hr, copy: () => Wr, customProvider: () => Fr, discord: () => zr, exclamation: () => qr, facebook: () => Kr, github: () => Br, google: () => Vr, linkedin: () => Zr, mail: () => Jr, microsoft: () => Qr, passkey: () => Gr, password: () => Yr, qrCodeScanner: () => Xr, securityKey: () => ea, spinner: () => ta });
var x = Z(616), ir = 0;
function r(n, t, e, o, i, a) {
  var s, c, h = {};
  for (c in t) c == "ref" ? s = t[c] : h[c] = t[c];
  var l = { type: n, props: h, key: e, ref: s, __k: null, __: null, __b: 0, __e: null, __d: void 0, __c: null, __h: null, constructor: void 0, __v: --ir, __source: i, __self: a };
  if (typeof n == "function" && (s = n.defaultProps)) for (c in s) h[c] === void 0 && (h[c] = s[c]);
  return x.options.vnode && x.options.vnode(l), l;
}
function ln() {
  return ln = Object.assign ? Object.assign.bind() : function(n) {
    for (var t = 1; t < arguments.length; t++) {
      var e = arguments[t];
      for (var o in e) Object.prototype.hasOwnProperty.call(e, o) && (n[o] = e[o]);
    }
    return n;
  }, ln.apply(this, arguments);
}
var rr = ["context", "children"];
function ar(n) {
  this.getChildContext = function() {
    return n.context;
  };
  var t = n.children, e = function(o, i) {
    if (o == null) return {};
    var a, s, c = {}, h = Object.keys(o);
    for (s = 0; s < h.length; s++) i.indexOf(a = h[s]) >= 0 || (c[a] = o[a]);
    return c;
  }(n, rr);
  return (0, x.cloneElement)(t, e);
}
function sr() {
  var n = new CustomEvent("_preact", { detail: {}, bubbles: !0, cancelable: !0 });
  this.dispatchEvent(n), this._vdom = (0, x.h)(ar, ln({}, this._props, { context: n.detail.context }), ai(this, this._vdomComponent)), (this.hasAttribute("hydrate") ? x.hydrate : x.render)(this._vdom, this._root);
}
function ri(n) {
  return n.replace(/-(\w)/g, function(t, e) {
    return e ? e.toUpperCase() : "";
  });
}
function cr(n, t, e) {
  if (this._vdom) {
    var o = {};
    o[n] = e = e ?? void 0, o[ri(n)] = e, this._vdom = (0, x.cloneElement)(this._vdom, o), (0, x.render)(this._vdom, this._root);
  }
}
function lr() {
  (0, x.render)(this._vdom = null, this._root);
}
function vo(n, t) {
  var e = this;
  return (0, x.h)("slot", ln({}, n, { ref: function(o) {
    o ? (e.ref = o, e._listener || (e._listener = function(i) {
      i.stopPropagation(), i.detail.context = t;
    }, o.addEventListener("_preact", e._listener))) : e.ref.removeEventListener("_preact", e._listener);
  } }));
}
function ai(n, t) {
  if (n.nodeType === 3) return n.data;
  if (n.nodeType !== 1) return null;
  var e = [], o = {}, i = 0, a = n.attributes, s = n.childNodes;
  for (i = a.length; i--; ) a[i].name !== "slot" && (o[a[i].name] = a[i].value, o[ri(a[i].name)] = a[i].value);
  for (i = s.length; i--; ) {
    var c = ai(s[i], null), h = s[i].slot;
    h ? o[h] = (0, x.h)(vo, { name: h }, c) : e[i] = c;
  }
  var l = t ? (0, x.h)(vo, null, e) : e;
  return (0, x.h)(t || n.nodeName.toLowerCase(), o, l);
}
var z = Z(7), g = Z(78);
function si(n, t) {
  for (var e in t) n[e] = t[e];
  return n;
}
function bo(n, t) {
  for (var e in n) if (e !== "__source" && !(e in t)) return !0;
  for (var o in t) if (o !== "__source" && n[o] !== t[o]) return !0;
  return !1;
}
function yo(n) {
  this.props = n;
}
(yo.prototype = new x.Component()).isPureReactComponent = !0, yo.prototype.shouldComponentUpdate = function(n, t) {
  return bo(this.props, n) || bo(this.state, t);
};
var ko = x.options.__b;
x.options.__b = function(n) {
  n.type && n.type.__f && n.ref && (n.props.ref = n.ref, n.ref = null), ko && ko(n);
};
var dr = typeof Symbol < "u" && Symbol.for && Symbol.for("react.forward_ref") || 3911, hr = (x.toChildArray, x.options.__e);
x.options.__e = function(n, t, e, o) {
  if (n.then) {
    for (var i, a = t; a = a.__; ) if ((i = a.__c) && i.__c) return t.__e == null && (t.__e = e.__e, t.__k = e.__k), i.__c(n, t);
  }
  hr(n, t, e, o);
};
var wo = x.options.unmount;
function ci(n, t, e) {
  return n && (n.__c && n.__c.__H && (n.__c.__H.__.forEach(function(o) {
    typeof o.__c == "function" && o.__c();
  }), n.__c.__H = null), (n = si({}, n)).__c != null && (n.__c.__P === e && (n.__c.__P = t), n.__c = null), n.__k = n.__k && n.__k.map(function(o) {
    return ci(o, t, e);
  })), n;
}
function li(n, t, e) {
  return n && (n.__v = null, n.__k = n.__k && n.__k.map(function(o) {
    return li(o, t, e);
  }), n.__c && n.__c.__P === t && (n.__e && e.insertBefore(n.__e, n.__d), n.__c.__e = !0, n.__c.__P = e)), n;
}
function yn() {
  this.__u = 0, this.t = null, this.__b = null;
}
function di(n) {
  var t = n.__.__c;
  return t && t.__a && t.__a(n);
}
function Wt() {
  this.u = null, this.o = null;
}
x.options.unmount = function(n) {
  var t = n.__c;
  t && t.__R && t.__R(), t && n.__h === !0 && (n.type = null), wo && wo(n);
}, (yn.prototype = new x.Component()).__c = function(n, t) {
  var e = t.__c, o = this;
  o.t == null && (o.t = []), o.t.push(e);
  var i = di(o.__v), a = !1, s = function() {
    a || (a = !0, e.__R = null, i ? i(c) : c());
  };
  e.__R = s;
  var c = function() {
    if (!--o.__u) {
      if (o.state.__a) {
        var l = o.state.__a;
        o.__v.__k[0] = li(l, l.__c.__P, l.__c.__O);
      }
      var d;
      for (o.setState({ __a: o.__b = null }); d = o.t.pop(); ) d.forceUpdate();
    }
  }, h = t.__h === !0;
  o.__u++ || h || o.setState({ __a: o.__b = o.__v.__k[0] }), n.then(s, s);
}, yn.prototype.componentWillUnmount = function() {
  this.t = [];
}, yn.prototype.render = function(n, t) {
  if (this.__b) {
    if (this.__v.__k) {
      var e = document.createElement("div"), o = this.__v.__k[0].__c;
      this.__v.__k[0] = ci(this.__b, e, o.__O = o.__P);
    }
    this.__b = null;
  }
  var i = t.__a && (0, x.createElement)(x.Fragment, null, n.fallback);
  return i && (i.__h = null), [(0, x.createElement)(x.Fragment, null, t.__a ? null : n.children), i];
};
var So = function(n, t, e) {
  if (++e[1] === e[0] && n.o.delete(t), n.props.revealOrder && (n.props.revealOrder[0] !== "t" || !n.o.size)) for (e = n.u; e; ) {
    for (; e.length > 3; ) e.pop()();
    if (e[1] < e[0]) break;
    n.u = e = e[2];
  }
};
(Wt.prototype = new x.Component()).__a = function(n) {
  var t = this, e = di(t.__v), o = t.o.get(n);
  return o[0]++, function(i) {
    var a = function() {
      t.props.revealOrder ? (o.push(i), So(t, n, o)) : i();
    };
    e ? e(a) : a();
  };
}, Wt.prototype.render = function(n) {
  this.u = null, this.o = /* @__PURE__ */ new Map();
  var t = (0, x.toChildArray)(n.children);
  n.revealOrder && n.revealOrder[0] === "b" && t.reverse();
  for (var e = t.length; e--; ) this.o.set(t[e], this.u = [1, 0, this.u]);
  return n.children;
}, Wt.prototype.componentDidUpdate = Wt.prototype.componentDidMount = function() {
  var n = this;
  this.o.forEach(function(t, e) {
    So(n, e, t);
  });
};
var ur = typeof Symbol < "u" && Symbol.for && Symbol.for("react.element") || 60103, pr = /^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/, fr = /^on(Ani|Tra|Tou|BeforeInp|Compo)/, mr = /[A-Z0-9]/g, gr = typeof document < "u", _r = function(n) {
  return (typeof Symbol < "u" && typeof Symbol() == "symbol" ? /fil|che|rad/ : /fil|che|ra/).test(n);
};
x.Component.prototype.isReactComponent = {}, ["componentWillMount", "componentWillReceiveProps", "componentWillUpdate"].forEach(function(n) {
  Object.defineProperty(x.Component.prototype, n, { configurable: !0, get: function() {
    return this["UNSAFE_" + n];
  }, set: function(t) {
    Object.defineProperty(this, n, { configurable: !0, writable: !0, value: t });
  } });
});
var xo = x.options.event;
function vr() {
}
function br() {
  return this.cancelBubble;
}
function yr() {
  return this.defaultPrevented;
}
x.options.event = function(n) {
  return xo && (n = xo(n)), n.persist = vr, n.isPropagationStopped = br, n.isDefaultPrevented = yr, n.nativeEvent = n;
};
var Co = { configurable: !0, get: function() {
  return this.class;
} }, Ao = x.options.vnode;
x.options.vnode = function(n) {
  var t = n.type, e = n.props, o = e;
  if (typeof t == "string") {
    for (var i in o = {}, e) {
      var a = e[i];
      if (!(i === "value" && "defaultValue" in e && a == null || gr && i === "children" && t === "noscript")) {
        var s = i.toLowerCase();
        i === "defaultValue" && "value" in e && e.value == null ? i = "value" : i === "download" && a === !0 ? a = "" : s === "ondoubleclick" ? i = "ondblclick" : s !== "onchange" || t !== "input" && t !== "textarea" || _r(e.type) ? s === "onfocus" ? i = "onfocusin" : s === "onblur" ? i = "onfocusout" : fr.test(i) ? i = s : t.indexOf("-") === -1 && pr.test(i) ? i = i.replace(mr, "-$&").toLowerCase() : a === null && (a = void 0) : s = i = "oninput", s === "oninput" && o[i = s] && (i = "oninputCapture"), o[i] = a;
      }
    }
    t == "select" && o.multiple && Array.isArray(o.value) && (o.value = (0, x.toChildArray)(e.children).forEach(function(c) {
      c.props.selected = o.value.indexOf(c.props.value) != -1;
    })), t == "select" && o.defaultValue != null && (o.value = (0, x.toChildArray)(e.children).forEach(function(c) {
      c.props.selected = o.multiple ? o.defaultValue.indexOf(c.props.value) != -1 : o.defaultValue == c.props.value;
    })), n.props = o, e.class != e.className && (Co.enumerable = "className" in e, e.className != null && (o.class = e.className), Object.defineProperty(o, "className", Co));
  }
  n.$$typeof = ur, Ao && Ao(n);
};
var Oo = x.options.__r;
x.options.__r = function(n) {
  Oo && Oo(n), n.__c;
};
var Eo = x.options.diffed;
function We() {
  return We = Object.assign ? Object.assign.bind() : function(n) {
    for (var t = 1; t < arguments.length; t++) {
      var e = arguments[t];
      for (var o in e) Object.prototype.hasOwnProperty.call(e, o) && (n[o] = e[o]);
    }
    return n;
  }, We.apply(this, arguments);
}
x.options.diffed = function(n) {
  Eo && Eo(n);
  var t = n.props, e = n.__e;
  e != null && n.type === "textarea" && "value" in t && t.value !== e.value && (e.value = t.value == null ? "" : t.value);
}, x.Fragment, g.useLayoutEffect, g.useState, g.useId, g.useReducer, g.useEffect, g.useLayoutEffect, g.useRef, g.useImperativeHandle, g.useMemo, g.useCallback, g.useContext, g.useDebugValue, x.createElement, x.createContext, x.createRef, x.Fragment, x.Component;
class kr {
  static throttle(t, e, o = {}) {
    const { leading: i = !0, trailing: a = !0 } = o;
    let s, c, h, l = 0;
    const d = () => {
      l = i === !1 ? 0 : Date.now(), h = null, t.apply(s, c);
    };
    return function(...u) {
      const _ = Date.now();
      l || i !== !1 || (l = _);
      const f = e - (_ - l);
      s = this, c = u, f <= 0 || f > e ? (h && (window.clearTimeout(h), h = null), l = _, t.apply(s, c)) : h || a === !1 || (h = window.setTimeout(d, f));
    };
  }
}
const Tn = "hanko-session-created", Ln = "hanko-session-expired", Nn = "hanko-user-logged-out", Un = "hanko-user-deleted", hi = "hanko-after-state-change", ui = "hanko-before-state-change";
class pi extends CustomEvent {
  constructor(t, e) {
    super(t, { detail: e });
  }
}
class un {
  constructor() {
    this.throttleLimit = 1e3, this._addEventListener = document.addEventListener.bind(document), this._removeEventListener = document.removeEventListener.bind(document), this._throttle = kr.throttle;
  }
  wrapCallback(t, e) {
    const o = (i) => {
      t(i.detail);
    };
    return e ? this._throttle(o, this.throttleLimit, { leading: !0, trailing: !1 }) : o;
  }
  addEventListenerWithType({ type: t, callback: e, once: o = !1, throttle: i = !1 }) {
    const a = this.wrapCallback(e, i);
    return this._addEventListener(t, a, { once: o }), () => this._removeEventListener(t, a);
  }
  static mapAddEventListenerParams(t, { once: e, callback: o }, i) {
    return { type: t, callback: o, once: e, throttle: i };
  }
  addEventListener(t, e, o) {
    return this.addEventListenerWithType(un.mapAddEventListenerParams(t, e, o));
  }
  onSessionCreated(t, e) {
    return this.addEventListener(Tn, { callback: t, once: e }, !0);
  }
  onSessionExpired(t, e) {
    return this.addEventListener(Ln, { callback: t, once: e }, !0);
  }
  onUserLoggedOut(t, e) {
    return this.addEventListener(Nn, { callback: t, once: e });
  }
  onUserDeleted(t, e) {
    return this.addEventListener(Un, { callback: t, once: e });
  }
  onAfterStateChange(t, e) {
    return this.addEventListener(hi, { callback: t, once: e }, !1);
  }
  onBeforeStateChange(t, e) {
    return this.addEventListener(ui, { callback: t, once: e }, !1);
  }
}
class fi {
  constructor() {
    this._dispatchEvent = document.dispatchEvent.bind(document);
  }
  dispatch(t, e) {
    this._dispatchEvent(new pi(t, e));
  }
  dispatchSessionCreatedEvent(t) {
    this.dispatch(Tn, t);
  }
  dispatchSessionExpiredEvent() {
    this.dispatch(Ln, null);
  }
  dispatchUserLoggedOutEvent() {
    this.dispatch(Nn, null);
  }
  dispatchUserDeletedEvent() {
    this.dispatch(Un, null);
  }
  dispatchAfterStateChangeEvent(t) {
    this.dispatch(hi, t);
  }
  dispatchBeforeStateChangeEvent(t) {
    this.dispatch(ui, t);
  }
}
class ke extends Error {
  constructor(t, e, o) {
    super(t), this.code = void 0, this.cause = void 0, this.code = e, this.cause = o, Object.setPrototypeOf(this, ke.prototype);
  }
}
class Ve extends ke {
  constructor(t) {
    super("Technical error", "somethingWentWrong", t), Object.setPrototypeOf(this, Ve.prototype);
  }
}
class Mn extends ke {
  constructor(t, e) {
    super("Conflict error", "conflict", e), Object.setPrototypeOf(this, Mn.prototype);
  }
}
class pn extends ke {
  constructor(t) {
    super("Request timed out error", "requestTimeout", t), Object.setPrototypeOf(this, pn.prototype);
  }
}
class Rn extends ke {
  constructor(t) {
    super("Request cancelled error", "requestCancelled", t), Object.setPrototypeOf(this, Rn.prototype);
  }
}
class Hn extends ke {
  constructor(t) {
    super("Invalid password error", "invalidPassword", t), Object.setPrototypeOf(this, Hn.prototype);
  }
}
class Wn extends ke {
  constructor(t) {
    super("Invalid Passcode error", "invalidPasscode", t), Object.setPrototypeOf(this, Wn.prototype);
  }
}
class Fn extends ke {
  constructor(t) {
    super("Invalid WebAuthn credential error", "invalidWebauthnCredential", t), Object.setPrototypeOf(this, Fn.prototype);
  }
}
class zn extends ke {
  constructor(t) {
    super("Passcode expired error", "passcodeExpired", t), Object.setPrototypeOf(this, zn.prototype);
  }
}
class qn extends ke {
  constructor(t) {
    super("Maximum number of Passcode attempts reached error", "passcodeAttemptsReached", t), Object.setPrototypeOf(this, qn.prototype);
  }
}
class Kn extends ke {
  constructor(t) {
    super("Not found error", "notFound", t), Object.setPrototypeOf(this, Kn.prototype);
  }
}
class Bn extends ke {
  constructor(t, e) {
    super("Too many requests error", "tooManyRequests", e), this.retryAfter = void 0, this.retryAfter = t, Object.setPrototypeOf(this, Bn.prototype);
  }
}
class $t extends ke {
  constructor(t) {
    super("Unauthorized error", "unauthorized", t), Object.setPrototypeOf(this, $t.prototype);
  }
}
class Vn extends ke {
  constructor(t) {
    super("Forbidden error", "forbidden", t), Object.setPrototypeOf(this, Vn.prototype);
  }
}
class Zn extends ke {
  constructor(t) {
    super("User verification error", "userVerification", t), Object.setPrototypeOf(this, Zn.prototype);
  }
}
class Jn extends ke {
  constructor(t) {
    super("Maximum number of email addresses reached error", "maxNumOfEmailAddressesReached", t), Object.setPrototypeOf(this, Jn.prototype);
  }
}
class Qn extends ke {
  constructor(t) {
    super("The email address already exists", "emailAddressAlreadyExistsError", t), Object.setPrototypeOf(this, Qn.prototype);
  }
}
class Gn extends ke {
  constructor(t, e) {
    super("An error occurred during third party sign up/sign in", t, e), Object.setPrototypeOf(this, Gn.prototype);
  }
}
function Ft(n) {
  for (var t = 1; t < arguments.length; t++) {
    var e = arguments[t];
    for (var o in e) n[o] = e[o];
  }
  return n;
}
var kn = function n(t, e) {
  function o(i, a, s) {
    if (typeof document < "u") {
      typeof (s = Ft({}, e, s)).expires == "number" && (s.expires = new Date(Date.now() + 864e5 * s.expires)), s.expires && (s.expires = s.expires.toUTCString()), i = encodeURIComponent(i).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
      var c = "";
      for (var h in s) s[h] && (c += "; " + h, s[h] !== !0 && (c += "=" + s[h].split(";")[0]));
      return document.cookie = i + "=" + t.write(a, i) + c;
    }
  }
  return Object.create({ set: o, get: function(i) {
    if (typeof document < "u" && (!arguments.length || i)) {
      for (var a = document.cookie ? document.cookie.split("; ") : [], s = {}, c = 0; c < a.length; c++) {
        var h = a[c].split("="), l = h.slice(1).join("=");
        try {
          var d = decodeURIComponent(h[0]);
          if (s[d] = t.read(l, d), i === d) break;
        } catch {
        }
      }
      return i ? s[i] : s;
    }
  }, remove: function(i, a) {
    o(i, "", Ft({}, a, { expires: -1 }));
  }, withAttributes: function(i) {
    return n(this.converter, Ft({}, this.attributes, i));
  }, withConverter: function(i) {
    return n(Ft({}, this.converter, i), this.attributes);
  } }, { attributes: { value: Object.freeze(e) }, converter: { value: Object.freeze(t) } });
}({ read: function(n) {
  return n[0] === '"' && (n = n.slice(1, -1)), n.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
}, write: function(n) {
  return encodeURIComponent(n).replace(/%(2[346BF]|3[AC-F]|40|5[BDE]|60|7[BCD])/g, decodeURIComponent);
} }, { path: "/" });
class mi {
  constructor(t) {
    var e, o;
    this.authCookieName = void 0, this.authCookieDomain = void 0, this.authCookieSameSite = void 0, this.authCookieName = (e = t.cookieName) != null ? e : "hanko", this.authCookieDomain = t.cookieDomain, this.authCookieSameSite = (o = t.cookieSameSite) != null ? o : "lax";
  }
  getAuthCookie() {
    return kn.get(this.authCookieName);
  }
  setAuthCookie(t, e) {
    const o = { secure: !0, sameSite: this.authCookieSameSite };
    this.authCookieDomain !== void 0 && (o.domain = this.authCookieDomain);
    const i = We({}, o, e);
    if ((i.sameSite === "none" || i.sameSite === "None") && i.secure === !1) throw new Ve(new Error("Secure attribute must be set when SameSite=None"));
    kn.set(this.authCookieName, t, i);
  }
  removeAuthCookie() {
    kn.remove(this.authCookieName);
  }
}
class wr {
  constructor(t) {
    this.keyName = void 0, this.keyName = t.keyName;
  }
  getSessionToken() {
    return sessionStorage.getItem(this.keyName);
  }
  setSessionToken(t) {
    sessionStorage.setItem(this.keyName, t);
  }
  removeSessionToken() {
    sessionStorage.removeItem(this.keyName);
  }
}
class Sr {
  constructor(t) {
    this._xhr = void 0, this._xhr = t;
  }
  getResponseHeader(t) {
    return this._xhr.getResponseHeader(t);
  }
}
class xr {
  constructor(t) {
    this.headers = void 0, this.ok = void 0, this.status = void 0, this.statusText = void 0, this.url = void 0, this._decodedJSON = void 0, this.xhr = void 0, this.headers = new Sr(t), this.ok = t.status >= 200 && t.status <= 299, this.status = t.status, this.statusText = t.statusText, this.url = t.responseURL, this.xhr = t;
  }
  json() {
    return this._decodedJSON || (this._decodedJSON = JSON.parse(this.xhr.response)), this._decodedJSON;
  }
  parseNumericHeader(t) {
    const e = parseInt(this.headers.getResponseHeader(t), 10);
    return isNaN(e) ? 0 : e;
  }
}
class Yn {
  constructor(t, e) {
    var o;
    this.timeout = void 0, this.api = void 0, this.dispatcher = void 0, this.cookie = void 0, this.sessionTokenStorage = void 0, this.lang = void 0, this.sessionTokenLocation = void 0, this.api = t, this.timeout = (o = e.timeout) != null ? o : 13e3, this.dispatcher = new fi(), this.cookie = new mi(We({}, e)), this.sessionTokenStorage = new wr({ keyName: e.cookieName }), this.lang = e.lang, this.sessionTokenLocation = e.sessionTokenLocation;
  }
  _fetch(t, e, o = new XMLHttpRequest()) {
    const i = this, a = this.api + t, s = this.timeout, c = this.getAuthToken(), h = this.lang;
    return new Promise(function(l, d) {
      o.open(e.method, a, !0), o.setRequestHeader("Accept", "application/json"), o.setRequestHeader("Content-Type", "application/json"), o.setRequestHeader("X-Language", h), c && o.setRequestHeader("Authorization", `Bearer ${c}`), o.timeout = s, o.withCredentials = !0, o.onload = () => {
        i.processHeaders(o), l(new xr(o));
      }, o.onerror = () => {
        d(new Ve());
      }, o.ontimeout = () => {
        d(new pn());
      }, o.send(e.body ? e.body.toString() : null);
    });
  }
  processHeaders(t) {
    let e = "", o = 0, i = "";
    if (t.getAllResponseHeaders().split(`\r
`).forEach((a) => {
      const s = a.toLowerCase();
      s.startsWith("x-auth-token") ? e = t.getResponseHeader("X-Auth-Token") : s.startsWith("x-session-lifetime") ? o = parseInt(t.getResponseHeader("X-Session-Lifetime"), 10) : s.startsWith("x-session-retention") && (i = t.getResponseHeader("X-Session-Retention"));
    }), e) {
      const a = new RegExp("^https://"), s = !!this.api.match(a) && !!window.location.href.match(a), c = i === "session" ? void 0 : new Date((/* @__PURE__ */ new Date()).getTime() + 1e3 * o);
      this.setAuthToken(e, { secure: s, expires: c });
    }
  }
  get(t) {
    return this._fetch(t, { method: "GET" });
  }
  post(t, e) {
    return this._fetch(t, { method: "POST", body: JSON.stringify(e) });
  }
  put(t, e) {
    return this._fetch(t, { method: "PUT", body: JSON.stringify(e) });
  }
  patch(t, e) {
    return this._fetch(t, { method: "PATCH", body: JSON.stringify(e) });
  }
  delete(t) {
    return this._fetch(t, { method: "DELETE" });
  }
  getAuthToken() {
    let t = "";
    switch (this.sessionTokenLocation) {
      case "cookie":
      default:
        t = this.cookie.getAuthCookie();
        break;
      case "sessionStorage":
        t = this.sessionTokenStorage.getSessionToken();
    }
    return t;
  }
  setAuthToken(t, e) {
    switch (this.sessionTokenLocation) {
      case "cookie":
      default:
        return this.cookie.setAuthCookie(t, e);
      case "sessionStorage":
        return this.sessionTokenStorage.setSessionToken(t);
    }
  }
}
class Xn {
  constructor(t, e) {
    this.client = void 0, this.client = new Yn(t, e);
  }
}
class eo extends Xn {
  async validate() {
    const t = await this.client.get("/sessions/validate");
    if (!t.ok) throw new Ve();
    return await t.json();
  }
}
class Cr {
  constructor(t) {
    this.storageKey = void 0, this.defaultState = { expiration: 0, lastCheck: 0 }, this.storageKey = t;
  }
  load() {
    const t = window.localStorage.getItem(this.storageKey);
    return t == null ? this.defaultState : JSON.parse(t);
  }
  save(t) {
    window.localStorage.setItem(this.storageKey, JSON.stringify(t || this.defaultState));
  }
}
class Ar {
  constructor(t, e) {
    this.onActivityCallback = void 0, this.onInactivityCallback = void 0, this.handleFocus = () => {
      this.onActivityCallback();
    }, this.handleBlur = () => {
      this.onInactivityCallback();
    }, this.handleVisibilityChange = () => {
      document.visibilityState === "visible" ? this.onActivityCallback() : this.onInactivityCallback();
    }, this.hasFocus = () => document.hasFocus(), this.onActivityCallback = t, this.onInactivityCallback = e, window.addEventListener("focus", this.handleFocus), window.addEventListener("blur", this.handleBlur), document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }
}
class Or {
  constructor(t, e, o) {
    this.intervalID = null, this.timeoutID = null, this.checkInterval = void 0, this.checkSession = void 0, this.onSessionExpired = void 0, this.checkInterval = t, this.checkSession = e, this.onSessionExpired = o;
  }
  scheduleSessionExpiry(t) {
    var e = this;
    this.stop(), this.timeoutID = setTimeout(async function() {
      e.stop(), e.onSessionExpired();
    }, t);
  }
  start(t = 0, e = 0) {
    var o = this;
    const i = this.calcTimeToNextCheck(t);
    this.sessionExpiresSoon(e) ? this.scheduleSessionExpiry(i) : this.timeoutID = setTimeout(async function() {
      try {
        let a = await o.checkSession();
        if (a.is_valid) {
          if (o.sessionExpiresSoon(a.expiration)) return void o.scheduleSessionExpiry(a.expiration - Date.now());
          o.intervalID = setInterval(async function() {
            a = await o.checkSession(), a.is_valid ? o.sessionExpiresSoon(a.expiration) && o.scheduleSessionExpiry(a.expiration - Date.now()) : o.stop();
          }, o.checkInterval);
        } else o.stop();
      } catch (a) {
        console.log(a);
      }
    }, i);
  }
  stop() {
    this.timeoutID && (clearTimeout(this.timeoutID), this.timeoutID = null), this.intervalID && (clearInterval(this.intervalID), this.intervalID = null);
  }
  isRunning() {
    return this.timeoutID !== null || this.intervalID !== null;
  }
  sessionExpiresSoon(t) {
    return t > 0 && t - Date.now() <= this.checkInterval;
  }
  calcTimeToNextCheck(t) {
    const e = Date.now() - t;
    return this.checkInterval >= e ? this.checkInterval - e % this.checkInterval : 0;
  }
}
class Er {
  constructor(t = "hanko_session", e, o, i) {
    this.channel = void 0, this.onSessionExpired = void 0, this.onSessionCreated = void 0, this.onLeadershipRequested = void 0, this.handleMessage = (a) => {
      const s = a.data;
      switch (s.action) {
        case "sessionExpired":
          this.onSessionExpired(s);
          break;
        case "sessionCreated":
          this.onSessionCreated(s);
          break;
        case "requestLeadership":
          this.onLeadershipRequested(s);
      }
    }, this.onSessionExpired = e, this.onSessionCreated = o, this.onLeadershipRequested = i, this.channel = new BroadcastChannel(t), this.channel.onmessage = this.handleMessage;
  }
  post(t) {
    this.channel.postMessage(t);
  }
}
class gi extends fi {
  constructor(t, e) {
    super(), this.listener = new un(), this.checkInterval = 3e4, this.client = void 0, this.sessionState = void 0, this.windowActivityManager = void 0, this.scheduler = void 0, this.sessionChannel = void 0, this.isLoggedIn = void 0, this.client = new eo(t, e), e.sessionCheckInterval && (this.checkInterval = e.sessionCheckInterval < 3e3 ? 3e3 : e.sessionCheckInterval), this.sessionState = new Cr(`${e.cookieName}_session_state`), this.sessionChannel = new Er(this.getSessionCheckChannelName(e.sessionTokenLocation, e.sessionCheckChannelName), () => this.onChannelSessionExpired(), (a) => this.onChannelSessionCreated(a), () => this.onChannelLeadershipRequested()), this.scheduler = new Or(this.checkInterval, () => this.checkSession(), () => this.onSessionExpired()), this.windowActivityManager = new Ar(() => this.startSessionCheck(), () => this.scheduler.stop());
    const o = Date.now(), { expiration: i } = this.sessionState.load();
    this.isLoggedIn = o < i, this.initializeEventListeners(), this.startSessionCheck();
  }
  initializeEventListeners() {
    this.listener.onSessionCreated((t) => {
      const { claims: e } = t, o = Date.parse(e.expiration), i = Date.now();
      this.isLoggedIn = !0, this.sessionState.save({ expiration: o, lastCheck: i }), this.sessionChannel.post({ action: "sessionCreated", claims: e }), this.startSessionCheck();
    }), this.listener.onUserLoggedOut(() => {
      this.isLoggedIn = !1, this.sessionChannel.post({ action: "sessionExpired" }), this.sessionState.save(null), this.scheduler.stop();
    }), window.addEventListener("beforeunload", () => this.scheduler.stop());
  }
  startSessionCheck() {
    if (!this.windowActivityManager.hasFocus() || (this.sessionChannel.post({ action: "requestLeadership" }), this.scheduler.isRunning())) return;
    const { lastCheck: t, expiration: e } = this.sessionState.load();
    this.isLoggedIn && this.scheduler.start(t, e);
  }
  async checkSession() {
    const t = Date.now(), { is_valid: e, claims: o, expiration_time: i } = await this.client.validate(), a = i ? Date.parse(i) : 0;
    return !e && this.isLoggedIn && this.dispatchSessionExpiredEvent(), e ? (this.isLoggedIn = !0, this.sessionState.save({ lastCheck: t, expiration: a })) : (this.isLoggedIn = !1, this.sessionState.save(null), this.sessionChannel.post({ action: "sessionExpired" })), { is_valid: e, claims: o, expiration: a };
  }
  onSessionExpired() {
    this.isLoggedIn && (this.isLoggedIn = !1, this.sessionState.save(null), this.sessionChannel.post({ action: "sessionExpired" }), this.dispatchSessionExpiredEvent());
  }
  onChannelSessionExpired() {
    this.isLoggedIn && (this.isLoggedIn = !1, this.dispatchSessionExpiredEvent());
  }
  onChannelSessionCreated(t) {
    const { claims: e } = t, o = Date.now(), i = Date.parse(e.expiration) - o;
    this.isLoggedIn = !0, this.dispatchSessionCreatedEvent({ claims: e, expirationSeconds: i });
  }
  onChannelLeadershipRequested() {
    this.windowActivityManager.hasFocus() || this.scheduler.stop();
  }
  getSessionCheckChannelName(t, e) {
    if (t !== "sessionStorage") return e;
    let o = sessionStorage.getItem("sessionCheckChannelName");
    return o != null && o !== "" || (o = `${e}-${Math.floor(100 * Math.random()) + 1}`, sessionStorage.setItem("sessionCheckChannelName", o)), o;
  }
}
class lt {
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
function _i(n) {
  const t = "==".slice(0, (4 - n.length % 4) % 4), e = n.replace(/-/g, "+").replace(/_/g, "/") + t, o = atob(e), i = new ArrayBuffer(o.length), a = new Uint8Array(i);
  for (let s = 0; s < o.length; s++) a[s] = o.charCodeAt(s);
  return i;
}
function vi(n) {
  const t = new Uint8Array(n);
  let e = "";
  for (const o of t) e += String.fromCharCode(o);
  return btoa(e).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
var ie = "copy", Ue = "convert";
function ut(n, t, e) {
  if (t === ie) return e;
  if (t === Ue) return n(e);
  if (t instanceof Array) return e.map((o) => ut(n, t[0], o));
  if (t instanceof Object) {
    const o = {};
    for (const [i, a] of Object.entries(t)) {
      if (a.derive) {
        const s = a.derive(e);
        s !== void 0 && (e[i] = s);
      }
      if (i in e) o[i] = e[i] != null ? ut(n, a.schema, e[i]) : null;
      else if (a.required) throw new Error(`Missing key: ${i}`);
    }
    return o;
  }
}
function An(n, t) {
  return { required: !0, schema: n, derive: t };
}
function de(n) {
  return { required: !0, schema: n };
}
function be(n) {
  return { required: !1, schema: n };
}
var bi = { type: de(ie), id: de(Ue), transports: be(ie) }, yi = { appid: be(ie), appidExclude: be(ie), credProps: be(ie) }, ki = { appid: be(ie), appidExclude: be(ie), credProps: be(ie) }, Pr = { publicKey: de({ rp: de(ie), user: de({ id: de(Ue), name: de(ie), displayName: de(ie) }), challenge: de(Ue), pubKeyCredParams: de(ie), timeout: be(ie), excludeCredentials: be([bi]), authenticatorSelection: be(ie), attestation: be(ie), extensions: be(yi) }), signal: be(ie) }, Ir = { type: de(ie), id: de(ie), rawId: de(Ue), authenticatorAttachment: be(ie), response: de({ clientDataJSON: de(Ue), attestationObject: de(Ue), transports: An(ie, (n) => {
  var t;
  return ((t = n.getTransports) == null ? void 0 : t.call(n)) || [];
}) }), clientExtensionResults: An(ki, (n) => n.getClientExtensionResults()) }, jr = { mediation: be(ie), publicKey: de({ challenge: de(Ue), timeout: be(ie), rpId: be(ie), allowCredentials: be([bi]), userVerification: be(ie), extensions: be(yi) }), signal: be(ie) }, $r = { type: de(ie), id: de(ie), rawId: de(Ue), authenticatorAttachment: be(ie), response: de({ clientDataJSON: de(Ue), authenticatorData: de(Ue), signature: de(Ue), userHandle: de(Ue) }), clientExtensionResults: An(ki, (n) => n.getClientExtensionResults()) };
async function Po(n) {
  const t = await navigator.credentials.get(function(e) {
    return ut(_i, jr, e);
  }(n));
  return function(e) {
    return ut(vi, $r, e);
  }(t);
}
class Be {
  constructor() {
    this.abortController = new AbortController();
  }
  static getInstance() {
    return Be.instance || (Be.instance = new Be()), Be.instance;
  }
  createAbortSignal() {
    return this.abortController.abort(), this.abortController = new AbortController(), this.abortController.signal;
  }
  async getWebauthnCredential(t) {
    return await Po(We({}, t, { signal: this.createAbortSignal() }));
  }
  async getConditionalWebauthnCredential(t) {
    return await Po({ publicKey: t, mediation: "conditional", signal: this.createAbortSignal() });
  }
  async createWebauthnCredential(t) {
    return await async function(e) {
      return o = await navigator.credentials.create(function(i) {
        return ut(_i, Pr, i);
      }(e)), ut(vi, Ir, o);
      var o;
    }(We({}, t, { signal: this.createAbortSignal() }));
  }
}
async function Io(n, t, e, o = "webauthn_credential_already_exists", i = "Webauthn credential already exists") {
  try {
    const a = await t.createWebauthnCredential(e);
    return await n.actions.webauthn_verify_attestation_response.run({ public_key: a });
  } catch {
    const s = await n.actions.back.run();
    return s.error = { code: o, message: i }, s;
  }
}
Be.instance = null;
const jo = { preflight: async (n) => await n.actions.register_client_capabilities.run({ webauthn_available: lt.supported(), webauthn_conditional_mediation_available: await lt.isConditionalMediationAvailable(), webauthn_platform_authenticator_available: await lt.isPlatformAuthenticatorAvailable() }), login_passkey: async (n) => {
  const t = Be.getInstance();
  try {
    const e = await t.getWebauthnCredential(n.payload.request_options);
    return await n.actions.webauthn_verify_assertion_response.run({ assertion_response: e });
  } catch {
    const o = await n.actions.back.run();
    return n.error && (o.error = n.error), o;
  }
}, onboarding_verify_passkey_attestation: async (n) => Io(n, Be.getInstance(), n.payload.creation_options), webauthn_credential_verification: async (n) => Io(n, Be.getInstance(), n.payload.creation_options), async thirdparty(n) {
  const t = new URLSearchParams(window.location.search), e = t.get("hanko_token"), o = t.get("error"), i = (a) => {
    a.forEach((c) => t.delete(c));
    const s = t.toString() ? `?${t.toString()}` : "";
    history.replaceState(null, null, `${window.location.pathname}${s}`);
  };
  if ((e == null ? void 0 : e.length) > 0) return i(["hanko_token"]), await n.actions.exchange_token.run({ token: e });
  if ((o == null ? void 0 : o.length) > 0) {
    const a = o === "access_denied" ? "third_party_access_denied" : "technical_error", s = t.get("error_description");
    i(["error", "error_description"]);
    const c = await n.actions.back.run(null, { dispatchAfterStateChangeEvent: !1 });
    return c.error = { code: a, message: s }, c.dispatchAfterStateChangeEvent(), c;
  }
  return n.isCached ? await n.actions.back.run() : (n.saveToLocalStorage(), window.location.assign(n.payload.redirect_url), n);
}, success: async (n) => {
  const { claims: t } = n.payload, e = Date.parse(t.expiration) - Date.now();
  return n.removeFromLocalStorage(), n.hanko.relay.dispatchSessionCreatedEvent({ claims: t, expirationSeconds: e }), n;
}, account_deleted: async (n) => (n.removeFromLocalStorage(), n.hanko.relay.dispatchUserDeletedEvent(), n) }, $o = { login_init: async (n) => {
  (async function() {
    const t = Be.getInstance();
    if (n.payload.request_options) try {
      const { publicKey: e } = n.payload.request_options, o = await t.getConditionalWebauthnCredential(e);
      await n.actions.webauthn_verify_assertion_response.run({ assertion_response: o });
    } catch {
      return;
    }
  })();
} };
class He {
  constructor(t, e, o, i = {}) {
    if (this.name = void 0, this.flowName = void 0, this.error = void 0, this.payload = void 0, this.actions = void 0, this.csrfToken = void 0, this.status = void 0, this.previousAction = void 0, this.isCached = void 0, this.cacheKey = void 0, this.hanko = void 0, this.invokedAction = void 0, this.excludeAutoSteps = void 0, this.autoStep = void 0, this.passkeyAutofillActivation = void 0, this.flowName = e, this.name = o.name, this.error = o.error, this.payload = o.payload, this.csrfToken = o.csrf_token, this.status = o.status, this.hanko = t, this.actions = this.buildActionMap(o.actions), this.name in jo) {
      const d = jo[this.name];
      this.autoStep = () => d(this);
    }
    if (this.name in $o) {
      const d = $o[this.name];
      this.passkeyAutofillActivation = () => d(this);
    }
    const { dispatchAfterStateChangeEvent: a = !0, excludeAutoSteps: s = null, previousAction: c = null, isCached: h = !1, cacheKey: l = "hanko-flow-state" } = i;
    this.excludeAutoSteps = s, this.previousAction = c, this.isCached = h, this.cacheKey = l, a && this.dispatchAfterStateChangeEvent();
  }
  buildActionMap(t) {
    const e = {};
    return Object.keys(t).forEach((o) => {
      e[o] = new Dt(t[o], this);
    }), new Proxy(e, { get: (o, i) => {
      if (i in o) return o[i];
      const a = typeof i == "string" ? i : i.toString();
      return Dt.createDisabled(a, this);
    } });
  }
  dispatchAfterStateChangeEvent() {
    this.hanko.relay.dispatchAfterStateChangeEvent({ state: this });
  }
  serialize() {
    return { flow_name: this.flowName, name: this.name, error: this.error, payload: this.payload, csrf_token: this.csrfToken, status: this.status, previous_action: this.previousAction, actions: Object.fromEntries(Object.entries(this.actions).map(([t, e]) => [t, { action: e.name, href: e.href, inputs: e.inputs, description: null }])) };
  }
  saveToLocalStorage() {
    localStorage.setItem(this.cacheKey, JSON.stringify(We({}, this.serialize(), { is_cached: !0 })));
  }
  removeFromLocalStorage() {
    localStorage.removeItem(this.cacheKey);
  }
  static async initializeFlowState(t, e, o, i = {}) {
    let a = new He(t, e, o, i);
    if (a.excludeAutoSteps != "all") for (; a && a.autoStep && ((s = a.excludeAutoSteps) == null || !s.includes(a.name)); ) {
      var s;
      const c = await a.autoStep();
      if (c.name == a.name) return c;
      a = c;
    }
    return a;
  }
  static readFromLocalStorage(t) {
    const e = localStorage.getItem(t);
    if (e) try {
      return JSON.parse(e);
    } catch {
      return;
    }
  }
  static async create(t, e, o = {}) {
    const { cacheKey: i = "hanko-flow-state", loadFromCache: a = !0 } = o;
    if (a) {
      const c = He.readFromLocalStorage(i);
      if (c) return He.deserialize(t, c, We({}, o, { cacheKey: i }));
    }
    const s = await He.fetchState(t, `/${e}`);
    return He.initializeFlowState(t, e, s, We({}, o, { cacheKey: i }));
  }
  static async deserialize(t, e, o = {}) {
    return He.initializeFlowState(t, e.flow_name, e, We({}, o, { previousAction: e.previous_action, isCached: e.is_cached }));
  }
  static async fetchState(t, e, o) {
    try {
      return (await t.client.post(e, o)).json();
    } catch (i) {
      return He.createErrorResponse(i);
    }
  }
  static createErrorResponse(t) {
    return { actions: null, csrf_token: "", name: "error", payload: null, status: 0, error: t };
  }
}
class Dt {
  constructor(t, e, o = !0) {
    this.enabled = void 0, this.href = void 0, this.name = void 0, this.inputs = void 0, this.parentState = void 0, this.enabled = o, this.href = t.href, this.name = t.action, this.inputs = t.inputs, this.parentState = e;
  }
  static createDisabled(t, e) {
    return new Dt({ action: t, href: "", inputs: {}, description: "Disabled action" }, e, !1);
  }
  async run(t = null, e = {}) {
    const { name: o, hanko: i, flowName: a, csrfToken: s, invokedAction: c, excludeAutoSteps: h, cacheKey: l } = this.parentState, { dispatchAfterStateChangeEvent: d = !0 } = e;
    if (!this.enabled) throw new Error(`Action '${this.name}' is not enabled in state '${o}'`);
    if (c) throw new Error(`An action '${c.name}' has already been invoked on state '${c.relatedStateName}'. No further actions can be run.`);
    this.parentState.invokedAction = { name: this.name, relatedStateName: o }, i.relay.dispatchBeforeStateChangeEvent({ state: this.parentState });
    const u = { input_data: We({}, Object.keys(this.inputs).reduce((f, w) => {
      const y = this.inputs[w];
      return y.value !== void 0 && (f[w] = y.value), f;
    }, {}), t), csrf_token: s }, _ = await He.fetchState(i, this.href, u);
    return this.parentState.removeFromLocalStorage(), He.initializeFlowState(i, a, _, { dispatchAfterStateChangeEvent: d, excludeAutoSteps: h, previousAction: c, cacheKey: l });
  }
}
class wi extends Xn {
  async getCurrent() {
    const t = await this.client.get("/me");
    if (t.status === 401) throw this.client.dispatcher.dispatchSessionExpiredEvent(), new $t();
    if (!t.ok) throw new Ve();
    const e = t.json(), o = await this.client.get(`/users/${e.id}`);
    if (o.status === 401) throw this.client.dispatcher.dispatchSessionExpiredEvent(), new $t();
    if (!o.ok) throw new Ve();
    return o.json();
  }
  async logout() {
    const t = await this.client.post("/logout");
    if (this.client.sessionTokenStorage.removeSessionToken(), this.client.cookie.removeAuthCookie(), this.client.dispatcher.dispatchUserLoggedOutEvent(), t.status !== 401 && !t.ok) throw new Ve();
  }
}
class Si extends un {
  constructor(t, e) {
    super(), this.session = void 0, this.user = void 0, this.cookie = void 0, this.client = void 0, this.relay = void 0;
    const o = We({ timeout: 13e3, cookieName: "hanko", localStorageKey: "hanko", sessionCheckInterval: 3e4, sessionCheckChannelName: "hanko-session-check" }, e);
    this.client = new Yn(t, o), this.session = new eo(t, o), this.user = new wi(t, o), this.relay = new gi(t, o), this.cookie = new mi(o);
  }
  setLang(t) {
    this.client.lang = t;
  }
  createState(t, e = {}) {
    return He.create(this, t, e);
  }
  async getUser() {
    return this.user.getCurrent();
  }
  async validateSession() {
    return this.session.validate();
  }
  getSessionToken() {
    return this.cookie.getAuthCookie();
  }
  async logout() {
    return this.user.logout();
  }
}
var Dr = Z(292), Ze = Z.n(Dr), Tr = Z(360), Je = Z.n(Tr), Lr = Z(884), Qe = Z.n(Lr), Nr = Z(88), Ge = Z.n(Nr), Qt = Z(914), mt = {};
mt.setAttributes = Qe(), mt.insert = (n) => {
  window._hankoStyle = n;
}, mt.domAPI = Je(), mt.insertStyleElement = Ge(), Ze()(Qt.A, mt);
const Tt = Qt.A && Qt.A.locals ? Qt.A.locals : void 0, Ur = function(n) {
  function t(e) {
    var o = si({}, e);
    return delete o.ref, n(o, e.ref || null);
  }
  return t.$$typeof = dr, t.render = t, t.prototype.isReactComponent = t.__f = !0, t.displayName = "ForwardRef(" + (n.displayName || n.name) + ")", t;
}((n, t) => {
  const { lang: e, hanko: o, setHanko: i } = (0, g.useContext)($e), { setLang: a } = (0, g.useContext)(z.TranslateContext);
  return (0, g.useEffect)(() => {
    a(e.replace(/[-]/, "")), i((s) => (s.setLang(e), s));
  }, [o, e, i, a]), r("section", Object.assign({ part: "container", className: Tt.container, ref: t }, { children: n.children }));
});
var Gt = Z(697), gt = {};
gt.setAttributes = Qe(), gt.insert = (n) => {
  window._hankoStyle = n;
}, gt.domAPI = Je(), gt.insertStyleElement = Ge(), Ze()(Gt.A, gt);
const I = Gt.A && Gt.A.locals ? Gt.A.locals : void 0;
var Mr = Z(633), q = Z.n(Mr);
const Rr = ({ size: n, secondary: t, disabled: e }) => r("svg", Object.assign({ id: "icon-apple", xmlns: "http://www.w3.org/2000/svg", width: n, height: n, viewBox: "20.5 16 15 19", className: q()(I.icon, t && I.secondary, e && I.disabled) }, { children: r("path", { d: "M28.2226562,20.3846154 C29.0546875,20.3846154 30.0976562,19.8048315 30.71875,19.0317864 C31.28125,18.3312142 31.6914062,17.352829 31.6914062,16.3744437 C31.6914062,16.2415766 31.6796875,16.1087095 31.65625,16 C30.7304687,16.0362365 29.6171875,16.640178 28.9492187,17.4494596 C28.421875,18.06548 27.9414062,19.0317864 27.9414062,20.0222505 C27.9414062,20.1671964 27.9648438,20.3121424 27.9765625,20.3604577 C28.0351562,20.3725366 28.1289062,20.3846154 28.2226562,20.3846154 Z M25.2929688,35 C26.4296875,35 26.9335938,34.214876 28.3515625,34.214876 C29.7929688,34.214876 30.109375,34.9758423 31.375,34.9758423 C32.6171875,34.9758423 33.4492188,33.792117 34.234375,32.6325493 C35.1132812,31.3038779 35.4765625,29.9993643 35.5,29.9389701 C35.4179688,29.9148125 33.0390625,28.9122695 33.0390625,26.0979021 C33.0390625,23.6579784 34.9140625,22.5588048 35.0195312,22.474253 C33.7773438,20.6382708 31.890625,20.5899555 31.375,20.5899555 C29.9804688,20.5899555 28.84375,21.4596313 28.1289062,21.4596313 C27.3554688,21.4596313 26.3359375,20.6382708 25.1289062,20.6382708 C22.8320312,20.6382708 20.5,22.5950413 20.5,26.2911634 C20.5,28.5861411 21.3671875,31.013986 22.4335938,32.5842339 C23.3476562,33.9129053 24.1445312,35 25.2929688,35 Z" }) })), Hr = ({ secondary: n, size: t, fadeOut: e, disabled: o }) => r("svg", Object.assign({ id: "icon-checkmark", xmlns: "http://www.w3.org/2000/svg", viewBox: "4 4 40 40", width: t, height: t, className: q()(I.checkmark, n && I.secondary, e && I.fadeOut, o && I.disabled) }, { children: r("path", { d: "M21.05 33.1 35.2 18.95l-2.3-2.25-11.85 11.85-6-6-2.25 2.25ZM24 44q-4.1 0-7.75-1.575-3.65-1.575-6.375-4.3-2.725-2.725-4.3-6.375Q4 28.1 4 24q0-4.15 1.575-7.8 1.575-3.65 4.3-6.35 2.725-2.7 6.375-4.275Q19.9 4 24 4q4.15 0 7.8 1.575 3.65 1.575 6.35 4.275 2.7 2.7 4.275 6.35Q44 19.85 44 24q0 4.1-1.575 7.75-1.575 3.65-4.275 6.375t-6.35 4.3Q28.15 44 24 44Zm0-3q7.1 0 12.05-4.975Q41 31.05 41 24q0-7.1-4.95-12.05Q31.1 7 24 7q-7.05 0-12.025 4.95Q7 16.9 7 24q0 7.05 4.975 12.025Q16.95 41 24 41Zm0-17Z" }) })), Wr = ({ size: n, secondary: t, disabled: e }) => r("svg", Object.assign({ xmlns: "http://www.w3.org/2000/svg", viewBox: "0 -960 960 960", width: n, height: n, className: q()(I.icon, t && I.secondary, e && I.disabled) }, { children: r("path", { d: "M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z" }) })), Fr = ({ size: n, secondary: t, disabled: e }) => r("svg", Object.assign({ id: "icon-custom-provider", xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", width: n, height: n, className: q()(I.icon, t && I.secondary, e && I.disabled) }, { children: [r("path", { d: "M0 0h24v24H0z", fill: "none" }), r("path", { d: "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" })] })), zr = ({ size: n, secondary: t, disabled: e }) => r("svg", Object.assign({ id: "icon-discord", fill: "#fff", xmlns: "http://www.w3.org/2000/svg", width: n, height: n, viewBox: "0 0 127.14 96.36", className: q()(I.icon, t && I.secondary, e && I.disabled) }, { children: r("path", { d: "M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" }) })), qr = ({ size: n, secondary: t, disabled: e }) => r("svg", Object.assign({ id: "icon-exclamation", xmlns: "http://www.w3.org/2000/svg", viewBox: "5 2 13 20", width: n, height: n, className: q()(I.exclamationMark, t && I.secondary, e && I.disabled) }, { children: r("path", { d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" }) })), Kr = ({ size: n, secondary: t, disabled: e }) => r("svg", Object.assign({ width: n, height: n, viewBox: "0 0 666.66668 666.66717", xmlns: "http://www.w3.org/2000/svg" }, { children: [r("defs", Object.assign({ id: "defs13" }, { children: r("clipPath", Object.assign({ clipPathUnits: "userSpaceOnUse", id: "clipPath25" }, { children: r("path", { d: "M 0,700 H 700 V 0 H 0 Z", id: "path23" }) })) })), r("g", Object.assign({ id: "g17", transform: "matrix(1.3333333,0,0,-1.3333333,-133.33333,799.99999)" }, { children: r("g", Object.assign({ id: "g19" }, { children: r("g", Object.assign({ id: "g21", clipPath: "url(#clipPath25)" }, { children: [r("g", Object.assign({ id: "g27", transform: "translate(600,350)" }, { children: r("path", { className: q()(I.facebookIcon, e ? I.disabledOutline : I.outline), d: "m 0,0 c 0,138.071 -111.929,250 -250,250 -138.071,0 -250,-111.929 -250,-250 0,-117.245 80.715,-215.622 189.606,-242.638 v 166.242 h -51.552 V 0 h 51.552 v 32.919 c 0,85.092 38.508,124.532 122.048,124.532 15.838,0 43.167,-3.105 54.347,-6.211 V 81.986 c -5.901,0.621 -16.149,0.932 -28.882,0.932 -40.993,0 -56.832,-15.528 -56.832,-55.9 V 0 h 81.659 l -14.028,-76.396 h -67.631 V -248.169 C -95.927,-233.218 0,-127.818 0,0", id: "path29" }) })), r("g", Object.assign({ id: "g31", transform: "translate(447.9175,273.6036)" }, { children: r("path", { className: q()(I.facebookIcon, e ? I.disabledLetter : I.letter), d: "M 0,0 14.029,76.396 H -67.63 v 27.019 c 0,40.372 15.838,55.899 56.831,55.899 12.733,0 22.981,-0.31 28.882,-0.931 v 69.253 c -11.18,3.106 -38.509,6.212 -54.347,6.212 -83.539,0 -122.048,-39.441 -122.048,-124.533 V 76.396 h -51.552 V 0 h 51.552 v -166.242 c 19.343,-4.798 39.568,-7.362 60.394,-7.362 10.254,0 20.358,0.632 30.288,1.831 L -67.63,0 Z", id: "path33" }) }))] })) })) }))] })), Br = ({ size: n, secondary: t, disabled: e }) => r("svg", Object.assign({ id: "icon-github", xmlns: "http://www.w3.org/2000/svg", fill: "#fff", viewBox: "0 0 97.63 96", width: n, height: n, className: q()(I.icon, t && I.secondary, e && I.disabled) }, { children: [r("path", { d: "M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" }), " "] })), Vr = ({ size: n, disabled: t }) => r("svg", Object.assign({ id: "icon-google", xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", width: n, height: n, className: I.googleIcon }, { children: [r("path", { className: q()(I.googleIcon, t ? I.disabled : I.blue), d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" }), r("path", { className: q()(I.googleIcon, t ? I.disabled : I.green), d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" }), r("path", { className: q()(I.googleIcon, t ? I.disabled : I.yellow), d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" }), r("path", { className: q()(I.googleIcon, t ? I.disabled : I.red), d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" }), r("path", { d: "M1 1h22v22H1z", fill: "none" })] })), Zr = ({ size: n, secondary: t, disabled: e }) => r("svg", Object.assign({ id: "icon-linkedin", fill: "#fff", xmlns: "http://www.w3.org/2000/svg", width: n, viewBox: "0 0 24 24", height: n, className: q()(I.icon, t && I.secondary, e && I.disabled) }, { children: r("path", { d: "M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" }) })), Jr = ({ size: n, secondary: t, disabled: e }) => r("svg", Object.assign({ id: "icon-mail", xmlns: "http://www.w3.org/2000/svg", width: n, height: n, viewBox: "0 -960 960 960", className: q()(I.icon, t && I.secondary, e && I.disabled) }, { children: r("path", { d: "M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm320-280L160-640v400h640v-400L480-440Zm0-80 320-200H160l320 200ZM160-640v-80 480-400Z" }) })), Qr = ({ size: n, disabled: t }) => r("svg", Object.assign({ id: "icon-microsoft", xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", width: n, height: n, className: I.microsoftIcon }, { children: [r("rect", { className: q()(I.microsoftIcon, t ? I.disabled : I.blue), x: "1", y: "1", width: "9", height: "9" }), r("rect", { className: q()(I.microsoftIcon, t ? I.disabled : I.green), x: "1", y: "11", width: "9", height: "9" }), r("rect", { className: q()(I.microsoftIcon, t ? I.disabled : I.yellow), x: "11", y: "1", width: "9", height: "9" }), r("rect", { className: q()(I.microsoftIcon, t ? I.disabled : I.red), x: "11", y: "11", width: "9", height: "9" })] })), Gr = ({ size: n, secondary: t, disabled: e }) => r("svg", Object.assign({ id: "icon-passkey", xmlns: "http://www.w3.org/2000/svg", viewBox: "3 1.5 19.5 19", width: n, height: n, className: q()(I.icon, t && I.secondary, e && I.disabled) }, { children: r("g", Object.assign({ id: "icon-passkey-all" }, { children: [r("circle", { id: "icon-passkey-head", cx: "10.5", cy: "6", r: "4.5" }), r("path", { id: "icon-passkey-key", d: "M22.5,10.5a3.5,3.5,0,1,0-5,3.15V19L19,20.5,21.5,18,20,16.5,21.5,15l-1.24-1.24A3.5,3.5,0,0,0,22.5,10.5Zm-3.5,0a1,1,0,1,1,1-1A1,1,0,0,1,19,10.5Z" }), r("path", { id: "icon-passkey-body", d: "M14.44,12.52A6,6,0,0,0,12,12H9a6,6,0,0,0-6,6v2H16V14.49A5.16,5.16,0,0,1,14.44,12.52Z" })] })) })), Yr = ({ size: n, secondary: t, disabled: e }) => r("svg", Object.assign({ id: "icon-password", xmlns: "http://www.w3.org/2000/svg", width: n, height: n, viewBox: "0 -960 960 960", className: q()(I.icon, t && I.secondary, e && I.disabled) }, { children: r("path", { d: "M80-200v-80h800v80H80Zm46-242-52-30 34-60H40v-60h68l-34-58 52-30 34 58 34-58 52 30-34 58h68v60h-68l34 60-52 30-34-60-34 60Zm320 0-52-30 34-60h-68v-60h68l-34-58 52-30 34 58 34-58 52 30-34 58h68v60h-68l34 60-52 30-34-60-34 60Zm320 0-52-30 34-60h-68v-60h68l-34-58 52-30 34 58 34-58 52 30-34 58h68v60h-68l34 60-52 30-34-60-34 60Z" }) })), Xr = ({ size: n, secondary: t, disabled: e }) => r("svg", Object.assign({ xmlns: "http://www.w3.org/2000/svg", viewBox: "0 -960 960 960", width: n, height: n, className: q()(I.icon, t && I.secondary, e && I.disabled) }, { children: r("path", { d: "M80-680v-200h200v80H160v120H80Zm0 600v-200h80v120h120v80H80Zm600 0v-80h120v-120h80v200H680Zm120-600v-120H680v-80h200v200h-80ZM700-260h60v60h-60v-60Zm0-120h60v60h-60v-60Zm-60 60h60v60h-60v-60Zm-60 60h60v60h-60v-60Zm-60-60h60v60h-60v-60Zm120-120h60v60h-60v-60Zm-60 60h60v60h-60v-60Zm-60-60h60v60h-60v-60Zm240-320v240H520v-240h240ZM440-440v240H200v-240h240Zm0-320v240H200v-240h240Zm-60 500v-120H260v120h120Zm0-320v-120H260v120h120Zm320 0v-120H580v120h120Z" }) })), ea = ({ size: n, secondary: t, disabled: e }) => r("svg", Object.assign({ xmlns: "http://www.w3.org/2000/svg", viewBox: "0 -960 960 960", width: n, height: n, className: q()(I.icon, t && I.secondary, e && I.disabled) }, { children: r("path", { d: "M280-240q-100 0-170-70T40-480q0-100 70-170t170-70q66 0 121 33t87 87h432v240h-80v120H600v-120H488q-32 54-87 87t-121 33Zm0-80q66 0 106-40.5t48-79.5h246v120h80v-120h80v-80H434q-8-39-48-79.5T280-640q-66 0-113 47t-47 113q0 66 47 113t113 47Zm0-80q33 0 56.5-23.5T360-480q0-33-23.5-56.5T280-560q-33 0-56.5 23.5T200-480q0 33 23.5 56.5T280-400Zm0-80Z" }) })), ta = ({ size: n, disabled: t }) => r("svg", Object.assign({ id: "icon-spinner", xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", width: n, height: n, className: q()(I.loadingSpinner, t && I.disabled) }, { children: [r("path", { d: "M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z", opacity: ".25" }), r("path", { d: "M10.72,19.9a8,8,0,0,1-6.5-9.79A7.77,7.77,0,0,1,10.4,4.16a8,8,0,0,1,9.49,6.52A1.54,1.54,0,0,0,21.38,12h.13a1.37,1.37,0,0,0,1.38-1.54,11,11,0,1,0-12.7,12.39A1.54,1.54,0,0,0,12,21.34h0A1.47,1.47,0,0,0,10.72,19.9Z" })] })), Lt = ({ name: n, secondary: t, size: e = 18, fadeOut: o, disabled: i }) => r(Cn[n], { size: e, secondary: t, fadeOut: o, disabled: i }), to = ({ children: n, isLoading: t, isSuccess: e, fadeOut: o, secondary: i, hasIcon: a, maxWidth: s }) => r(x.Fragment, { children: r("div", t ? Object.assign({ className: q()(I.loadingSpinnerWrapper, I.centerContent, s && I.maxWidth) }, { children: r(Lt, { name: "spinner", secondary: i }) }) : e ? Object.assign({ className: q()(I.loadingSpinnerWrapper, I.centerContent, s && I.maxWidth) }, { children: r(Lt, { name: "checkmark", secondary: i, fadeOut: o }) }) : Object.assign({ className: a ? I.loadingSpinnerWrapperIcon : I.loadingSpinnerWrapper }, { children: n })) }), na = () => r(to, { isLoading: !0 }), Ae = (n) => {
  const [t, e] = (0, g.useState)(n);
  return (0, g.useEffect)(() => {
    n && e(n);
  }, [n]), { flowState: t };
};
var Yt = Z(577), _t = {};
_t.setAttributes = Qe(), _t.insert = (n) => {
  window._hankoStyle = n;
}, _t.domAPI = Je(), _t.insertStyleElement = Ge(), Ze()(Yt.A, _t);
const Ce = Yt.A && Yt.A.locals ? Yt.A.locals : void 0, xi = (n, t, e) => {
  const { hanko: o, setUIState: i, isOwnFlow: a } = (0, g.useContext)($e);
  (0, g.useEffect)(() => o.onBeforeStateChange(({ state: s }) => {
    n && a(s) && (i((c) => Object.assign(Object.assign({}, c), { isDisabled: !0, error: void 0 })), t(s.invokedAction.name == n.name));
  }), [n, o, a, t, i]), (0, g.useEffect)(() => o.onAfterStateChange(({ state: s }) => {
    var c;
    n && a(s) && (e(((c = s.previousAction) === null || c === void 0 ? void 0 : c.name) == n.name), t(!1));
  }), [o, e, t, n, a]);
}, Ci = (0, x.createContext)({}), G = ({ onSubmit: n, children: t, hidden: e = !1, maxWidth: o, flowAction: i }) => r(Ci.Provider, Object.assign({ value: { flowAction: i } }, { children: i && i.enabled && !e ? r("form", Object.assign({ onSubmit: n || ((a) => {
  return s = void 0, c = void 0, l = function* () {
    return a.preventDefault(), yield i.run();
  }, new ((h = void 0) || (h = Promise))(function(d, u) {
    function _(y) {
      try {
        w(l.next(y));
      } catch (S) {
        u(S);
      }
    }
    function f(y) {
      try {
        w(l.throw(y));
      } catch (S) {
        u(S);
      }
    }
    function w(y) {
      var S;
      y.done ? d(y.value) : (S = y.value, S instanceof h ? S : new h(function(C) {
        C(S);
      })).then(_, f);
    }
    w((l = l.apply(s, c || [])).next());
  });
  var s, c, h, l;
}), className: Ce.form }, { children: r("ul", Object.assign({ className: Ce.ul }, { children: (0, x.toChildArray)(t).map((a, s) => r("li", Object.assign({ part: "form-item", className: q()(Ce.li, o ? Ce.maxWidth : null) }, { children: a }), s)) })) })) : null })), Y = (n) => {
  var { title: t, children: e, secondary: o, dangerous: i, autofocus: a, showLastUsed: s, onClick: c, icon: h, showSuccessIcon: l } = n, d = function(L, N) {
    var F = {};
    for (var B in L) Object.prototype.hasOwnProperty.call(L, B) && N.indexOf(B) < 0 && (F[B] = L[B]);
    if (L != null && typeof Object.getOwnPropertySymbols == "function") {
      var V = 0;
      for (B = Object.getOwnPropertySymbols(L); V < B.length; V++) N.indexOf(B[V]) < 0 && Object.prototype.propertyIsEnumerable.call(L, B[V]) && (F[B[V]] = L[B[V]]);
    }
    return F;
  }(n, ["title", "children", "secondary", "dangerous", "autofocus", "showLastUsed", "onClick", "icon", "showSuccessIcon"]);
  const u = (0, g.useRef)(null), { uiState: _ } = (0, g.useContext)($e), { t: f } = (0, g.useContext)(z.TranslateContext), [w, y] = (0, g.useState)(!1), [S, C] = (0, g.useState)(!1), { flowAction: T } = (0, g.useContext)(Ci);
  xi(T, y, C), (0, g.useEffect)(() => {
    const { current: L } = u;
    L && a && L.focus();
  }, [a]);
  const E = (0, g.useMemo)(() => l && (S || d.isSuccess), [S, d, l]), $ = (0, g.useMemo)(() => _.isDisabled || d.disabled, [d, _]);
  return r("button", Object.assign({ part: i ? "button dangerous-button" : o ? "button secondary-button" : "button primary-button", title: t, ref: u, type: "submit", disabled: $, onClick: c, className: q()(Ce.button, i ? Ce.dangerous : o ? Ce.secondary : Ce.primary), "data-bubble": s ? f("labels.lastUsed") : void 0 }, { children: r(to, Object.assign({ isLoading: w, isSuccess: E, secondary: !0, hasIcon: !!h, maxWidth: !0 }, { children: [h ? r(Lt, { name: h, secondary: o, disabled: $ }) : null, r("div", Object.assign({ className: Ce.caption }, { children: r("span", { children: e }) }))] })) }));
}, Ne = (n) => {
  var t, e, o, i, a, { label: s } = n, c = function(f, w) {
    var y = {};
    for (var S in f) Object.prototype.hasOwnProperty.call(f, S) && w.indexOf(S) < 0 && (y[S] = f[S]);
    if (f != null && typeof Object.getOwnPropertySymbols == "function") {
      var C = 0;
      for (S = Object.getOwnPropertySymbols(f); C < S.length; C++) w.indexOf(S[C]) < 0 && Object.prototype.propertyIsEnumerable.call(f, S[C]) && (y[S[C]] = f[S[C]]);
    }
    return y;
  }(n, ["label"]);
  const h = (0, g.useRef)(null), { uiState: l } = (0, g.useContext)($e), { t: d } = (0, g.useContext)(z.TranslateContext), u = (0, g.useMemo)(() => l.isDisabled || c.disabled, [c, l]);
  (0, g.useEffect)(() => {
    const { current: f } = h;
    f && c.autofocus && (f.focus(), f.select());
  }, [c.autofocus]);
  const _ = (0, g.useMemo)(() => {
    var f;
    return c.markOptional && !(!((f = c.flowInput) === null || f === void 0) && f.required) ? `${c.placeholder} (${d("labels.optional")})` : c.placeholder;
  }, [c.markOptional, c.placeholder, c.flowInput, d]);
  return r("div", Object.assign({ className: Ce.inputWrapper }, { children: r("input", Object.assign({ part: "input text-input", required: (t = c.flowInput) === null || t === void 0 ? void 0 : t.required, maxLength: (e = c.flowInput) === null || e === void 0 ? void 0 : e.max_length, minLength: (o = c.flowInput) === null || o === void 0 ? void 0 : o.min_length, hidden: (i = c.flowInput) === null || i === void 0 ? void 0 : i.hidden }, c, { ref: h, "aria-label": _, placeholder: _, className: q()(Ce.input, !!(!((a = c.flowInput) === null || a === void 0) && a.error) && c.markError && Ce.error), disabled: u })) }));
}, we = ({ children: n }) => r("section", Object.assign({ className: Tt.content }, { children: n }));
var Xt = Z(111), vt = {};
vt.setAttributes = Qe(), vt.insert = (n) => {
  window._hankoStyle = n;
}, vt.domAPI = Je(), vt.insertStyleElement = Ge(), Ze()(Xt.A, vt);
const At = Xt.A && Xt.A.locals ? Xt.A.locals : void 0, no = ({ children: n, hidden: t }) => t ? null : r("section", Object.assign({ part: "divider", className: At.divider }, { children: [r("div", { part: "divider-line", className: At.line }), n ? r("div", Object.assign({ part: "divider-text", class: At.text }, { children: n })) : null, r("div", { part: "divider-line", className: At.line })] }));
var en = Z(905), bt = {};
bt.setAttributes = Qe(), bt.insert = (n) => {
  window._hankoStyle = n;
}, bt.domAPI = Je(), bt.insertStyleElement = Ge(), Ze()(en.A, bt);
const Ai = en.A && en.A.locals ? en.A.locals : void 0, Se = ({ state: n, error: t, flowError: e }) => {
  var o, i;
  const { t: a } = (0, g.useContext)(z.TranslateContext), { uiState: s, setUIState: c } = (0, g.useContext)($e);
  return (0, g.useEffect)(() => {
    var h, l;
    if (((h = n == null ? void 0 : n.error) === null || h === void 0 ? void 0 : h.code) == "form_data_invalid_error") for (const d of Object.values(n == null ? void 0 : n.actions)) {
      let u = !1;
      for (const _ of Object.values(d == null ? void 0 : d.inputs)) if (!((l = _.error) === null || l === void 0) && l.code) return c(Object.assign(Object.assign({}, s), { error: _.error })), void (u = !0);
      u || c(Object.assign(Object.assign({}, s), { error: n.error }));
    }
    else n != null && n.error && c(Object.assign(Object.assign({}, s), { error: n == null ? void 0 : n.error }));
  }, [n]), r("section", Object.assign({ part: "error", className: Ai.errorBox, hidden: !(!((o = s.error) === null || o === void 0) && o.code) && !(e != null && e.code) && !t }, { children: [r("span", { children: r(Lt, { name: "exclamation", size: 15 }) }), r("span", Object.assign({ id: "errorMessage", part: "error-text" }, { children: a(t ? `errors.${t.code}` : `flowErrors.${((i = s.error) === null || i === void 0 ? void 0 : i.code) || (e == null ? void 0 : e.code)}`) }))] }));
};
var tn = Z(619), yt = {};
yt.setAttributes = Qe(), yt.insert = (n) => {
  window._hankoStyle = n;
}, yt.domAPI = Je(), yt.insertStyleElement = Ge(), Ze()(tn.A, yt);
const dn = tn.A && tn.A.locals ? tn.A.locals : void 0, re = ({ children: n }) => r("h1", Object.assign({ part: "headline1", className: q()(dn.headline, dn.grade1) }, { children: n }));
var nn = Z(995), kt = {};
kt.setAttributes = Qe(), kt.insert = (n) => {
  window._hankoStyle = n;
}, kt.domAPI = Je(), kt.insertStyleElement = Ge(), Ze()(nn.A, kt);
const zt = nn.A && nn.A.locals ? nn.A.locals : void 0, On = (n) => {
  var { loadingSpinnerPosition: t, dangerous: e = !1, onClick: o, flowAction: i } = n, a = function(N, F) {
    var B = {};
    for (var V in N) Object.prototype.hasOwnProperty.call(N, V) && F.indexOf(V) < 0 && (B[V] = N[V]);
    if (N != null && typeof Object.getOwnPropertySymbols == "function") {
      var ee = 0;
      for (V = Object.getOwnPropertySymbols(N); ee < V.length; ee++) F.indexOf(V[ee]) < 0 && Object.prototype.propertyIsEnumerable.call(N, V[ee]) && (B[V[ee]] = N[V[ee]]);
    }
    return B;
  }(n, ["loadingSpinnerPosition", "dangerous", "onClick", "flowAction"]);
  const { t: s } = (0, g.useContext)(z.TranslateContext), { uiState: c } = (0, g.useContext)($e), [h, l] = (0, g.useState)(), [d, u] = (0, g.useState)(!1), [_, f] = (0, g.useState)(!1);
  let w;
  o || (o = (N) => {
    return F = void 0, B = void 0, ee = function* () {
      return N.preventDefault(), yield i == null ? void 0 : i.run();
    }, new ((V = void 0) || (V = Promise))(function(U, ge) {
      function De(te) {
        try {
          Pe(ee.next(te));
        } catch (se) {
          ge(se);
        }
      }
      function xe(te) {
        try {
          Pe(ee.throw(te));
        } catch (se) {
          ge(se);
        }
      }
      function Pe(te) {
        var se;
        te.done ? U(te.value) : (se = te.value, se instanceof V ? se : new V(function(pe) {
          pe(se);
        })).then(De, xe);
      }
      Pe((ee = ee.apply(F, B || [])).next());
    });
    var F, B, V, ee;
  }), xi(i, u, f);
  const y = (N) => {
    N.preventDefault(), l(!0);
  }, S = (N) => {
    N.preventDefault(), l(!1);
  }, C = (0, g.useMemo)(() => d || a.isLoading, [d, a]), T = (0, g.useMemo)(() => _ || a.isSuccess, [_, a]), E = (0, g.useMemo)(() => i && !i.enabled || a.hidden, [i, a]), $ = (0, g.useCallback)((N) => {
    N.preventDefault(), l(!1), o(N);
  }, [o]), L = (0, g.useCallback)(() => E ? null : r(x.Fragment, { children: [h ? r(x.Fragment, { children: [r(On, Object.assign({ onClick: $ }, { children: s("labels.yes") })), " / ", r(On, Object.assign({ onClick: S }, { children: s("labels.no") })), " "] }) : null, r("button", Object.assign({}, a, { onClick: e ? y : o, disabled: h || a.disabled || c.isDisabled, part: "link", className: q()(zt.link, e ? zt.danger : null) }, { children: a.children }))] }), [E, c, h, e, o, $, a, s]);
  return r(x.Fragment, { children: r("span", Object.assign({ className: q()(zt.linkWrapper, t === "right" ? zt.reverse : null), onMouseEnter: () => {
    w && window.clearTimeout(w);
  }, onMouseLeave: () => {
    w = window.setTimeout(() => {
      l(!1);
    }, 1e3);
  } }, { children: r(x.Fragment, h || !C && !T ? { children: L() } : { children: [r(to, { isLoading: C, isSuccess: T, secondary: a.secondary, fadeOut: !0 }), L()] }) })) });
}, K = On, Ee = ({ children: n, hidden: t = !1 }) => t ? null : r("section", Object.assign({ className: Tt.footer }, { children: n })), oo = (n) => {
  var { label: t } = n, e = function(a, s) {
    var c = {};
    for (var h in a) Object.prototype.hasOwnProperty.call(a, h) && s.indexOf(h) < 0 && (c[h] = a[h]);
    if (a != null && typeof Object.getOwnPropertySymbols == "function") {
      var l = 0;
      for (h = Object.getOwnPropertySymbols(a); l < h.length; l++) s.indexOf(h[l]) < 0 && Object.prototype.propertyIsEnumerable.call(a, h[l]) && (c[h[l]] = a[h[l]]);
    }
    return c;
  }(n, ["label"]);
  const { uiState: o } = (0, g.useContext)($e), i = (0, g.useMemo)(() => o.isDisabled || e.disabled, [e, o]);
  return r("div", Object.assign({ className: Ce.inputWrapper }, { children: r("label", Object.assign({ className: Ce.checkboxWrapper }, { children: [r("input", Object.assign({ part: "input checkbox-input", type: "checkbox", "aria-label": t, className: Ce.checkbox }, e)), r("span", Object.assign({ className: q()(Ce.label, i ? Ce.disabled : null) }, { children: t }))] })) }));
}, fn = () => r("section", { className: At.spacer });
var on = Z(489), wt = {};
wt.setAttributes = Qe(), wt.insert = (n) => {
  window._hankoStyle = n;
}, wt.domAPI = Je(), wt.insertStyleElement = Ge(), Ze()(on.A, wt);
const wn = on.A && on.A.locals ? on.A.locals : void 0, H = ({ children: n, hidden: t, center: e }) => t ? null : r("p", Object.assign({ part: "paragraph", className: q()(wn.paragraph, e && wn.center, e && wn.column) }, { children: n }));
var qt = function(n, t, e, o) {
  return new (e || (e = Promise))(function(i, a) {
    function s(l) {
      try {
        h(o.next(l));
      } catch (d) {
        a(d);
      }
    }
    function c(l) {
      try {
        h(o.throw(l));
      } catch (d) {
        a(d);
      }
    }
    function h(l) {
      var d;
      l.done ? i(l.value) : (d = l.value, d instanceof e ? d : new e(function(u) {
        u(d);
      })).then(s, c);
    }
    h((o = o.apply(n, [])).next());
  });
};
const oa = (n) => {
  var t;
  const { t: e } = (0, g.useContext)(z.TranslateContext), { init: o, initialComponentName: i, uiState: a, setUIState: s, hidePasskeyButtonOnLogin: c, lastLogin: h } = (0, g.useContext)($e), [l, d] = (0, g.useState)(!1), [u, _] = (0, g.useState)(null), [f, w] = (0, g.useState)(null), { flowState: y } = Ae(n.state), S = lt.supported(), [C, T] = (0, g.useState)(void 0), [E, $] = (0, g.useState)(null), [L, N] = (0, g.useState)(!1), F = (U) => {
    if (U.preventDefault(), U.target instanceof HTMLInputElement) {
      const { value: ge } = U.target;
      w(ge), B(ge);
    }
  }, B = (U) => {
    const ge = () => s((xe) => Object.assign(Object.assign({}, xe), { email: U, username: null })), De = () => s((xe) => Object.assign(Object.assign({}, xe), { email: null, username: U }));
    switch (u) {
      case "email":
        ge();
        break;
      case "username":
        De();
        break;
      case "identifier":
        U.match(/^[^@]+@[^@]+\.[^@]+$/) ? ge() : De();
    }
  }, V = (0, g.useMemo)(() => (!!y.actions.webauthn_generate_request_options.enabled || !!y.actions.thirdparty_oauth.enabled) && y.actions.continue_with_login_identifier.enabled, [y.actions]), ee = y.actions.continue_with_login_identifier.inputs;
  return (0, g.useEffect)(() => {
    const U = y.actions.continue_with_login_identifier.inputs;
    U != null && U.email ? (_("email"), w(a.email)) : U != null && U.username ? (_("username"), w(a.username)) : (_("identifier"), w(a.email || a.username));
  }, [y, a.email, a.username]), r(x.Fragment, { children: [r(we, { children: [r(re, { children: e("headlines.signIn") }), r(Se, { state: y, error: C }), ee ? r(x.Fragment, { children: [r(G, Object.assign({ flowAction: y.actions.continue_with_login_identifier, onSubmit: (U) => qt(void 0, void 0, void 0, function* () {
    return U.preventDefault(), B(f), y.actions.continue_with_login_identifier.run({ [u]: f });
  }), maxWidth: !0 }, { children: [ee.email ? r(Ne, { type: "email", autoComplete: "username webauthn", autoCorrect: "off", flowInput: ee.email, onInput: F, value: f, placeholder: e("labels.email"), pattern: "^[^@]+@[^@]+\\.[^@]+$" }) : ee.username ? r(Ne, { type: "text", autoComplete: "username webauthn", autoCorrect: "off", flowInput: ee.username, onInput: F, value: f, placeholder: e("labels.username") }) : r(Ne, { type: "text", autoComplete: "username webauthn", autoCorrect: "off", flowInput: ee.identifier, onInput: F, value: f, placeholder: e("labels.emailOrUsername") }), r(Y, { children: e("labels.continue") })] })), r(no, Object.assign({ hidden: !V }, { children: e("labels.or") }))] }) : null, y.actions.thirdparty_oauth.enabled ? (t = y.actions.thirdparty_oauth.inputs.provider.allowed_values) === null || t === void 0 ? void 0 : t.map((U) => r(G, Object.assign({ flowAction: y.actions.thirdparty_oauth, onSubmit: (ge) => ((De, xe) => qt(void 0, void 0, void 0, function* () {
    De.preventDefault(), $(xe);
    const Pe = yield y.actions.thirdparty_oauth.run({ provider: xe, redirect_to: window.location.toString() });
    return Pe.error && $(null), Pe;
  }))(ge, U.value) }, { children: r(Y, Object.assign({ isLoading: U.value == E, secondary: !0, icon: U.value.startsWith("custom_") ? "customProvider" : U.value, showLastUsed: (h == null ? void 0 : h.login_method) == "third_party" && (h == null ? void 0 : h.third_party_provider) == U.value }, { children: e("labels.signInWith", { provider: U.name }) })) }), U.value)) : null, y.actions.webauthn_generate_request_options.enabled && !c ? r(G, Object.assign({ flowAction: y.actions.webauthn_generate_request_options }, { children: r(Y, Object.assign({ secondary: !0, title: S ? null : e("labels.webauthnUnsupported"), disabled: !S }, { children: e("labels.signInPasskey") })) })) : null, y.actions.remember_me.enabled && r(x.Fragment, { children: [r(fn, {}), r(oo, { required: !1, type: "checkbox", label: e("labels.staySignedIn"), checked: L, onChange: (U) => qt(void 0, void 0, void 0, function* () {
    return N((ge) => !ge), y.actions.remember_me.run({ remember_me: !L });
  }) })] })] }), r(Ee, Object.assign({ hidden: i !== "auth" }, { children: r(H, Object.assign({ center: !0 }, { children: [r("span", { children: e("labels.dontHaveAnAccount") }), r(K, Object.assign({ onClick: (U) => qt(void 0, void 0, void 0, function* () {
    U.preventDefault(), d(!0), o("registration");
  }), loadingSpinnerPosition: "left", isLoading: l }, { children: e("labels.signUp") }))] })) }))] });
}, ia = (n) => {
  var { index: t, focus: e, digit: o = "" } = n, i = function(l, d) {
    var u = {};
    for (var _ in l) Object.prototype.hasOwnProperty.call(l, _) && d.indexOf(_) < 0 && (u[_] = l[_]);
    if (l != null && typeof Object.getOwnPropertySymbols == "function") {
      var f = 0;
      for (_ = Object.getOwnPropertySymbols(l); f < _.length; f++) d.indexOf(_[f]) < 0 && Object.prototype.propertyIsEnumerable.call(l, _[f]) && (u[_[f]] = l[_[f]]);
    }
    return u;
  }(n, ["index", "focus", "digit"]);
  const a = (0, g.useRef)(null), { uiState: s } = (0, g.useContext)($e), c = () => {
    const { current: l } = a;
    l && (l.focus(), l.select());
  }, h = (0, g.useMemo)(() => s.isDisabled || i.disabled, [i, s]);
  return (0, g.useEffect)(() => {
    t === 0 && c();
  }, [t, i.disabled]), (0, g.useMemo)(() => {
    e && c();
  }, [e]), r("div", Object.assign({ className: Ce.passcodeDigitWrapper }, { children: r("input", Object.assign({}, i, { part: "input passcode-input", "aria-label": `${i.name}-digit-${t + 1}`, name: i.name + t.toString(10), type: "text", inputMode: "numeric", maxLength: 1, ref: a, value: o.charAt(0), required: !0, className: Ce.input, disabled: h })) }));
}, io = ({ passcodeDigits: n = [], numberOfInputs: t = 6, onInput: e, disabled: o = !1 }) => {
  const [i, a] = (0, g.useState)(0), s = () => n.slice(), c = () => {
    i < t - 1 && a(i + 1);
  }, h = () => {
    i > 0 && a(i - 1);
  }, l = (f) => {
    const w = s();
    w[i] = f.charAt(0), e(w);
  }, d = (f) => {
    if (f.preventDefault(), o) return;
    const w = f.clipboardData.getData("text/plain").slice(0, t - i).split(""), y = s();
    let S = i;
    for (let C = 0; C < t; ++C) C >= i && w.length > 0 && (y[C] = w.shift(), S++);
    a(S), e(y);
  }, u = (f) => {
    f.key === "Backspace" ? (f.preventDefault(), l(""), h()) : f.key === "Delete" ? (f.preventDefault(), l("")) : f.key === "ArrowLeft" ? (f.preventDefault(), h()) : f.key === "ArrowRight" ? (f.preventDefault(), c()) : f.key !== " " && f.key !== "Spacebar" && f.key !== "Space" || f.preventDefault();
  }, _ = (f) => {
    f.target instanceof HTMLInputElement && l(f.target.value), c();
  };
  return (0, g.useEffect)(() => {
    n.length === 0 && a(0);
  }, [n]), r("div", Object.assign({ className: Ce.passcodeInputWrapper }, { children: Array.from(Array(t)).map((f, w) => r(ia, { name: "passcode", index: w, focus: i === w, digit: n[w], onKeyDown: u, onInput: _, onPaste: d, onFocus: () => ((y) => {
    a(y);
  })(w), disabled: o }, w)) }));
};
var Do = function(n, t, e, o) {
  return new (e || (e = Promise))(function(i, a) {
    function s(l) {
      try {
        h(o.next(l));
      } catch (d) {
        a(d);
      }
    }
    function c(l) {
      try {
        h(o.throw(l));
      } catch (d) {
        a(d);
      }
    }
    function h(l) {
      var d;
      l.done ? i(l.value) : (d = l.value, d instanceof e ? d : new e(function(u) {
        u(d);
      })).then(s, c);
    }
    h((o = o.apply(n, [])).next());
  });
};
const ra = (n) => {
  const { t } = (0, g.useContext)(z.TranslateContext), { flowState: e } = Ae(n.state), { uiState: o, setUIState: i } = (0, g.useContext)($e), [a, s] = (0, g.useState)(), [c, h] = (0, g.useState)(e.payload.resend_after), [l, d] = (0, g.useState)([]), u = (0, g.useMemo)(() => {
    var f;
    return ((f = e.error) === null || f === void 0 ? void 0 : f.code) === "passcode_max_attempts_reached";
  }, [e]), _ = (0, g.useCallback)((f) => Do(void 0, void 0, void 0, function* () {
    return yield e.actions.verify_passcode.run({ code: f });
  }), [e]);
  return (0, g.useEffect)(() => {
    const f = a > 0 && setInterval(() => s(a - 1), 1e3);
    return () => clearInterval(f);
  }, [a]), (0, g.useEffect)(() => {
    const f = c > 0 && setInterval(() => {
      h(c - 1);
    }, 1e3);
    return () => clearInterval(f);
  }, [c]), (0, g.useEffect)(() => {
    var f;
    c == 0 && ((f = e.error) === null || f === void 0 ? void 0 : f.code) == "rate_limit_exceeded" && i((w) => Object.assign(Object.assign({}, w), { error: null }));
  }, [c]), (0, g.useEffect)(() => {
    d([]), e.payload.resend_after >= 0 && h(e.payload.resend_after);
  }, [e]), r(x.Fragment, { children: [r(we, { children: [r(re, { children: t("headlines.loginPasscode") }), r(Se, { state: e }), r(H, { children: o.email ? t("texts.enterPasscode") : t("texts.enterPasscodeNoEmail") }), r(H, Object.assign({ hidden: !o.email }, { children: r("b", { children: o.email }) })), r(G, Object.assign({ flowAction: e.actions.verify_passcode, onSubmit: (f) => Do(void 0, void 0, void 0, function* () {
    return f.preventDefault(), _(l.join(""));
  }) }, { children: [r(io, { onInput: (f) => {
    if (d(f), f.filter((w) => w !== "").length === 6) return _(f.join(""));
  }, passcodeDigits: l, numberOfInputs: 6, disabled: a <= 0 || u }), r(Y, Object.assign({ disabled: a <= 0 || u }, { children: t("labels.continue") }))] }))] }), r(Ee, { children: [r(K, Object.assign({ flowAction: e.actions.back, loadingSpinnerPosition: "right" }, { children: t("labels.back") })), r(K, Object.assign({ disabled: c > 0, flowAction: e.actions.resend_passcode, loadingSpinnerPosition: "left" }, { children: c > 0 ? t("labels.passcodeResendAfter", { passcodeResendAfter: c }) : t("labels.sendNewPasscode") }))] })] });
}, aa = (n) => {
  const { t } = (0, g.useContext)(z.TranslateContext), { flowState: e } = Ae(n.state);
  return r(x.Fragment, { children: [r(we, { children: [r(re, { children: t("headlines.registerAuthenticator") }), r(Se, { state: e }), r(H, { children: t("texts.setupPasskey") }), r(G, Object.assign({ flowAction: e.actions.webauthn_generate_creation_options }, { children: r(Y, Object.assign({ autofocus: !0, icon: "passkey" }, { children: t("labels.registerAuthenticator") })) }))] }), r(Ee, Object.assign({ hidden: !e.actions.skip.enabled && !e.actions.back.enabled }, { children: [r(K, Object.assign({ loadingSpinnerPosition: "right", flowAction: e.actions.back }, { children: t("labels.back") })), r(K, Object.assign({ loadingSpinnerPosition: "left", flowAction: e.actions.skip }, { children: t("labels.skip") }))] }))] });
};
var To = function(n, t, e, o) {
  return new (e || (e = Promise))(function(i, a) {
    function s(l) {
      try {
        h(o.next(l));
      } catch (d) {
        a(d);
      }
    }
    function c(l) {
      try {
        h(o.throw(l));
      } catch (d) {
        a(d);
      }
    }
    function h(l) {
      var d;
      l.done ? i(l.value) : (d = l.value, d instanceof e ? d : new e(function(u) {
        u(d);
      })).then(s, c);
    }
    h((o = o.apply(n, [])).next());
  });
};
const sa = (n) => {
  const { t } = (0, g.useContext)(z.TranslateContext), { flowState: e } = Ae(n.state), [o, i] = (0, g.useState)(), [a, s] = (0, g.useState)(), c = (0, g.useMemo)(() => r(K, Object.assign({ flowAction: e.actions.continue_to_passcode_confirmation_recovery, loadingSpinnerPosition: "left" }, { children: t("labels.forgotYourPassword") })), [e, t]), h = (0, g.useMemo)(() => r(K, Object.assign({ flowAction: e.actions.continue_to_login_method_chooser, loadingSpinnerPosition: "left" }, { children: "Choose another method" })), [e]);
  return (0, g.useEffect)(() => {
    const l = a > 0 && setInterval(() => s(a - 1), 1e3);
    return () => clearInterval(l);
  }, [a]), r(x.Fragment, { children: [r(we, { children: [r(re, { children: t("headlines.loginPassword") }), r(Se, { state: e }), r(G, Object.assign({ flowAction: e.actions.password_login, onSubmit: (l) => To(void 0, void 0, void 0, function* () {
    return l.preventDefault(), e.actions.password_login.run({ password: o });
  }) }, { children: [r(Ne, { type: "password", flowInput: e.actions.password_login.inputs.password, autocomplete: "current-password", placeholder: t("labels.password"), onInput: (l) => To(void 0, void 0, void 0, function* () {
    l.target instanceof HTMLInputElement && i(l.target.value);
  }), autofocus: !0 }), r(Y, Object.assign({ disabled: a > 0 }, { children: a > 0 ? t("labels.passwordRetryAfter", { passwordRetryAfter: a }) : t("labels.signIn") }))] })), e.actions.continue_to_login_method_chooser.enabled ? c : null] }), r(Ee, { children: [r(K, Object.assign({ flowAction: e.actions.back, loadingSpinnerPosition: "right" }, { children: t("labels.back") })), e.actions.continue_to_login_method_chooser.enabled ? h : c] })] });
};
var Lo = function(n, t, e, o) {
  return new (e || (e = Promise))(function(i, a) {
    function s(l) {
      try {
        h(o.next(l));
      } catch (d) {
        a(d);
      }
    }
    function c(l) {
      try {
        h(o.throw(l));
      } catch (d) {
        a(d);
      }
    }
    function h(l) {
      var d;
      l.done ? i(l.value) : (d = l.value, d instanceof e ? d : new e(function(u) {
        u(d);
      })).then(s, c);
    }
    h((o = o.apply(n, [])).next());
  });
};
const ca = (n) => {
  const { t } = (0, g.useContext)(z.TranslateContext), { flowState: e } = Ae(n.state), [o, i] = (0, g.useState)();
  return r(we, { children: [r(re, { children: t("headlines.registerPassword") }), r(Se, { state: e }), r(H, { children: t("texts.passwordFormatHint", { minLength: e.actions.password_recovery.inputs.new_password.min_length, maxLength: 72 }) }), r(G, Object.assign({ flowAction: e.actions.password_recovery, onSubmit: (a) => Lo(void 0, void 0, void 0, function* () {
    return a.preventDefault(), e.actions.password_recovery.run({ new_password: o });
  }) }, { children: [r(Ne, { type: "password", autocomplete: "new-password", flowInput: e.actions.password_recovery.inputs.new_password, placeholder: t("labels.newPassword"), onInput: (a) => Lo(void 0, void 0, void 0, function* () {
    a.target instanceof HTMLInputElement && i(a.target.value);
  }), autofocus: !0 }), r(Y, { children: t("labels.continue") })] }))] });
}, la = (n) => {
  const { t } = (0, g.useContext)(z.TranslateContext), { flowState: e } = Ae(n.state);
  return r(x.Fragment, { children: [r(we, { children: [r(re, { children: t("headlines.selectLoginMethod") }), r(Se, { flowError: e == null ? void 0 : e.error }), r(H, { children: t("texts.howDoYouWantToLogin") }), r(G, Object.assign({ flowAction: e.actions.continue_to_passcode_confirmation }, { children: r(Y, Object.assign({ secondary: !0, icon: "mail" }, { children: t("labels.passcode") })) })), r(G, Object.assign({ flowAction: e.actions.continue_to_password_login }, { children: r(Y, Object.assign({ secondary: !0, icon: "password" }, { children: t("labels.password") })) })), r(G, Object.assign({ flowAction: e.actions.webauthn_generate_request_options }, { children: r(Y, Object.assign({ secondary: !0, icon: "passkey" }, { children: t("labels.passkey") })) }))] }), r(Ee, { children: r(K, Object.assign({ flowAction: e.actions.back, loadingSpinnerPosition: "right" }, { children: t("labels.back") })) })] });
};
var Kt = function(n, t, e, o) {
  return new (e || (e = Promise))(function(i, a) {
    function s(l) {
      try {
        h(o.next(l));
      } catch (d) {
        a(d);
      }
    }
    function c(l) {
      try {
        h(o.throw(l));
      } catch (d) {
        a(d);
      }
    }
    function h(l) {
      var d;
      l.done ? i(l.value) : (d = l.value, d instanceof e ? d : new e(function(u) {
        u(d);
      })).then(s, c);
    }
    h((o = o.apply(n, [])).next());
  });
};
const da = (n) => {
  var t;
  const { t: e } = (0, g.useContext)(z.TranslateContext), { init: o, uiState: i, setUIState: a, initialComponentName: s } = (0, g.useContext)($e), { flowState: c } = Ae(n.state), h = c.actions.register_login_identifier.inputs, l = !(!(h != null && h.email) || !(h != null && h.username)), [d, u] = (0, g.useState)(void 0), [_, f] = (0, g.useState)(null), [w, y] = (0, g.useState)(!1), [S, C] = (0, g.useState)(!1), T = (0, g.useMemo)(() => !!c.actions.thirdparty_oauth.enabled && c.actions.register_login_identifier.enabled, [c.actions]);
  return r(x.Fragment, { children: [r(we, { children: [r(re, { children: e("headlines.signUp") }), r(Se, { state: c, error: d }), h ? r(x.Fragment, { children: [r(G, Object.assign({ flowAction: c.actions.register_login_identifier, onSubmit: (E) => Kt(void 0, void 0, void 0, function* () {
    return E.preventDefault(), yield c.actions.register_login_identifier.run({ email: i.email, username: i.username });
  }), maxWidth: !0 }, { children: [h.username ? r(Ne, { markOptional: l, markError: l, type: "text", autoComplete: "username", autoCorrect: "off", flowInput: h.username, onInput: (E) => {
    if (E.preventDefault(), E.target instanceof HTMLInputElement) {
      const { value: $ } = E.target;
      a((L) => Object.assign(Object.assign({}, L), { username: $ }));
    }
  }, value: i.username, placeholder: e("labels.username") }) : null, h.email ? r(Ne, { markOptional: l, markError: l, type: "email", autoComplete: "email", autoCorrect: "off", flowInput: h.email, onInput: (E) => {
    if (E.preventDefault(), E.target instanceof HTMLInputElement) {
      const { value: $ } = E.target;
      a((L) => Object.assign(Object.assign({}, L), { email: $ }));
    }
  }, value: i.email, placeholder: e("labels.email"), pattern: "^.*[^0-9]+$" }) : null, r(Y, Object.assign({ autofocus: !0 }, { children: e("labels.continue") }))] })), r(no, Object.assign({ hidden: !T }, { children: e("labels.or") }))] }) : null, c.actions.thirdparty_oauth.enabled ? (t = c.actions.thirdparty_oauth.inputs.provider.allowed_values) === null || t === void 0 ? void 0 : t.map((E) => r(G, Object.assign({ flowAction: c.actions.thirdparty_oauth, onSubmit: ($) => ((L, N) => Kt(void 0, void 0, void 0, function* () {
    L.preventDefault(), f(N);
    const F = yield c.actions.thirdparty_oauth.run({ provider: N, redirect_to: window.location.toString() }, { dispatchAfterStateChangeEvent: !1 });
    f(null), F.dispatchAfterStateChangeEvent();
  }))($, E.value) }, { children: r(Y, Object.assign({ isLoading: E.value == _, secondary: !0, icon: E.value.startsWith("custom_") ? "customProvider" : E.value }, { children: e("labels.signInWith", { provider: E.name }) })) }), E.value)) : null, c.actions.remember_me.enabled && r(x.Fragment, { children: [r(fn, {}), r(oo, { required: !1, type: "checkbox", label: e("labels.staySignedIn"), checked: w, onChange: (E) => Kt(void 0, void 0, void 0, function* () {
    E.preventDefault();
    const $ = yield c.actions.remember_me.run({ remember_me: !w }, { dispatchAfterStateChangeEvent: !1 });
    y((L) => !L), $.dispatchAfterStateChangeEvent();
  }) })] })] }), r(Ee, Object.assign({ hidden: s !== "auth" }, { children: r(H, Object.assign({ center: !0 }, { children: [r("span", { children: e("labels.alreadyHaveAnAccount") }), r(K, Object.assign({ onClick: (E) => Kt(void 0, void 0, void 0, function* () {
    E.preventDefault(), C(!0), o("login");
  }), loadingSpinnerPosition: "left", isLoading: S }, { children: e("labels.signIn") }))] })) }))] });
};
var No = function(n, t, e, o) {
  return new (e || (e = Promise))(function(i, a) {
    function s(l) {
      try {
        h(o.next(l));
      } catch (d) {
        a(d);
      }
    }
    function c(l) {
      try {
        h(o.throw(l));
      } catch (d) {
        a(d);
      }
    }
    function h(l) {
      var d;
      l.done ? i(l.value) : (d = l.value, d instanceof e ? d : new e(function(u) {
        u(d);
      })).then(s, c);
    }
    h((o = o.apply(n, [])).next());
  });
};
const ha = (n) => {
  const { t } = (0, g.useContext)(z.TranslateContext), { flowState: e } = Ae(n.state), [o, i] = (0, g.useState)();
  return r(x.Fragment, { children: [r(we, { children: [r(re, { children: t("headlines.registerPassword") }), r(Se, { state: e }), r(H, { children: t("texts.passwordFormatHint", { minLength: e.actions.register_password.inputs.new_password.min_length, maxLength: 72 }) }), r(G, Object.assign({ flowAction: e.actions.register_password, onSubmit: (a) => No(void 0, void 0, void 0, function* () {
    return a.preventDefault(), e.actions.register_password.run({ new_password: o });
  }) }, { children: [r(Ne, { type: "password", autocomplete: "new-password", flowInput: e.actions.register_password.inputs.new_password, placeholder: t("labels.newPassword"), onInput: (a) => No(void 0, void 0, void 0, function* () {
    a.target instanceof HTMLInputElement && i(a.target.value);
  }), autofocus: !0 }), r(Y, { children: t("labels.continue") })] }))] }), r(Ee, Object.assign({ hidden: !e.actions.back.enabled && !e.actions.skip.enabled }, { children: [r(K, Object.assign({ loadingSpinnerPosition: "right", flowAction: e.actions.back }, { children: t("labels.back") })), r(K, Object.assign({ loadingSpinnerPosition: "left", flowAction: e.actions.skip }, { children: t("labels.skip") }))] }))] });
};
var rn = Z(21), St = {};
St.setAttributes = Qe(), St.insert = (n) => {
  window._hankoStyle = n;
}, St.domAPI = Je(), St.insertStyleElement = Ge(), Ze()(rn.A, St);
const Fe = rn.A && rn.A.locals ? rn.A.locals : void 0, Nt = function({ name: n, columnSelector: t, contentSelector: e, data: o = [], checkedItemID: i, setCheckedItemID: a, dropdown: s = !1 }) {
  const c = (0, g.useCallback)((d) => `${n}-${d}`, [n]), h = (0, g.useCallback)((d) => c(d) === i, [i, c]), l = (d) => {
    if (!(d.target instanceof HTMLInputElement)) return;
    const u = parseInt(d.target.value, 10), _ = c(u);
    a(_ === i ? null : _);
  };
  return r("div", Object.assign({ className: Fe.accordion }, { children: o.map((d, u) => r("div", Object.assign({ className: Fe.accordionItem }, { children: [r("input", { type: "radio", className: Fe.accordionInput, id: `${n}-${u}`, name: n, onClick: l, value: u, checked: h(u) }), r("label", Object.assign({ className: q()(Fe.label, s && Fe.dropdown), for: `${n}-${u}` }, { children: r("span", Object.assign({ className: Fe.labelText }, { children: t(d, u) })) })), r("div", Object.assign({ className: q()(Fe.accordionContent, s && Fe.dropdownContent) }, { children: e(d, u) }))] }), u)) }));
}, je = ({ children: n }) => r("h2", Object.assign({ part: "headline2", className: q()(dn.headline, dn.grade2) }, { children: n }));
var Sn = function(n, t, e, o) {
  return new (e || (e = Promise))(function(i, a) {
    function s(l) {
      try {
        h(o.next(l));
      } catch (d) {
        a(d);
      }
    }
    function c(l) {
      try {
        h(o.throw(l));
      } catch (d) {
        a(d);
      }
    }
    function h(l) {
      var d;
      l.done ? i(l.value) : (d = l.value, d instanceof e ? d : new e(function(u) {
        u(d);
      })).then(s, c);
    }
    h((o = o.apply(n, [])).next());
  });
};
const ua = ({ checkedItemID: n, setCheckedItemID: t, flowState: e, onState: o }) => {
  const { t: i } = (0, g.useContext)(z.TranslateContext), a = (0, g.useMemo)(() => !1, []);
  return r(Nt, { name: "email-edit-dropdown", columnSelector: (s) => {
    const c = r("span", Object.assign({ className: Fe.description }, { children: s.is_verified ? s.is_primary ? r(x.Fragment, { children: [" -", " ", i("labels.primaryEmail")] }) : null : r(x.Fragment, { children: [" -", " ", i("labels.unverifiedEmail")] }) }));
    return s.is_primary ? r(x.Fragment, { children: [r("b", { children: s.address }), c] }) : r(x.Fragment, { children: [s.address, c] });
  }, data: e.payload.user.emails, contentSelector: (s) => {
    var c, h;
    return r(x.Fragment, { children: [s.is_primary ? r(x.Fragment, { children: r(H, { children: [r(je, { children: i("headlines.isPrimaryEmail") }), i("texts.isPrimaryEmail")] }) }) : r(x.Fragment, { children: r(H, { children: [r(je, { children: i("headlines.setPrimaryEmail") }), i("texts.setPrimaryEmail"), r("br", {}), r(K, Object.assign({ flowAction: e.actions.email_set_primary, onClick: (l) => ((d, u) => Sn(void 0, void 0, void 0, function* () {
      d.preventDefault();
      const _ = yield e.actions.email_set_primary.run({ email_id: u }, { dispatchAfterStateChangeEvent: !1 });
      return o(_);
    }))(l, s.id), loadingSpinnerPosition: "right" }, { children: i("labels.setAsPrimaryEmail") }))] }) }), s.is_verified ? r(x.Fragment, { children: r(H, { children: [r(je, { children: i("headlines.emailVerified") }), i("texts.emailVerified")] }) }) : r(x.Fragment, { children: r(H, { children: [r(je, { children: i("headlines.emailUnverified") }), i("texts.emailUnverified"), r("br", {}), r(K, Object.assign({ flowAction: e.actions.email_verify, onClick: (l) => ((d, u) => Sn(void 0, void 0, void 0, function* () {
      d.preventDefault();
      const _ = yield e.actions.email_verify.run({ email_id: u }, { dispatchAfterStateChangeEvent: !1 });
      return o(_);
    }))(l, s.id), loadingSpinnerPosition: "right" }, { children: i("labels.verify") }))] }) }), !((c = e.actions.email_delete.inputs.email_id.allowed_values) === null || c === void 0) && c.map((l) => l.value).includes(s.id) ? r(x.Fragment, { children: r(H, { children: [r(je, { children: i("headlines.emailDelete") }), i("texts.emailDelete"), r("br", {}), r(K, Object.assign({ dangerous: !0, flowAction: e.actions.email_delete, onClick: (l) => ((d, u) => Sn(void 0, void 0, void 0, function* () {
      d.preventDefault();
      const _ = yield e.actions.email_delete.run({ email_id: u }, { dispatchAfterStateChangeEvent: !1 });
      return o(_);
    }))(l, s.id), disabled: a, loadingSpinnerPosition: "right" }, { children: i("labels.delete") }))] }) }) : null, ((h = s.identities) === null || h === void 0 ? void 0 : h.length) > 0 ? r(x.Fragment, { children: r(H, { children: [r(je, { children: i("headlines.connectedAccounts") }), s.identities.map((l) => l.provider).join(", ")] }) }) : null] });
  }, checkedItemID: n, setCheckedItemID: t });
}, pa = ({ onCredentialNameSubmit: n, oldName: t, onBack: e, credential: o, credentialType: i, flowState: a }) => {
  const { t: s } = (0, g.useContext)(z.TranslateContext), [c, h] = (0, g.useState)(t);
  return r(x.Fragment, { children: [r(we, { children: [r(re, { children: s(i === "security-key" ? "headlines.renameSecurityKey" : "headlines.renamePasskey") }), r(Se, { flowError: null }), r(H, { children: s(i === "security-key" ? "texts.renameSecurityKey" : "texts.renamePasskey") }), r(G, Object.assign({ flowAction: a.actions.webauthn_credential_rename, onSubmit: (l) => n(l, o.id, c) }, { children: [r(Ne, { type: "text", name: i, value: c, minLength: 3, maxLength: 32, required: !0, placeholder: s(i === "security-key" ? "labels.newSecurityKeyName" : "labels.newPasskeyName"), onInput: (l) => {
    return d = void 0, u = void 0, f = function* () {
      l.target instanceof HTMLInputElement && h(l.target.value);
    }, new ((_ = void 0) || (_ = Promise))(function(w, y) {
      function S(E) {
        try {
          T(f.next(E));
        } catch ($) {
          y($);
        }
      }
      function C(E) {
        try {
          T(f.throw(E));
        } catch ($) {
          y($);
        }
      }
      function T(E) {
        var $;
        E.done ? w(E.value) : ($ = E.value, $ instanceof _ ? $ : new _(function(L) {
          L($);
        })).then(S, C);
      }
      T((f = f.apply(d, u || [])).next());
    });
    var d, u, _, f;
  }, autofocus: !0 }), r(Y, { children: s("labels.save") })] }))] }), r(Ee, { children: r(K, Object.assign({ onClick: e, loadingSpinnerPosition: "right" }, { children: s("labels.back") })) })] });
}, Uo = ({ credentials: n = [], checkedItemID: t, setCheckedItemID: e, onBack: o, onCredentialNameSubmit: i, allowCredentialDeletion: a, credentialType: s, onCredentialDelete: c, flowState: h }) => {
  const { t: l } = (0, g.useContext)(z.TranslateContext), { setPage: d } = (0, g.useContext)($e), u = (f) => {
    if (f.name) return f.name;
    const w = f.public_key.replace(/[\W_]/g, "");
    return `${s === "security-key" ? "SecurityKey" : "Passkey"}-${w.substring(w.length - 7, w.length)}`;
  }, _ = (f) => new Date(f).toLocaleString();
  return r(Nt, { name: s === "security-key" ? "security-key-edit-dropdown" : "passkey-edit-dropdown", columnSelector: (f) => u(f), data: n, contentSelector: (f) => r(x.Fragment, { children: [r(H, { children: [r(je, { children: l(s === "security-key" ? "headlines.renameSecurityKey" : "headlines.renamePasskey") }), l(s === "security-key" ? "texts.renameSecurityKey" : "texts.renamePasskey"), r("br", {}), r(K, Object.assign({ onClick: (w) => ((y, S, C) => {
    y.preventDefault(), d(r(pa, { oldName: u(S), credential: S, credentialType: C, onBack: o, onCredentialNameSubmit: i, flowState: h }));
  })(w, f, s), loadingSpinnerPosition: "right" }, { children: l("labels.rename") }))] }), r(H, Object.assign({ hidden: !a }, { children: [r(je, { children: l(s === "security-key" ? "headlines.deleteSecurityKey" : "headlines.deletePasskey") }), l(s === "security-key" ? "texts.deleteSecurityKey" : "texts.deletePasskey"), r("br", {}), r(K, Object.assign({ dangerous: !0, flowAction: h.actions.webauthn_credential_delete, onClick: (w) => c(w, f.id), loadingSpinnerPosition: "right" }, { children: l("labels.delete") }))] })), r(H, { children: [r(je, { children: l("headlines.lastUsedAt") }), f.last_used_at ? _(f.last_used_at) : "-"] }), r(H, { children: [r(je, { children: l("headlines.createdAt") }), _(f.created_at)] })] }), checkedItemID: t, setCheckedItemID: e });
}, pt = ({ name: n, title: t, children: e, checkedItemID: o, setCheckedItemID: i }) => r(Nt, { dropdown: !0, name: n, columnSelector: () => t, contentSelector: () => r(x.Fragment, { children: e }), setCheckedItemID: i, checkedItemID: o, data: [{}] }), mn = ({ flowError: n }) => {
  const { t } = (0, g.useContext)(z.TranslateContext);
  return r(x.Fragment, { children: n ? r("div", Object.assign({ className: Ai.errorMessage }, { children: t(`flowErrors.${n == null ? void 0 : n.code}`) })) : null });
}, fa = ({ checkedItemID: n, setCheckedItemID: t, flowState: e, onState: o }) => {
  var i;
  const { t: a } = (0, g.useContext)(z.TranslateContext), { setUIState: s } = (0, g.useContext)($e), [c, h] = (0, g.useState)();
  return r(pt, Object.assign({ name: "email-create-dropdown", title: a("labels.addEmail"), checkedItemID: n, setCheckedItemID: t }, { children: [r(mn, { flowError: (i = e.actions.email_create.inputs.email) === null || i === void 0 ? void 0 : i.error }), r(G, Object.assign({ flowAction: e.actions.email_create, onSubmit: (l) => ((d, u) => {
    return _ = void 0, f = void 0, y = function* () {
      d.preventDefault(), s((C) => Object.assign(Object.assign({}, C), { email: u }));
      const S = yield e.actions.email_create.run({ email: u }, { dispatchAfterStateChangeEvent: !1 });
      return o(S);
    }, new ((w = void 0) || (w = Promise))(function(S, C) {
      function T(L) {
        try {
          $(y.next(L));
        } catch (N) {
          C(N);
        }
      }
      function E(L) {
        try {
          $(y.throw(L));
        } catch (N) {
          C(N);
        }
      }
      function $(L) {
        var N;
        L.done ? S(L.value) : (N = L.value, N instanceof w ? N : new w(function(F) {
          F(N);
        })).then(T, E);
      }
      $((y = y.apply(_, f || [])).next());
    });
    var _, f, w, y;
  })(l, c).then(() => h("")) }, { children: [r(Ne, { markError: !0, type: "email", placeholder: a("labels.newEmailAddress"), onInput: (l) => {
    l.preventDefault(), l.target instanceof HTMLInputElement && h(l.target.value);
  }, value: c, flowInput: e.actions.email_create.inputs.email }), r(Y, { children: a("labels.save") })] }))] }));
};
var Mo = function(n, t, e, o) {
  return new (e || (e = Promise))(function(i, a) {
    function s(l) {
      try {
        h(o.next(l));
      } catch (d) {
        a(d);
      }
    }
    function c(l) {
      try {
        h(o.throw(l));
      } catch (d) {
        a(d);
      }
    }
    function h(l) {
      var d;
      l.done ? i(l.value) : (d = l.value, d instanceof e ? d : new e(function(u) {
        u(d);
      })).then(s, c);
    }
    h((o = o.apply(n, [])).next());
  });
};
const ma = ({ checkedItemID: n, setCheckedItemID: t, onState: e, flowState: o }) => {
  var i, a, s;
  const { t: c } = (0, g.useContext)(z.TranslateContext), [h, l] = (0, g.useState)(""), d = o.actions.password_create.enabled ? o.actions.password_create : o.actions.password_update;
  return r(pt, Object.assign({ name: "password-edit-dropdown", title: c(o.actions.password_create.enabled ? "labels.setPassword" : "labels.changePassword"), checkedItemID: n, setCheckedItemID: t }, { children: [r(H, { children: c("texts.passwordFormatHint", { minLength: (i = d.inputs.password.min_length) === null || i === void 0 ? void 0 : i.toString(10), maxLength: (a = d.inputs.password.max_length) === null || a === void 0 ? void 0 : a.toString(10) }) }), r(mn, { flowError: (s = o.actions.password_create.inputs.password) === null || s === void 0 ? void 0 : s.error }), r(G, Object.assign({ flowAction: d, onSubmit: (u) => ((_, f) => Mo(void 0, void 0, void 0, function* () {
    _.preventDefault();
    const w = yield d.run({ password: f }, { dispatchAfterStateChangeEvent: !1 });
    return e(w);
  }))(u, h).then(() => l("")) }, { children: [r(Ne, { markError: !0, autoComplete: "new-password", placeholder: c("labels.newPassword"), type: "password", onInput: (u) => {
    u.preventDefault(), u.target instanceof HTMLInputElement && l(u.target.value);
  }, value: h, flowInput: d.inputs.password }), r(Y, { children: c("labels.save") })] })), r(K, Object.assign({ dangerous: !0, flowAction: o.actions.password_delete, onClick: (u) => ((_) => Mo(void 0, void 0, void 0, function* () {
    _.preventDefault();
    const f = yield o.actions.password_delete.run(null, { dispatchAfterStateChangeEvent: !1 });
    return e(f);
  }))(u).then(() => l("")), loadingSpinnerPosition: "right" }, { children: c("labels.delete") }))] }));
}, Ro = ({ checkedItemID: n, setCheckedItemID: t, credentialType: e, flowState: o, onState: i }) => {
  const { t: a } = (0, g.useContext)(z.TranslateContext), s = lt.supported(), c = e == "passkey" ? o.actions.webauthn_credential_create : o.actions.security_key_create;
  return r(pt, Object.assign({ name: e === "security-key" ? "security-key-create-dropdown" : "passkey-create-dropdown", title: a(e === "security-key" ? "labels.createSecurityKey" : "labels.createPasskey"), checkedItemID: n, setCheckedItemID: t }, { children: [r(H, { children: a(e === "security-key" ? "texts.securityKeySetUp" : "texts.setupPasskey") }), r(G, Object.assign({ onSubmit: (h) => {
    return l = void 0, d = void 0, _ = function* () {
      h.preventDefault();
      const f = yield c.run(null, { dispatchAfterStateChangeEvent: !1 });
      return i(f);
    }, new ((u = void 0) || (u = Promise))(function(f, w) {
      function y(T) {
        try {
          C(_.next(T));
        } catch (E) {
          w(E);
        }
      }
      function S(T) {
        try {
          C(_.throw(T));
        } catch (E) {
          w(E);
        }
      }
      function C(T) {
        var E;
        T.done ? f(T.value) : (E = T.value, E instanceof u ? E : new u(function($) {
          $(E);
        })).then(y, S);
      }
      C((_ = _.apply(l, d || [])).next());
    });
    var l, d, u, _;
  }, flowAction: c }, { children: r(Y, Object.assign({ title: s ? null : a("labels.webauthnUnsupported") }, { children: a(e === "security-key" ? "labels.createSecurityKey" : "labels.createPasskey") })) }))] }));
};
var Ho = function(n, t, e, o) {
  return new (e || (e = Promise))(function(i, a) {
    function s(l) {
      try {
        h(o.next(l));
      } catch (d) {
        a(d);
      }
    }
    function c(l) {
      try {
        h(o.throw(l));
      } catch (d) {
        a(d);
      }
    }
    function h(l) {
      var d;
      l.done ? i(l.value) : (d = l.value, d instanceof e ? d : new e(function(u) {
        u(d);
      })).then(s, c);
    }
    h((o = o.apply(n, [])).next());
  });
};
const ga = ({ checkedItemID: n, setCheckedItemID: t, flowState: e, onState: o }) => {
  var i, a;
  const { t: s } = (0, g.useContext)(z.TranslateContext), [c, h] = (0, g.useState)();
  return r(pt, Object.assign({ name: "username-edit-dropdown", title: s(e.payload.user.username ? "labels.changeUsername" : "labels.setUsername"), checkedItemID: n, setCheckedItemID: t }, { children: [r(mn, { flowError: e.payload.user.username ? (i = e.actions.username_update.inputs.username) === null || i === void 0 ? void 0 : i.error : (a = e.actions.username_create.inputs.username) === null || a === void 0 ? void 0 : a.error }), r(G, Object.assign({ flowAction: e.payload.user.username ? e.actions.username_update : e.actions.username_create, onSubmit: (l) => Ho(void 0, void 0, void 0, function* () {
    l.preventDefault();
    const d = e.payload.user.username ? e.actions.username_update : e.actions.username_create, u = yield d.run({ username: c }, { dispatchAfterStateChangeEvent: !1 });
    return o(u).then(() => h(""));
  }) }, { children: [r(Ne, { markError: !0, placeholder: s("labels.username"), type: "text", onInput: (l) => {
    l.preventDefault(), l.target instanceof HTMLInputElement && h(l.target.value);
  }, value: c, flowInput: e.payload.user.username ? e.actions.username_update.inputs.username : e.actions.username_create.inputs.username }), r(Y, { children: s("labels.save") })] })), r(K, Object.assign({ flowAction: e.actions.username_delete, onClick: (l) => Ho(void 0, void 0, void 0, function* () {
    l.preventDefault();
    const d = yield e.actions.username_delete.run(null, { dispatchAfterStateChangeEvent: !1 });
    return o(d).then(() => h(""));
  }), dangerous: !0, loadingSpinnerPosition: "right" }, { children: s("labels.delete") }))] }));
}, _a = ({ state: n, onBack: t }) => {
  const { t: e } = (0, g.useContext)(z.TranslateContext);
  return r(x.Fragment, { children: [r(we, { children: [r(re, { children: e("headlines.deleteAccount") }), r(Se, { flowError: null }), r(H, { children: e("texts.deleteAccount") }), r(G, Object.assign({ flowAction: n.actions.account_delete }, { children: [r(oo, { required: !0, type: "checkbox", label: e("labels.deleteAccount") }), r(Y, { children: e("labels.delete") })] }))] }), r(Ee, { children: r(K, Object.assign({ onClick: t }, { children: e("labels.back") })) })] });
}, va = ({ checkedItemID: n, setCheckedItemID: t, flowState: e, onState: o }) => {
  const { t: i } = (0, g.useContext)(z.TranslateContext), a = (s) => new Date(s).toLocaleString();
  return r(Nt, { name: "session-edit-dropdown", columnSelector: (s) => {
    const c = r("b", { children: s.user_agent ? s.user_agent : s.id }), h = s.current ? r("span", Object.assign({ className: Fe.description }, { children: r(x.Fragment, { children: [" -", " ", i("labels.currentSession")] }) })) : null;
    return r(x.Fragment, { children: [c, h] });
  }, data: e.payload.sessions, contentSelector: (s) => {
    var c, h, l;
    return r(x.Fragment, { children: [r(H, Object.assign({ hidden: !s.ip_address }, { children: [r(je, { children: i("headlines.ipAddress") }), s.ip_address] })), r(H, { children: [r(je, { children: i("headlines.lastUsed") }), a(s.last_used)] }), r(H, { children: [r(je, { children: i("headlines.createdAt") }), a(s.created_at)] }), !((l = (h = (c = e.actions.session_delete.inputs.session_id) === null || c === void 0 ? void 0 : c.allowed_values) === null || h === void 0 ? void 0 : h.map((d) => d.value)) === null || l === void 0) && l.includes(s.id) ? r(H, { children: [r(je, { children: i("headlines.revokeSession") }), r(K, Object.assign({ dangerous: !0, onClick: (d) => ((u, _) => {
      return f = void 0, w = void 0, S = function* () {
        u.preventDefault();
        const C = yield e.actions.session_delete.run({ session_id: _ }, { dispatchAfterStateChangeEvent: !1 });
        return o(C);
      }, new ((y = void 0) || (y = Promise))(function(C, T) {
        function E(N) {
          try {
            L(S.next(N));
          } catch (F) {
            T(F);
          }
        }
        function $(N) {
          try {
            L(S.throw(N));
          } catch (F) {
            T(F);
          }
        }
        function L(N) {
          var F;
          N.done ? C(N.value) : (F = N.value, F instanceof y ? F : new y(function(B) {
            B(F);
          })).then(E, $);
        }
        L((S = S.apply(f, w || [])).next());
      });
      var f, w, y, S;
    })(d, s.id), loadingSpinnerPosition: "right" }, { children: i("labels.revoke") }))] }) : null] });
  }, checkedItemID: n, setCheckedItemID: t });
};
var Wo = function(n, t, e, o) {
  return new (e || (e = Promise))(function(i, a) {
    function s(l) {
      try {
        h(o.next(l));
      } catch (d) {
        a(d);
      }
    }
    function c(l) {
      try {
        h(o.throw(l));
      } catch (d) {
        a(d);
      }
    }
    function h(l) {
      var d;
      l.done ? i(l.value) : (d = l.value, d instanceof e ? d : new e(function(u) {
        u(d);
      })).then(s, c);
    }
    h((o = o.apply(n, [])).next());
  });
};
const ba = ({ checkedItemID: n, setCheckedItemID: t, flowState: e, onState: o }) => {
  var i, a, s, c;
  const { t: h } = (0, g.useContext)(z.TranslateContext), l = r("span", Object.assign({ className: Fe.description }, { children: !((i = e.payload.user.mfa_config) === null || i === void 0) && i.auth_app_set_up ? r(x.Fragment, { children: [" -", " ", h("labels.configured")] }) : null })), d = r(x.Fragment, { children: [h("labels.authenticatorAppManage"), " ", l] });
  return r(pt, Object.assign({ name: "authenticator-app-manage-dropdown", title: d, checkedItemID: n, setCheckedItemID: t }, { children: [r(je, { children: h(!((a = e.payload.user.mfa_config) === null || a === void 0) && a.auth_app_set_up ? "headlines.authenticatorAppAlreadySetUp" : "headlines.authenticatorAppNotSetUp") }), r(H, { children: [h(!((s = e.payload.user.mfa_config) === null || s === void 0) && s.auth_app_set_up ? "texts.authenticatorAppAlreadySetUp" : "texts.authenticatorAppNotSetUp"), r("br", {}), !((c = e.payload.user.mfa_config) === null || c === void 0) && c.auth_app_set_up ? r(K, Object.assign({ flowAction: e.actions.otp_secret_delete, onClick: (u) => Wo(void 0, void 0, void 0, function* () {
    u.preventDefault();
    const _ = yield e.actions.otp_secret_delete.run(null, { dispatchAfterStateChangeEvent: !1 });
    return o(_);
  }), loadingSpinnerPosition: "right", dangerous: !0 }, { children: h("labels.delete") })) : r(K, Object.assign({ flowAction: e.actions.continue_to_otp_secret_creation, onClick: (u) => Wo(void 0, void 0, void 0, function* () {
    u.preventDefault();
    const _ = yield e.actions.continue_to_otp_secret_creation.run(null, { dispatchAfterStateChangeEvent: !1 });
    return o(_);
  }), loadingSpinnerPosition: "right" }, { children: h("labels.authenticatorAppAdd") }))] })] }));
}, ya = ({ checkedItemID: n, setCheckedItemID: t, flowState: e, onState: o }) => {
  const { t: i } = (0, g.useContext)(z.TranslateContext), a = (0, g.useMemo)(() => !1, []);
  return r(Nt, { name: "connected-accounts", columnSelector: (s) => {
    const c = r("b", { children: s.provider });
    return r(x.Fragment, { children: c });
  }, contentSelector: (s) => r(x.Fragment, { children: r(x.Fragment, { children: r(H, { children: [r(je, { children: i("headlines.deleteIdentity") }), r(K, Object.assign({ dangerous: !0, flowAction: e.actions.disconnect_thirdparty_oauth_provider, onClick: (c) => ((h, l) => {
    return d = void 0, u = void 0, f = function* () {
      h.preventDefault();
      const w = yield e.actions.disconnect_thirdparty_oauth_provider.run({ identity_id: l }, { dispatchAfterStateChangeEvent: !1 });
      return o(w);
    }, new ((_ = void 0) || (_ = Promise))(function(w, y) {
      function S(E) {
        try {
          T(f.next(E));
        } catch ($) {
          y($);
        }
      }
      function C(E) {
        try {
          T(f.throw(E));
        } catch ($) {
          y($);
        }
      }
      function T(E) {
        var $;
        E.done ? w(E.value) : ($ = E.value, $ instanceof _ ? $ : new _(function(L) {
          L($);
        })).then(S, C);
      }
      T((f = f.apply(d, u || [])).next());
    });
    var d, u, _, f;
  })(c, s.identity_id), disabled: a, loadingSpinnerPosition: "right" }, { children: i("labels.delete") }))] }) }) }), checkedItemID: n, setCheckedItemID: t, data: e.payload.user.identities });
}, ka = ({ checkedItemID: n, setCheckedItemID: t, flowState: e, onState: o }) => {
  var i, a;
  const { t: s } = (0, g.useContext)(z.TranslateContext);
  return r(pt, Object.assign({ name: "connect-account-dropdown", title: s("labels.connectAccount"), checkedItemID: n, setCheckedItemID: t }, { children: [r(mn, { flowError: (i = e.actions.connect_thirdparty_oauth_provider.inputs.provider) === null || i === void 0 ? void 0 : i.error }), (a = e.actions.connect_thirdparty_oauth_provider.inputs.provider.allowed_values) === null || a === void 0 ? void 0 : a.map((c) => r(G, Object.assign({ flowAction: e.actions.connect_thirdparty_oauth_provider, onSubmit: (h) => ((l, d) => {
    return u = void 0, _ = void 0, w = function* () {
      l.preventDefault();
      const y = yield e.actions.connect_thirdparty_oauth_provider.run({ provider: d, redirect_to: window.location.href });
      return o(y);
    }, new ((f = void 0) || (f = Promise))(function(y, S) {
      function C($) {
        try {
          E(w.next($));
        } catch (L) {
          S(L);
        }
      }
      function T($) {
        try {
          E(w.throw($));
        } catch (L) {
          S(L);
        }
      }
      function E($) {
        var L;
        $.done ? y($.value) : (L = $.value, L instanceof f ? L : new f(function(N) {
          N(L);
        })).then(C, T);
      }
      E((w = w.apply(u, _ || [])).next());
    });
    var u, _, f, w;
  })(h, c.value) }, { children: r(Y, Object.assign({ icon: c.value.startsWith("custom_") ? "customProvider" : c.value }, { children: c.name }), c) }), c.value))] }));
};
var Bt = function(n, t, e, o) {
  return new (e || (e = Promise))(function(i, a) {
    function s(l) {
      try {
        h(o.next(l));
      } catch (d) {
        a(d);
      }
    }
    function c(l) {
      try {
        h(o.throw(l));
      } catch (d) {
        a(d);
      }
    }
    function h(l) {
      var d;
      l.done ? i(l.value) : (d = l.value, d instanceof e ? d : new e(function(u) {
        u(d);
      })).then(s, c);
    }
    h((o = o.apply(n, [])).next());
  });
};
const Oi = (n) => {
  var t, e, o, i, a, s, c;
  const { t: h } = (0, g.useContext)(z.TranslateContext), { setPage: l } = (0, g.useContext)($e), { flowState: d } = Ae(n.state), [u, _] = (0, g.useState)(""), f = (S) => Bt(void 0, void 0, void 0, function* () {
    S != null && S.error || (_(null), yield new Promise((C) => setTimeout(C, 360))), S.dispatchAfterStateChangeEvent();
  }), w = (S, C, T) => Bt(void 0, void 0, void 0, function* () {
    S.preventDefault();
    const E = yield d.actions.webauthn_credential_rename.run({ passkey_id: C, passkey_name: T }, { dispatchAfterStateChangeEvent: !1 });
    return f(E);
  }), y = (S) => (S.preventDefault(), l(r(Oi, { state: d, enablePasskeys: n.enablePasskeys })), Promise.resolve());
  return r(we, { children: [r(Se, { state: ((t = d == null ? void 0 : d.error) === null || t === void 0 ? void 0 : t.code) !== "form_data_invalid_error" ? d : null }), d.actions.username_create.enabled || d.actions.username_update.enabled || d.actions.username_delete.enabled ? r(x.Fragment, { children: [r(re, { children: h("labels.username") }), d.payload.user.username ? r(H, { children: r("b", { children: d.payload.user.username.username }) }) : null, r(H, { children: d.actions.username_create.enabled || d.actions.username_update.enabled ? r(ga, { onState: f, flowState: d, checkedItemID: u, setCheckedItemID: _ }) : null })] }) : null, !((o = (e = d.payload) === null || e === void 0 ? void 0 : e.user) === null || o === void 0) && o.emails || d.actions.email_create.enabled ? r(x.Fragment, { children: [r(re, { children: h("headlines.profileEmails") }), r(H, { children: [r(ua, { flowState: d, onState: f, checkedItemID: u, setCheckedItemID: _ }), d.actions.email_create.enabled ? r(fa, { flowState: d, onState: f, checkedItemID: u, setCheckedItemID: _ }) : null] })] }) : null, d.actions.password_create.enabled || d.actions.password_update.enabled ? r(x.Fragment, { children: [r(re, { children: h("headlines.profilePassword") }), r(H, { children: r(ma, { flowState: d, onState: f, checkedItemID: u, setCheckedItemID: _ }) })] }) : null, n.enablePasskeys && (!((a = (i = d.payload) === null || i === void 0 ? void 0 : i.user) === null || a === void 0) && a.passkeys || d.actions.webauthn_credential_create.enabled) ? r(x.Fragment, { children: [r(re, { children: h("headlines.profilePasskeys") }), r(H, { children: [r(Uo, { flowState: d, onBack: y, onCredentialNameSubmit: w, onCredentialDelete: (S, C) => Bt(void 0, void 0, void 0, function* () {
    S.preventDefault();
    const T = yield d.actions.webauthn_credential_delete.run({ passkey_id: C }, { dispatchAfterStateChangeEvent: !1 });
    return f(T);
  }), credentials: d.payload.user.passkeys, checkedItemID: u, setCheckedItemID: _, allowCredentialDeletion: !!d.actions.webauthn_credential_delete.enabled, credentialType: "passkey" }), d.actions.webauthn_credential_create.enabled ? r(Ro, { flowState: d, onState: f, credentialType: "passkey", checkedItemID: u, setCheckedItemID: _ }) : null] })] }) : null, !((s = d.payload.user.mfa_config) === null || s === void 0) && s.security_keys_enabled ? r(x.Fragment, { children: [r(re, { children: h("headlines.securityKeys") }), r(H, { children: [r(Uo, { onBack: y, flowState: d, onCredentialNameSubmit: w, onCredentialDelete: (S, C) => Bt(void 0, void 0, void 0, function* () {
    S.preventDefault();
    const T = yield d.actions.security_key_delete.run({ security_key_id: C }, { dispatchAfterStateChangeEvent: !1 });
    return f(T);
  }), credentials: d.payload.user.security_keys, checkedItemID: u, setCheckedItemID: _, allowCredentialDeletion: !!d.actions.security_key_delete.enabled, credentialType: "security-key" }), d.actions.security_key_create.enabled ? r(Ro, { flowState: d, onState: f, credentialType: "security-key", checkedItemID: u, setCheckedItemID: _ }) : null] })] }) : null, !((c = d.payload.user.mfa_config) === null || c === void 0) && c.totp_enabled ? r(x.Fragment, { children: [r(re, { children: h("headlines.authenticatorApp") }), r(H, { children: r(ba, { onState: f, flowState: d, checkedItemID: u, setCheckedItemID: _ }) })] }) : null, d.actions.connect_thirdparty_oauth_provider.enabled || d.actions.disconnect_thirdparty_oauth_provider.enabled ? r(x.Fragment, { children: [r(re, { children: h("headlines.connectedAccounts") }), r(ya, { flowState: d, onState: f, checkedItemID: u, setCheckedItemID: _ }), d.actions.connect_thirdparty_oauth_provider.enabled ? r(ka, { setCheckedItemID: _, flowState: d, onState: f, checkedItemID: u }) : null] }) : null, d.payload.sessions ? r(x.Fragment, { children: [r(re, { children: h("headlines.profileSessions") }), r(H, { children: r(va, { flowState: d, onState: f, checkedItemID: u, setCheckedItemID: _ }) })] }) : null, d.actions.account_delete.enabled ? r(x.Fragment, { children: [r(fn, {}), r(H, { children: r(no, {}) }), r(H, { children: r(G, Object.assign({ onSubmit: (S) => (S.preventDefault(), l(r(_a, { onBack: y, state: d })), Promise.resolve()), flowAction: d.actions.account_delete }, { children: r(Y, Object.assign({ dangerous: !0 }, { children: h("headlines.deleteAccount") })) })) })] }) : null] });
}, wa = Oi, Fo = ({ state: n, error: t }) => {
  const { t: e } = (0, g.useContext)(z.TranslateContext), { init: o, componentName: i } = (0, g.useContext)($e), [a, s] = (0, g.useState)(!1), c = (0, g.useCallback)(() => o(i), [i, o]), { flowState: h } = Ae(n);
  return (0, g.useEffect)(() => (addEventListener("hankoAuthSuccess", c), () => {
    removeEventListener("hankoAuthSuccess", c);
  }), [c]), r(we, { children: [r(re, { children: e("headlines.error") }), r(Se, { state: h, error: t }), r(G, Object.assign({ onSubmit: (l) => {
    l.preventDefault(), s(!0), c();
  } }, { children: r(Y, Object.assign({ isLoading: a }, { children: e("labels.continue") })) }))] });
};
var zo = function(n, t, e, o) {
  return new (e || (e = Promise))(function(i, a) {
    function s(l) {
      try {
        h(o.next(l));
      } catch (d) {
        a(d);
      }
    }
    function c(l) {
      try {
        h(o.throw(l));
      } catch (d) {
        a(d);
      }
    }
    function h(l) {
      var d;
      l.done ? i(l.value) : (d = l.value, d instanceof e ? d : new e(function(u) {
        u(d);
      })).then(s, c);
    }
    h((o = o.apply(n, [])).next());
  });
};
const Sa = (n) => {
  const { t } = (0, g.useContext)(z.TranslateContext), { flowState: e } = Ae(n.state), [o, i] = (0, g.useState)();
  return r(x.Fragment, { children: [r(we, { children: [r(re, { children: t("headlines.createEmail") }), r(Se, { state: e }), r(G, Object.assign({ onSubmit: (a) => zo(void 0, void 0, void 0, function* () {
    return a.preventDefault(), e.actions.email_address_set.run({ email: o });
  }), flowAction: e.actions.email_address_set }, { children: [r(Ne, { type: "email", autoComplete: "email", autoCorrect: "off", flowInput: e.actions.email_address_set.inputs.email, onInput: (a) => zo(void 0, void 0, void 0, function* () {
    a.target instanceof HTMLInputElement && i(a.target.value);
  }), placeholder: t("labels.email"), pattern: "^.*[^0-9]+$", value: o }), r(Y, { children: t("labels.continue") })] }))] }), r(Ee, Object.assign({ hidden: !e.actions.skip.enabled }, { children: [r("span", { hidden: !0 }), r(K, Object.assign({ flowAction: e.actions.skip, loadingSpinnerPosition: "left" }, { children: t("labels.skip") }))] }))] });
};
var qo = function(n, t, e, o) {
  return new (e || (e = Promise))(function(i, a) {
    function s(l) {
      try {
        h(o.next(l));
      } catch (d) {
        a(d);
      }
    }
    function c(l) {
      try {
        h(o.throw(l));
      } catch (d) {
        a(d);
      }
    }
    function h(l) {
      var d;
      l.done ? i(l.value) : (d = l.value, d instanceof e ? d : new e(function(u) {
        u(d);
      })).then(s, c);
    }
    h((o = o.apply(n, [])).next());
  });
};
const xa = (n) => {
  const { t } = (0, g.useContext)(z.TranslateContext), { flowState: e } = Ae(n.state), [o, i] = (0, g.useState)();
  return r(x.Fragment, { children: [r(we, { children: [r(re, { children: t("headlines.createUsername") }), r(Se, { state: e }), r(G, Object.assign({ flowAction: e.actions.username_create, onSubmit: (a) => qo(void 0, void 0, void 0, function* () {
    return a.preventDefault(), e.actions.username_create.run({ username: o });
  }) }, { children: [r(Ne, { type: "text", autoComplete: "username", autoCorrect: "off", flowInput: e.actions.username_create.inputs.username, onInput: (a) => qo(void 0, void 0, void 0, function* () {
    a.target instanceof HTMLInputElement && i(a.target.value);
  }), value: o, placeholder: t("labels.username") }), r(Y, { children: t("labels.continue") })] }))] }), r(Ee, Object.assign({ hidden: !e.actions.skip.enabled }, { children: [r("span", { hidden: !0 }), r(K, Object.assign({ flowAction: e.actions.skip, loadingSpinnerPosition: "left" }, { children: t("labels.skip") }))] }))] });
}, Ca = (n) => {
  const { t } = (0, g.useContext)(z.TranslateContext), { flowState: e } = Ae(n.state);
  return r(x.Fragment, { children: [r(we, { children: [r(re, { children: t("headlines.setupLoginMethod") }), r(Se, { flowError: e == null ? void 0 : e.error }), r(H, { children: t("texts.selectLoginMethodForFutureLogins") }), r(G, Object.assign({ flowAction: e.actions.continue_to_passkey_registration }, { children: r(Y, Object.assign({ secondary: !0, icon: "passkey" }, { children: t("labels.passkey") })) })), r(G, Object.assign({ flowAction: e.actions.continue_to_password_registration }, { children: r(Y, Object.assign({ secondary: !0, icon: "password" }, { children: t("labels.password") })) }))] }), r(Ee, Object.assign({ hidden: !e.actions.back.enabled && !e.actions.skip.enabled }, { children: [r(K, Object.assign({ loadingSpinnerPosition: "right", flowAction: e.actions.back }, { children: t("labels.back") })), r(K, Object.assign({ loadingSpinnerPosition: "left", flowAction: e.actions.skip }, { children: t("labels.skip") }))] }))] });
};
var Ko = function(n, t, e, o) {
  return new (e || (e = Promise))(function(i, a) {
    function s(l) {
      try {
        h(o.next(l));
      } catch (d) {
        a(d);
      }
    }
    function c(l) {
      try {
        h(o.throw(l));
      } catch (d) {
        a(d);
      }
    }
    function h(l) {
      var d;
      l.done ? i(l.value) : (d = l.value, d instanceof e ? d : new e(function(u) {
        u(d);
      })).then(s, c);
    }
    h((o = o.apply(n, [])).next());
  });
};
const Aa = (n) => {
  const { t } = (0, g.useContext)(z.TranslateContext), { flowState: e } = Ae(n.state), [o, i] = (0, g.useState)([]), a = (0, g.useCallback)((s) => Ko(void 0, void 0, void 0, function* () {
    return e.actions.otp_code_validate.run({ otp_code: s });
  }), [e]);
  return (0, g.useEffect)(() => {
    i([]);
  }, [e]), r(x.Fragment, { children: [r(we, { children: [r(re, { children: t("headlines.otpLogin") }), r(Se, { state: e }), r(H, { children: t("texts.otpLogin") }), r(G, Object.assign({ flowAction: e.actions.otp_code_validate, onSubmit: (s) => Ko(void 0, void 0, void 0, function* () {
    return s.preventDefault(), a(o.join(""));
  }) }, { children: [r(io, { onInput: (s) => {
    if (i(s), s.filter((c) => c !== "").length === 6) return a(s.join(""));
  }, passcodeDigits: o, numberOfInputs: 6 }), r(Y, { children: t("labels.continue") })] }))] }), r(Ee, Object.assign({ hidden: !e.actions.continue_to_login_security_key.enabled }, { children: r(K, Object.assign({ loadingSpinnerPosition: "right", flowAction: e.actions.continue_to_login_security_key }, { children: t("labels.useAnotherMethod") })) }))] });
}, Oa = (n) => {
  const { t } = (0, g.useContext)(z.TranslateContext), { flowState: e } = Ae(n.state);
  return r(x.Fragment, { children: [r(we, { children: [r(re, { children: t("headlines.securityKeyLogin") }), r(Se, { state: e }), r(H, { children: t("texts.securityKeyLogin") }), r(G, Object.assign({ flowAction: e.actions.webauthn_generate_request_options }, { children: r(Y, Object.assign({ autofocus: !0, icon: "securityKey" }, { children: t("labels.securityKeyUse") })) }))] }), r(Ee, Object.assign({ hidden: !e.actions.continue_to_login_otp.enabled }, { children: r(K, Object.assign({ loadingSpinnerPosition: "right", flowAction: e.actions.continue_to_login_otp }, { children: t("labels.useAnotherMethod") })) }))] });
}, Ea = (n) => {
  const { t } = (0, g.useContext)(z.TranslateContext), { flowState: e } = Ae(n.state), o = (0, g.useMemo)(() => {
    const { actions: i } = e;
    return i.continue_to_security_key_creation.enabled && !i.continue_to_otp_secret_creation.enabled ? i.continue_to_security_key_creation : !i.continue_to_security_key_creation.enabled && i.continue_to_otp_secret_creation.enabled ? i.continue_to_otp_secret_creation : void 0;
  }, [e]);
  return r(x.Fragment, { children: [r(we, { children: [r(re, { children: t("headlines.mfaSetUp") }), r(Se, { flowError: e == null ? void 0 : e.error }), r(H, { children: t("texts.mfaSetUp") }), o ? r(G, Object.assign({ flowAction: o }, { children: r(Y, { children: t("labels.continue") }) })) : r(x.Fragment, { children: [r(G, Object.assign({ flowAction: e.actions.continue_to_security_key_creation }, { children: r(Y, Object.assign({ secondary: !0, icon: "securityKey" }, { children: t("labels.securityKey") })) })), r(G, Object.assign({ flowAction: e.actions.continue_to_otp_secret_creation }, { children: r(Y, Object.assign({ secondary: !0, icon: "qrCodeScanner" }, { children: t("labels.authenticatorApp") })) }))] })] }), r(Ee, { children: [r(K, Object.assign({ loadingSpinnerPosition: "right", flowAction: e.actions.back }, { children: t("labels.back") })), r(K, Object.assign({ loadingSpinnerPosition: "left", flowAction: e.actions.skip }, { children: t("labels.skip") }))] })] });
};
var an = Z(560), xt = {};
xt.setAttributes = Qe(), xt.insert = (n) => {
  window._hankoStyle = n;
}, xt.domAPI = Je(), xt.insertStyleElement = Ge(), Ze()(an.A, xt);
const Pa = an.A && an.A.locals ? an.A.locals : void 0, Ia = ({ children: n, text: t }) => {
  const { t: e } = (0, g.useContext)(z.TranslateContext), [o, i] = (0, g.useState)(!1);
  return r("section", Object.assign({ className: Tt.clipboardContainer }, { children: [r("div", { children: [n, " "] }), r("div", Object.assign({ className: Tt.clipboardIcon, onClick: (a) => {
    return s = void 0, c = void 0, l = function* () {
      a.preventDefault();
      try {
        yield navigator.clipboard.writeText(t), i(!0), setTimeout(() => i(!1), 1500);
      } catch (d) {
        console.error("Failed to copy: ", d);
      }
    }, new ((h = void 0) || (h = Promise))(function(d, u) {
      function _(y) {
        try {
          w(l.next(y));
        } catch (S) {
          u(S);
        }
      }
      function f(y) {
        try {
          w(l.throw(y));
        } catch (S) {
          u(S);
        }
      }
      function w(y) {
        var S;
        y.done ? d(y.value) : (S = y.value, S instanceof h ? S : new h(function(C) {
          C(S);
        })).then(_, f);
      }
      w((l = l.apply(s, c || [])).next());
    });
    var s, c, h, l;
  } }, { children: o ? r("span", { children: ["- ", e("labels.copied")] }) : r(Lt, { name: "copy", secondary: !0, size: 13 }) }))] }));
}, ja = ({ src: n, secret: t }) => {
  const { t: e } = (0, g.useContext)(z.TranslateContext);
  return r("div", Object.assign({ className: Pa.otpCreationDetails }, { children: [r("img", { alt: "QR-Code", src: n }), r(fn, {}), r(Ia, Object.assign({ text: t }, { children: e("texts.otpSecretKey") })), r("div", { children: t })] }));
};
var Bo = function(n, t, e, o) {
  return new (e || (e = Promise))(function(i, a) {
    function s(l) {
      try {
        h(o.next(l));
      } catch (d) {
        a(d);
      }
    }
    function c(l) {
      try {
        h(o.throw(l));
      } catch (d) {
        a(d);
      }
    }
    function h(l) {
      var d;
      l.done ? i(l.value) : (d = l.value, d instanceof e ? d : new e(function(u) {
        u(d);
      })).then(s, c);
    }
    h((o = o.apply(n, [])).next());
  });
};
const $a = (n) => {
  const { t } = (0, g.useContext)(z.TranslateContext), { flowState: e } = Ae(n.state), [o, i] = (0, g.useState)([]), a = (0, g.useCallback)((s) => Bo(void 0, void 0, void 0, function* () {
    return e.actions.otp_code_verify.run({ otp_code: s });
  }), [e]);
  return (0, g.useEffect)(() => {
    var s;
    ((s = e.error) === null || s === void 0 ? void 0 : s.code) === "passcode_invalid" && i([]);
  }, [e]), r(x.Fragment, { children: [r(we, { children: [r(re, { children: t("headlines.otpSetUp") }), r(Se, { state: e }), r(H, { children: t("texts.otpScanQRCode") }), r(ja, { src: e.payload.otp_image_source, secret: e.payload.otp_secret }), r(H, { children: t("texts.otpEnterVerificationCode") }), r(G, Object.assign({ flowAction: e.actions.otp_code_verify, onSubmit: (s) => Bo(void 0, void 0, void 0, function* () {
    return s.preventDefault(), a(o.join(""));
  }) }, { children: [r(io, { onInput: (s) => {
    if (i(s), s.filter((c) => c !== "").length === 6) return a(s.join(""));
  }, passcodeDigits: o, numberOfInputs: 6 }), r(Y, { children: t("labels.continue") })] }))] }), r(Ee, { children: r(K, Object.assign({ flowAction: e.actions.back, loadingSpinnerPosition: "right" }, { children: t("labels.back") })) })] });
}, Da = (n) => {
  const { t } = (0, g.useContext)(z.TranslateContext), { flowState: e } = Ae(n.state);
  return r(x.Fragment, { children: [r(we, { children: [r(re, { children: t("headlines.securityKeySetUp") }), r(Se, { state: e }), r(H, { children: t("texts.securityKeySetUp") }), r(G, Object.assign({ flowAction: e.actions.webauthn_generate_creation_options }, { children: r(Y, Object.assign({ autofocus: !0, icon: "securityKey" }, { children: t("labels.createSecurityKey") })) }))] }), r(Ee, Object.assign({ hidden: !e.actions.back.enabled }, { children: r(K, Object.assign({ loadingSpinnerPosition: "right", flowAction: e.actions.back }, { children: t("labels.back") })) }))] });
}, Ta = (n) => {
  const { t } = (0, g.useContext)(z.TranslateContext), { flowState: e } = Ae(n.state);
  return r(x.Fragment, { children: [r(we, { children: [r(re, { children: t("headlines.trustDevice") }), r(Se, { flowError: e == null ? void 0 : e.error }), r(H, { children: t("texts.trustDevice") }), r(G, Object.assign({ flowAction: e.actions.trust_device }, { children: r(Y, { children: t("labels.trustDevice") }) }))] }), r(Ee, { children: [r(K, Object.assign({ flowAction: e.actions.back, loadingSpinnerPosition: "right" }, { children: t("labels.back") })), r(K, Object.assign({ flowAction: e.actions.skip, loadingSpinnerPosition: "left" }, { children: t("labels.skip") }))] })] });
};
var Vo = function(n, t, e, o) {
  return new (e || (e = Promise))(function(i, a) {
    function s(l) {
      try {
        h(o.next(l));
      } catch (d) {
        a(d);
      }
    }
    function c(l) {
      try {
        h(o.throw(l));
      } catch (d) {
        a(d);
      }
    }
    function h(l) {
      var d;
      l.done ? i(l.value) : (d = l.value, d instanceof e ? d : new e(function(u) {
        u(d);
      })).then(s, c);
    }
    h((o = o.apply(n, [])).next());
  });
};
const $e = (0, x.createContext)(null), La = (n) => {
  var t, { lang: e, prefilledEmail: o, prefilledUsername: i, globalOptions: a, createWebauthnAbortSignal: s, nonce: c } = n, h = function(v, M) {
    var ue = {};
    for (var ce in v) Object.prototype.hasOwnProperty.call(v, ce) && M.indexOf(ce) < 0 && (ue[ce] = v[ce]);
    if (v != null && typeof Object.getOwnPropertySymbols == "function") {
      var Me = 0;
      for (ce = Object.getOwnPropertySymbols(v); Me < ce.length; Me++) M.indexOf(ce[Me]) < 0 && Object.prototype.propertyIsEnumerable.call(v, ce[Me]) && (ue[ce[Me]] = v[ce[Me]]);
    }
    return ue;
  }(n, ["lang", "prefilledEmail", "prefilledUsername", "globalOptions", "createWebauthnAbortSignal", "nonce"]);
  const { hanko: l, injectStyles: d, hidePasskeyButtonOnLogin: u, translations: _, translationsLocation: f, fallbackLanguage: w } = a;
  l.setLang((e == null ? void 0 : e.toString()) || w);
  const y = (0, g.useRef)(null), S = (0, g.useMemo)(() => `${a.storageKey}_last_login`, [a.storageKey]), [C, T] = (0, g.useState)(h.componentName), [E, $] = (0, g.useState)((t = h.mode) !== null && t !== void 0 ? t : "login"), L = (0, g.useRef)(!1), [N, F] = (0, g.useState)(!1), B = (0, g.useMemo)(() => ({ auth: E, login: "login", registration: "registration", profile: "profile", events: null }), [E]), V = (0, g.useMemo)(() => r(na, {}), []), [ee, U] = (0, g.useState)(V), [, ge] = (0, g.useState)(l), [De, xe] = (0, g.useState)(), [Pe, te] = (0, g.useState)({ email: o, username: i }), se = function(v, M) {
    var ue;
    (ue = y.current) === null || ue === void 0 || ue.dispatchEvent(new CustomEvent(v, { detail: M, bubbles: !1, composed: !0 }));
  }, pe = (0, g.useCallback)((v) => B[C] == v.flowName, [B, C, E]), Xe = (v) => {
    U(r(Fo, { error: v instanceof ke ? v : new Ve(v) }));
  };
  (0, g.useMemo)(() => l.onBeforeStateChange(({ state: v }) => {
    pe(v) && te((M) => Object.assign(Object.assign({}, M), { isDisabled: !0, error: void 0 }));
  }), [l, pe]), (0, g.useEffect)(() => {
    te((v) => Object.assign(Object.assign(Object.assign({}, v), o && { email: o }), i && { username: i }));
  }, [o, i]), (0, g.useEffect)(() => l.onAfterStateChange(({ state: v }) => Vo(void 0, void 0, void 0, function* () {
    var M;
    if (pe(v)) switch (["onboarding_verify_passkey_attestation", "webauthn_credential_verification", "login_passkey", "thirdparty"].includes(v.name) || te((ue) => Object.assign(Object.assign({}, ue), { isDisabled: !1 })), v.name) {
      case "login_init":
        U(r(oa, { state: v })), v.passkeyAutofillActivation();
        break;
      case "passcode_confirmation":
        U(r(ra, { state: v }));
        break;
      case "login_otp":
        U(r(Aa, { state: v }));
        break;
      case "onboarding_create_passkey":
        U(r(aa, { state: v }));
        break;
      case "login_password":
        U(r(sa, { state: v }));
        break;
      case "login_password_recovery":
        U(r(ca, { state: v }));
        break;
      case "login_security_key":
        U(r(Oa, { state: v }));
        break;
      case "mfa_method_chooser":
        U(r(Ea, { state: v }));
        break;
      case "mfa_otp_secret_creation":
        U(r($a, { state: v }));
        break;
      case "mfa_security_key_creation":
        U(r(Da, { state: v }));
        break;
      case "login_method_chooser":
        U(r(la, { state: v }));
        break;
      case "registration_init":
        U(r(da, { state: v }));
        break;
      case "password_creation":
        U(r(ha, { state: v }));
        break;
      case "success":
        !((M = v.payload) === null || M === void 0) && M.last_login && localStorage.setItem(S, JSON.stringify(v.payload.last_login)), v.autoStep();
        break;
      case "profile_init":
        U(r(wa, { state: v, enablePasskeys: a.enablePasskeys }));
        break;
      case "error":
        U(r(Fo, { state: v }));
        break;
      case "onboarding_email":
        U(r(Sa, { state: v }));
        break;
      case "onboarding_username":
        U(r(xa, { state: v }));
        break;
      case "credential_onboarding_chooser":
        U(r(Ca, { state: v }));
        break;
      case "device_trust":
        U(r(Ta, { state: v }));
    }
  })), [C, B]);
  const j = (0, g.useCallback)((v) => Vo(void 0, void 0, void 0, function* () {
    te((ce) => Object.assign(Object.assign({}, ce), { isDisabled: !0 }));
    const M = localStorage.getItem(S);
    M && xe(JSON.parse(M));
    const ue = { excludeAutoSteps: ["success"], cacheKey: "hanko-auth-flow-state", dispatchAfterStateChangeEvent: !1 };
    if (new URLSearchParams(window.location.search).get("saml_hint") === "idp_initiated") $("token_exchange"), yield l.createState("token_exchange", Object.assign(Object.assign({}, ue), { dispatchAfterStateChangeEvent: !0 }));
    else {
      const ce = yield l.createState(v, ue);
      $(ce.flowName), setTimeout(() => ce.dispatchAfterStateChangeEvent(), 500);
    }
  }), []), P = (0, g.useCallback)((v) => {
    T(v);
    const M = B[v];
    M && j(M).catch(Xe);
  }, [B]);
  return (0, g.useEffect)(() => {
    if (!L.current) {
      const v = setTimeout(() => {
        var M;
        $((M = h.mode) !== null && M !== void 0 ? M : "login"), F(!0);
      }, 0);
      return () => clearTimeout(v);
    }
  }, [h.mode]), (0, g.useEffect)(() => {
    N && !L.current && (L.current = !0, P(C));
  }, [N, E, C, P]), (0, g.useEffect)(() => {
    l.onUserDeleted(() => {
      se("onUserDeleted");
    }), l.onSessionCreated((v) => {
      se("onSessionCreated", v);
    }), l.onSessionExpired(() => {
      se("onSessionExpired");
    }), l.onUserLoggedOut(() => {
      se("onUserLoggedOut");
    }), l.onBeforeStateChange((v) => {
      se("onBeforeStateChange", v);
    }), l.onAfterStateChange((v) => {
      se("onAfterStateChange", v);
    });
  }, [l]), (0, g.useMemo)(() => {
    const v = () => {
      P(C);
    };
    ["auth", "login", "registration"].includes(C) ? (l.onUserLoggedOut(v), l.onSessionExpired(v), l.onUserDeleted(v)) : C === "profile" && l.onSessionCreated(v);
  }, [C, l, P]), r($e.Provider, Object.assign({ value: { init: P, initialComponentName: h.componentName, setUIState: te, uiState: Pe, hanko: l, setHanko: ge, lang: (e == null ? void 0 : e.toString()) || w, prefilledEmail: o, prefilledUsername: i, componentName: C, setComponentName: T, hidePasskeyButtonOnLogin: u, page: ee, setPage: U, lastLogin: De, isOwnFlow: pe } }, { children: r(z.TranslateProvider, Object.assign({ translations: _, fallbackLang: w, root: f }, { children: r(Ur, Object.assign({ ref: y }, { children: C !== "events" ? r(x.Fragment, { children: [d ? r("style", { nonce: c || void 0, dangerouslySetInnerHTML: { __html: window._hankoStyle.innerHTML } }) : null, ee] }) : null })) })) }));
}, Na = { en: Z(6).en };
var Ei = function(n, t, e, o) {
  return new (e || (e = Promise))(function(i, a) {
    function s(l) {
      try {
        h(o.next(l));
      } catch (d) {
        a(d);
      }
    }
    function c(l) {
      try {
        h(o.throw(l));
      } catch (d) {
        a(d);
      }
    }
    function h(l) {
      var d;
      l.done ? i(l.value) : (d = l.value, d instanceof e ? d : new e(function(u) {
        u(d);
      })).then(s, c);
    }
    h((o = o.apply(n, [])).next());
  });
};
const Ke = {}, Ut = (n, t) => {
  var e;
  const o = (e = document.getElementsByTagName(`hanko-${n}`).item(0)) === null || e === void 0 ? void 0 : e.nonce;
  return r(La, Object.assign({ componentName: n, globalOptions: Ke, createWebauthnAbortSignal: Fa }, t, { nonce: o }));
}, Ua = (n) => Ut("auth", n), Ma = (n) => Ut("login", n), Ra = (n) => Ut("registration", n), Ha = (n) => Ut("profile", n), Wa = (n) => Ut("events", n);
let Vt = new AbortController();
const Fa = () => (Vt && Vt.abort(), Vt = new AbortController(), Vt.signal), Ct = ({ tagName: n, entryComponent: t, shadow: e = !0, observedAttributes: o }) => Ei(void 0, void 0, void 0, function* () {
  customElements.get(n) || function(i, a, s, c) {
    function h() {
      var l = Reflect.construct(HTMLElement, [], h);
      return l._vdomComponent = i, l._root = c && c.shadow ? l.attachShadow({ mode: "open" }) : l, l;
    }
    (h.prototype = Object.create(HTMLElement.prototype)).constructor = h, h.prototype.connectedCallback = sr, h.prototype.attributeChangedCallback = cr, h.prototype.disconnectedCallback = lr, s = s || i.observedAttributes || Object.keys(i.propTypes || {}), h.observedAttributes = s, s.forEach(function(l) {
      Object.defineProperty(h.prototype, l, { get: function() {
        var d, u, _, f;
        return (d = (u = this._vdom) == null || (_ = u.props) == null ? void 0 : _[l]) != null ? d : (f = this._props) == null ? void 0 : f[l];
      }, set: function(d) {
        this._vdom ? this.attributeChangedCallback(l, null, d) : (this._props || (this._props = {}), this._props[l] = d, this.connectedCallback());
        var u = typeof d;
        d != null && u !== "string" && u !== "boolean" && u !== "number" || this.setAttribute(l, d);
      } });
    }), customElements.define(a || i.tagName || i.displayName || i.name, h);
  }(t, n, o, { shadow: e });
}), za = (n, t = {}) => Ei(void 0, void 0, void 0, function* () {
  const e = ["api", "lang", "prefilled-email", "entry", "mode"];
  return t = Object.assign({ shadow: !0, injectStyles: !0, enablePasskeys: !0, hidePasskeyButtonOnLogin: !1, translations: null, translationsLocation: "/i18n", fallbackLanguage: "en", storageKey: "hanko", sessionCheckInterval: 3e4 }, t), Ke.hanko = new Si(n, { cookieName: t.storageKey, cookieDomain: t.cookieDomain, cookieSameSite: t.cookieSameSite, localStorageKey: t.storageKey, sessionCheckInterval: t.sessionCheckInterval, sessionTokenLocation: t.sessionTokenLocation }), Ke.injectStyles = t.injectStyles, Ke.enablePasskeys = t.enablePasskeys, Ke.hidePasskeyButtonOnLogin = t.hidePasskeyButtonOnLogin, Ke.translations = t.translations || Na, Ke.translationsLocation = t.translationsLocation, Ke.fallbackLanguage = t.fallbackLanguage, Ke.storageKey = t.storageKey, yield Promise.all([Ct(Object.assign(Object.assign({}, t), { tagName: "hanko-auth", entryComponent: Ua, observedAttributes: e })), Ct(Object.assign(Object.assign({}, t), { tagName: "hanko-login", entryComponent: Ma, observedAttributes: e })), Ct(Object.assign(Object.assign({}, t), { tagName: "hanko-registration", entryComponent: Ra, observedAttributes: e })), Ct(Object.assign(Object.assign({}, t), { tagName: "hanko-profile", entryComponent: Ha, observedAttributes: e.filter((o) => ["api", "lang"].includes(o)) })), Ct(Object.assign(Object.assign({}, t), { tagName: "hanko-events", entryComponent: Wa, observedAttributes: [] }))]), { hanko: Ke.hanko };
});
X.rc;
X.Kj;
X.fK;
X.tJ;
X.Z7;
X.qQ;
var qa = X.I4;
X.O8;
X.Qq;
X.ku;
X.ls;
X.bO;
X.yv;
X.AT;
X.m_;
X.KG;
X.Wj;
X.DH;
X.kf;
X.Uw;
X.oY;
X.Wg;
X.AC;
X.D_;
X.jx;
X.nX;
X.Nx;
X.Sd;
var Pi = X.kz;
X.fX;
X.qA;
X.tz;
X.gN;
const Ka = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Hanko: qa,
  register: Pi
}, Symbol.toStringTag, { value: "Module" }));
var En = "";
function Zo(n) {
  En = n;
}
function Ba(n = "") {
  if (!En) {
    const t = document.querySelector("[data-webawesome]");
    if (t != null && t.hasAttribute("data-webawesome")) {
      const e = new URL(t.getAttribute("data-webawesome") ?? "", window.location.href).pathname;
      Zo(e);
    } else {
      const o = [...document.getElementsByTagName("script")].find(
        (i) => i.src.endsWith("webawesome.js") || i.src.endsWith("webawesome.loader.js") || i.src.endsWith("webawesome.ssr-loader.js")
      );
      if (o) {
        const i = String(o.getAttribute("src"));
        Zo(i.split("/").slice(0, -1).join("/"));
      }
    }
  }
  return En.replace(/\/$/, "") + (n ? `/${n.replace(/^\//, "")}` : "");
}
new MutationObserver((n) => {
  for (const { addedNodes: t } of n)
    for (const e of t)
      e.nodeType === Node.ELEMENT_NODE && Va(e);
});
async function Va(n) {
  const t = n instanceof Element ? n.tagName.toLowerCase() : "", e = t == null ? void 0 : t.startsWith("wa-"), o = [...n.querySelectorAll(":not(:defined)")].map((s) => s.tagName.toLowerCase()).filter((s) => s.startsWith("wa-"));
  e && !customElements.get(t) && o.push(t);
  const i = [...new Set(o)], a = await Promise.allSettled(i.map((s) => Za(s)));
  for (const s of a)
    s.status === "rejected" && console.warn(s.reason);
  await new Promise(requestAnimationFrame), n.dispatchEvent(
    new CustomEvent("wa-discovery-complete", {
      bubbles: !1,
      cancelable: !1,
      composed: !0
    })
  );
}
function Za(n) {
  if (customElements.get(n))
    return Promise.resolve();
  const t = n.replace(/^wa-/i, ""), e = Ba(`components/${t}/${t}.js`);
  return new Promise((o, i) => {
    import(e).then(() => o()).catch(() => i(new Error(`Unable to autoload <${n}> from ${e}`)));
  });
}
const Ja = /* @__PURE__ */ new Set(), Zt = /* @__PURE__ */ new Map(), Ii = typeof MutationObserver < "u" && typeof document < "u" && typeof document.documentElement < "u";
if (Ii) {
  const n = new MutationObserver($i);
  document.documentElement.dir, document.documentElement.lang || navigator.language, n.observe(document.documentElement, {
    attributes: !0,
    attributeFilter: ["dir", "lang"]
  });
}
function ji(...n) {
  n.map((t) => {
    const e = t.$code.toLowerCase();
    Zt.has(e) ? Zt.set(e, Object.assign(Object.assign({}, Zt.get(e)), t)) : Zt.set(e, t);
  }), $i();
}
function $i() {
  Ii && (document.documentElement.dir, document.documentElement.lang || navigator.language), [...Ja.keys()].map((n) => {
    typeof n.requestUpdate == "function" && n.requestUpdate();
  });
}
var Di = {
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
  goToSlide: (n, t) => `Go to slide ${n} of ${t}`,
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
ji(Di);
var Qa = Di;
ji(Qa);
var Ga = Object.defineProperty, Ya = Object.getOwnPropertyDescriptor, me = (n, t, e, o) => {
  for (var i = o > 1 ? void 0 : o ? Ya(t, e) : t, a = n.length - 1, s; a >= 0; a--)
    (s = n[a]) && (i = (o ? s(t, e, i) : s(i)) || i);
  return o && i && Ga(t, e, i), i;
};
const oe = {
  primary: null,
  // The primary instance that makes API calls
  user: null,
  osmConnected: !1,
  osmData: null,
  loading: !0,
  hanko: null,
  initialized: !1,
  instances: /* @__PURE__ */ new Set(),
  profileDisplayName: ""
  // Shared profile display name
}, Jo = (n) => `hanko-verified-${n}`, Qo = (n) => `hanko-onboarding-${n}`;
let he = class extends Pt {
  constructor() {
    super(...arguments), this.hankoUrlAttr = "", this.basePath = "", this.authPath = "/api/auth/osm", this.osmRequired = !1, this.osmScopes = "read_prefs", this.showProfile = !1, this.redirectAfterLogin = "", this.autoConnect = !1, this.verifySession = !1, this.redirectAfterLogout = "", this.displayNameAttr = "", this.mappingCheckUrl = "", this.appId = "", this.loginUrl = "", this.user = null, this.osmConnected = !1, this.osmData = null, this.osmLoading = !1, this.loading = !0, this.error = null, this.profileDisplayName = "", this.hasAppMapping = !1, this._trailingSlashCache = {}, this._debugMode = !1, this._lastSessionId = null, this._hanko = null, this._isPrimary = !1, this._handleVisibilityChange = () => {
      this._isPrimary && !document.hidden && !this.showProfile && !this.user && (this.log("👁️ Page visible, re-checking session..."), this.checkSession());
    }, this._handleWindowFocus = () => {
      this._isPrimary && !this.showProfile && !this.user && (this.log("🎯 Window focused, re-checking session..."), this.checkSession());
    }, this._handleExternalLogin = (n) => {
      var e;
      if (!this._isPrimary) return;
      const t = n;
      !this.showProfile && !this.user && ((e = t.detail) != null && e.user) && (this.log("🔔 External login detected, updating user state..."), this.user = t.detail.user, this._broadcastState(), this.osmRequired && this.checkOSMConnection());
    };
  }
  // Get computed hankoUrl (priority: attribute > meta tag > window.HANKO_URL > origin)
  get hankoUrl() {
    if (this.hankoUrlAttr)
      return this.hankoUrlAttr;
    const n = document.querySelector('meta[name="hanko-url"]');
    if (n) {
      const e = n.getAttribute("content");
      if (e)
        return this.log("🔍 hanko-url auto-detected from <meta> tag:", e), e;
    }
    if (window.HANKO_URL)
      return this.log(
        "🔍 hanko-url auto-detected from window.HANKO_URL:",
        window.HANKO_URL
      ), window.HANKO_URL;
    const t = window.location.origin;
    return this.log("🔍 hanko-url auto-detected from window.location.origin:", t), t;
  }
  connectedCallback() {
    super.connectedCallback(), this._debugMode = this._checkDebugMode(), this.log("🔌 hanko-auth connectedCallback called"), oe.instances.add(this), document.addEventListener("visibilitychange", this._handleVisibilityChange), window.addEventListener("focus", this._handleWindowFocus), document.addEventListener("hanko-login", this._handleExternalLogin);
  }
  // Use firstUpdated instead of connectedCallback to ensure React props are set
  firstUpdated() {
    this.log("🔌 hanko-auth firstUpdated called"), this.log("  hankoUrl:", this.hankoUrl), this.log("  basePath:", this.basePath), oe.initialized || oe.primary ? (this.log("🔄 Using shared state from primary instance"), this._syncFromShared(), this._isPrimary = !1) : (this.log("👑 This is the primary instance"), this._isPrimary = !0, oe.primary = this, oe.initialized = !0, this.init());
  }
  disconnectedCallback() {
    if (super.disconnectedCallback(), document.removeEventListener(
      "visibilitychange",
      this._handleVisibilityChange
    ), window.removeEventListener("focus", this._handleWindowFocus), document.removeEventListener("hanko-login", this._handleExternalLogin), oe.instances.delete(this), this._isPrimary && oe.instances.size > 0) {
      const n = oe.instances.values().next().value;
      n && (this.log("👑 Promoting new primary instance"), n._isPrimary = !0, oe.primary = n);
    }
    oe.instances.size === 0 && (oe.initialized = !1, oe.primary = null);
  }
  // Sync local state from shared state (only if values changed to prevent render loops)
  _syncFromShared() {
    this.user !== oe.user && (this.user = oe.user), this.osmConnected !== oe.osmConnected && (this.osmConnected = oe.osmConnected), this.osmData !== oe.osmData && (this.osmData = oe.osmData), this.loading !== oe.loading && (this.loading = oe.loading), this._hanko !== oe.hanko && (this._hanko = oe.hanko), this.profileDisplayName !== oe.profileDisplayName && (this.profileDisplayName = oe.profileDisplayName);
  }
  // Update shared state and broadcast to all instances
  _broadcastState() {
    oe.user = this.user, oe.osmConnected = this.osmConnected, oe.osmData = this.osmData, oe.loading = this.loading, oe.profileDisplayName = this.profileDisplayName, oe.instances.forEach((n) => {
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
  addTrailingSlash(n, t) {
    const e = this._trailingSlashCache[t];
    return e !== void 0 && e && !n.endsWith("/") ? n + "/" : n;
  }
  async init() {
    if (!this._isPrimary) {
      this.log("⏭️ Not primary, skipping init...");
      return;
    }
    try {
      await Pi(this.hankoUrl, {
        enablePasskeys: !1,
        hidePasskeyButtonOnLogin: !0
      });
      const { Hanko: n } = await Promise.resolve().then(() => Ka), t = window.location.hostname, o = t === "localhost" || t === "127.0.0.1" ? {} : {
        cookieDomain: ".hotosm.org",
        cookieName: "hanko",
        cookieSameSite: "lax"
      };
      this._hanko = new n(this.hankoUrl, o), oe.hanko = this._hanko, this._hanko.onSessionExpired(() => {
        this.log("🕒 Hanko session expired event received"), this.handleSessionExpired();
      }), this._hanko.onUserLoggedOut(() => {
        this.log("🚪 Hanko user logged out event received"), this.handleUserLoggedOut();
      }), await this.checkSession(), this.user && (this.osmRequired && await this.checkOSMConnection(), await this.fetchProfileDisplayName()), this.loading = !1, this._broadcastState(), this.setupEventListeners();
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
          const t = await n.json();
          if (t.is_valid === !1) {
            this.log(
              "ℹ️ Session validation returned is_valid:false - no valid session"
            );
            return;
          }
          this.log("✅ Valid Hanko session found via cookie"), this.log("📋 Session data:", t);
          try {
            const e = await fetch(`${this.hankoUrl}/me`, {
              method: "GET",
              credentials: "include",
              // Include httpOnly cookies
              headers: {
                "Content-Type": "application/json"
              }
            });
            let o = !0;
            if (e.ok) {
              const i = await e.json();
              this.log("👤 User data retrieved from /me:", i), i.email ? (this.user = {
                id: i.user_id || i.id,
                email: i.email,
                username: i.username || null,
                emailVerified: i.email_verified || i.verified || !1
              }, o = !1) : this.log("⚠️ /me has no email, will use SDK fallback");
            }
            if (o) {
              this.log("🔄 Using SDK to get user with email");
              const i = await this._hanko.user.getCurrent();
              this.user = {
                id: i.id,
                email: i.email,
                username: i.username,
                emailVerified: i.email_verified || !1
              };
            }
          } catch (e) {
            this.log("⚠️ Failed to get user data:", e), t.user_id && (this.user = {
              id: t.user_id,
              email: t.email || null,
              username: null,
              emailVerified: !1
            });
          }
          if (this.user) {
            const e = Jo(window.location.hostname), o = sessionStorage.getItem(e);
            if (this.verifySession && this.redirectAfterLogin && !o) {
              this.log(
                "🔄 verify-session enabled, redirecting to callback for app verification..."
              ), sessionStorage.setItem(e, "true"), window.location.href = this.redirectAfterLogin;
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
            ), this.osmRequired && await this.checkOSMConnection(), await this.fetchProfileDisplayName(), this.osmRequired && this.autoConnect && !this.osmConnected && (this.log(
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
  async checkOSMConnection() {
    if (this.osmConnected) {
      this.log("⏭️ Already connected to OSM, skipping check");
      return;
    }
    const n = this.loading;
    n || (this.osmLoading = !0);
    try {
      const t = this.getBasePath(), e = this.authPath, i = `${`${t}${e}/status`}`;
      this.log("🔍 Checking OSM connection at:", i), this.log("  basePath:", t), this.log("  authPath:", e), this.log("🍪 Current cookies:", document.cookie);
      const a = await fetch(i, {
        credentials: "include",
        redirect: "follow"
      });
      if (this.log("📡 OSM status response:", a.status), this.log("📡 Final URL after redirects:", a.url), this.log("📡 Response headers:", [...a.headers.entries()]), a.ok) {
        const s = await a.text();
        this.log("📡 OSM raw response:", s.substring(0, 200));
        let c;
        try {
          c = JSON.parse(s);
        } catch {
          throw this.logError(
            "Failed to parse OSM response as JSON:",
            s.substring(0, 500)
          ), new Error("Invalid JSON response from OSM status endpoint");
        }
        this.log("📡 OSM status data:", c), c.connected ? (this.log("✅ OSM is connected:", c.osm_username), this.osmConnected = !0, this.osmData = c, this.dispatchEvent(
          new CustomEvent("osm-connected", {
            detail: { osmData: c },
            bubbles: !0,
            composed: !0
          })
        )) : (this.log("❌ OSM is NOT connected"), this.osmConnected = !1, this.osmData = null);
      }
    } catch (t) {
      this.logError("OSM connection check failed:", t);
    } finally {
      n || (this.osmLoading = !1), this._isPrimary && this._broadcastState();
    }
  }
  // Check app mapping status (for cross-app auth scenarios)
  // Only used when mapping-check-url is configured
  async checkAppMapping() {
    if (!this.mappingCheckUrl || !this.user)
      return !0;
    const n = Qo(window.location.hostname), t = sessionStorage.getItem(n);
    this.log("🔍 Checking app mapping at:", this.mappingCheckUrl);
    try {
      const e = await fetch(this.mappingCheckUrl, {
        credentials: "include"
      });
      if (e.ok) {
        const o = await e.json();
        if (this.log("📡 Mapping check response:", o), o.needs_onboarding) {
          if (t)
            return this.log("⚠️ Already tried onboarding this session, skipping redirect"), !0;
          this.log("⚠️ User needs onboarding, redirecting..."), sessionStorage.setItem(n, "true");
          const i = encodeURIComponent(window.location.origin), a = this.appId ? `onboarding=${this.appId}` : "";
          return window.location.href = `${this.hankoUrl}/app?${a}&return_to=${i}`, !1;
        }
        return sessionStorage.removeItem(n), this.hasAppMapping = !0, this.log("✅ User has app mapping"), !0;
      } else if (e.status === 401 || e.status === 403) {
        if (t)
          return this.log("⚠️ Already tried onboarding this session, skipping redirect"), !0;
        this.log("⚠️ 401/403 - User needs onboarding, redirecting..."), sessionStorage.setItem(n, "true");
        const o = encodeURIComponent(window.location.origin), i = this.appId ? `onboarding=${this.appId}` : "";
        return window.location.href = `${this.hankoUrl}/app?${i}&return_to=${o}`, !1;
      }
      return this.log("⚠️ Unexpected status from mapping check:", e.status), !0;
    } catch (e) {
      return this.log("⚠️ App mapping check failed:", e), !0;
    }
  }
  // Fetch profile display name from login backend
  async fetchProfileDisplayName() {
    try {
      const n = `${this.hankoUrl}/api/profile/me`;
      this.log("👤 Fetching profile from:", n);
      const t = await fetch(n, {
        credentials: "include"
      });
      if (t.ok) {
        const e = await t.json();
        this.log("👤 Profile data:", e), (e.first_name || e.last_name) && (this.profileDisplayName = `${e.first_name || ""} ${e.last_name || ""}`.trim(), this.log("👤 Display name set to:", this.profileDisplayName));
      }
    } catch (n) {
      this.log("⚠️ Could not fetch profile:", n);
    }
  }
  setupEventListeners() {
    this.updateComplete.then(() => {
      var t;
      const n = (t = this.shadowRoot) == null ? void 0 : t.querySelector("hanko-auth");
      n && (n.addEventListener("onSessionCreated", (e) => {
        var i, a;
        this.log("🎯 Hanko event: onSessionCreated", e.detail);
        const o = (a = (i = e.detail) == null ? void 0 : i.claims) == null ? void 0 : a.session_id;
        if (o && this._lastSessionId === o) {
          this.log("⏭️ Skipping duplicate session event");
          return;
        }
        this._lastSessionId = o, this.handleHankoSuccess(e);
      }), n.addEventListener(
        "hankoAuthLogout",
        () => this.handleLogout()
      ));
    });
  }
  async handleHankoSuccess(n) {
    var o;
    if (this.log("Hanko auth success:", n.detail), !this._hanko) {
      this.logError("Hanko instance not initialized");
      return;
    }
    let t = !1;
    try {
      const i = new AbortController(), a = setTimeout(() => i.abort(), 5e3), s = await fetch(`${this.hankoUrl}/me`, {
        method: "GET",
        credentials: "include",
        // Include httpOnly cookies
        headers: {
          "Content-Type": "application/json"
        },
        signal: i.signal
      });
      if (clearTimeout(a), s.ok) {
        const c = await s.json();
        this.log("👤 User data retrieved from /me:", c), c.email ? (this.user = {
          id: c.user_id || c.id,
          email: c.email,
          username: c.username || null,
          emailVerified: c.email_verified || c.verified || !1
        }, t = !0) : this.log("⚠️ /me has no email, will try SDK fallback");
      } else
        this.log("⚠️ /me endpoint returned non-OK status, will try SDK fallback");
    } catch (i) {
      this.log("⚠️ /me endpoint fetch failed (timeout or cross-origin TLS issue):", i);
    }
    if (!t)
      try {
        this.log("🔄 Trying SDK fallback for user info...");
        const i = new Promise(
          (s, c) => setTimeout(() => c(new Error("SDK timeout")), 5e3)
        ), a = await Promise.race([
          this._hanko.user.getCurrent(),
          i
        ]);
        this.user = {
          id: a.id,
          email: a.email,
          username: a.username,
          emailVerified: a.email_verified || !1
        }, t = !0, this.log("✅ User info retrieved via SDK fallback");
      } catch (i) {
        this.log("⚠️ SDK fallback failed, trying JWT claims:", i);
        try {
          const a = (o = n.detail) == null ? void 0 : o.claims;
          if (a != null && a.sub)
            this.user = {
              id: a.sub,
              email: a.email || null,
              username: null,
              emailVerified: a.email_verified || !1
            }, t = !0, this.log("✅ User info extracted from JWT claims");
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
    ), this.osmRequired && await this.checkOSMConnection(), await this.fetchProfileDisplayName(), this.osmRequired && this.autoConnect && !this.osmConnected) {
      this.log("🔄 Auto-connecting to OSM..."), this.handleOSMConnect();
      return;
    }
    const e = !this.osmRequired || this.osmConnected;
    this.log(
      "🔄 Checking redirect-after-login:",
      this.redirectAfterLogin,
      "showProfile:",
      this.showProfile,
      "canRedirect:",
      e
    ), e ? (this.dispatchEvent(
      new CustomEvent("auth-complete", {
        bubbles: !0,
        composed: !0
      })
    ), this.redirectAfterLogin ? (this.log("✅ Redirecting to:", this.redirectAfterLogin), window.location.href = this.redirectAfterLogin) : this.log("❌ No redirect (redirectAfterLogin not set)")) : this.log("⏸️ Waiting for OSM connection before redirect");
  }
  async handleOSMConnect() {
    const n = this.osmScopes.split(" ").join("+"), t = this.getBasePath(), e = this.authPath, i = `${`${t}${e}/login`}?scopes=${n}`;
    this.log("🔗 OSM Connect clicked!"), this.log("  basePath:", t), this.log("  authPath:", e), this.log("  Login path:", i), this.log("  Fetching redirect URL from backend...");
    try {
      const a = await fetch(i, {
        method: "GET",
        credentials: "include",
        redirect: "manual"
        // Don't follow redirect, we'll do it manually
      });
      if (this.log("  Response status:", a.status), this.log("  Response type:", a.type), a.status === 0 || a.type === "opaqueredirect") {
        const s = a.headers.get("Location") || a.url;
        this.log("  ✅ Got redirect URL:", s), window.location.href = s;
      } else if (a.status >= 300 && a.status < 400) {
        const s = a.headers.get("Location");
        this.log("  ✅ Got redirect URL from header:", s), s && (window.location.href = s);
      } else {
        this.logError("  ❌ Unexpected response:", a.status);
        const s = await a.text();
        this.logError("  Response body:", s.substring(0, 200));
      }
    } catch (a) {
      this.logError("  ❌ Failed to fetch redirect URL:", a);
    }
  }
  async handleLogout() {
    this.log("🚪 Logout initiated"), this.log("📊 Current state before logout:", {
      user: this.user,
      osmConnected: this.osmConnected,
      osmData: this.osmData
    }), this.log("🍪 Cookies before logout:", document.cookie);
    try {
      const n = this.getBasePath(), t = this.authPath, e = `${n}${t}/disconnect`, o = e.startsWith("http") ? e : `${window.location.origin}${e}`;
      this.log("🔌 Calling OSM disconnect:", o);
      const i = await fetch(o, {
        method: "POST",
        credentials: "include"
      });
      this.log("📡 Disconnect response status:", i.status);
      const a = await i.json();
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
    const t = Jo(n), e = Qo(n);
    sessionStorage.removeItem(t), sessionStorage.removeItem(e), this.log("🔄 Session flags cleared"), this.user = null, this.osmConnected = !1, this.osmData = null, this.hasAppMapping = !1, this._isPrimary && this._broadcastState(), this.dispatchEvent(
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
      const n = this.getBasePath(), t = this.authPath, e = `${n}${t}/disconnect`, o = e.startsWith("http") ? e : `${window.location.origin}${e}`;
      this.log(
        "🔌 Calling OSM disconnect (session expired):",
        o
      );
      const i = await fetch(o, {
        method: "POST",
        credentials: "include"
      });
      this.log("📡 Disconnect response status:", i.status);
      const a = await i.json();
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
    const t = n.detail.item.value;
    if (this.log("🎯 Dropdown item selected:", t), t === "profile") {
      const e = this.hankoUrl, o = this.redirectAfterLogin || window.location.origin;
      window.location.href = `${e}/app/profile?return_to=${encodeURIComponent(o)}`;
    } else if (t === "connect-osm") {
      const i = window.location.pathname.includes("/app") ? window.location.origin : window.location.href, a = this.hankoUrl;
      window.location.href = `${a}/app?return_to=${encodeURIComponent(
        i
      )}&osm_required=true`;
    } else t === "logout" && this.handleLogout();
  }
  handleSkipOSM() {
    this.dispatchEvent(new CustomEvent("osm-skipped")), this.dispatchEvent(new CustomEvent("auth-complete")), this.redirectAfterLogin && (window.location.href = this.redirectAfterLogin);
  }
  render() {
    var n, t, e;
    if (this.log(
      "🎨 RENDER - showProfile:",
      this.showProfile,
      "user:",
      !!this.user,
      "loading:",
      this.loading
    ), this.loading)
      return Ie`
        <wa-button appearance="plain" size="small" disabled>Log in</wa-button>
      `;
    if (this.error)
      return Ie`
        <div class="container">
          <div class="error">${this.error}</div>
        </div>
      `;
    if (this.user) {
      const o = this.osmRequired && !this.osmConnected && !this.osmLoading, i = this.displayNameAttr || this.profileDisplayName || this.user.username || this.user.email || this.user.id, a = i ? i[0].toUpperCase() : "U";
      return this.showProfile ? Ie`
          <div class="container">
            <div class="profile">
              <div class="profile-header">
                <div class="profile-avatar">${a}</div>
                <div class="profile-info">
                  <div class="profile-name">
                    ${i}
                  </div>
                  <div class="profile-email">
                    ${this.user.email || this.user.id}
                  </div>
                </div>
              </div>

              ${this.osmRequired && this.osmLoading ? Ie`
                    <div class="osm-section">
                      <div class="loading">Checking OSM connection...</div>
                    </div>
                  ` : this.osmRequired && this.osmConnected ? Ie`
                    <div class="osm-section">
                      <div class="osm-connected">
                        <div class="osm-badge">
                          <span class="osm-badge-icon">🗺️</span>
                          <div>
                            <div>Connected to OpenStreetMap</div>
                            ${(n = this.osmData) != null && n.osm_username ? Ie`
                                  <div class="osm-username">
                                    @${this.osmData.osm_username}
                                  </div>
                                ` : ""}
                          </div>
                        </div>
                      </div>
                    </div>
                  ` : ""}
              ${o ? Ie`
                    <div class="osm-section">
                      ${this.autoConnect ? Ie`
                            <div class="osm-connecting">
                              <div class="spinner"></div>
                              <div class="connecting-text">
                                🗺️ Connecting to OpenStreetMap...
                              </div>
                            </div>
                          ` : Ie`
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
        ` : Ie`
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
              <span class="header-avatar">${a}</span>
              ${this.osmConnected ? Ie`
                    <span
                      class="osm-status-badge connected"
                      title="Connected to OSM as @${(t = this.osmData) == null ? void 0 : t.osm_username}"
                      >✓</span
                    >
                  ` : this.osmRequired ? Ie`
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
            ${this.osmRequired ? this.osmConnected ? Ie`
                    <wa-dropdown-item value="osm-connected" disabled>
                      <wa-icon slot="icon" name="check"></wa-icon>
                      Connected to OSM (@${(e = this.osmData) == null ? void 0 : e.osm_username})
                    </wa-dropdown-item>
                  ` : Ie`
                    <wa-dropdown-item value="connect-osm">
                      <wa-icon slot="icon" name="map"></wa-icon>
                      Connect OSM
                    </wa-dropdown-item>
                  ` : ""}
            <wa-dropdown-item value="logout" variant="danger">
              <wa-icon slot="icon" name="right-from-bracket"></wa-icon>
              Sign Out
            </wa-dropdown-item>
          </wa-dropdown>
        `;
    } else {
      if (this.showProfile)
        return Ie`
          <div class="container">
            <hanko-auth></hanko-auth>
          </div>
        `;
      {
        const i = window.location.pathname.includes("/app"), a = this.redirectAfterLogin || (i ? window.location.origin : window.location.href), c = new URLSearchParams(window.location.search).get("auto_connect") === "true" ? "&auto_connect=true" : "", h = this.hankoUrl;
        this.log("🔗 Login URL base:", h);
        const d = `${this.loginUrl || `${h}/app`}?return_to=${encodeURIComponent(
          a
        )}${this.osmRequired ? "&osm_required=true" : ""}${c}`;
        return Ie`<wa-button
          appearance="plain"
          size="small"
          href="${d}"
          >Log in
        </wa-button> `;
      }
    }
  }
};
he.styles = Li`
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
me([
  Te({ type: String, attribute: "hanko-url" })
], he.prototype, "hankoUrlAttr", 2);
me([
  Te({ type: String, attribute: "base-path" })
], he.prototype, "basePath", 2);
me([
  Te({ type: String, attribute: "auth-path" })
], he.prototype, "authPath", 2);
me([
  Te({ type: Boolean, attribute: "osm-required" })
], he.prototype, "osmRequired", 2);
me([
  Te({ type: String, attribute: "osm-scopes" })
], he.prototype, "osmScopes", 2);
me([
  Te({ type: Boolean, attribute: "show-profile" })
], he.prototype, "showProfile", 2);
me([
  Te({ type: String, attribute: "redirect-after-login" })
], he.prototype, "redirectAfterLogin", 2);
me([
  Te({ type: Boolean, attribute: "auto-connect" })
], he.prototype, "autoConnect", 2);
me([
  Te({ type: Boolean, attribute: "verify-session" })
], he.prototype, "verifySession", 2);
me([
  Te({ type: String, attribute: "redirect-after-logout" })
], he.prototype, "redirectAfterLogout", 2);
me([
  Te({ type: String, attribute: "display-name" })
], he.prototype, "displayNameAttr", 2);
me([
  Te({ type: String, attribute: "mapping-check-url" })
], he.prototype, "mappingCheckUrl", 2);
me([
  Te({ type: String, attribute: "app-id" })
], he.prototype, "appId", 2);
me([
  Te({ type: String, attribute: "login-url" })
], he.prototype, "loginUrl", 2);
me([
  nt()
], he.prototype, "user", 2);
me([
  nt()
], he.prototype, "osmConnected", 2);
me([
  nt()
], he.prototype, "osmData", 2);
me([
  nt()
], he.prototype, "osmLoading", 2);
me([
  nt()
], he.prototype, "loading", 2);
me([
  nt()
], he.prototype, "error", 2);
me([
  nt()
], he.prototype, "profileDisplayName", 2);
me([
  nt()
], he.prototype, "hasAppMapping", 2);
he = me([
  er("hotosm-auth")
], he);
export {
  he as HankoAuth
};
