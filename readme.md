## Overview

Autosync is a simple and yet powerful tool for one-way and two-way binding data to DOM elements. The library's core features is minumum network footprint and wide browser support.

## Why?

Suppose you are building a single page application or simple a module of a system with a large number of AJAX elements (dialogs, polls etc.). Assume we have a user profile setting dialog which we wish to open and fill with data retrieved from the server on demand, i.e. when some button is pressed. Before we could solve this problem like this:

    
    function openProfileDialog() {
       var req = new XMLHttpRequest()
       //  Retrieving data
       req.onload = function() {
          var data = JSON.parse(this.responseText)
          var email_field = document.querySelector('#profile_dialog .email')
          var send_news = document.querySelector('#profile_dialog .send_news')
          // ...other elements
          
          email_field.value = data.email
          send_news.checked = !!data.send_news
          // ...assign other values
          
          // show the dialog
          document.getElementById('profile_dialog').style.display = 'block'
          document.getElementById('profile_dialog').style.opacity = '1'
       }
       req.send(null)
    }
    
    function closeProfileDialog(save) {
       // if "Save" button is pressed, then submit the data
       if (save) {
          //  Send the data via POST some way:
          //  submit the form to the hidden iframe element, using FormData,
          //  create a JSON object, form a URI string
       }
       // hide the dialog
       document.getElementById('profile_dialog').style.opacity = '0'
       document.getElementById('profile_dialog').ontransitionend = function() {
          this.style.display = ''
          this.style.ontransitionend = null
       }                  
    }
                   

Not so bad, but what if there will be a lot of such dialogs? Also it is very exhausting to manipulate DOM elements' states manually, especially in large dialogs with a lot of fields.

Let's implement the same logic with Autosync. First we need to provide a model name (a plain JS variable) in the `asmodel` attribute:

    
    <input type="text" class="email" asmodel="profile_settings.email" />
    <input type="checkbox" class="send_news" asmodel="profile_settings.send_news" />
                   

Also in some cases we'll have to provide the context (a name of the object where this variable is stored as a key), if the context is not defined it is automatically assigned the window object. Thanks to providing contexts we are able to have different variables with the same name but different values as models (it is not considered a good practice, but maybe you will really need it), and bind different HTML element groups to these variables.

If you use `window` object as the context, do not declare the model using `var` keyword. In such a case a non-configurable property is created, and Autosync will not be able to redefine it.

All that is left to do now is tell Autosync that we want to use our variables as models and start the synchronization.

    
    as.add('profile_settings')
                   

Autosync does not launch the sync automatically, and for good reasons. One of the most important of them is that most of the data is loaded later asynchronously (lazy load), and there is no reason to process element groups that have no underlying data yet. Also this gives you a fine grained control over when exactly you will fill up your elements with data. Finally, in a fallback implementation for old browsers the watch mechanism is implemented using timers, so an empty model list on the start minimizes the impact on page performance.

Now you can make assignments like `profile_settings = data`, `profile_settings.email = ''`, and your elements will update themselves automatically. To stop the sync call the `remove` method:

    
    as.remove('profile_settings')