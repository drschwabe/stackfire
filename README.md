# Stack

Stack is a command driven middleware stack intended for internal routing of application state (and not for http requests or browser pushState). 

Commands are simply regex strings ala Express routes (ex: '/my/command'). 

The idea is to expose a set of commands (ie: routes) your application is built around to enforce a familiar route driven, synchronous control flow & ensure consistent handling of state.   

Asynchronous functions are accommodated with standard callback pattern and modularity encouraged via middleware. 

## Install
```
npm install --save stack
```

## Usage
```
var stack = require('stack')

stack.on('/', (state, next) => {
   //functionality here
   next(null, state)
})
```

The command definition above itself is middleware, we simply listen for the desired route and call next() 

And when you are ready to invoke the route: 

```
stack.fire('/', (err, newState) => {
  //any function listening for the given route will do it's thing...
  //each listener function is fired in the order it was defined.
  //the callback from fire receives the final result after all listener functions have completed
  //so if the fire command was called from within
  //another fire event already underway, you can now pass state up to the original stack again.  
})
```

Because of the guaranteed synchronous execution of the middleware stack you can nest commands that 'go horizontal' from within this stack; without breaking or complicating the overall control flow of the application. Ex: 

```
stack.on('/command', (state, next) => {
    //Branch off and fire another stack: 
    cs.fire('/another-command', (err, newState) => { 
        next(null, newState) //< Return the modified state to original stack.
    })
})
```

Each fire the state object is modified to include a req property with the corresponding route and parameters.  Ex: state.req


###  Modularity

The current hypothesis is that now you have a super simple control flow to your application you can focus on building actual functionality via modules that stack together as middleware.  Modules for your app can simply drop in as a function that runs a stack.on listener or set of listeners.  Ex: 

```
require('do-awesome-stuff')(stack)
//(pass an existing stack to the do-awesome-stuff module which extends it with a bunch of new commands)
```

### TODOs
- Document all functionality
- Fix/add support for catch-all wildcard listeners ie: stack.on('*')
- Write tests
