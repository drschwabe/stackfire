# Stack

Stack is a route driven state management library that leverages a familiar callback and middleware pattern used in Express.  


## Install
```
npm install --save stack
```

## Usage
```javascript
var stack = require('stack')

stack.on('/do-something', (state, next) => {
   //modify state here, then pass it along: 
   next(null, state)
})

stack.fire('/do-something')
```

Unlike Express however, instead of http requests the idea is to pass your entire application's state through your 'stack' of listeners.  Each execute in order, asynchronously, passing along the modified state via next()

The main benefit to this approach is the set of 'commands' (ie: routes) your application now inheritently exposes; essentially an API you can tap into from anywhere, including from modules you later introduce or from outside contributors who can standardize around your stack as the formal way to extend and create new functionality in your app.


## API

`stack.on(command, callback)`   
Creates a listener that invokes `callback` on the given `command`


`stack.fire(command, state, callback)`   
Fires an arbitrary `command` causing the stack of listeners listening to that command to fire (in order) until the end of the stack. 


`stack.first(command, state, callback)`  
Same as on, but queued to the top of your stack so that it executes first (unless you add another .first listener)


`stack.last(command, state, callback)`  
Same as first, but queued to the bottom of your stack. 


`stack.state`  
The last known state of the stack.  Persists after a fire concludes; after the bottom of the stack is reached hence the updated state is retained and available to subsequent fires. 


`stack.state._command`  
A special property added to your state object to keep track of the current command being issued. 


`stack.state._command[parameter]`  
Any number of parameters on the command itself (ie: `/do-something/:time` are made available as a property of the `stack.state._command` object (ie: `stack.state._command.time`).  

This is essentially how URL parameters are treated in web routers; for example in Express they are accessed via req.params


## Examples


#### License
MIT
