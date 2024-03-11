(function() {

if (!('defineProperty' in Object) && !('__defineSetter__' in Object) || !('JSON' in window)) {
   var s = document.getElementsByTagName('script')
   for (var i = 0; i < s.length; i++) {
      if (s[i].src.match(/(^|\/)autosync.js$/)) {
         s[i].src = s[i].src.replace(/autosync(-min)?.js$/, 'autosync-compat$1.js')
      }
   }
   return
}

window.as = {
   cache: {},
   hooks: { before: {}, after: {} },
   hints: {},
   add: function(module, scope, key, atomic, val) {
      if (!scope) scope = window;
      var _scope = scope;
      if (_scope.toString() == _scope) {
         scope = eval(scope);
      }
      if (!val && scope[module]) {
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
      if (_scope.toString() == _scope) {
         scope = eval(scope);
      }
      key = key || ''
      var val = scope[module];
      delete scope[module];
      if (!unset) scope[module] = val.export();
      delete this.hints[module + '#' + key];
      clearEmbedsFor(module, scope);
      delete this.events[module + '#' + key];
      return this;
   },
   pull: function(module, scope, update, url, key) {
      if (!scope) scope = window;
      var _scope = scope;
      if (_scope.toString() == _scope) {
         scope = eval(scope);
      }
      var data = scope[module.split('.')[0]];
      var els = document.querySelectorAll ? document.querySelectorAll('[asmodel^="' + module + '"]') : document.getElementsByTagName('*');
      for (var i = 0; i < els.length; i++) {
         if (!els[i].tagName.toLowerCase().match(/^(textarea|input)$/)) continue;
         var prop = els[i].getAttribute('asmodel');
         if (prop.match(new RegExp('^' + module + '[a-z0-9$@#_-]', 'i'))) continue;
         
         var el_scope = els[i].getAttribute('asscope')
         if (_scope.toString() == _scope && el_scope !== null && el_scope != _scope) continue;
         
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
      if (scope.toString() == scope) {
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
            els[k].ashandlers[module] = true
         }
      }
   },
   clearEvents(module, scope, selector, type, func) {
      if (!scope) scope = 'window'
      if (scope.toString() == scope) {
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
         throw Error()
      }
      if (s[j] == '*' && j == s.length-1) return val
      val = val instanceof Object && s[j].match(/^[a-z][a-z0-9$@#_-]*$/i) ||
            val instanceof Array && !isNaN(parseInt(s[j])) ?
               val[s[j]] : val
      if (val == undefined) break
   }
   return val
}

function processEmbeds(module, scope, _clear, noupdate) {
   for (var i = 0; i < as.embeds.length; i++) {
      var context = as.embeds[i].scope
      var str = as.embeds[i].str
      
      var p = str.split(/\s*->\s*/).slice(0, 2)
      var p1 = p[0].split(/\s*:\s*/)
      var p2 = p[1].split(/\s*:\s*/)
      var id = p1[1] || 'id'
      var ref = p2[1]
      var field = p2[2] || (ref.match(/_id$/) ? ref.slice(0, -3) : '')
      
      if (module.indexOf(p1[0]) == -1 && p1[0].indexOf(module) == -1) continue
      
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
            o[id] = v2[k][ref]
            var el = _clear ? null : v1.find(o)
            if (!el && !_clear) continue
            if (field instanceof Array) {
               for (var j = 0; j < field.length; j++) {
                  delete v2[k][field[j]]
                  var to = '', from = field[j]
                  if (field[j].match(/.+>.+/)) {
                     to = field[j].split('>')[1].trim()
                     from = field[j].split('>')[0].trim()
                  } else {
                     var prefix = p1[0].split('.').pop().replace(/s$/, '')
                     to = prefix != from ? prefix + '_' + from : from
                  }
                  if (!_clear) v2[k][to] = el[from] && el[from].export && el[from].export() || el[from]
               }
            } else {
               delete v2[k][field]
               if (!_clear) v2[k][field] = Object.freeze ? Object.freeze(el.export()) : el.export()
            }
         }
      } else {
         o[id] = v2[i][ref]
         var el = _clear ? null : v1.find(o)
         if (!el && !_clear) continue
         if (field instanceof Array) {
            for (var j = 0; j < field.length; j++) {
               delete v2[i][field[j]]
               var to = '', from = field[j]
               if (field[j].match(/.+>.+/)) {
                  to = field[j].split('>')[1].trim()
                  from = field[j].split('>')[0].trim()
               } else {
                  var prefix = p1[0].split('.').pop().replace(/s$/, '')
                  to = prefix != from ? prefix + '_' + from : from
               }
               if (!_clear) v2[k][to] = el[from] && el[from].export && el[from].export() || el[from]
            }
         } else {
            delete v2[i][field]
            if (!_clear) v2[i][field] = Object.freeze ? Object.freeze(el.export()) : el.export()
         }
      }
      if (module != p2[0] && p2[0].split('.')[0] in context && !noupdate) {
         as.update(p2[0], context)
      }
   }
}

function clearEmbeds(scope, str) {
   var p = str.split(/\s*->\s*/).slice(0, 2)
   var p1 = p[0].split(/\s*:\s*/)
   if (p1.length) processEmbeds(p1[0], scope, true)
}

function clearEmbedsFor(module, scope) {
   processEmbeds(module, scope, true, true)
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

   var value = val, _sc = _scope, sc = scope, render_root = root || module, mkey = key || ''
   
   if ('defineProperty' in Object) {
      Object.defineProperty(sc, module.split('.').pop(), {
      
         get: function(){
            return value;
         },

         set: function(val){
            value = val;
            if (val && !val.charAt) {
               for (var key in val) {
                  if (val instanceof Array && key !== +key) continue
                  createProxy(val[key], module + '.' + key, _scope, val, root);
               }
            }
            initRender(render_root, _sc, mkey, null, module, val);
         },

         configurable: true
      });
   } else if ('__defineSetter__' in scope) {
      scope.__defineSetter__(module.split('.').pop(), function(val) {
         value = val;
         if (val && !val.charAt) {
            for (var key in val) {
               if (val instanceof Array && key !== +key) continue
               createProxy(val[key], module + '.' + key, _scope, val, root);
            }
         }
         initRender(render_root, _sc, mkey, null, module, val);
      });
   }
   
   if (val && !val.charAt) {
      for (var key in val) {
         if (val instanceof Array && key != +key) continue
         createProxy(val[key], module + '.' + key, _scope, val, root);
      }
   }
   if (val instanceof Array) {
      var a = ['push', 'pop', 'shift', 'unshift', 'splice']
      var o = new Function(); o.prototype = Array.prototype
      val.__proto__ = new o()
      for (var i = 0; i < a.length; i++) {
         (function() {
            var method = a[i]
            val.__proto__[method] = function() {
               var args = arguments
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
               as.hints[module + '#' + key] = hints;
               
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
      val.__proto__.map = function(f) {
         var result = []
         if (!(f instanceof Function)) return null
         for (var i = 0; i < this.length; i++) {
            result.push(f(this[i]))
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
         return JSON.stringify(this, ' ', 2)
      }
      val.__proto__.export = function() {
         return JSON.parse(JSON.stringify(this))
      }
   }
   
}

Array.prototype.export = function() {
   var result = []
   for (var i = 0; i < this.length; i++) {
      result.push(this[i].export && this[i].export instanceof Function ? this[i].export() : this[i])
   }
   return result
}

function initRender(render_root, _sc, mkey, hints, module, val) {
   
   var _root = fixRoot(render_root, mkey)
   
   var info = { value: val, module: module, context: _sc, key: mkey, root: _root, sourceRoot: render_root, hints: hints }
   
   var funcs = [as.hooks.before[module + '#' + mkey]];
   
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
   
   processEmbeds(_root, _sc)
   
   var start = +(new Date())

   render(_root, _sc, mkey, hints);
   
   var end = +(new Date())
   
   if (as.debug) console.log('DOM tree update: ' + (end - start) + 'ms');
   info.timeTaken = end - start;
   
   funcs = [as.hooks.after[module + '#' + mkey]];
   
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
      if (!as.hints[module + '#' + key]) as.hints[module + '#' + key] = {}
      as.hints[module + '#' + key].index = parseInt(prev)
   }
   return module
}

function needsAtomic(module, scope, key) {
   if (!scope) scope = 'window'
   var _scope = scope;
   if (_scope.toString() == _scope) {
      scope = eval(scope);
   }
   var els = document.querySelectorAll ? document.querySelectorAll('[asmodel^="' + module + '"]') : document.getElementsByTagName('*')
   for (var i = 0; i < els.length; i++) {
      var prop = els[i].getAttribute('asmodel');
      if (prop === null || (document.all && !prop.match(new RegExp('^' + module))) || 
          prop.match(new RegExp('^' + module + '[a-z0-9$@#_-]', 'i'))) continue
      
      var el_scope = els[i].getAttribute('asscope')
      if (_scope.toString() == _scope && el_scope !== null && el_scope != _scope) continue;
      
      var el_key = els[i].getAttribute('askey')
      if (el_key != null && el_key != key && el_key != '*') continue
      
      if (els[i].getAttribute('astemplate') !== false && !els[i].astemplate) {
         els[i].astemplate = els[i].getAttribute('astemplate')
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
   if (_scope.toString() == _scope) {
      scope = eval(scope);
   }
   var data = scope[module.split('.')[0]]
   var els = []
   if (document.querySelectorAll) {
      els = document.querySelectorAll('[asmodel^="' + module + '"]')
      els = Array.prototype.filter.call(els, function(el) {
         var _el = el.parentNode
         while (_el && _el.getAttribute) {
            if (_el.getAttribute('asmodel') !== null) return false
            _el = _el.parentNode
         }
         return true
      })
   } else {
      var els = Array.prototype.filter.call(document.getElementsByTagName('*'), function(el) {
         if (!el.getAttribute || !el.getAttribute('asmodel') || !el.getAttribute('asmodel').match(new RegExp('^' + module))) return false
         var _el = el.parentNode
         while (_el && _el.getAttribute) {
            if (_el.getAttribute('asmodel') !== null) return false
            _el = _el.parentNode
         }
         return true
      })
   }
   for (var i = 0; i < els.length; i++) {
      if (as.debug) console.log(els[i])
      processElement(els[i], data, module, scope, _scope, key, hints)
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
   
   if (el.getAttribute('asif') !== null && el.getAttribute('asif').length) {
      try {
         if (!eval('$value = ' + JSON.stringify(parent_val) + ', ' + calcDates(el.getAttribute('asif')))) {
            el.ashidden = true
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
   if (_scope.toString() == _scope && el_scope !== null && el_scope != _scope) return;
   
   var el_key = el.getAttribute('askey')
   if (el_key != null && el_key != key && el_key != '*') return
   
   if (el.getAttribute('astemplate') !== false && !el.astemplate) {
      el.astemplate = el.getAttribute('astemplate')
   }
   var is_input = el.tagName.toLowerCase().match(/^(textarea|input)$/)
   var s = prop.split('.')
   var val = data
   for (var j = 1; j < s.length; j++) {
      if (val instanceof Object && s[j].match(/^[a-z][a-z0-9$@#_-]*$/i) && !(s[j] in val)) {
         console.error("Cannot find field '" + s[j] + "' in model '" + s.slice(0, j).join('.') + "'")
         break
      }
      val = val instanceof Object && s[j].match(/^[a-z][a-z0-9$@#_-]*$/i) ||
            val instanceof Array && !isNaN(parseInt(s[j])) ?
               val[s[j]] : val
      if (val == undefined) break
   }
   
   if (!el.astemplate && (el.innerHTML.indexOf('{$value') != -1 || el.innerHTML.match(/^func:/))) {
      el.astemplate = el.innerHTML
      el.innerHTML = ''
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
            return
         }
      }
      if (hints.add.filter(function(i) { return i > range[1] }).length == hints.add.length &&
          hints.remove.filter(function(i) { return i > range[1] }).length == hints.remove.length) {
         el.asprocessedtime = +(new Date())
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
      return
   }
   
   if (is_input && el.originalPlaceholder) {
      el.placeholder = el.originalPlaceholder
   }
   
   var patch = false, _index = index
   
   if (val instanceof Array && as.hints[module + '#' + key] && as.hints[module + '#' + key].index !== undefined &&
       val.length == el.children.length && !is_input) {
      var index = as.hints[module + '#' + key].index
      
      var _el = el
      
      _val = val
      
      val = val[index]
      el = el.children[index]
      el.astemplate = el.parentNode.astemplate
      
      if (el.astemplate) {
         var output = renderTemplate(el, val, scope, [data, module, scope, _scope, key, hints])
         el.outerHTML = output
      }
      
      processEventsRecursive(_el, _val, module, scope, index)
      delete el.astemplate
      _el.asprocessedtime = +(new Date())
      return
   }

   var output = null
   if (val instanceof Object && !el.astemplate) output = formatJSON(el, val)
   if (el.astemplate) output = renderTemplate(el, val, scope, [data, module, scope, _scope, key, hints])
   updateView(el, output, is_input)
   if (!hints || !hints.ignore_children) {
      index = as.hints[module + '#' + key] && as.hints[module + '#' + key].index
      var _el = getRootModule(el)
      if (_el && _el != el) {
         val = findValue(scope, _el.getAttribute('asmodel'))
         index = undefined
      }
      processEventsRecursive(_el || el, val, module, scope, index)
   }
   el.asprocessedtime = +(new Date()) 
}

function processEventsRecursive(el, val, module, scope, index) {
   for (var i = 0; i < el.children.length; i++) {
      processEventsRecursive(el.children[i], val, module, scope, index)
   }
   processEvents(el, val, module, scope, index)
}

function processEvents(el, val, module, scope, index) {
   if (!scope) scope = window
   if (index === undefined) index = -1
   for (var i = 0; i < el.attributes.length; i++) {
      if (el.attributes[i].name.match(/^as-on/)) {
         
         var attr_val = el.attributes[i].value
         var modifiers = el.attributes[i].name.slice(el.attributes[i].name.indexOf(':')+1).split(':')
         
         attr_val = attr_val.replace(/([a-zA-Z0-9$_-]+)(?=\()/g, function() {
            var name = arguments[1]
            if (name.match(/^(for|while|with|switch|function)$/)) return name 
            var index = arguments[2]
            if (index > 0 && attr_val.charAt(index-1) == '.') return name
            return '(scope.funcs && scope.funcs.' + name + ' || scope.' + name + ' || window.' + name + ')'
         })
         
         attr_val = calcDates(attr_val)
         
         var pos = el.attributes[i].name.indexOf(':')
         var func = new Function('event', 'value', 'scope', 'index', attr_val)
         var type = el.attributes[i].name.slice(5, pos > 5 ? pos : null)
         var f = function(modifiers) {
            return function(event) {
               func.call(this, event, val || scope, scope, index)
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
         addEventHandler(el, type, f)
         if (!as.debug) el.removeAttribute(el.attributes[i].name)
         if (!el.asevents) el.asevents = {}
         if (!el.asevents[type]) el.asevents[type] = {}
         el.asevents[type] = true
      }
   }
   addCustomEvents(el, val, module, scope, index)
}

function addCustomEvents(el, val, module, scope, index) {
   if (!scope) scope = 'window'
   if (scope.toString() == scope) {
      scope = eval(scope)
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
            
            if (els[k].ashandlers && els[k].ashandlers.indexOf(module) != -1) continue
            
            var f = (function(index) {
               return function(event) {
                  setTimeout(function() { e.handler.call(this, event, findValue(scope, module), scope, index) }, 0)
               }
            })(index)
            
            e._handlers[index] = f
            
            addEventHandler(els[k], e.type, f)
            if (!els[k].ashandlers) els[k].ashandlers = []
            els[k].ashandlers.push(module)
         }
      }
   }
}

function addEventHandler(el, type, func) {
   if (el.addEventListener) {
      el.addEventListener(type, func)
   } else {
      el.attachEvent('on' + type, func)
   }
}

function removeEventHandler(el, type, func) {
   if (el.removeEventListener) {
      el.removeEventListener(type, func)
   } else {
      el.detachEvent('on' + type, func)
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

function compileTemplate(el, val, scope) {
   if (el.astemplate.match(/^func:/)) {
      // Compile only once
      if (el.asTplFunc == undefined) {
         el.asTplStacks = []
         var tpl = el.astemplate.slice(5)
         var pos = tpl.indexOf('(')
         var func_name = tpl.slice(0, pos)
         if (scope[func_name] ||
             scope.funcs && scope.funcs[func_name]) {
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
            el.asTplFunc = scope.funcs && scope.funcs[func_name] || scope[func_name]
            el.asTplArgs = args
         } else {
            el.asTplFunc = scope.funcs && scope.funcs[func_name] || scope[func_name]
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
         while (tpl.indexOf('{$value[', pos) != -1) {
            var pos = tpl.indexOf('{$value[', pos) + 8
            last = pos - 8
            var n = 1, state = 0, quote = '', token = '', error = false
            while (pos < tpl.length) {
               var c = tpl.charAt(pos)
               if (n == 0 && state == 0) {
                  if (c == '[') {
                     n = 1, pos++
                     continue
                  } else if (c == '}') {
                     break
                  }
                  if (c == '|') {
                     n = 0
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
                        else if (tpl.charAt(pos) == '}' && n == 0) {
                           flag = true; break
                        }
                     }
                     if (flag) el.asTplStacks[index].extra = tpl.slice(_pos, pos)
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

function renderTemplate(el, val, scope, args) {
   if (el.astemplate.match(/^func:/)) {
      if (!el.asTplFunc) compileTemplate(el, val, scope)
      if (!el.getAttribute('aslist')) {
         getFuncArgs(el, val)
         return el.asTplFunc && el.asTplFunc.apply(scope, el.asTplArgs) || ''
      } else if (val && val.length === +val.length) {
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
      if (el.astemplate.indexOf('{$value}') != -1) {
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
               if (data === undefined) data = "{$value['" + el.asTplStacks[i].tokens.join("']['") + "']}"
               if (data instanceof Date) {
                  var format = el.asTplStacks[i].extra && el.asTplStacks[i].extra.split('|')[0].slice(1,-1) || 'DD.MM.YYYY HH:mm:ss'
                  data = formatDate(data, format)
               }
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
            for (var i = 0; i < el.children.length; i++) {
               checkChildElements(el.children[i])
            }
            if (!el.getAttribute('asmodel') && (el.getAttribute('astemplate') && el.getAttribute('astemplate').match(/^func:/) || el.innerHTML.match(/^func:/)) && val) {
               if (el.getAttribute('astemplate') === null) {
                  el.astemplate = el.innerHTML
               } else if (el.getAttribute('astemplate') !== null && !el.astemplate) {
                  el.astemplate = el.getAttribute('astemplate')
               }
               if (!el.astemplate && (el.innerHTML.indexOf('{$value') != -1 || el.innerHTML.match(/^func:/))) {
                  el.astemplate = el.innerHTML
                  el.innerHTML = ''
               }
               if (!el.asTplFunc) compileTemplate(el, val, scope)
               var source = el.outerHTML.replace(/\s+$/, '')
               getFuncArgs(el, val)
               el.innerHTML = el.asTplFunc && el.asTplFunc.apply(scope, el.asTplArgs) || ''
            }
            if (el.getAttribute('asmodel')) {
               if (!args[5]) args[5] = {}
               args[5]['ignore_children'] = true
               processElement.apply(this, [el].concat(args).concat([val]))
               args[5]['ignore_children'] = false
            }
            processCSS(el, val, index)
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
      
      var hints = as.hints[el.getAttribute('asmodel')]
      
      if (el.getAttribute('aslist') !== null && val && val.length === +val.length) {
         var range = [0, val.length-1]
         if (el.getAttribute('aslist').match(/^[0-9]+:[0-9]+$/)) {
            range = el.getAttribute('aslist').split(':')
         } else if (hints && hints.add) {
            var result = ''
            for (var j = 0; j < hints.add.length; j++) {
               var i = hints.add[j]
               result += f(el, val[i]).replace(/\s+$/, '').replace('{$index}', i).replace('{\\$index}', '{$index}')
            }
            var b = document.createElement('div')
            b.style.display = 'none'
            b.innerHTML = result
            
            var n1 = el.children.length / (val.length - hints.add.length)
            var n2 = b.children.length / hints.add.length
            if (n1 == n2) {
               for (var i = 0; i < hints.add.length; i++) {
                  for (var j = 0; j < n1; j++) {
                     var index = (hints.add[i] * n1) + j
                     if (index < el.children.length) el.insertBefore(b.children[i * n1 + j], el.children[index])
                     else el.appendChild(b.children[i * n1 + j])
                  }
               }
               return el.innerHTML
            }
         } else if (hints && hints.index !== undefined) {
            var result = f(el, val[hints.index]).replace(/\s+$/, '').replace('{$index}', i).replace('{\\$index}', '{$index}')
            
            var b = document.createElement('div')
            b.style.display = 'none'
            b.innerHTML = result
            
            var n1 = el.children.length / val.length
            var n2 = b.children.length
            if (n1 == n2) {
               for (var j = 0; j < n1; j++) {
                  var index = (hints.index * n1) + j
                  if (index < el.children.length) el.insertBefore(b.children[j], el.children[index])
                  else el.appendChild(b.children[j])
                  if (index+1 < el.children.length) el.removeChild(el.children[index+1])
               }
               return el.innerHTML
            }
         }
         
         var now = +(new Date())
         var cache_data = as.cache[el.getAttribute('asmodel')]
         
         var expired = !cache_data || +cache_data.time < now - 500
         
         var matches = cache_data && cache_data.template == el.astemplate && cache_data.data == val && val == as.hints.source
   
         if (!expired && matches) {
            return cache_data.output
         }
         
         var result = ''
         for (var i = +range[0]; i <= +range[1]; i++) {
            result += f(el, val[i], i).replace(/\s+$/, '').replace('{$index}', i).replace('{\\$index}', '{$index}')
         }
         
         if (expired || !matches) {
            as.cache[el.getAttribute('asmodel')] = { time: now, template: el.astemplate.slice(), data: val, output: result }
         }
         
         return result
      }
      
      return f(el, val)
   }
}

function processCSS(el, val, index) {
   // Process CSS classes
   if (el.getAttribute('asclasses') !== null) {
      var classes = el.getAttribute('asclasses').split(/\s*,\s*/)
      for (var i = 0; i < classes.length; i++) {
         classes[i] = classes[i].trim()
         var p1 = classes[i].lastIndexOf('?')
         var p2 = classes[i].lastIndexOf('|')
         if (p2 == -1) classes[i] += '|'
         var cond = classes[i].slice(0, p1).trim()
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
   }
   // Process inline styles
   if (el.getAttribute('asstyles') !== null) {
      var styles = el.getAttribute('asstyles').split(/\s*,,\s*/)
      for (var i = 0; i < styles.length; i++) {
         styles[i] = styles[i].trim()
         var p1 = styles[i].lastIndexOf('?')
         var p2 = styles[i].lastIndexOf('|')
         if (p2 == -1) styles[i] += '|'
         var cond = styles[i].slice(0, p1).trim()
         var s1 = styles[i].slice(p1+1, p2).trim()
         var s2 = styles[i].slice(p2+1).trim()
         var result = s2
         try {
            if (eval('now = window.now; $value = ' + JSON.stringify(val) + ', ' + calcDates(cond))) {
               result = s1
            }
         } catch (ex) {}
         if (result.length) el.setAttribute('style', (el.getAttribute('style') ? el.getAttribute('style') + ' ' : '') + result)
      }
   }
}

function cleanupAttrs(el) {
   var attrs = []
   for (var i = 0; i < el.attributes.length; i++) {
      attrs.push(el.attributes[i])
   }
   for (var i = 0; i < attrs.length; i++) {
      var attr = attrs[i].name
      if (attr.match(/^as(if|classes|styles|placeholder)$/)) el.removeAttribute(attr)
   }
}

function calcDates(str, nowrap) {
   str = str.replace(/(^|[\s{])\$(?:now\.((?:((?:plus|minus)(?:Hour|Day|Week|Month|Year))(\(\d+\))?\.)*)(timestamp|date(?:time)?|format\(('[^']+'|[^()]+)\)))([\s:,}]|$)/g, function() {
      var wrap = !nowrap && !arguments[0].match(/\.timestamp/) ? "'" : ''
      var date = now
      var s = arguments[2]
      while (m = s.match(/^((?:plus|minus)(?:Hour|Day|Week|Month|Year))(\(\d+\))?\./)) {
         if (m[1]) date = date[m[1]].call(date, m[2] && m[2].slice(1, -1))
         s = s.slice(m[0].length)
      }
      var result = arguments[6] && arguments[6].length ? date.format(arguments[6]) : date[arguments[5]]
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
      MM: function (e) {
         return p(2, '' + (e.getMonth() + 1))
      },
      M: function (e) {
         return '' + (e.getMonth() + 1)
      },
      MMM: function(e) {
         date.toLocaleDateString(navigator.language, {month: 'long'}).slice(0, 3)
      },
      MMMM: function(e) {
         date.toLocaleDateString(navigator.language, {month: 'long'})
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

Object.defineProperty(window, 'now', {
   get: function(){

      var date = new Date()
      var o = {}
      
      Object.defineProperty(o, 'raw', {
         get: function(){
            return date;
         }
      })
      
      Object.defineProperty(o, 'timestamp', {
         get: function(){
            return +date;
         }
      })
      
      Object.defineProperty(o, 'date', {
         get: function(){
            return formatDate(date, 'YYYY-MM-DD')
         }
      })
      
      Object.defineProperty(o, 'datetime', {
         get: function(){
            return formatDate(date, 'YYYY-MM-DD HH:mm:ss')
         }
      })
      
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
})

})()