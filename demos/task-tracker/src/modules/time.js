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
   
   var r = null;
   
   return n.replace((r = Object.keys(t).concat('\\[[^\\[\\]]*\\]'), new RegExp(r.join('|'), 'g')), (function (n) {
      return t.hasOwnProperty(n) ? t[n](e)  : n.replace(/\[|\]/g, '')
   }));
}

function calcDates(str, nowrap) {
   str = str.replace(/(^|[\s{])\$(?:now\.((?:((?:plus|minus)(?:Hour|Day|Week|Month|Year))(\(\d+\))?\.)*)(timestamp|date(?:time)?|format\(('[^']+'|[^()]+)\)))([\s:,}]|$)/g, function() {
      var wrap = !nowrap && !arguments[0].match(/\.timestamp/) ? "'" : ''
      var date = now
      var s = arguments[2], m = null
      while (m = s.match(/^((?:plus|minus)(?:Hour|Day|Week|Month|Year))(\(\d+\))?\./)) {
         if (m[1]) date = date[m[1]].call(date, m[2] && m[2].slice(1, -1))
         s = s.slice(m[0].length)
      }
      arguments[6] = arguments[6].replace(/^'/, '').replace(/'$/, '')
      var result = arguments[6] && arguments[6].length ? date.format(arguments[6]) : date[arguments[5]]
      return arguments[1] + wrap + result + wrap + arguments[7]
   })
   return str
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

export { formatDate, calcDates };