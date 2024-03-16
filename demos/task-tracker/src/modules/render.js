import { processElement, findValue } from './core.js';
import { compileTemplate } from './compile.js';
import { processCSS, processAttrs, cleanupAttrs } from './process.js'
import { formatDate, calcDates } from './time.js';

export function renderTemplate(el, val, scope, _scope, args) {
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
               as.components[el.getAttribute('asref')] = { template: el.outerHTML }
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
      
      var hints = args[1] && args[1] == el.getAttribute('asmodel') ? args[5] : as.hints[_key]
      
      if (el.getAttribute('aslist') !== null && val && val instanceof Array) {
         var range = [0, val.length-1]
         if (el.getAttribute('aslist').match(/^[0-9]+:[0-9]+$/)) {
            range = el.getAttribute('aslist').split(':')
         } else if (hints && hints.add) {
            var result = ''
            for (var j = 0; j < hints.add.length; j++) {
               var i = hints.add[j]
               result += f(el, val[i]).replace(/\s+$/, '').replace('{$index}', i+1).replace('{\\$index}', '{$index}')
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
            var result = f(el, val[hints.index]).replace(/\s+$/, '').replace('{$index}', i+1).replace('{\\$index}', '{$index}')
            
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