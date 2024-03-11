(function() {

if (!('JSON' in window)) {
   polyfillJSON()
}

window.as = {
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

function processEmbeds(module, scope, options, src_module) {
   var _clear = !!options.clear,
       noupdate = !!options.noupdate
   var queue = []
   for (var i = 0; i < as.embeds.length; i++) {
      var context = as.embeds[i].scope
      var str = as.embeds[i].str
      
      var p = str.split(/\s*->\s*/).slice(0, 2)
      var p1 = p[0].split(/\s*:\s*/)
      var p2 = p[1].split(/\s*:\s*/)
      var id = p1[1] || 'id'
      var ref = p2[1]
      var field = p2[2] || (ref.match(/_id$/) ? ref.slice(0, -3) : '')
      
      //if (module.indexOf(p1[0]) == -1 && p1[0].indexOf(module) == -1) continue
      
      if (field.match(/^\[[^\]]+\]$/)) field = field.slice(1, -1).split(/\s*,\s*/)
      else field.replace(/^>/, '')

      try {
         var v1 = findValue(context, p1[0])
         var v2 = findValue(context, p2[0])
      } catch(ex) {}
      
      if (v1 === null || v1 === undefined || v2 === null || v2 === undefined) continue
      
      if (!v1.length || !v1.find || !id.length || !ref.length || !field.length) continue
      
      if (v2.length) {
         var o = {}
         for (var k = 0; k < v2.length; k++) {
            if (as.hints.ctx && v1.indexOf(as.hints.ctx) != -1 && as.hints.ctx[id] != v2[k][ref]) {
               continue
            }
            o[id] = v2[k][ref]
            var el = _clear ? null : v1.find(o)
            if (!el && !_clear) continue
            copyValue(el, v2[k], p1, p2, field, _clear)
         }
      } else {
         if (!as.hints.ctx || v1.indexOf(as.hints.ctx) == -1 || as.hints.ctx[id] === v2[k][ref]) {
            o[id] = v2[i][ref]
            var el = _clear ? null : v1.find(o)
            if (!el && !_clear) continue
            copyValue(el, v2, p1, p2, field, _clear)
         }
      }
      queue.push(p2[0])
   }
   if (noupdate) return
   queue.sort()
   for (var i = 0; i < queue.length-1; i++) {
      if (queue[i] == queue[i+1]) {
         queue.splice(i--, 1)
         continue
      }
      if (queue[i+1].indexOf(queue[i] + '.') == 0) {
         queue.splice(i+1, 1)
         i--
         continue
      }
   }
   if (as.debug) console.log('Queue: ' + queue)
   for (var i = 0; i < queue.length; i++) {
      if (queue[i] != module && queue[i].indexOf(module + '.') != 0) as.update(queue[i], context)
   }
}

function copyValue(v1, v2, p1, p2, field, _clear) {
   if (field instanceof Array) {
      for (var j = 0; j < field.length; j++) {
         delete v2[field[j]]
         var to = '', from = field[j]
         if (field[j].match(/.+>.+/)) {
            to = field[j].split('>')[1].trim()
            from = field[j].split('>')[0].trim()
         } else {
            var prefix = p1[0].split('.').pop().replace(/s$/, '')
            to = prefix != from ? prefix + '_' + from : from
         }
         if (!_clear) v2[to] = v1[from] && v1[from]._export && v1[from]._export() || v1[from]
      }
   } else {
      delete v2[field]
      if (!_clear) v2[field] = Object.freeze ? Object.freeze(el._export()) : el._export()
   }
}

function updateEmbeds(val, module, scope) {
   for (var i = 0; i < as.embeds.length; i++) {
      var context = as.embeds[i].scope
      var str = as.embeds[i].str
      
      if (scope != context) continue
      
      var p = str.split(/\s*->\s*/).slice(0, 2)
      var p1 = p[0].split(/\s*:\s*/)
      var p2 = p[1].split(/\s*:\s*/)
      var id = p1[1] || 'id'
      var ref = p2[1]
      var field = p2[2] || (ref.match(/_id$/) ? ref.slice(0, -3) : '')
      
      if (field.match(/^\[[^\]]+\]$/)) field = field.slice(1, -1).split(/\s*,\s*/)
      else field.replace(/^>/, '')
      
      var m = module.match(new RegExp('^' + p2[0] + '\.([0-9]+)\.' + ref + '$'))
      
      if (m && m[1] && ref == m[1]) {
         try {
            var v1 = findValue(context, p1[0])
            var v2 = findValue(context, p2[0])
         } catch(ex) {}
         
         if (v1 === null || v1 === undefined || v2 === null || v2 === undefined) continue
      
         if (v1.length) {
            var o = {}; o[id] = val
            var el = v1.find(o)
            copyValue(p1, p2, el, v2[+m[1]], ref, field, false)
         }
      }
   }
}

function clearEmbeds(scope, str) {
   var p = str.split(/\s*->\s*/).slice(0, 2)
   var p1 = p[0].split(/\s*:\s*/)
   if (p1.length) processEmbeds(p1[0], scope, { clear: true })
}

function clearEmbedsFor(module, scope) {
   processEmbeds(module, scope, { clear: true, noupdate: true })
   as.embeds = as.embeds.filter(function(embed) {
      return !embed.str.match(new RegExp('(^|->\\s*)' + module + '[.:]'))
   })
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
            if (val != +val && !val.charAt && val instanceof Object) {
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
   } else {
      var options = {
      
         get: function(){
            return value;
         },

         set: function(val){
            value = val;
            render(render_root, scope, mkey);
         }
      }
      if (!('__defineGetter__' in scope) && _scope.toString() == _scope) {
         var cache = self.cache;
         var found = false;
         var key = _scope + '_' + module;
         for (var el in cache) {
            if (cache[el].key == key) {
               found = true;
               break;
            }
         }
         if (!found) {
            cache[key] = { key: key, module: module, scope: scope, value: val };
            render(module, scope);
         }
      } else {
         addProperty(scope, module.split('.').pop(), options);
      }
   }
   
   if (val && !val.charAt && val instanceof Object) {
      for (var key in val) {
         if (val instanceof Function || val instanceof Array && key != +key) continue
         createProxy(val[key], module + '.' + key, _scope, val, root);
      }
   }
   if (val instanceof Array) {
      var o = new Function(); o.prototype = Array.prototype
      val.__proto__ = new o()
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
   var xmlhttp;
   try {
      xmlhttp = new ActiveXObject("Msxml2.XMLHTTP");
   } catch (e) {
      try {
         xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
      } catch (E) {
         xmlhttp = false;
      }
   }
   if (!xmlhttp && typeof XMLHttpRequest!='undefined') {
      xmlhttp = new XMLHttpRequest();
   }
   return xmlhttp;
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
         if (!eval('$value = ' + JSON.stringify(parent_val) + ', ' + calcDates(el.getAttribute('asif')))) {
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
   if (_scope.toString() == _scope && _scope != window && el_scope !== null && el_scope != _scope) return;
   
   var el_key = el.getAttribute('askey')
   if (el_key != null && el_key != key && el_key != '*') return
   
   if (el.getAttribute('astemplate') !== null && !el.astemplate) {
      el.astemplate = el.getAttribute('astemplate').replace(/&quote;/g, '"').replace(/&amp;/g, '&')
   }
   
   if (!hints) hints = {}
   if (!hints.stack) hints.stack = []
   hints.stack.push(prop)
   
   var is_input = el.tagName.toLowerCase().match(/^(textarea|input)$/)
   
   var val = findValue(scope, hints.stack.length > 1 ? prop : module)
   
   if (val && (val instanceof Array || !(val instanceof String) && !(typeof val == 'number'))) {
      val.__parent = parent_val
   }
   
   var components = []
   for (var c in as.components) {
      components.push(c)
   }
   
   if (!el.astemplate && (el.innerHTML.indexOf('{$value') != -1 || el.innerHTML.match(/^func:/) || el.innerHTML.indexOf('$now') != -1 ||
        el.innerHTML.match(new RegExp('<(' + components.join('|') + ')')))) {
      el.astemplate = el.innerHTML
      el.innerHTML = ''
   }
   
   if (val instanceof Array && el.getAttribute('asjson') === null &&
        el.getAttribute('aslist') === null) {
      el.setAttribute('aslist', '')
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

function postProcessConditions(el, _val, prop, module, scope, _scope, key, hints, index) {
   
   var n = el.children.length / (_val && _val.length || 1)
   
   for (var i = 0; i < el.children.length; i++) {
      if (el.children[i].getAttribute('ashidden') !== null) continue
      if (el.children[i].getAttribute('asmodel') && el.children[i].getAttribute('asmodel').slice(0, 1) != '.') {
         var _el = el.children[i]
         var val = findValue(scope, _el.getAttribute('asmodel'))
         
         if (!val || typeof val == 'number' || val instanceof String) continue
         
         val.__parent = _val
         
         n = _el.children.length / (val.length || 1)
         
         for (var j = 0; j < _el.children.length; j++) {
            var idx = Math.floor(j / n)
            
            if (val.length && (val[idx] instanceof Array || !(val[idx] instanceof String) && !(typeof val[idx] == 'number'))) {
               val[idx].__parent = val.parent
            }
            
            processCSS(_el.children[j], val && val.length ? val[idx] : val, idx, true)
            processAttrs(_el.children[j], val && val.length ? val[idx] : val, idx, true)
            cleanupAttrs(_el.children[j])
            processInputValue(_el.children[j])
            
            postProcessConditions(_el.children[j], val && val.length ? val[idx] : val, val && val.length ? prop + '.' + idx : prop, module, scope, _scope, key, hints, idx)
         }
      } else {
         
         var idx = _val && _val.length ? Math.floor(i / n) : index
         if (_val && _val.length && _val[idx] && (_val[idx] instanceof Array || !(_val[idx] instanceof String) && !(typeof _val[idx] == 'number'))) {
            _val[idx].__parent = _val.parent
         }
         
         processCSS(el.children[i], _val && _val.length ? _val[idx] : _val, idx, true)
         processAttrs(el.children[i], _val && _val.length ? _val[idx] : _val, idx, true)
         cleanupAttrs(el.children[i])
         processInputValue(el.children[i])
         
         postProcessConditions(el.children[i], _val && _val.length ? _val[idx] : _val, _val && _val.length ? prop + '.' + idx : prop, module, scope, _scope, key, hints, idx)
      }
   }
}

function addInputEvents(el, val, module, scope, index) {
   var els = document.querySelectorAll('input[asmodel^="' + module + '"], textarea[asmodel^="' + module + '"]')
   for (var i = 0; i < els.length; i++) {
      if (els[i].hasInputHandler) continue
      addEventHandler(els[i], 'change', function() {
         var key = module.split('.').pop()
         var val = findValue(scope, module.split('.').slice(0, -1).join('.'))
         val[key] = this.type.match(/^checkbox|radio$/) ? this.checked : this.value
      }, false)
      els[i].hasInputHandler = true
   }
}

function processEventsRecursive(el, val, module, scope, index, comp) {
   if (el.getAttribute('ascomponent') && el.getAttribute('ascomponent').length) {
      comp = el.getAttribute('ascomponent')
   }
   for (var i = 0; i < el.children.length; i++) {
      processEventsRecursive(el.children[i], val, module, scope, index, comp)
   }
   processEvents(el, val, module, scope, index, comp)
}

function processEvents(el, val, module, scope, index, comp) {
   if (!scope) scope = window
   if (index === undefined) index = -1
   for (var i = 0; i < el.attributes.length; i++) {
      if (el.attributes[i].name.match(/^as-on/)) {
         
         var attr_val = el.attributes[i].value
         var modifiers = el.attributes[i].name.indexOf(':') != -1 ? el.attributes[i].name.slice(el.attributes[i].name.indexOf(':')+1).split(':') : []
         
         attr_val = attr_val.replace(/([a-zA-Z0-9$_-]+)(?=\()/g, function() {
            var name = arguments[1]
            if (name.match(/^(for|while|with|switch|function)$/)) return name 
            var index = arguments[2]
            if (index > 0 && attr_val.charAt(index-1) == '.') return name
            var comp_scope = comp && comp.length ? 'as.components[\'' + comp + '\'].funcs && as.components[\'' + comp + '\'].funcs.' + name + ' || ' : ''
            return '(' + comp_scope + 'scope.funcs && scope.funcs.' + name + ' || scope.' + name + ' || window.' + name + ')'
         })
         
         attr_val = calcDates(attr_val)
         
         attr_val = getRefs(el) + attr_val
         
         var pos = el.attributes[i].name.indexOf(':')
         var func = new Function('event', 'value', 'scope', 'index', attr_val)
         var type = el.attributes[i].name.slice(5, pos > 5 ? pos : undefined)
         var f = function(modifiers) {
            return function(event) {
               if (!event) event = window.event
               if (!event.target && event.srcElement) {
                  event.target = event.srcElement
               }
               if (modifiers.indexOf('self') == -1 || event && event.target === this) {
                  func.call(this, event, val || scope, scope, index)
               }
               if (modifiers.indexOf('stop') != -1 && event) {
                  event = event || window.event
                  event.stopPropagation()
                  event.cancelBubble = true
               }
               if (modifiers.indexOf('prevent') != -1 && event) {
                  event = event || window.event
                  event.preventDefault()
                  return false
               }
            }
         }(modifiers)
         if (el.asevents && el.asevents[type]) return
         addEventHandler(el, type, f, modifiers.indexOf('capture') != -1)
         if (!as.debug) el.removeAttribute(el.attributes[i].name)
         if (!el.asevents) el.asevents = {}
         if (!el.asevents[type]) el.asevents[type] = {}
         el.asevents[type] = true
      }
   }
}

function getRefs(el) {
   if (!document.querySelectorAll) return ''
   while (el && !el.getAttribute('asmodel')) {
      el = el.parentNode
   }
   var els = Array.prototype.slice.call(el.querySelectorAll("[asref]"))
   for (var i = 0; i < els.length; i++) {
      var _el = els[i].parentNode
      while (_el) {
         if (_el.getAttribute('asmodel') && _el != el) {
            els.splice(i--, 1)
            break
         }
         if (_el == el) break
         _el = _el.parentNode
      }
   }
   var s = []
   for (var i = 0; i < els.length; i++) {
      s.push([])
      var _el = els[i]
      while (_el != el) {
         var c = _el.parentNode.children
         var j = 0
         for (; j < c.length; j++) {
            if (c[j] == _el) break
         }
         s[s.length-1].unshift(j)
         _el = _el.parentNode
      }
   }
   var result = 'var el = this; while (el && !el.getAttribute(\'asmodel\')) el = el.parentNode; '
   for (var i = 0; i < els.length; i++) {
      var str = 'el'
      for (var j = 0; j < s[i].length; j++) {
         str += '.children[' + s[i][j] + ']'
      }
      result += 'var $' + els[i].getAttribute('asref').replace(/[^a-z0-9@_]/g, '') + ' = ' + str + '; '
   }
   return result
}

function addCustomEvents(el, val, module, scope, index) {
   if (!scope) scope = 'window'
   if (scope.toString() == scope && scope !== window) {
      scope = eval(scope)
   }
   if (index === undefined) index = -1
   else {
      var _el = getRootModule(el)
      if (_el && _el != el) {
         el = _el
         module = el.getAttribute('asmodel')
      }
   }
   if (!document.querySelectorAll || !as.events[module]) return
   var all_els = document.querySelectorAll('[asmodel="' + module + '"]')
   for (var i = 0; i < all_els.length; i++) {
      for (var j = 0; j < as.events[module].length; j++) {
         var e = as.events[module][j]
         var els = all_els[i].querySelectorAll(e.selector)
         
         for (var k = 0; k < els.length; k++) {
            var el_key = els[k].getAttribute('key')
            if (e.key !== undefined && el_key !== null && el_key != e.key) {
               continue
            }
            
            if (els[k].ashandlers && els[k].ashandlers[module]) continue
            
            var f = (function(index) {
               return function(event) {
                  setTimeout(function() { e.handler.call(this, event, findValue(scope, module), scope, index) }, 0)
               }
            })(index)
            
            e._handlers[index] = f
            
            addEventHandler(els[k], e.type, f)
            if (!els[k].ashandlers) els[k].ashandlers = {}
            els[k].ashandlers[module] = true
         }
      }
   }
}

function addEventHandler(el, type, func, capture) {
   if (el.addEventListener) {
      el.addEventListener(type, func, !!capture)
   } else {
      el.attachEvent('on' + type, func, !!capture)
   }
}

function removeEventHandler(el, type, func, capture) {
   if (el.removeEventListener) {
      el.removeEventListener(type, func, !!capture)
   } else {
      el.detachEvent('on' + type, func, !!capture)
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

function compileTemplate(el, val, scope, args) {
   if (el.astemplate.match(/^func:/)) {
      // Compile only once
      if (el.asTplFunc == undefined) {
         el.asTplStacks = []
         var tpl = el.astemplate.slice(5)
         var pos = tpl.indexOf('(')
         var func_name = tpl.slice(0, pos)
         var hints = args[5]
         var func = hints && hints.component && as.components[hints.component] && 
                    as.components[hints.component].funcs && as.components[hints.component].funcs[func_name] ||
                    scope[func_name] || scope.funcs && scope.funcs[func_name]
         if (func) {
            var n = 0, m = 0
            var args = []
            var token = ''
            pos++
            var index = -1
            var c = tpl.charAt(pos)
            var quote = ''
            var state = 0
            if (c == ',') {
               return '[template error]'
            }
            while (pos < tpl.length) {
               c = tpl.charAt(pos)
               if (c == "\\") {
                  pos++
                  continue
               }
               if (n == 0 && state == 0) {
                  if (c == '[') {
                     n = 1, m = 1, pos++
                     continue
                  }
               }
               if ((c == "'" || c == '"') && n == 0 || n == 1 && c == quote) {
                  n = (n+1)%2
                  if (n == 1) {
                     quote = c, state = 2
                  } else {
                     state = 0
                  }
                  pos++
                  c = tpl.charAt(pos)
               }
               if (n == 1 && state == 0 && tpl.slice(pos-1,pos+1) == '[]') {
                  error = true
                  break
               }
               else if (m == 1 && c == ']' && state < 2) {
                  m = 0
                  if (!(tpl.charAt(pos-1) == "'" || tpl.slice(pos-2,pos) == '\\"')) {
                     token = { value: token }
                  }
                  if (!el.asTplStacks[index]) el.asTplStacks[index] = { tokens: [] }
                  el.asTplStacks[index].tokens.push(token)
                  token = '', state = 0, n = 0
                  if (pos < tpl.length-1 && tpl.charAt(pos+1) == ',') {
                     pos+=2
                     continue
                  }
                  if (pos == tpl.length-1 && tpl.charAt(pos+1) != ')') {
                     return '[template error]'
                  }
                  if (pos == tpl.length-2) {
                     pos += 2
                     break
                  }
               }
               else if (state == 2 &&
                           (c == quote || tpl.slice(pos,pos+2) == '\\' + quote)) {
                  state = 0, quote = ''
               }
               else if ((c == "," || pos == tpl.length-1 && c == ')') && n == 0) {
                  args.push(token.match(/^[0-9]+(\.[0-9]+)?$/) ? Number(token) : token)
                  token = ''
               }
               else if (n > 0 && state > 0 || c.match(/^[0-9.]$/)) {
                  token += c
               }
               else if (c.match(/^\s$/)) {
                  pos++
                  continue
               }
               else {
                  if (tpl.slice(pos, pos+6) != '$value' && !(pos == tpl.length-1 && c == ')')) return '[template error]'
                  index++
                  pos += 6
                  c = tpl.charAt(pos)
                  args.push(c != '[' ? val : null)
                  if (c != '[' && tpl.slice(pos-6, pos) == '$value') el.asValIndex = index
                  if (c == '[') m++
                  if (!(c == ',' || c == '[' || pos == tpl.length-1 && c == ')')) return '[template error]'
               }
               pos++
            }
            el.asTplFunc = func
            el.asTplArgs = args
         } else {
            el.asTplFunc = func
            el.asTplArgs = []
            el.asValIndex = -1
         }
      }
   } else {
      // Compile only once
      if (!el.asTplStacks && !el.asTplError) {
         el.asTplStacks = []
         var tpl = el.astemplate
         var pos = 0, index = 0, last = 0
         while (tpl.indexOf('{$value', pos) != -1) {
            var pos = tpl.indexOf('{$value', pos) + 7
            last = pos - 7
            var n = 0, state = 0, quote = '', token = '', error = false
            while (pos < tpl.length) {
               var c = tpl.charAt(pos)
               if (n == 0 && state == 0) {
                  if (c == '[') {
                     n = 1, pos++
                     continue
                  } else if (c == '}') {
                     if (!el.asTplStacks[index]) {
                        el.asTplStacks[index] = { start: last, tokens: [] }
                     }
                     break
                  }
                  if (c == '|' && n == 0) {
                     var e = []
                     var flag = false
                     var _pos = pos+1
                     while (pos < tpl.length) {
                        pos++
                        if (tpl.charAt(pos) == "\\" && n > 0) {
                           pos++; continue
                        }
                        else if ((tpl.charAt(pos) == "'" || tpl.charAt(pos) == '"')&& n == 0) {
                           n = 1; quote = tpl.charAt(pos)
                        }
                        else if (tpl.charAt(pos) == quote && n > 0) {
                           n = 0; quote = ''
                        }
                        else if (n == 0 && tpl.charAt(pos) == "|") {
                           e.push(tpl.slice(_pos, pos))
                           _pos = pos + 1
                        }
                        else if (tpl.charAt(pos) == '}' && n == 0) {
                           flag = true
                           if (pos > _pos) e.push(tpl.slice(_pos, pos))
                           break
                        }
                     }
                     if (flag) {
                        if (!el.asTplStacks[index]) {
                           el.asTplStacks[index] = { start: last, tokens: [] }
                        }
                        el.asTplStacks[index].extra = e
                     }
                     break
                  }
               }
               if (n == 1 && state == 0 && tpl.slice(pos-1,pos+1) == '[]') {
                  error = true
                  break
               }
               if (n == 1 && c == "'" && tpl.charAt(pos-1) == '[') {
                  state = 2, quote = "'"
               }
               else if (n == 1 && tpl.slice(pos,pos+2) == '\\"') {
                  state = 2, quote = '"', pos++
               } else if (n == 1 && c == ']') {
                  if (!(tpl.charAt(pos-1) == "'" || tpl.slice(pos-2,pos) == '\\"')) {
                     token = { value: token }
                  }
                  if (!el.asTplStacks[index]) el.asTplStacks[index] = { start: last, tokens: [] }
                  el.asTplStacks[index].tokens.push(token)
                  token = '', state = 0, n = 0
               } else if (state == 2 &&
                           (c == quote || tpl.slice(pos,pos+2) == '\\' + quote)) {
                  state = 0, quote = ''
               } else {
                  // not a string literal
                  if (n > 0 && state == 0) state = 1
                  if (n > 0 && state > 0) {
                     token += c
                  }
               }
               pos++
            }
            if (error) {
               el.asTplStacks = null
               el.asTplError = true
               break
            }
            el.asTplStacks[index].end = pos+1
            index++
         }
      }
   }
}

function polyfillJSON() {
   window.JSON = {
      parse: function(str) {
         var str = str.toString()
         this.str = str
         var result = null
         if (!str.length) return result
         if (str.charAt(0) == '[') {
            result = []
            str = str.slice(1)
            while (str.length && str.charAt(0) == ' ') str = str.slice(1)
            if (!str.length) throw new Error('Invalid JSON format');
            while (str.charAt(0) != ']') {
               result.push(this.parse(str))
               str = this.str
            }
            str = str.slice(1)
            while (str.length && (str.charAt(0) == ' ' || str.charAt(0) == ',')) str = str.slice(1)
            this.str = str
            return result
         }
         if (str.charAt(0) == '{') {
            result = {}
            str = str.slice(1)
            while (str.length && str.charAt(0) == ' ') str = str.slice(1)
            if (!str.length) throw new Error('Invalid JSON format');
            while (str.charAt(0) != '}') {
               var m = str.match(/^\s*"([^"]+)"\s*:\s*/)
               if (!m) throw new Error('Invalid JSON format');
               var key = m[1]
               str = str.slice(m[0].length)
               result[key] = this.parse(str)
               str = this.str
               if (result[key] == null) throw new Error('Invalid JSON format');
            }
            str = str.slice(1)
            while (str.length && (str.charAt(0) == ' ' || str.charAt(0) == ',')) str = str.slice(1)
            this.str = str
            return result
         }
         if (str.charAt(0) == '"') {
            result = ''
            str = str.slice(1)
            while (str.length && str.charAt(0) != '"') {
               if (str.charAt(0) == '\\' && str.charAt(1) == '"') {
                  result += str.slice(0, 2)
                  str = str.slice(2)
                  continue
               }
               result += str.charAt(0)
               str = str.slice(1)
            }
            str = str.slice(1)
            while (str.length && (str.charAt(0) == ' ' || str.charAt(0) == ',')) str = str.slice(1)
            this.str = str
            return result
         }
         if (str.charAt(0).match(/[0-9]/)) {
            result = ''
            while (str.length && str.charAt(0).match(/[0-9.eE-]/)) {
               result += str.charAt(0)
               str = str.slice(1)
            }
            while (str.length && !str.charAt(0).match(/[ ,\]}]/)) str = str.slice(1)
            while (str.length && (str.charAt(0) == ' ' || str.charAt(0) == ',')) str = str.slice(1)
            this.str = str
            return parseFloat(result)
         }
      },
      stringify: function(obj, fields, space, level) {
         if (!level) level = 0
         if (space && !isNaN(parseInt(space))) {
            var res = ''
            for (var i = 0; i < parseInt(space); i++) res += ' '
            space = res
         }
         for (var i = 1; i < level; i++) {
            space += space
         }
         var str = ''
         if (obj instanceof Array) {
            str += '['
            for (var i = 0; i < obj.length; i++) {
               str += (space ? '\n' + space : '') + this.stringify(obj[i], fields, space, level+1) + ','
            }
            if (str.slice(-1) == ',') str = str.slice(0, -1)
            str = str + (space && obj.length > 0 ? '\n' : '') + ']'
         } else if (obj instanceof Object) {
            str += '{'
            var c = 0
            for (var i in obj) {
               if (fields && fields instanceof Array && fields.indexOf(i) == -1) continue
               str += (space ? '\n' + space : '') + '"' + i + '"' + ':' + this.stringify(obj[i], fields, space, level+1) + ','
               c++
            }
            if (str.slice(-1) == ',') str = str.slice(0, -1)
            str = str + (space && c > 0 ? '\n' : '') + '}'
         } else {
            str = '"' + obj.toString() + '"'
         }
         return str
      }
   }
}

function renderTemplate(el, val, scope, _scope, args) {
   if (el.astemplate.match(/ astemplate="func:/)) {
      var temp = document.createElement('div')
      temp.innerHTML = el.astemplate
      var children = temp.getElementsByTagName('*')
      for (var i = 0; i < children.length; i++) {
         children[i].astemplate = children[i].getAttribute('astemplate') || children[i].innerHTML
         if (children[i].astemplate.match(/^func:/) && !children[i].getAttribute('asmodel')) {
            children[i].innerHTML = renderTemplate(children[i], val, scope, _scope, args)
         }
      }
      el.astemplate = temp.innerHTML
   }
   if (el.astemplate.match(/^func:/)) {
      if (!el.asTplFunc) compileTemplate(el, val, scope, args)
      if (!el.getAttribute('aslist')) {
         getFuncArgs(el, val)
         return el.asTplFunc && el.asTplFunc.apply(scope, el.asTplArgs) || ''
      } else if (val instanceof Array) {
         var range = [0, val.length-1]
         var s = el.getAttribute('aslist')
         if (s && s.match(/^[0-9]+:[0-9]+$/)) {
            range = el.getAttribute('aslist').split(':')
         }
         var result = ''
         for (var i = +range[0]; i <= +range[1]; i++) {
            getFuncArgs(el, val[i])
            result += el.asTplFunc.apply(scope, el.asTplArgs)
         }
         return result
      }
   } else {
      if (el.astemplate.indexOf('{$value}') != -1 && (!(val instanceof Array) || el.getAttribute('aslist') === null)) {
         if (val instanceof Object) val = JSON.stringify(val)
         return el.astemplate.replace('{$value}', val).replace('{\\$value}', '{$value}')
      }
         
      function f(el, val, index) {
         
         function renderSelf(el) {
            var str = el.astemplate
            var parts = []
            var n = 0
            for (var i = 0; i < el.asTplStacks.length; i++) {
               parts.push(str.slice(n, el.asTplStacks[i].start))
               n = el.asTplStacks[i].end
            }
            parts.push(str.slice(n))
            
            str = parts[0]
            
            for (var i = 0; i < el.asTplStacks.length; i++) {
               var s = el.asTplStacks[i].tokens.slice()
               var data = val
               for (var j = 0; j < s.length; j++) {
                  if (!s[j].charAt && s[j].value) s[j] = eval(s[j].value)
                  data = data instanceof Object && s[j].match && s[j].match(/^[a-z][a-z0-9$@#_-]*$/i) ||
                        data instanceof Array && !isNaN(parseInt(s[j])) ?
                           data[s[j]] : data
                  if (data == undefined) break
               }
               var filters = el.asTplStacks[i].extra && el.asTplStacks[i].extra.slice()
               if (data === undefined) data = "{$value['" + el.asTplStacks[i].tokens.join("']['") + "']}"
               var strDate = false
               if (filters && filters[0].match(/^date\([^\)]+\)$/)) {
                  if (!(data instanceof Date)) {
                     data = new Date(data)
                  }
                  el.asTplStacks[i].extra[0] = el.asTplStacks[i].extra[0].slice(5, -1)
                  strDate = true
               }
               if (data instanceof Date) {
                  var format = el.asTplStacks[i].extra && el.asTplStacks[i].extra[0].slice(1,-1) || 'DD.MM.YYYY HH:mm:ss'
                  data = formatDate(data, format)
                  filters.splice(0, 1)
               }
               if (strDate) {
                  el.asTplStacks[i].extra[0] = 'date(' + el.asTplStacks[i].extra[0] + ')'
               }
               if (filters) data = applyFilters(data, filters)
               if (data instanceof Object) data = JSON.stringify(data)
               str += (data ? data.toString() : '') + parts[i+1]
            }
            return str
         }
         
         var b = document.createElement('div')
         b.style.display = 'none'
         b.innerHTML = el.astemplate
         
         // If condition is not met do not check children and return empty string
         if (b.children.length == 1 && b.children[0].getAttribute('asif') !== null && b.children[0].getAttribute('asif').length) {
            try {
               if (!eval('now = window.now; $value = ' + JSON.stringify(val) + ', ' + calcDates(b.children[0].getAttribute('asif')))) {
                  return ''
               }
            } catch (ex) {}
         }
         
         if (val === null || val === undefined) {
            var s = b.children[0] ? getPlaceholder(b.children[0]) : ''
            b.children[0].innerHTML = s
            return b.children[0].outerHTML
         }
         
         function checkChildElements(el) {
            
            var known_tags = ['div', 'span', 'p', 'b', 'i', 'u', 's', 'strong', 'em', 'a', 'img', 'ul', 'ol', 'li', 'code', 'quote', 'cite', 'br', 'hr', 'input', 'textarea', 'table', 'thead', 'tbody', 'tr', 'td', 'script', 'dt', 'dd', 'style', 'link']
            if (known_tags.indexOf(el.tagName.toLowerCase()) == -1 && as.components[el.tagName.toLowerCase()]) {
               if (args[5] && args[5]['component_stack']) {
                  if (args[5]['component_stack'] > 250) {
                     console.error('Too much component recursion')
                     return
                  }
               }
               
               var c = document.createElement('div')
               c.style.display = 'none'
               c.innerHTML = as.components[el.tagName.toLowerCase()].template || ''
               
               if (args[5] && args[5]['component_stack']) {
                  if (args[5]['component_stack'].indexOf(el.tagName.toLowerCase()) != -1) {
                     /* if (c.children.length > 1 || !c.children[0].getAttribute('asif') &&
                          (!c.children[0].getAttribute('asmodel') || c.children[0].getAttribute('asmodel').slice(0, 1) != '.')) {
                        console.error('Infinite recursion detected on component ' + args[5]['component'])
                     }
                     return */
                  }
               }
               
               var a = []
               for (var i = 0; i < c.childNodes.length; i++) {
                  a.push(c.childNodes[i])
                  el.parentNode.insertBefore(c.childNodes[i], el)
               }
               
               if (!args[5]) args[5] = {}
               args[5]['component'] = el.tagName.toLowerCase()
               if (!args[5]['component_stack']) args[5]['component_stack'] = []
               args[5]['component_stack'].push(el.tagName.toLowerCase())
               
               el.parentNode.removeChild(el)
               for (var i = 0; i < a.length; i++) {
                  if (a[i].nodeType == 1) {
                     a[i].setAttribute('ascomponent', args[5]['component'])
                     checkChildElements(a[i])
                  }
               }
               args[5]['component_stack'].pop()
               return
            }
            
            if (el.getAttribute('asref') && !as.components[el.getAttribute('asref')]) {
               as.components[el.getAttribute('asref')] = { template: el.outerHTML.replace(/(?:\n)\s+(<\/[a-z]+>)$/, '\n$1') }
            }
            
            if (!el.getAttribute('asmodel')) {
               for (var i = 0; i < el.children.length; i++) {
                  checkChildElements(el.children[i])
               }
            }
            if (!el.getAttribute('asmodel') && (el.getAttribute('astemplate') && el.getAttribute('astemplate').match(/^func:/) || el.innerHTML.match(/^func:/)) && val) {
               if (el.getAttribute('astemplate') === null) {
                  el.astemplate = el.innerHTML
               } else if (el.getAttribute('astemplate') !== null && !el.astemplate) {
                  el.astemplate = el.getAttribute('astemplate').replace(/&quote;/g, '"').replace(/&amp;/g, '&')
               }
               if (!el.astemplate && (el.innerHTML.indexOf('{$value') != -1 || el.innerHTML.match(/^func:/))) {
                  el.astemplate = el.innerHTML
                  el.innerHTML = ''
               }
               if (!el.asTplFunc) compileTemplate(el, val, scope, args)
               var source = el.outerHTML.replace(/\s+$/, '')
               getFuncArgs(el, val)
               el.innerHTML = el.asTplFunc && el.asTplFunc.apply(scope, el.asTplArgs) || ''
            }
            
            if (el.getAttribute('asmodel')) {
               if (!args[5]) args[5] = {}
               
               if (el.getAttribute('asmodel').slice(0, 1) == '.') {
                  var prop = el.getAttribute('asmodel')
                  var i = args[5]['stack'].length
                  while (i > 0 && !prop || prop.charAt(0) == '.') {
                     prop = args[5]['stack'][--i] + (index != -1 ? '.' + index : '') + prop
                  }
                  
                  if (prop && prop.length && prop.charAt(0) != '.') {
                     var _module = prop
                     var _val = findValue(val, el.getAttribute('asmodel').slice(1))
                     el.setAttribute('asmodel', _module)
                     el.setAttribute('aschild', '')
                     
                     if (as.debug) {
                        console.log('Child model: ' + _module)
                        console.log('Value: ', _val && _val.toString())
                     }
                     
                     processElement.apply(this, [el, _val, _module].concat(args.slice(2)).concat([val]))
                     
                  }
               } else {
                  args[5]['ignore_children'] = true
                  processElement.apply(this, [el].concat(args).concat([val]))
                  args[5]['ignore_children'] = false
               }
            } else {
               if (el.getAttribute('asif') !== null && el.getAttribute('asif').length) {
                  try {
                     if (!eval('$value = ' + JSON.stringify(val) + ', ' + calcDates(el.getAttribute('asif')))) {
                        el.ashidden = true
                        el.setAttribute('ashidden', '')
                        el.original_display = el.style.display
                        el.style.display = 'none'
                        return
                     }
                  } catch (ex) {}
               }
            }
            
            processCSS(el, val, index)
            processAttrs(el, val, index)
            cleanupAttrs(el)
         }
         
         el.asorigtemplate = el.astemplate
         
         if (!args[5] || !args[5]['ignore_children']) {
            checkChildElements(b)
            if (b.innerHTML != el.astemplate) el.astemplate = b.innerHTML
         }
      
         if (el.asorigtemplate != el.astemplate) {
            el.asTplStacks = null
            el.asTplError = null
         }
         
         if (!el.asTplStacks && !el.asTplError) compileTemplate(el, val, scope)
         
         var str = renderSelf(el)
         
         str = calcDates(str, true)
         
         el.astemplate = el.asorigtemplate
         delete el.asorigtemplate
         
         return str
      }
      
      if (el.getAttribute('aslist') !== null && (!val || val.length === 0)) {
         return ''
      }
      
      var _key = el.getAttribute('askey') !== null && el.getAttribute('askey') != '*' ?
         el.getAttribute('asmodel') + '#' + el.getAttribute('askey') :
         el.getAttribute('asmodel')
      
      var hints = as.hints[_key]
      
      if (el.getAttribute('aslist') !== null && val && val instanceof Array) {
         var range = [0, val.length-1]
         if (el.getAttribute('aslist').match(/^[0-9]+:[0-9]+$/)) {
            range = el.getAttribute('aslist').split(':')
         }
         
         var result = ''
         for (var i = +range[0]; i <= +range[1]; i++) {
            result += f(el, val[i], i).replace(/\s+$/, '').replace('{$index}', i).replace('{\\$index}', '{$index}')
         }
         
         return result
      }
      
      return f(el, val)
   }
}

String.prototype.pad = function(n, ch) {
   if (!ch) ch = ' '
   var s = ''
   var left = Math.floor((n - this.length) / 2)
   for (var i = 0; i < left; i++) {
      s += ch
   }
   s += this
   for (var i = 0; i < n - this.length - left; i++) {
      s += ch
   }
   return s
}

String.prototype.padleft = function(n, ch) {
   if (!ch) ch = ' '
   var s = ''
   n = n - this.length
   for (var i = 0; i < n; i++) {
      s += ch
   }
   s += this
   return s
}

String.prototype.padright = function(n, ch) {
   if (!ch) ch = ' '
   var s = this
   n = n - this.length
   for (var i = 0; i < n; i++) {
      s += ch
   }
   return s
}

function applyFilters(data, filters) {
   for (var i = 0; i < filters.length; i++) {
      switch (filters[i]) {
         case 'upper':
            data = data.toUpperCase()
            break
         case 'lower':
            data = data.toLowerCase()
            break
         case 'capitalize':
            data = data.slice(0).toUpperCase() + data.slice(1)
            break
         case 'capitalizeWords':
            data = data.replace(/(?:^|\W)\w/, function(str) {
               return str.toUpperCase()
            })
            break
         case 'reverse':
            data = data.split('').reverse().join('')
            break
         case 'trim':
            data = data.trim()
            break
      }
      if (filters[i].match(/^pad([lL]eft|[rR]ight)?\(.*\)$/)) {
         data = eval('data.' + filters[i])
      }
   }
   return data
}

function processCSS(el, val, index, post) {
   // Process CSS classes
   if (el.getAttribute('asclasses') !== null) {
      var classes = el.getAttribute('asclasses').split(/\s*,\s*/)
      var delayed = []
      for (var i = 0; i < classes.length; i++) {
         classes[i] = classes[i].trim()
         var p1 = classes[i].lastIndexOf('?')
         var p2 = classes[i].lastIndexOf('|')
         if (p2 == -1) {
            classes[i] += '|'
            p2 = classes[i].length-1
         }
         var cond = classes[i].slice(0, p1).trim()
         if (cond.match(/\$value\['__parent'\]/) && !post) {
            delayed.push(classes[i])
            continue
         }
         var s1 = classes[i].slice(p1+1, p2).trim()
         var s2 = classes[i].slice(p2+1).trim()
         var result = s2
         try {
            if (eval('now = window.now; $value = ' + JSON.stringify(val) + ', $index = ' + (index !== undefined ? parseInt(index) : -1) + ',' + calcDates(cond))) {
               result = s1
            }
         } catch (ex) {}
         var c = result.split(/\s+/).filter(function(s) { return s.length })
         for (var i = 0; i < c.length; i++) {
            el.classList.add(c[i])
         }
      }
      el.setAttribute('asclasses', delayed.join(' , '))
   }
   // Process inline styles
   if (el.getAttribute('asstyles') !== null) {
      var styles = el.getAttribute('asstyles').split(/\s*,,\s*/)
      var delayed = []
      for (var i = 0; i < styles.length; i++) {
         styles[i] = styles[i].trim()
         var p1 = styles[i].lastIndexOf('?')
         var p2 = styles[i].lastIndexOf('|')
         if (p2 == -1) {
            styles[i] += '|'
            p2 = styles[i].length-1
         }
         var cond = styles[i].slice(0, p1).trim()
         if (cond.match(/\$value\['__parent'\]/) && !post) {
            delayed.push(styles[i])
            continue
         }
         var s1 = styles[i].slice(p1+1, p2).trim()
         var s2 = styles[i].slice(p2+1).trim()
         var result = s2
         try {
            if (eval('now = window.now; $value = ' + JSON.stringify(val) + ', $index = ' + (index !== undefined ? parseInt(index) : -1) + ', ' + calcDates(cond))) {
               result = s1
            }
         } catch (ex) {}
         if (result.length) el.setAttribute('style', (el.getAttribute('style') ? el.getAttribute('style') + ' ' : '') + result)
      }
      el.setAttribute('asstyles', delayed.join(' ,, '))
   }
}

function processAttrs(el, val, index, post) {
   if (el.getAttribute('asattrs') !== null) {
      var attrs = el.getAttribute('asattrs').split(/\s*,\s*/)
      var delayed = []
      for (var i = 0; i < attrs.length; i++) {
         attrs[i] = attrs[i].trim()
         var p1 = attrs[i].lastIndexOf('?')
         var p2 = attrs[i].lastIndexOf('|')
         if (p2 == -1) {
            attrs[i] += '|'
            p2 = attrs[i].length-1
         }
         var cond = attrs[i].slice(0, p1).trim()
         if (cond.match(/\$value\['__parent'\]/) && !post) {
            delayed.push(attrs[i])
            continue
         }
         var s1 = attrs[i].slice(p1+1, p2).trim()
         var s2 = attrs[i].slice(p2+1).trim()
         var result = s2
         try {
            if (eval('now = window.now; $value = ' + JSON.stringify(val) + ', $index = ' + (index !== undefined ? parseInt(index) : -1) + ', ' + calcDates(cond))) {
               result = s1
            }
         } catch (ex) {}
         if (result.length) {
            var p = result.split('=')
            for (var i = 0; i < p.length-1; i++) {
               if (p[i][p[i].length-1].match(/[!=]/) || p[i+1] == '' || p[i+1][0] == '=') {
                  if (p[i+1] == '') {
                     p[i] += '=='
                     if (i < p.length-1) {
                        p[i] += p[i+2]
                        p.splice(i+2, 1)
                     }
                  }
                  else p[i] += p[i+1]
                  p.splice(i+1, 1)
               }
            }
            if (p.length <= 2) { 
               if (p[1]) p[1] = p[1].replace(/^"/, '').replace(/([^\\])"$/, '$1')
               else p.push('')
               el.setAttribute(p[0], p[1])
            }
         }
      }
      el.setAttribute('asattrs', delayed.join(' , '))
   }
}

function cleanupAttrs(el) {
   var attrs = []
   for (var i = 0; i < el.attributes.length; i++) {
      attrs.push(el.attributes[i])
   }
   for (var i = 0; i < attrs.length; i++) {
      var attr = attrs[i].name
      if (attr.match(/^as(if|classes|styles|attrs|placeholder)$/)) {
         if (attr.match(/^as(classes|styles|attrs)$/) && attrs[i].value.length) continue
         el.removeAttribute(attr)
      }
   }
}

function processInputValue(el) {
   if (el.tagName == 'INPUT' && el.getAttribute('asvalue')) {
      el.value = el.getAttribute('asvalue')
      el.removeAttribute('asvalue')
   }
}

function calcDates(str, nowrap) {
   str = str.replace(/(^|[\s{])\$(?:now\.((?:((?:plus|minus)(?:Hour|Day|Week|Month|Year))(\(\d+\))?\.)*)(timestamp|date(?:time)?|format\(('[^']+'|[^()]+)\)))([\s:,}]|$)/g, function() {
      var wrap = !nowrap && !arguments[0].match(/\.timestamp/) ? "'" : ''
      var date = now()
      var s = arguments[2]
      while (m = s.match(/^((?:plus|minus)(?:Hour|Day|Week|Month|Year))(\(\d+\))?\./)) {
         if (m[1]) date = date[m[1]].call(date, m[2] && m[2].slice(1, -1))
         s = s.slice(m[0].length)
      }
      arguments[6] = arguments[6].replace(/^'/, '').replace(/'$/, '')
      var result = arguments[6] && arguments[6].length ? date.format(arguments[6]) : date[arguments[5]].call(date)
      return arguments[1] + wrap + result + wrap + arguments[7]
   })
   return str
}

function getFuncArgs(el, val) {
   if (el.asValIndex > -1) el.asTplArgs[el.asValIndex] = val
   for (var i = 0; i < el.asTplArgs.length; i++) {
      if (el.asTplStacks[i]) {
         var s = el.asTplStacks[i].tokens.slice()
         var data = val
         for (var j = 0; j < s.length; j++) {
            if (!s[j].charAt && s[j].value) s[j] = eval(s[j].value)
            data = data instanceof Object && s[j].match && s[j].match(/^[a-z][a-z0-9$@#_-]*$/i) ||
                  data instanceof Array && !isNaN(parseInt(s[j])) ?
                     data[s[j]] : data
            if (data == undefined) break
         }
         el.asTplArgs[i] = data
      }
   }
}

function formatDate(e, n) {
   var t = {
      DD: function (e) {
         return p(2, '' + e.getDate())
      },
      D: function (e) {
         return '' + e.getDate()
      },
      MMMM: function(e) {
         return e.toLocaleDateString(navigator.language, {month: 'long'})
      },
      MMM: function(e) {
         return e.toLocaleDateString(navigator.language, {month: 'long'}).slice(0, 3)
      },
      MM: function (e) {
         return p(2, '' + (e.getMonth() + 1))
      },
      M: function (e) {
         return '' + (e.getMonth() + 1)
      },
      YYYY: function (e) {
         return p(4, '' + e.getFullYear())
      },
      YY: function (e) {
         return ('' + e.getFullYear()).substr( - 2)
      },
      HH: function (e) {
         return p(2, '' + e.getHours())
      },
      H: function (e) {
         return '' + e.getHours()
      },
      mm: function (e) {
         return p(2, '' + e.getMinutes())
      },
      m: function (e) {
         return '' + e.getMinutes()
      },
      ss: function (e) {
         return p(2, '' + e.getSeconds())
      },
      s: function (e) {
         return '' + e.getSeconds()
      }
   }
   function p(e, t) {
      return t.length >= e ? t : p(e, '0' + t)
   }
   
   return r = null, n.replace((r = Object.keys(t).concat('\\[[^\\[\\]]*\\]'), new RegExp(r.join('|'), 'g')), (function (n) {
      return t.hasOwnProperty(n) ? t[n](e)  : n.replace(/\[|\]/g, '')
   }));
}

function addProperty(obj, name, options) {

   // wrapper functions
   var
      oldValue = obj[name],
      getFn = function () {
         return options.get.apply(obj, [oldValue]);
      },
      setFn = function (newValue) {
         return oldValue = options.set.apply(obj, [newValue]);
      };

   // Modern browsers, IE9+, and IE8 (must be a DOM object),
   if (Object.defineProperty) {

      Object.defineProperty(obj, name, {
         get: getFn,
         set: setFn
      });

   // Older Mozilla
   } else if (obj.__defineGetter__) {

      obj.__defineGetter__(name, getFn);
      obj.__defineSetter__(name, setFn);

   }
}


function watch() {
   if (timer) return
   timer = setInterval(function() {
      var cache = as.cache
      for (var el in cache) {
         var module = cache[el].module
         var scope = cache[el].scope
         if (JSON.stringify(cache[el].value) == JSON.stringify(scope[module])) continue
         cache[el].value = scope[module]
         render(module, scope)
      }
   }, 800)
}

function stopWatch() {
   if (timer) {
      clearInterval(timer)
      timer = null
   }
}

if (!('defineProperty' in Object) && document.all) watch();

var timer = null

window.now = function() {
   var date = new Date()
   var o = {}
      
   o.raw = function(){
      return date;
   }
      
   o.timestamp = function(){
      return +date;
   }
      
   o.date = function(){
      return formatDate(date, 'YYYY-MM-DD')
   }
      
   o.datetime = function(){
      return formatDate(date, 'YYYY-MM-DD HH:mm:ss')
   }
      
   o.minusHour = function(n) {
      date.setHours(date.getHours()-(n || 1))
      return this
   }
   
   o.plusHour = function(n) {
      date.setHours(date.getHours()+(n || 1))
      return this
   }
   
   o.minusDay = function(n) {
      date.setDate(date.getDate()-(n || 1))
      return this
   }
   
   o.plusDay = function(n) {
      date.setDate(date.getDate()+(n || 1))
      return this
   }
   
   o.minusWeek = function(n) {
      date.setDate(date.getDate()-(n || 1)*7)
      return this
   }
   
   o.plusWeek = function(n) {
      date.setDate(date.getDate()+(n || 1)*7)
      return this
   }
   
   o.minusMonth = function(n) {
      date.setMonth(date.getMonth()-(n || 1))
      return this
   }
   
   o.plusMonth = function(n) {
      date.setMonth(date.getMonth()+(n || 1))
      return this
   }
   
   o.minusYear = function(n) {
      date.setMonth(date.getMonth()-(n || 1))
      return this
   }
   
   o.plusYear = function(n) {
      date.setMonth(date.getMonth()+(n || 1))
      return this
   }
   
   o.format = function(s) {
      return formatDate(date, s)
   }
      
   return o;
}

})()