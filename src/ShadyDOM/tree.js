/**
@license
Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

'use strict';

// TODO(sorvell): circular (patch loads tree and tree loads patch)
// for now this is stuck on `utils`
//import {patchNode} from './patch'
import * as utils from './utils'

// native add/remove
let nativeInsertBefore = Element.prototype.insertBefore;
let nativeAppendChild = Element.prototype.appendChild;
let nativeRemoveChild = Element.prototype.removeChild;

/**
 * `tree` is a dom manipulation library used by ShadyDOM to
 * manipulate composed and logical trees.
 */
export let tree = {

  // sad but faster than slice...
  arrayCopyChildNodes: function(parent) {
    let copy=[], i=0;
    for (let n=parent.firstChild; n; n=n.nextSibling) {
      copy[i++] = n;
    }
    return copy;
  },

  arrayCopyChildren: function(parent) {
    let copy=[], i=0;
    for (let n=parent.firstElementChild; n; n=n.nextElementSibling) {
      copy[i++] = n;
    }
    return copy;
  },

  arrayCopy: function(a$) {
    let l = a$.length;
    let copy = new Array(l);
    for (let i=0; i < l; i++) {
      copy[i] = a$[i];
    }
    return copy;
  },

  saveChildNodes: function(node) {
    tree.Logical.saveChildNodes(node);
    if (!tree.Composed.hasParentNode(node)) {
      tree.Composed.saveComposedData(node);
      //tree.Composed.saveParentNode(node);
    }
    tree.Composed.saveChildNodes(node);
  }

};

