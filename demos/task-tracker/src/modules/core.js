import { renderTemplate } from './render.js';
import { postProcessConditions } from './process.js';
import { processEventsRecursive, addCustomEvents } from './events.js';
import { processEmbeds, updateEmbeds, clearEmbeds, clearEmbedsFor } from './embeds.js';
import { calcDates } from './time.js';

var as = {
   cache: {},
   components: {},
   hooks: { before: {}, after: {} },
   hints: {},
   add: function(module, scope, key, atomic, val) {
      if (!scope) scope = window;
      var _scope = scope;
      if (scope.toString() == scope && scope !== window) {
         scope = eval(scope);
      }
      if (!val && (scope[module] || typeof scope[module] === 'number')) {
         val = scope[module]
      }
      if (scope == window && !document.all) {
         delete scope[module];
      }
      var self = this;
      
      if (atomic === null || atomic === undefined) {
         atomic = needsAtomic(module, scope, key)
      }
      
      createProxy(val, module, _scope, scope, atomic ? module : null, key)
      
      scope[module] = val;
      return this;
   },
   remove: function(module, scope, key, unset) {
      if (!scope) scope = window;
      var _scope = scope;
      if (scope.toString() == scope && scope !== window) {
         scope = eval(scope);
      }
      key = key || ''
      var val = scope[module];
      delete scope[module];
      if (!unset) scope[module] = val._export();
      var _key = key != '' ? module + '#' + key : module
      delete this.hints[_key];
      clearEmbedsFor(module, scope);
      delete this.events[_key];
      return this;
   },
   pull: function(module, scope, update, url, key) {
      if (!scope) scope = window;
      var _scope = scope;
      if (scope.toString() == scope && scope !== window) {
         scope = eval(scope);
      }
      var data = scope[module.split('.')[0]];
      var els = document.querySelectorAll ? document.querySelectorAll('[asmodel^="' + module + '"]') : document.getElementsByTagName('*');
      for (var i = 0; i < els.length; i++) {
         if (!els[i].tagName.toLowerCase().match(/^(textarea|input)$/)) continue;
         var prop = els[i].getAttribute('asmodel');
         if (prop.match(new RegExp('^' + module + '[a-z0-9$@#_-]', 'i'))) continue;
         
         var el_scope = els[i].getAttribute('asscope')
         if (_scope.toString() == _scope && _scope !== window && el_scope !== null && el_scope != _scope) continue;
         
         if (key != null) {
            var el_key = els[i].getAttribute('askey')
            if (el_key != null && el_key != key && el_key != '*') continue
         }
         
         var s = prop.split('.');
         var val = data;
         for (var j = 1; j < s.length; j++) {
            var is_valid = val instanceof Object && !!s[j].match(/^[a-z][a-z0-9$@#_-]*$/i) ||
                           val instanceof Array && !isNaN(parseInt(s[j]));
            val = is_valid && j < s.length-1 ? val[s[j]] : val;
            if (val == undefined || !is_valid) break;
         }
         var new_val = els[i].type == 'checkbox' || els[i].type == 'radio' ? els[i].checked : els[i].value
         if (new_val.match(/^-?[0-9]+$/)) new_val = parseInt(new_val)
         else if (new_val.match(/^-?[0-9]+(\.[0-9]+)?$/)) new_val = parseFloat(new_val)
         if (els[i].getAttribute('asjson') !== false) {
            try { new_val = JSON.parse(new_val) } catch(ex) { console.log(ex) }
         }
         if (s.length > 1) val[s[s.length-1]] = new_val;
         else scope[module] = new_val;
         if (url) {
            send(url, new_val)
         }
         if (update) {
            render(module, _scope, key)
         }
      }
   },
   update: function(module, scope, key) {
      render(module, scope, key)
   },
   setBefore: function(module, func, scope, key) {
      key = key || ''
      key = key ? module + '#' + key : module
      if (module) this.hooks.before[key] = [func, scope]
      else this.hooks.before['global'] = [func, scope]
   },
   setAfter: function(module, func, scope, key) {
      key = key || ''
      key = key ? module + '#' + key : module
      if (module) this.hooks.after[key] = [func, scope]
      else this.hooks.after['global'] = [func, scope]
   },
   addEvent: function(module_key, scope, selector, type, func, key) {
      if (!scope) scope = 'window'
      if (scope.toString() == scope && scope !== window) {
         scope = eval(scope)
      }
      
      if (!document.querySelectorAll) return
      
      var module = findValue(scope, module_key)
      
      if (type.match(/^on/)) type = type.slice(2)
      if (!type.length || !func) return
      
      if (!as.events[module_key]) as.events[module_key] = []

      var e = { model: module_key, scope: scope, selector: selector, type: type, handler: func, key: key, _handlers: [] }
      as.events[module_key].push(e)
      
      var all_els = document.querySelectorAll('[asmodel="' + module_key + '"]')
      for (var i = 0; i < all_els.length; i++) {
         
         if (e.selector != selector) continue
         var els = all_els[i].querySelectorAll(e.selector)
         
         for (var k = 0; k < els.length; k++) {
            var el_key = els[k].getAttribute('key')
            if (e.key !== undefined && el_key !== null && el_key != e.key) {
               continue
            }
            
            var index = -1
            var list = getClosestCollection(els[k], all_els[i], scope)
            if (list.container) {
               index = list.index
               els[k].asindex = index
            }
            
            var f = (function(index) {
               return function(event) {
                  e.handler.call(this, event, module, scope, index)
               }
            })(index)
            
            e._handlers[index] = f
            
            addEventHandler(els[k], e.type, f)
            if (!els[k].ashandlers) els[k].ashandlers = {}
            els[k].ashandlers[module_key] = true
         }
      }
   },
   clearEvents: function(module, scope, selector, type, func) {
      if (!scope) scope = 'window'
      if (scope.toString() == scope && scope !== window) {
         scope = eval(scope)
      }
      if (!document.querySelectorAll || !as.events[module]) return
      var all_els = document.querySelectorAll('[asmodel="' + module + '"]')
      for (var i = 0; i < all_els.length; i++) {
         for (var j = 0; j < as.events[module].length; j++) {
            var e = as.events[module][j]
            if (e.selector != selector) continue
            var els = all_els[i].querySelectorAll(e.selector)
            
            var matches = (e.type == type && (!func || func == e.handler))
            
            for (var k = 0; k < els.length; k++) {
               var el_key = els[k].getAttribute('key')
               if (e.key !== undefined && el_key !== null && el_key != e.key) {
                  continue
               }
               
               if (matches) {
                  removeEventHandler(els[k], e.type, e._handlers[els[k].asindex || -1])
               }
            }
            if (matches) as.events[module].splice(j--, 1)
         }
      }
   },
   embedObject: function(scope, str) {
      for (var i = 0; i < this.embeds.length; i++) {
         if (this.embeds[i].scope == scope && this.embeds[i].str == str) return
      }
      this.embeds.push({ scope: scope, str: str })
   },
   removeEmbed: function(scope, str, keep) {
      if (!keep) clearEmbeds(scope, str)
      for (var i = 0; i < this.embeds.length; i++) {
         if (this.embeds[i].scope == scope && this.embeds[i].str == str) {
            this.embeds.splice(this.embeds.indexOf(str), 1)
         }
      }
   },
   embeds: [],
   events: {}
}

function findValue(scope, path) {
   if (!path instanceof String) throw Error("Error: path is not a string")
   var s = path.split('.')
   var val = scope[s[0]]
   for (var j = 1; j < s.length; j++) {
      if (val instanceof Object && s[j].match(/^[a-z][a-z0-9$@#_-]*$/i) && !(s[j] in val)) {
         console.error("Cannot find field '" + s[j] + "' in model '" + s.slice(0, j).join('.') + "'")
      }
      if (s[j] == '*' && j == s.length-1) return val
      val = val instanceof Object && s[j].match(/^[a-z][a-z0-9$@#_-]*$/i) ||
            val instanceof Array && !isNaN(parseInt(s[j])) ?
               val[s[j]] : val
      if (val == undefined) break
   }
   return val
}

function getClosestCollection(el, root, scope) {
   while (el && el.parentNode != root) {
      if (el.parentNode.getAttribute('aslist') !== null) break
      el = el.parentNode
   }
   if (!el || !el.parentNode || el.parentNode.getAttribute('aslist') === null) {
      return { container: null, index: -1 }
   }
   
   var val = findValue(scope, el.parentNode.getAttribute('asmodel'))
   if (val.length == 0) return { container: el.parentNode, index: -1 }
   
   var b = document.createElement('div')
   b.style.display = 'none'
   b.innerHTML = el.parentNode.astemplate
   var n = el.parentNode.children.length / val.length / b.children.length
   
   var i = 0, _el = el.parentNode.children[0]
   while (_el && _el != el) {
      _el = _el.nextElementSibling, i++
   }
   
   return { container: el.parentNode, index: Math.floor(i / n) }
}

function createProxy(val, module, _scope, scope, root, key) {

   var value = val, _sc = _scope, sc = scope,
               render_root = root || module,
               mkey = key || ''
   
   if ('defineProperty' in Object) {
      Object.defineProperty(sc, module.split('.').pop(), {
      
         get: function(){
            return value;
         },

         set: function(val){
            value = val;
            if (val != +val && !val.charAt && val instanceof Object || val instanceof Array) {
               createProxy(val, module, _scope, scope, root);
            }
            
            var _key = key ? module + '#' + key : module

            updateEmbeds(val, module, _scope);
            
            as.hints.ctx = scope;
            initRender(render_root, _sc, mkey, null, module, val);
            delete as.hints.ctx;
         },

         configurable: true
      });
   } else if ('__defineSetter__' in scope) {
      scope.__defineSetter__(module.split('.').pop(), function(val) {
         value = val;
         if (val != +val && !val.charAt && val instanceof Object || val instanceof Array) {
            createProxy(val, module, _scope, scope, root);
         }
         
         updateEmbeds(val, module, _scope);
         
         as.hints.ctx = scope;
         initRender(render_root, _sc, mkey, null, module, val);
         delete as.hints.ctx;
      });
   }
   
   if (val && !val.charAt && val instanceof Object) {
      for (var key in val) {
         if (val instanceof Function || val instanceof Array && key != +key) continue
         createProxy(val[key], module + '.' + key, _scope, val, root);
      }
   }
   if (val instanceof Array) {
      createArrayProxy(val, arguments)
   } else if (val && !val.charAt && !val.toFixed && val !== undefined && val !== null) {
      var o = new Function(); o.prototype = val.__proto__
      val.__proto__ = new o()
      val.__proto__.toString = function() {
         f(this)
         return JSON.stringify(this, ' ', 2)
      }
      val.__proto__._export = function() {
         f(this)
         return JSON.parse(JSON.stringify(this))
      }
      function f(obj) {
         for (var key in obj) {
            if (obj.hasOwnProperty(key) && key != '__parent' && obj[key] && typeof obj[key] != "string") f(obj[key])
         }
         delete obj.__parent
      }
   }
   
}

Array.prototype._export = function() {
   var result = []
   for (var i = 0; i < this.length; i++) {
      result.push(this[i]._export && this[i]._export instanceof Function ? this[i]._export() : this[i])
   }
   return result
}

function createArrayProxy(val, args) {
   var a = ['push', 'pop', 'shift', 'unshift', 'splice']
   var o = new Function(); o.prototype = Array.prototype
   val.__proto__ = new o()
   for (var i = 0; i < a.length; i++) {
      (function() {
         var method = a[i]
         val.__proto__[method] = function() {
            Array.prototype[method].apply(this, args);
            
            var indexes = [];
            if (method == 'push') indexes.push(val.length-1);
            if (method == 'unshift') indexes.push(0);
            if (method == 'splice' && args.length > 2) {
               for (var j = 2; j < args.length; j++) {
                  indexes.push(args[0]+j-2);
               }
            }
            for (var j = 0; j < indexes.length; j++) {
               var key = indexes[j]
               createProxy(val[key], module + '.' + key, _scope, val, root)
            }
            var hints = { add: indexes, remove: [] }
            if (method == 'pop') hints.remove.push(val.length-1);
            if (method == 'shift') hints.remove.push(0);
            if (method == 'splice') {
               for (var j = 0; j < args[1]; j++) {
                  hints.remove.push(args[0]+j);
               }
            }
            as.hints[key ? module + '#' + key : module] = hints;
            
            (function(render_root, _sc, mkey, hints, module, val) {
               setTimeout(function() {
                  initRender(render_root, _sc, mkey, hints, module, val);
               }, 0)
            })(render_root, _sc, mkey, hints, module, val)
         }
      })()
   }
   val.__proto__.find = function(f) {
      if (f instanceof Function) {
         for (var i = 0; i < this.length; i++) {
            if (f(this[i])) return this[i]
         }
      } else if (f instanceof Object) {
         for (var i = 0; i < this.length; i++) {
            if (checkFields(this[i], f)) return this[i]
         }
      }
      return null
   }
   val.__proto__.filter = function(f) {
      var result = []
      if (f instanceof Function) {
         for (var i = 0; i < this.length; i++) {
            if (f(this[i])) result.push(this[i])
         }
      } else if (f instanceof Object) {
         for (var i = 0; i < this.length; i++) {
            if (checkFields(this[i], f)) result.push(this[i])
         }
      }
      return result
   }
   function checkFields(self, obj) {
      for (var key in obj) {
         if (obj.hasOwnProperty(key) && 
           (!self.hasOwnProperty(key) || obj[key] != self[key])) {
            return false
         }
      }
      return true
   }
}

function initRender(render_root, _sc, mkey, hints, module, val) {
   
   var _root = fixRoot(render_root, mkey)
   
   var info = { value: val, module: module, context: _sc, key: mkey, root: _root, sourceRoot: render_root, hints: hints }
   
   var funcs = [as.hooks.before[mkey ? module + '#' + mkey : module]];
   
   if (_root.indexOf('.') != -1) {
      var s = _root;
      while (s.lastIndexOf('.') != -1) {
         s = s.slice(0, s.lastIndexOf('.'));
         if (as.hooks.before[s]) funcs.push(as.hooks.before[s]);
      }
   }
   
   if (as.hooks.before['global']) funcs.push(as.hooks.before['global']);
   
   for (var i = 0; i < funcs.length; i++) {
      if (funcs[i] && funcs[i][1] !== undefined && funcs[i][1] != _sc) continue;
      if (funcs[i] && funcs[i][0] instanceof Function) funcs[i][0](val, info);
   }
   
   processEmbeds(_root, _sc, {}, module)
   
   var start = +(new Date())

   render(_root, _sc, mkey, hints);
   
   var end = +(new Date())
   
   if (as.debug) console.log('DOM tree update: ' + (end - start) + 'ms');
   info.timeTaken = end - start;
   
   funcs = [as.hooks.after[mkey ? module + '#' + mkey : module]];
   
   if (_root.indexOf('.') != -1) {
      var s = _root;
      while (s.lastIndexOf('.') != -1) {
         s = s.slice(0, s.lastIndexOf('.'));
         if (as.hooks.after[s]) funcs.push(as.hooks.after[s]);
      }
   }
   
   if (as.hooks.after['global']) funcs.push(as.hooks.after['global']);
   
   for (var i = 0; i < funcs.length; i++) {
      if (funcs[i] && funcs[i][1] !== undefined && funcs[i][1] != _sc) continue;
      if (funcs[i] && funcs[i][0] instanceof Function) funcs[i][0](val, info);
   }
   
}

function fixRoot(module, key) {
   var els = document.querySelectorAll ? document.querySelectorAll('[asmodel^="' + module + '"]') : document.getElementsByTagName('*')
   var res = []
   var prev = ''
   while (module.length && !res.length) {
      for (var i = 0; i < els.length; i++) {
         var prop = els[i].getAttribute('asmodel');
         if (prop === null || (document.all && !prop.match(new RegExp('^' + module))) || 
             prop.match(new RegExp('^' + module + '[a-z0-9$@#_-]', 'i'))) continue
         res.push(els[i])
      }
      if (!res.length) {
         prev = module.split('.').pop()
         module = module.split('.').slice(0, -1).join('.')
         if (document.querySelectorAll) els = document.querySelectorAll('[asmodel^="' + module + '"]')
      }
   }
   if (prev.match(/^[0-9]+$/)) {
      var _key = key ? module + '#' + key : module
      if (!as.hints[_key]) as.hints[_key] = {}
      as.hints[_key].index = parseInt(prev)
   }
   return module
}

function needsAtomic(module, scope, key) {
   if (!scope) scope = 'window'
   var _scope = scope;
   if (scope.toString() == scope && scope !== window) {
      scope = eval(scope);
   }
   var els = document.querySelectorAll ? document.querySelectorAll('[asmodel^="' + module + '"]') : document.getElementsByTagName('*')
   for (var i = 0; i < els.length; i++) {
      var prop = els[i].getAttribute('asmodel');
      if (prop === null || (document.all && !prop.match(new RegExp('^' + module))) || 
          prop.match(new RegExp('^' + module + '[a-z0-9$@#_-]', 'i'))) continue
      
      var el_scope = els[i].getAttribute('asscope')
      if (_scope.toString() == _scope && _scope !== window && el_scope !== null && el_scope != _scope) continue;
      
      var el_key = els[i].getAttribute('askey')
      if (el_key != null && el_key != key && el_key != '*') continue
      
      if (els[i].getAttribute('astemplate') !== null && !els[i].astemplate) {
         els[i].astemplate = els[i].getAttribute('astemplate').replace(/&quote;/g, '"').replace(/&amp;/g, '&')
      }
      
      if (els[i].getAttribute('asjson')) {
         return true
      }
   }
   return false
}

function getXmlHttp(){
   return new XMLHttpRequest();
}

function send(url, data) {
   var data = data instanceof Array || data instanceof Object ? JSON.stringify(data) : data.toString()
   var req = getXmlHttp()
   req.open('POST', url, true)
   req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
   req.onload = function() {
      if (as.onpersist && as.onpersist instanceof Function) as.onpersist(data)
   }
   req.onerror = function() {
      var msg = this.status > 0 ? 'Request error: HTTP ' + this.status + ' (' + this.statusText + ')' : 'Content security policy error'
      console.error(msg)
   }
   req.send('data=' + encodeURIComponent(data))
}

function render(module, scope, key, hints) {
   if (!scope) scope = 'window'
   var _scope = scope;
   if (scope.toString() == scope && scope !== window) {
      scope = eval(scope);
   }
   var data = findValue(scope, module) //scope[module.split('.')[0]]
   var els = []
   if (document.querySelectorAll) {
      els = document.querySelectorAll('[asmodel^="' + module + '"]')
      els = Array.prototype.filter.call(els, function(el) {
         var _el = el.parentNode
         while (_el && _el.getAttribute) {
            //if (_el.getAttribute('asmodel') !== null) return false
            if (Array.prototype.slice.call(els).indexOf(_el) != -1) return false
            _el = _el.parentNode
         }
         return true
      })
   } else {
      var els = Array.prototype.filter.call(document.getElementsByTagName('*'), function(el) {
         if (!el.getAttribute || !el.getAttribute('asmodel') || !el.getAttribute('asmodel').match(new RegExp('^' + module))) return false
         var _el = el.parentNode
         while (_el && _el.getAttribute) {
            //if (_el.getAttribute('asmodel') !== null) return false
            if (Array.prototype.slice.call(els).indexOf(_el) != -1) return false
            _el = _el.parentNode
         }
         return true
      })
   }
   for (var i = 0; i < els.length; i++) {
      if (as.debug) {
         console.log('Starting render on element')
         console.log(els[i])
      }
      var _module = els[i].getAttribute('asmodel')
      processElement(els[i], data, _module, scope, _scope, key, hints)
      cleanupTemplates(els[i])
   }
}

function processElement(el, data, module, scope, _scope, key, hints, parent_val, index) {
   var prop = el.getAttribute('asmodel');
   if (prop === null) {
      var _el = el;
      while (_el && _el.getAttribute && prop === null) {
         prop = _el.getAttribute('asmodel');
         if (prop) {
            break;
         }
         _el = _el.parentNode;
      }
   }
   var is_child = false
   if (el.getAttribute('aschild') !== null) {
      prop = module
      is_child = true
   }
   
   if (el.getAttribute('asif') !== null && el.getAttribute('asif').length) {
      try {
         if (!eval('var $value; $value = ' + JSON.stringify(parent_val) + ', ' + calcDates(el.getAttribute('asif')))) {
            el.ashidden = true
            el.setAttribute('ashidden', '')
            el.original_display = el.style.display
            el.style.display = 'none'
            return
         }
      } catch (ex) {}
   }
   
   el.ashidden = false
   if (el.original_display !== undefined) {
      el.style.display = el.original_display
   }
   el.original_display = ''
   
   if (prop === null || (document.all && !prop.match(new RegExp('^' + module))) || 
       prop.match(new RegExp('^' + module + '[a-z0-9$@#_-]', 'i'))) return
   
   var el_scope = el.getAttribute('asscope')
   if (_scope.toString() == _scope && _scope !== window && el_scope !== null && el_scope != _scope) return;
   
   var el_key = el.getAttribute('askey')
   if (el_key != null && el_key != key && el_key != '*') return
   
   if (el.getAttribute('astemplate') !== null && !el.astemplate) {
      el.astemplate = el.getAttribute('astemplate').replace(/&quote;/g, '"').replace(/&amp;/g, '&')
   }
   
   if (!hints) hints = {}
   if (!hints.stack) hints.stack = []
   hints.stack.push(prop)
   
   var is_input = el.tagName.toLowerCase().match(/^(textarea|input)$/)
   
   var val = findValue(scope, module)
   
   if (val && (val instanceof Array || !(val instanceof String) && !(typeof val == 'number'))) {
      val.__parent = parent_val
   }
   
   var components = []
   for (var c in as.components) {
      components.push(c)
   }
   
   if (!el.astemplate && (el.innerHTML.indexOf('{$value') != -1 || el.innerHTML.match(/^func:/) ||
        el.innerHTML.match(new RegExp('<(' + components.join('|') + ')')))) {
      el.astemplate = el.innerHTML
      el.innerHTML = ''
   }
   
   if (val instanceof Array && el.getAttribute('asjson') === null &&
        el.getAttribute('aslist') === null) {
      el.setAttribute('aslist', '')
   }
   
   if (el.getAttribute('aslist') !== null && !el.getAttribute('aslist').match(/^[0-9]+:[0-9]+$/) &&
       el.astemplate && hints && hints.remove) {
      var count = el.children.length
      var b = document.createElement('div')
      b.style.display = 'none'
      b.innerHTML = el.astemplate
      var delta = hints.remove.length
      if (hints.add) delta -= hints.add.length
      var n = el.children.length / (val.length + delta) 
      if (n == parseInt(n) && n == b.children.length) {
         for (var i = 0; i < hints.remove.length; i++) {
            var index = hints.remove[i] * parseInt(n)
            for (var j = 0; j < n; j++) {
               el.children[index+j].parentNode.removeChild(el.children[index+j])
            }
         }
         if (!hints.add || !hints.add.length) {
            el.asprocessedtime = +(new Date())
            if (hints.stack) hints.stack.pop()
            return
         }
      }
   }
   if (el.getAttribute('aslist') !== null && el.getAttribute('aslist').match(/^[0-9]+:[0-9]+$/) &&
       el.astemplate && hints) {
      var range = el.getAttribute('aslist').split(':')
      if (hints.add && hints.remove && hints.add.length == hints.remove.length) {
         if (hints.add.filter(function(i) { return i < range[0] }).length == hints.add.length &&
             hints.remove.filter(function(i) { return i < range[0] }).length == hints.remove.length) {
            el.asprocessedtime = +(new Date())
            if (hints.stack) hints.stack.pop()
            return
         }
      }
      if (hints.add.filter(function(i) { return i > range[1] }).length == hints.add.length &&
          hints.remove.filter(function(i) { return i > range[1] }).length == hints.remove.length) {
         el.asprocessedtime = +(new Date())
         if (hints.stack) hints.stack.pop()
         return
      }
   }
   
   if (el.getAttribute('aslist') !== null && val.length === 0 ||
      (val === undefined || val === null) && el.getAttribute('asplaceholder')) {
      var s = getPlaceholder(el)
      if (el.tagName.toLowerCase() == 'input' && el.type == 'text' || el.tagName.toLowerCase() == 'textarea') {
         el.originalPlaceholder = el.placeholder
         el.placeholder = s
         el.value = ''
      } else {
         el.innerHTML = s
      }
      el.asprocessedtime = +(new Date())
      if (hints.stack) hints.stack.pop()
      return
   }
   
   if (is_input && el.originalPlaceholder) {
      el.placeholder = el.originalPlaceholder
   }
   
   var patch = false, _index = index, _key = key ? module + '#' + key : module
   
   if (val instanceof Array && as.hints[_key] && as.hints[_key].index !== undefined &&
       val.length == el.children.length && !is_input) {
      var index = as.hints[_key].index
      
      var _el = el
      
      _val = val
      
      val = val[index]
      el = el.children[index]
      el.astemplate = el.parentNode.astemplate
      
      if (el.astemplate) {
         var output = renderTemplate(el, val, scope, _scope, [data, module, scope, _scope, key, hints])
         el.outerHTML = output
      } else {
         var t_el = el.parentNode
         while (t_el && !t_el.astemplate) {
            t_el = t_el.parentNode
         }
         
         var b = document.createElement('div')
         b.style.display = 'none'
         b.innerHTML = t_el.astemplate
         t_el = b.querySelector('[asmodel=".' + module.split('.').pop() + '"]')
         el.astemplate = t_el.getAttribute('astemplate') || t_el.innerHTML
         
         var output = renderTemplate(el, val, scope, _scope, [data, module, scope, _scope, key, hints])
         el.outerHTML = output
      }
      
      addInputEvents(_el, val, module, scope, index)
      processEventsRecursive(_el, _val, module, scope, index)
      addCustomEvents(_el, _val, module, scope, index)
      postProcessConditions(el, val, module, scope, _scope, key, hints, index)
      
      delete el.astemplate
      _el.asprocessedtime = +(new Date())
      if (hints.stack) hints.stack.pop()
      return
   }
   
   saveTemplate(el)
   
   var output = null
   if (val instanceof Object && !el.astemplate) output = formatJSON(el, val)
   
   if (el.astemplate) output = renderTemplate(el, val, scope, _scope, [data, module, scope, _scope, key, hints])
   if (is_input && !output) output = val
   if (is_input && el.type.match(/^checkbox|radio$/) && (val === 1 || val === true || val.toString().match(/^on|true|yes$/i))) {
      el.setAttribute('checked', '')
   } else {
      updateView(el, output, is_input)
   }

   restoreTemplates(el)
   
   if (!hints || (!hints.ignore_children && hints.stack.length == 1)) {
      index = as.hints[_key] && as.hints[_key].index
      var _el = getRootModule(el)
      if (_el && _el != el) {
         val = findValue(scope, _el.getAttribute('asmodel'))
         index = undefined
      }
      addInputEvents(_el || el, val, module, scope, index)
      processEventsRecursive(_el || el, val, module, scope, index, null)
      addCustomEvents(_el || el, val, module, scope, index)
      postProcessConditions(el, val, prop, module, scope, _scope, key, hints, index)
   }
   if (hints.stack) hints.stack.pop()
   el.asprocessedtime = +(new Date()) 
}

function saveTemplate(el) {
   if (el.astemplate) el.setAttribute('astpl', el.astemplate.replace(/\{\$/g, '{$$$$'))
}

function restoreTemplates(el) {
   if (el.getAttribute('astpl')) {
      el.astemplate = el.getAttribute('astpl').replace(/\{\$\$/g, '{$$')
   }   
   for (var i = 0; i < el.children.length; i++) {
      restoreTemplates(el.children[i])
   }
}

function cleanupTemplates(el) {
   if (el.getAttribute('astpl')) {
      el.removeAttribute('astpl')
   }   
   for (var i = 0; i < el.children.length; i++) {
      cleanupTemplates(el.children[i])
   }
}

function getRootModule(el) {
   var last = null
   while (el) {
      el = el.parentNode
      if (el && el.getAttribute && el.getAttribute('asmodel')) {
         last = el
      }
   }
   return last
}

function getPlaceholder(el) {
   var s = el.getAttribute('asplaceholder') || ''
   if (s.match(/^\$\((.*)\)$/)) {
      s = s.match(/^\$\((.*)\)$/)[1]
      var pe = document.querySelector(s)
      s = pe ? pe.innerHTML : ''
   }
   return s
}

function wasRecentInit(el, hints) {
   var now = +(new Date())
   var threshold = 50
   var _el = el.parentNode
   if (!el) return false
   var last_tag = _el.tagName.toLowerCase()
   while (_el) {
      if (_el.getAttribute && _el.getAttribute('asmodel') && _el.astemplate) {
         if (_el.asprocessedtime && now - _el.asprocessedtime < threshold) {
            return true
         }
      }
      _el = _el.parentNode
      if (_el && _el.tagName) last_tag = _el.tagName.toLowerCase()
   }
   if (!last_tag || !last_tag.match(/^(body|html)$/) && (!hints || !hints.ignore_children)) return true
   return false
}

function updateView(el, val, is_input) {
   if (val === undefined) val = ''
   if (is_input) {
      if (el.type == 'checkbox' || el.type == 'radio') {
         el.checked = !!val
      }
      el.value = val
   }
   else el.innerHTML = val
}

function formatJSON(el, val) {
   if (val instanceof Object && !el.astemplate) {
      if (val.__parent) {
         return formatJSON(el, val._export())
      }
      if (el.getAttribute('asjson') && el.getAttribute('asjson').match(/^pretty/)) {
         var s = el.getAttribute('asjson')
         var space = s.indexOf(':') != -1 ? s.slice(s.indexOf(':')+1).replace(/\\t/g, '\t').replace(/\*([1-9][0-9]*)$/, function(m, n, i, s) {
            var sp = s.slice(0, i), res = sp, n = parseInt(n);
            for (var i = 2; i < n; i++) {
               res += sp;
            }
            return res
         }) : '4'
         if (space.match(/^[1-9][0-9]*$/)) space = parseInt(space)
      }
      val = JSON.stringify(val, null, el.getAttribute('asjson') && el.getAttribute('asjson').match(/^pretty/) ? space : 0)
   } 
   return val
}

export { as, processElement, findValue };