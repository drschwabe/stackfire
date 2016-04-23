# async-router

AR is a simple router intended for internal routing of application state (and not for http requests or browser pushState). 

The idea is to enforce a route driven, synchronous control flow to your application to maintain integrity of state.  

Asynchronous functions are accommodated with standard callback pattern and modularity encouraged via middleware. 

## Usage
```
ar.listen('/', function(state, next) {
   //functionality here
   next(null, state)
})
```

The route itself is middleware, simply listen for the desired routes and call next() 

```
ar.fire('/', function(state) {
  //all this does is causes any function listening for the given route to do it's thing...
  //each listener function is fired in the order it was defined.
  //the callback from fire receives the final result after all listener functions have completed
  //so if the fire command was called from within
  //another fire event already underway, you can now pass state up to the original stack again.  
})
```

This let's you nest commands which will 'go horizontal' from within your stack; without breaking or complicating the overall control flow of the application. Ex: 

```
ar.listen('/action', function(state, next) {
    //Break off and fire another stack: 
    ar.fire('/another-action', function(state) { 
        next(null, state) //< Return modified state to original stack.
    })
})
```


###  Modularity

The current hypothesis is that now you have a super simple control flow to your application you can focus on building actual functionality via modules that stack together as middleware. 


### TODOs
- Implement Express style path parsing. 
- Make an actual middleware implementation that doesn't require a specific route. 


