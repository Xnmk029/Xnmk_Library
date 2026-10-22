'use strict';
/* 极简 DOM 桩：只为 replay.test.js 提供脚本核心所依赖的最小接口面。
 * 接口对齐真实 DOM 子集：getAttribute/setAttribute/classList/appendChild/
 * textContent 赋值/shadowRoot 字段；文本叶子以 nodeType=3 表示。 */

function ClassList(setRef, ownerAttr) {
  this._set = setRef;
  this._attr = ownerAttr;
}
ClassList.prototype.contains = function (c) { return this._set.has(c); };
ClassList.prototype.add = function (c) {
  this._set.add(c);
  this._attr['class'] = Array.from(this._set).join(' ');
};
ClassList.prototype.remove = function (c) {
  this._set.delete(c);
  this._attr['class'] = Array.from(this._set).join(' ');
};

function El(tag, attrs) {
  this.nodeType = 1;
  this.tagName = String(tag).toUpperCase();
  this.attributes = {};
  this._classes = new Set();
  this.childNodes = [];
  this.parentNode = null;
  this.shadowRoot = null;
  var self = this;
  this.classList = new ClassList(this._classes, this.attributes);
  if (attrs) Object.keys(attrs).forEach(function (k) { self.setAttribute(k, attrs[k]); });
}

Object.defineProperty(El.prototype, 'className', {
  get: function () { return this.attributes['class'] || ''; },
  set: function (v) { this.setAttribute('class', String(v)); }
});

El.prototype.getAttribute = function (name) {
  return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
};
El.prototype.setAttribute = function (name, value) {
  this.attributes[name] = String(value);
  if (name === 'class') {
    var self = this;
    this._classes = new Set(String(value).split(/\s+/).filter(Boolean));
    this.classList = new ClassList(this._classes, this.attributes);
    void self;
  }
};
El.prototype.appendChild = function (child) {
  child.parentNode = this;
  this.childNodes.push(child);
  return child;
};
Object.defineProperty(El.prototype, 'textContent', {
  set: function (txt) {
    var leaf = txtNode(String(txt));
    this.childNodes = [leaf];
    leaf.parentNode = this;
  },
  get: function () {
    // 与脚本内部 getText 不同的独立取值路径：仅用于桩侧断言交叉核验
    function rec(n) {
      if (!n) return '';
      if (n.nodeType === 3) return n.nodeValue || '';
      var out = [];
      (n.childNodes || []).forEach(function (c) { out.push(rec(c)); });
      return out.join('');
    }
    return rec(this);
  }
});

function txtNode(v) { return { nodeType: 3, nodeValue: v, parentNode: null }; }

function make(tag, attrs, text) {
  var n = new El(tag, attrs);
  if (text !== undefined) n.appendChild(txtNode(text));
  return n;
}

function createDocumentShim() {
  return {
    createElement: function (tag) { return make(tag); },
    body: make('body')
  };
}

module.exports = {
  El: El,
  make: make,
  txtNode: txtNode,
  createDocumentShim: createDocumentShim
};
