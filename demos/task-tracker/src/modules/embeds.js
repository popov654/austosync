import { findValue } from './core.js';

export function processEmbeds(module, scope, options, src_module) {
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

export function updateEmbeds(val, module, scope) {
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

export function clearEmbeds(scope, str) {
   var p = str.split(/\s*->\s*/).slice(0, 2)
   var p1 = p[0].split(/\s*:\s*/)
   if (p1.length) processEmbeds(p1[0], scope, { clear: true })
}

export function clearEmbedsFor(module, scope) {
   processEmbeds(module, scope, { clear: true, noupdate: true })
   as.embeds = as.embeds.filter(function(embed) {
      return !embed.str.match(new RegExp('(^|->\\s*)' + module + '[.:]'))
   })
}