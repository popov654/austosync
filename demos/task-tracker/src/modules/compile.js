export function compileTemplate(el, val, scope, args) {
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
                     if (flag) el.asTplStacks[index].extra = e
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