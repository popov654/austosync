import { getRootModule } from './core.js';
import { calcDates } from './time.js';

function addInputEvents(el, val, module, scope, index) {
   var els = document.querySelectorAll('input[asmodel^="' + module + '"], textarea[asmodel^="' + module + '"]')
   for (var i = 0; i < els.length; i++) {
      if (els[i].hasInputHandler) continue
      addEventHandler(els[i], 'change', function() {
         var module = this.getAttribute('asmodel') || module
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
   if (scope.toString() == scope) {
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

export { processEventsRecursive, addCustomEvents };