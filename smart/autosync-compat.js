(function() {
   
if (!('JSON' in window)) {
   polyfillJSON()
}
   
window.as = {
   cache: {},
   add: function(module, scope, key, atomic, val) {
      if (!scope) scope = window;
      var _scope = scope;
      if (_scope.toString() == _scope) {
         scope = eval(scope);
      }
      if (!val && scope[module]) {
         val = scope[module];
      }
      if (scope == window && !document.all) {
         delete scope[module];
      }
      var self = this;
      
      if (atomic === null || atomic === undefined) {
         atomic = templatesPresent(module, scope, key)
      }
      
      createProxy(val, module, _scope, scope, atomic ? module : null, key)
      
      scope[module] = val;
      return this;
   },
   remove: function(module, scope, unset) {
      if (!scope) scope = window;
      var _scope = scope;
      if (_scope.toString() == _scope) {
         scope = eval(scope);
      }
      var val = scope[module];
      delete scope[module];
      if (!unset) scope[module] = val;
      
      var key = _scope + '_' + module;
      if (key in cache) delete cache[key];
      
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
   }
}

function createProxy(val, module, _scope, scope, root, key) {

   var value = val, _sc = _scope, sc = scope, render_root = root || module, mkey = key
   
   if ('defineProperty' in Object) {
      Object.defineProperty(sc, module.split('.').pop(), {
      
         get: function(){
            return value;
         },

         set: function(val){
            value = val;
            render(render_root, _sc, mkey);
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
            render(render_root, scope);
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
   
   if (!val.charAt) {
      for (var key in val) {
         createProxy(val[key], module + '.' + key, _scope, val, root)
      }
   }
   
}

function templatesPresent(module, scope, key) {
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
      
      if (els[i].getAttribute('asjson') || els[i].astemplate && (els[i].astemplate.match(/^func:/) || els[i].astemplate.match(/$value\[/))) {
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

function render(module, scope, key) {
   if (!scope) scope = 'window'
   var _scope = scope;
   if (_scope.toString() == _scope) {
      scope = eval(scope);
   }
   var data = scope[module.split('.')[0]]
   if (module.indexOf('.') != -1) {
      var s = module.split('.')
      for (var j = 1; j < s.length; j++) {
         data = data instanceof Object && s[j].match(/^[a-z][a-z0-9$@#_-]*$/i) ||
               data instanceof Array && !isNaN(parseInt(s[j])) ?
                  data[s[j]] : data
         if (data == undefined) break
      }
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
      var is_input = els[i].tagName.toLowerCase().match(/^(textarea|input)$/)
      var s = prop.split('.')
      var val = data
      for (var j = 1; j < s.length; j++) {
         val = val instanceof Object && s[j].match(/^[a-z][a-z0-9$@#_-]*$/i) ||
               val instanceof Array && !isNaN(parseInt(s[j])) ?
                  val[s[j]] : val
         if (val == undefined) break
      }
      
      if (!els[i].astemplate && (els[i].innerHTML.indexOf('{$value') != -1 || els[i].innerHTML.match(/^func:/))) {
         els[i].astemplate = els[i].innerHTML
         els[i].innerHTML = ''
      }
      
      if (val instanceof Object && !els[i].astemplate) {
         if (els[i].getAttribute('asjson') && els[i].getAttribute('asjson').match(/^pretty/)) {
            var s = els[i].getAttribute('asjson')
            var space = s.indexOf(':') != -1 ? s.slice(s.indexOf(':')+1).replace(/\\t/g, '\t').replace(/\*([1-9][0-9]*)$/, function(m, n, i, s) {
               var sp = s.slice(0, i), res = sp, n = parseInt(n);
               for (var i = 2; i < n; i++) {
                  res += sp;
               }
               return res
            }) : '4'
            if (space.match(/^[1-9][0-9]*$/)) space = parseInt(space)
         }
         val = JSON.stringify(val, null, els[i].getAttribute('asjson') && els[i].getAttribute('asjson').match(/^pretty/) ? space : 0)
      }
      
      if (els[i].astemplate) val = renderTemplate(els[i], val, scope)
      if (val === undefined) val = ''
      if (is_input) {
         if (els[i].type == 'checkbox' || els[i].type == 'radio') {
            els[i].checked = !!val
         }
         els[i].value = val
      }
      else if (val !== null) els[i].innerHTML = val
   }
}

function compileTemplate(el, val, scope) {
   if (el.astemplate.match(/^func:/)) {
      // Compile only once
      if (el.asTplFunc == undefined) {
         var tpl = el.astemplate.slice(5)
         var pos = tpl.indexOf('(')
         var func_name = tpl.slice(0, pos)
         if (scope[func_name]) {
            var n = 0
            var args = []
            var token = ''
            pos++
            var index = -1
            var c = tpl.charAt(pos)
            if (c == ',') {
               return '[template error]'
            }
            while (pos < tpl.length) {
               c = tpl.charAt(pos)
               if (c == "\\") pos++
               else if (c == "'") {
                  n = (n+1)%2
               }
               else if ((c == "," || pos == tpl.length-1 && c == ')') && n == 0) {
                  args.push(token.match(/^[0-9](\.[0-9]+)?$/) ? Number(token) : token)
                  token = ''
               }
               else if (n == 1 || c.match(/^[0-9.]$/)) {
                  token += c
               } else {
                  if (tpl.slice(pos, pos+6) != '$value' && !(pos == tpl.length-1 && c == ')')) return '[template error]'
                  args.push(val)
                  index = args.length-1
                  pos += 6
                  c = tpl.charAt(pos)
                  if (!(c == ',' || pos == tpl.length-1 && c == ')')) return '[template error]'
               }
               pos++
            }
            el.asTplFunc = scope[func_name]
            el.asTplArgs = args
            el.asValIndex = index
         } else {
            el.asTplFunc = scope[func_name]
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
      stringify: function(obj) {
         var str = ''
         if (obj instanceof Array) {
            str += '['
            for (var i = 0; i < obj.length; i++) {
               str += this.stringify(obj[i]) + ','
            }
            if (str.slice(-1) == ',') str = str.slice(0, -1)
            str = str + ']'
         } else if (obj instanceof Object) {
            str += '{'
            for (var i in obj) {
               str += '"' + i + '"' + ':' + this.stringify(obj[i]) + ','
            }
            if (str.slice(-1) == ',') str = str.slice(0, -1)
            str = str + '}'
         } else {
            str = '"' + obj.toString() + '"'
         }
         return str
      }
   }
}

function renderTemplate(el, val, scope) {
   if (el.astemplate.match(/^func:/)) {
      if (!el.asTplFunc) compileTemplate(el, val, scope)
      if (!el.getAttribute('aslist')) {
         if (el.asValIndex > -1) el.asTplArgs[el.asValIndex] = val
         return el.asTplFunc && el.asTplFunc.apply(scope, el.asTplArgs) || ''
      } else if (val.length && +val.length == val.length) {
         var range = [0, val.length-1]
         if (el.getAttribute('aslist').match(/^[0-9]+:[0-9]+$/)) {
            range = el.getAttribute('aslist').split(':')
         }
         var result = ''
         for (var i = +range[0]; i <= +range[1]; i++) {
            el.asTplArgs[el.asValIndex] = val[i]
            result += el.asTplFunc.apply(scope, el.asTplArgs)
         }
         return result
      }
   } else {
      if (el.astemplate.indexOf('{$value}') != -1) {
         if (val instanceof Object) val = JSON.stringify(val)
         return el.astemplate.replace('{$value}', val)
      }
      
      if (!el.asTplStacks && !el.asTplError) compileTemplate(el, val, scope)
         
      function f(el, val) {
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
            if (data instanceof Object) data = JSON.stringify(data)
            str += data.toString() + parts[i+1]
         }
         return str
      }
      
      if (el.getAttribute('aslist') !== null && val.length && +val.length == val.length) {
         var range = [0, val.length-1]
         if (el.getAttribute('aslist').match(/^[0-9]+:[0-9]+$/)) {
            range = el.getAttribute('aslist').split(':')
         }
         var result = ''
         for (var i = +range[0]; i <= +range[1]; i++) {
            result += f(el, val[i])
         }
         return result
      }
      
      return f(el, val)
   }
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

})()