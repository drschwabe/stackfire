var test = require('tape'), 
    stack = require('./stack.js')

test("stack.fire('/do-something') to invoke stack.on('/do-something')", function(t) {
  t.plan(2)

  stack.on('/do-something', (state, next) => {
    t.ok(state, 'listener invoked')    
    t.equal(state.req.path, '/do-something', "state.req.path equals '/do-something'")
  })

  stack.fire('/do-something') 

})

test("stack.fire from within a stack.on listener", function(t) {
  t.plan(2)

  stack.on('/do-something-else', (state, next) => {
    //Nested fire: 
    stack.fire('/do-another-thing', (err, newState) => {
      next(null, newState)
    })
  })

  stack.on('/do-another-thing', (state, next) => {
    t.ok(state, 'root level listener invoked from a nested fire')
    t.equals(state.req.path, '/do-another-thing', "state.req.path equals the command from the nested fire (not the original command).")    
  })

  //Original command: 
  stack.fire('/do-something-else')

})