tree.Logical = {

  hasParentNode: function(node) {
    return Boolean(node.__dom && node.__dom.parentNode);
  },

  hasChildNodes: function(node) {
    return Boolean(node.__dom && node.__dom.childNodes !== undefined);
  },

  getChildNodes: function(node) {
    // note: we're distinguishing here between undefined and false-y:
    // hasChildNodes uses undefined check to see if this element has logical
    // children; the false-y check indicates whether or not we should rebuild
    // the cached childNodes array.
    return this.hasChildNodes(node) ? this._getChildNodes(node) :
      tree.Composed.getChildNodes(node);
  },

  _getChildNodes: function(node) {
    if (!node.__dom.childNodes) {
      node.__dom.childNodes = [];
      for (let n=this.getFirstChild(node); n; n=this.getNextSibling(n)) {
        node.__dom.childNodes.push(n);
      }
    }
    return node.__dom.childNodes;
  },

  // NOTE: __dom can be created under 2 conditions: (1) an element has a
  // logical tree, or (2) an element is in a logical tree. In case (1), the
  // element will store firstChild/lastChild, and in case (2), the element
  // will store parentNode, nextSibling, previousSibling. This means that
  // the mere existence of __dom is not enough to know if the requested
  // logical data is available and instead we do an explicit undefined check.
  getParentNode: function(node) {
    return node.__dom && node.__dom.parentNode !== undefined ?
      node.__dom.parentNode : tree.Composed.getParentNode(node);
  },

  getFirstChild: function(node) {
    return node.__dom && node.__dom.firstChild !== undefined ?
      node.__dom.firstChild : tree.Composed.getFirstChild(node);
  },

  getLastChild: function(node) {
    return node.__dom && node.__dom.lastChild  !== undefined ?
      node.__dom.lastChild : tree.Composed.getLastChild(node);
  },

  getNextSibling: function(node) {
    return node.__dom && node.__dom.nextSibling  !== undefined ?
      node.__dom.nextSibling : tree.Composed.getNextSibling(node);
  },

  getPreviousSibling: function(node) {
    return node.__dom && node.__dom.previousSibling  !== undefined ?
      node.__dom.previousSibling : tree.Composed.getPreviousSibling(node);
  },

  getFirstElementChild: function(node) {
    return node.__dom && node.__dom.firstChild !== undefined ?
      this._getFirstElementChild(node) :
      tree.Composed.getFirstElementChild(node);
  },

  _getFirstElementChild: function(node) {
    let n = node.__dom.firstChild;
    while (n && n.nodeType !== Node.ELEMENT_NODE) {
      n = n.__dom.nextSibling;
    }
    return n;
  },

  getLastElementChild: function(node) {
    return node.__dom && node.__dom.lastChild !== undefined ?
      this._getLastElementChild(node) :
      tree.Composed.getLastElementChild(node);
  },

  _getLastElementChild: function(node) {
    let n = node.__dom.lastChild;
    while (n && n.nodeType !== Node.ELEMENT_NODE) {
      n = n.__dom.previousSibling;
    }
    return n;
  },

  getNextElementSibling: function(node) {
    return node.__dom && node.__dom.nextSibling !== undefined ?
      this._getNextElementSibling(node) :
      tree.Composed.getNextElementSibling(node);
  },

  _getNextElementSibling: function(node) {
    let n = node.__dom.nextSibling;
    while (n && n.nodeType !== Node.ELEMENT_NODE) {
      n = this.getNextSibling(n);
    }
    return n;
  },

  getPreviousElementSibling: function(node) {
    return node.__dom && node.__dom.previousSibling !== undefined ?
      this._getPreviousElementSibling(node) :
      tree.Composed.getPreviousElementSibling(node);
  },

  _getPreviousElementSibling: function(node) {
    let n = node.__dom.previousSibling;
    while (n && n.nodeType !== Node.ELEMENT_NODE) {
      n = this.getPreviousSibling(n);
    }
    return n;
  },

  // Capture the list of light children. It's important to do this before we
  // start transforming the DOM into "rendered" state.
  // Children may be added to this list dynamically. It will be treated as the
  // source of truth for the light children of the element. This element's
  // actual children will be treated as the rendered state once this function
  // has been called.
  saveChildNodes: function(node) {
    if (!this.hasChildNodes(node)) {
      node.__dom = node.__dom || {};
      node.__dom.firstChild = node.firstChild;
      node.__dom.lastChild = node.lastChild;
      let c$ = node.__dom.childNodes = tree.arrayCopyChildNodes(node);
      for (let i=0, n; (i<c$.length) && (n=c$[i]); i++) {
        n.__dom = n.__dom || {};
        n.__dom.parentNode = node;
        n.__dom.nextSibling = c$[i+1] || null;
        n.__dom.previousSibling = c$[i-1] || null;
        utils.common.patchNode(n);
      }
    }
  },

  // TODO(sorvell): may need to patch saveChildNodes iff the tree has
  // already been distributed.
  // NOTE: ensure `node` is patched...
  recordInsertBefore: function(node, container, ref_node) {
    container.__dom.childNodes = null;
    // handle document fragments
    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      let c$ = tree.arrayCopyChildNodes(node);
      for (let i=0; i < c$.length; i++) {
        this._linkNode(c$[i], container, ref_node);
      }
      // cleanup logical dom in doc fragment.
      node.__dom = node.__dom || {};
      node.__dom.firstChild = node.__dom.lastChild = undefined;
      node.__dom.childNodes = null;
    } else {
      this._linkNode(node, container, ref_node);
    }
  },

  _linkNode: function(node, container, ref_node) {
    utils.common.patchNode(node);
    ref_node = ref_node || null;
    node.__dom = node.__dom || {};
    container.__dom = container.__dom || {};
    if (ref_node) {
      ref_node.__dom = ref_node.__dom || {};
    }
    // update ref_node.previousSibling <-> node
    node.__dom.previousSibling = ref_node ? ref_node.__dom.previousSibling :
      container.__dom.lastChild;
    if (node.__dom.previousSibling) {
      node.__dom.previousSibling.__dom.nextSibling = node;
    }
    // update node <-> ref_node
    node.__dom.nextSibling = ref_node;
    if (node.__dom.nextSibling) {
      node.__dom.nextSibling.__dom.previousSibling = node;
    }
    // update node <-> container
    node.__dom.parentNode = container;
    if (ref_node) {
      if (ref_node === container.__dom.firstChild) {
        container.__dom.firstChild = node;
      }
    } else {
      container.__dom.lastChild = node;
      if (!container.__dom.firstChild) {
        container.__dom.firstChild = node;
      }
    }
    // remove caching of childNodes
    container.__dom.childNodes = null;
  },

  recordRemoveChild: function(node, container) {
    node.__dom = node.__dom || {};
    container.__dom = container.__dom || {};
    if (node === container.__dom.firstChild) {
      container.__dom.firstChild = node.__dom.nextSibling;
    }
    if (node === container.__dom.lastChild) {
      container.__dom.lastChild = node.__dom.previousSibling;
    }
    let p = node.__dom.previousSibling;
    let n = node.__dom.nextSibling;
    if (p) {
      p.__dom = p.__dom || {};
      p.__dom.nextSibling = n;
    }
    if (n) {
      n.__dom = n.__dom || {};
      n.__dom.previousSibling = p;
    }
    // When an element is removed, logical data is no longer tracked.
    // Explicitly set `undefined` here to indicate this. This is disginguished
    // from `null` which is set if info is null.
    node.__dom.parentNode = node.__dom.previousSibling =
      node.__dom.nextSibling = undefined;
    // remove caching of childNodes
    container.__dom.childNodes = null;
  }

}


