# async-router

AR is a simple router intended for internal routing of application state (and not for http requests or browser pushState). 

The idea is to enforce a familiar route driven, synchronous control flow to your application to ensure consistent handling of state.  

Asynchronous functions are accommodated with standard callback pattern and modularity encouraged via middleware. 

## Instal
```
npm install --save async-router
```

## Usage
```
var ar = require('async-router')

ar.listen('/', function(state, next) {
   //functionality here
   next(null, state)
})
```

The route definition above itself is middleware, we simply listen for the desired route and call next() 

And when you are ready to invoke the route: 

```
ar.fire('/', state, function(err, newState) {
  //any function listening for the given route will do it's thing...
  //each listener function is fired in the order it was defined.
  //the callback from fire receives the final result after all listener functions have completed
  //so if the fire command was called from within
  //another fire event already underway, you can now pass state up to the original stack again.  
})
```

Because of the guaranteed synchronous execution of the middleware stack you can nest commands that 'go horizontal' from within this stack; without breaking or complicating the overall control flow of the application. Ex: 

```
ar.listen('/action', function(state, next) {
    //Branch off and fire another stack: 
    ar.fire('/another-action', state, function(err, newState) { 
        next(null, newState) //< Return the modified state to original stack.
    })
})
```

Each fire the state object is modified to include a req property with the corresponding route and parameters.  Ex: state.req


###  Modularity

The current hypothesis is that now you have a super simple control flow to your application you can focus on building actual functionality via modules that stack together as middleware.  Modules for your app can simply drop in as a function that runs an ar.listener or set of ar.listeners. 


### TODOs
- Document more clearly the state.req object
- Write test to ensure all listeners are fired from a single fire

