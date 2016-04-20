#async-router
[VR helmet / Google AR looking logo thing]

AR is a simple router intended for internal routing of application state (and not for http or browser pushState). 

The idea is to enforce a route driven, synchronous control flow to your application to maintain integrity of state.  

Asyncronous functions are accommodated with standard callback pattern and modularity encouraged via simple middleware implementation. 

## Usage
ar.listen('/', function(state, next) {
   //functionality here
   next(null, state)
})

The route itself is middleware, simply listen the desired routes and call next() 

ar.fire('/', function(state) {
  //all this does is causes any function listening for the given route to do it's thing...
  //each listener function is fired in the order it was defined.
  //the callback from fire receives the final result after all listener functions have completed
  //so if the fire command was called from within
  //a stack already underway, you now have the state object back again so you can pass it up to the original stack. 
})

This let's you nest commands which will 'go horizontal' from within your stack; without breaking or complicating the overall control flow of the application. 




###  Modularity

Now that you have a super simple control flow to your application you can focus on building actual functionality via modules that stack together as middleware. 





