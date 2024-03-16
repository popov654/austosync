import { findValue } from './core.js';
import { calcDates } from './time.js';

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
            if (eval('now = window.now; $value = ' + JSON.stringify(val) + ', $index = ' + (index !== undefined ? parseInt(index)+1 : -1) + ',' + calcDates(cond))) {
               result = s1
            }
         } catch (ex) {}
         var c = result.split(/\s+/).filter(function(s) { return s.length })
         for (var i = 0; i < c.length; i++) {
            el.classList.add(c[i])
         }
      }
      if (post !== 'self') el.setAttribute('asclasses', delayed.join(' , '))
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
            if (eval('now = window.now; $value = ' + JSON.stringify(val) + ', $index = ' + (index !== undefined ? parseInt(index)+1 : -1) + ', ' + calcDates(cond))) {
               result = s1
            }
         } catch (ex) {}
         if (result.length || el.getAttribute('style') != null) {
            if (post === 'self' && !result.length) {
               el.removeAttribute('style')
            } else {
               el.setAttribute('style', (post !== 'self' && el.getAttribute('style') ? el.getAttribute('style') + ' ' : '') + result)
            }
         }
      }
      if (post !== 'self') el.setAttribute('asstyles', delayed.join(' ,, '))
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
            if (eval('var $value, $index, now; now = window.now; $value = ' + JSON.stringify(val) + ', $index = ' + (index !== undefined ? parseInt(index) : -1) + ',' + calcDates(cond))) {
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

function postProcessConditions(el, _val, prop, module, scope, _scope, key, hints, index) {
   
   processCSS(el, _val, index, 'self')
   processAttrs(el, _val, index, true)
   
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

export { processCSS, processAttrs, cleanupAttrs, postProcessConditions };