// TODO(sorvell): composed tree manipulation is made available
// (1) to maninpulate the composed tree, and (2) to track changes
// to the tree for optional patching pluggability.
tree.Composed = {

  hasParentNode: function(node) {
    return Boolean(node.__dom && node.__dom.$parentNode !== undefined);
  },

  hasChildNodes: function(node) {
    return Boolean(node.__dom && node.__dom.$childNodes !== undefined);
  },

  getChildNodes: function(node) {
    return this.hasChildNodes(node) ? this._getChildNodes(node) :
      (!node.__patched && tree.arrayCopy(node.childNodes));
  },

  _getChildNodes: function(node) {
    if (!node.__dom.$childNodes) {
      node.__dom.$childNodes = [];
      for (let n=node.__dom.$firstChild; n; n=n.__dom.$nextSibling) {
        node.__dom.$childNodes.push(n);
      }
    }
    return node.__dom.$childNodes;
  },

  getComposedChildNodes: function(node) {
    return node.__dom.$childNodes;
  },

  getParentNode: function(node) {
    return this.hasParentNode(node) ? node.__dom.$parentNode :
      (!node.__patched && node.parentNode);
  },

  getFirstChild: function(node) {
    return node.__patched ? node.__dom.$firstChild : node.firstChild;
  },

  getLastChild: function(node) {
    return node.__patched ? node.__dom.$lastChild : node.lastChild;
  },

  getNextSibling: function(node) {
    return node.__patched ? node.__dom.$nextSibling : node.nextSibling;
  },

  getPreviousSibling: function(node) {
    return node.__patched ? node.__dom.$previousSibling : node.previousSibling;
  },

  getFirstElementChild: function(node) {
    return node.__patched ? this._getFirstElementChild(node) :
      node.firstElementChild;
  },

  _getFirstElementChild: function(node) {
    let n = node.__dom.$firstChild;
    while (n && n.nodeType !== Node.ELEMENT_NODE) {
      n = n.__dom.$nextSibling;
    }
    return n;
  },

  getLastElementChild: function(node) {
    return node.__patched ? this._getLastElementChild(node) :
      node.lastElementChild;
  },

  _getLastElementChild: function(node) {
    let n = node.__dom.$lastChild;
    while (n && n.nodeType !== Node.ELEMENT_NODE) {
      n = n.__dom.$previousSibling;
    }
    return n;
  },

  getNextElementSibling: function(node) {
    return node.__patched ? this._getNextElementSibling(node) :
      node.nextElementSibling;
  },

  _getNextElementSibling: function(node) {
    let n = node.__dom.$nextSibling;
    while (n && n.nodeType !== Node.ELEMENT_NODE) {
      n = this.getNextSibling(n);
    }
    return n;
  },

  getPreviousElementSibling: function(node) {
    return node.__patched ? this._getPreviousElementSibling(node) :
      node.previousElementSibling;
  },

  _getPreviousElementSibling: function(node) {
    let n = node.__dom.$previousSibling;
    while (n && n.nodeType !== Node.ELEMENT_NODE) {
      n = this.getPreviousSibling(n);
    }
    return n;
  },

  saveChildNodes: function(node) {
    if (!this.hasChildNodes(node)) {
      node.__dom = node.__dom || {};
      node.__dom.$firstChild = node.firstChild;
      node.__dom.$lastChild = node.lastChild;
      let c$ = node.__dom.$childNodes = tree.arrayCopyChildNodes(node);
      for (let i=0, n; (i<c$.length) && (n=c$[i]); i++) {
        this.saveComposedData(n);
      }
    }
  },

  saveComposedData: function(node) {
    node.__dom = node.__dom || {};
    if (node.__dom.$parentNode === undefined) {
      node.__dom.$parentNode = node.parentNode;
    }
    if (node.__dom.$nextSibling === undefined) {
      node.__dom.$nextSibling = node.nextSibling;
    }
    if (node.__dom.$previousSibling === undefined) {
      node.__dom.$previousSibling = node.previousSibling;
    }
  },

  recordInsertBefore: function(node, container, ref_node) {
    container.__dom.$childNodes = null;
    // handle document fragments
    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      // TODO(sorvell): remember this for patching:
      // the act of setting this info can affect patched nodes
      // getters; therefore capture childNodes before patching.
      for (let n=this.getFirstChild(node); n; n=this.getNextSibling(n)) {
        this._linkNode(n, container, ref_node);
      }
    } else {
      this._linkNode(node, container, ref_node);
    }
  },

  _linkNode: function(node, container, ref_node) {
    node.__dom = node.__dom || {};
    container.__dom = container.__dom || {};
    if (ref_node) {
      ref_node.__dom = ref_node.__dom || {};
    }
    // update ref_node.previousSibling <-> node
    node.__dom.$previousSibling = ref_node ? ref_node.__dom.$previousSibling :
      container.__dom.$lastChild;
    if (node.__dom.$previousSibling) {
      node.__dom.$previousSibling.__dom.$nextSibling = node;
    }
    // update node <-> ref_node
    node.__dom.$nextSibling = ref_node;
    if (node.__dom.$nextSibling) {
      node.__dom.$nextSibling.__dom.$previousSibling = node;
    }
    // update node <-> container
    node.__dom.$parentNode = container;
    if (ref_node) {
      if (ref_node === container.__dom.$firstChild) {
        container.__dom.$firstChild = node;
      }
    } else {
      container.__dom.$lastChild = node;
      if (!container.__dom.$firstChild) {
        container.__dom.$firstChild = node;
      }
    }
    // remove caching of childNodes
    container.__dom.$childNodes = null;
  },

  recordRemoveChild: function(node, container) {
    node.__dom = node.__dom || {};
    container.__dom = container.__dom || {};
    if (node === container.__dom.$firstChild) {
      container.__dom.$firstChild = node.__dom.$nextSibling;
    }
    if (node === container.__dom.$lastChild) {
      container.__dom.$lastChild = node.__dom.$previousSibling;
    }
    let p = node.__dom.$previousSibling;
    let n = node.__dom.$nextSibling;
    if (p) {
      p.__dom = p.__dom || {};
      p.__dom.$nextSibling = n;
    }
    if (n) {
      n.__dom = n.__dom || {};
      n.__dom.$previousSibling = p;
    }
    node.__dom.$parentNode = node.__dom.$previousSibling =
      node.__dom.$nextSibling = null;
    // remove caching of childNodes
    container.__dom.$childNodes = null;
  },

  clearChildNodes: function(node) {
    let c$ = this.getChildNodes(node);
    for (let i=0, c; i < c$.length; i++) {
      c = c$[i];
      this.recordRemoveChild(c, node);
      nativeRemoveChild.call(node, c)
    }
  },

  saveParentNode: function(node) {
    node.__dom = node.__dom || {};
    node.__dom.$parentNode = node.parentNode;
  },

  insertBefore: function(parentNode, newChild, refChild) {
    this.saveChildNodes(parentNode);
    // remove from current location.
    this._addChild(parentNode, newChild, refChild);
    return nativeInsertBefore.call(parentNode, newChild, refChild || null);
  },

  appendChild: function(parentNode, newChild) {
    this.saveChildNodes(parentNode);
    this._addChild(parentNode, newChild);
    return nativeAppendChild.call(parentNode, newChild);
  },

  removeChild: function(parentNode, node) {
    let currentParent = this.getParentNode(node);
    this.saveChildNodes(parentNode);
    this._removeChild(parentNode, node);
    if (currentParent === parentNode) {
      return nativeRemoveChild.call(parentNode, node);
    }
  },

  _addChild: function(parentNode, newChild, refChild) {
    let isFrag = (newChild.nodeType === Node.DOCUMENT_FRAGMENT_NODE);
    let oldParent = this.getParentNode(newChild);
    if (oldParent) {
      this._removeChild(oldParent, newChild);
    }
    if (isFrag) {
      let c$ = this.getChildNodes(newChild);
      for (let i=0; i < c$.length; i++) {
        let c = c$[i];
        // unlink document fragment children
        this._removeChild(newChild, c);
        this.recordInsertBefore(c, parentNode, refChild);
      }
    } else {
      this.recordInsertBefore(newChild, parentNode, refChild);
    }
  },

  _removeChild: function(parentNode, node) {
    this.recordRemoveChild(node, parentNode);
  }

};

// for testing...
let descriptors = {};
export function getNativeProperty(element, property) {
  if (!descriptors[property]) {
    descriptors[property] = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype, property) ||
    Object.getOwnPropertyDescriptor(
      Element.prototype, property) ||
    Object.getOwnPropertyDescriptor(
      Node.prototype, property);
  }
  return descriptors[property].get.call(element);
}

// for testing...
function assertNative(element, property, tracked) {
  let native = getNativeProperty(element, property);
  if (native != tracked && element.__patched) {
    window.console.warn('tracked', tracked, 'native', native);
  }
  return tracked;
}