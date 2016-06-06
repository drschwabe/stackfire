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

ar.listen('/', function(req, state, next) {
   //functionality here
   next(null, req, state)
})
```

The route definition above itself is middleware, we simply listen for the desired route and call next() 

And when you are ready to invoke the route: 

```
ar.fire('/', function(state) {
  //any function listening for the given route will do it's thing...
  //each listener function is fired in the order it was defined.
  //the callback from fire receives the final result after all listener functions have completed
  //so if the fire command was called from within
  //another fire event already underway, you can now pass state up to the original stack again.  
})
```

Because of the guaranteed synchronous execution of the middleware stack you can nest commands that 'go horizontal' from within this stack; without breaking or complicating the overall control flow of the application. Ex: 

```
ar.listen('/action', function(req, state, next) {
    //Branch off and fire another stack: 
    ar.fire('/another-action', function(err, state) { 
        next(null, req, state) //< Return the modified state to original stack.
    })
})
```


###  Modularity

The current hypothesis is that now you have a super simple control flow to your application you can focus on building actual functionality via modules that stack together as middleware. 


### TODOs
- Consider making the call for next() more intuitive by not requiring the req object; instead automagically include the req object on the state object itself (perhaps along with a history of previous requests)
- Write test to ensure multiple listeners are fired from a single fire event

