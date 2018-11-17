const stack = require('../../stack.js')

require('stackfire-tools-inject')(stack)
stack.control_state.pause = true
stack.inject()

stack.on('init', (next) => {
  next.fire('terminal/start-db-server')
})

stack.on('terminal/start-db-server', (next) => {
  console.log('start-db-server?')
  setTimeout(() => {
    console.log('db server started (after 1 second delay)')
    next()
  }, 1000)
})

stack.on('init', (next) => {
  next.fire('terminal/create/fund/test', (next) => {
    console.log("firing complete.")
    next()
  })
})

//stack.on('terminal/create/fund/:nickname', (next) => {
stack.on('terminal/create/fund/test', (next) => {
  console.log('do something...')
  setTimeout(() => {
    console.log('fund created (after 2 second delay)')
    next()
  }, 2000)
})


// stack.buffer((next) => {
//   if(!stack.injected) return next()
//   stack.changeAsync(next)
// })

stack.fire('init')
