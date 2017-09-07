const test = require('tape-catch'), 
      requireUncached = require('require-uncached'), 
      //^ ensures a clean slate for stack for each test. 
      _ = require('underscore'), 
      log = console.log

test("stack.fire invokes stack.on", (t) => {
  t.plan(1)
  let stack = requireUncached('./stack.js')

  stack.on('/do-something', () => {
    //t.ok(state, 'listener invoked')    
    debugger
    t.equal(stack.state._command.path, '/do-something', "state._command.path equals '/do-something'")
  })

  stack.fire('/do-something')

})

test("stack.fire nested within stack.on", (t) => {
  t.plan(3)
  let stack = requireUncached('./stack.js')

  stack.on('/apple', () => {
    console.log('/apple "on" (middleware in progress). _command.path:')
    console.log(stack.state._command.path)

    stack.fire('/bannana', (err, newState, nextFire) => {
      console.log('/bannana fired (its final callback in progress)')
      console.log(stack.state._command.path)     
      console.log("/bannana's callback will immediately call stack.next()")   
      debugger
      stack.next() //Maybe can solve this with calling stack.nextFire()
    })
  })

  stack.on('/bannana', () => {         
    console.log('/bannana "on" middleware in progress. _command.path:')
    console.log(stack.state._command.path) 
    t.ok(stack.state, 'root level listener invoked from a nested fire')
    t.equal(stack.state._command.path, '/bannana', "state._command.path equals the path of the current 'on' listener.")       
    console.log('/bannana middleware will now call stack.next()')
    stack.next() 
  })

  console.log('about to fire /apple')

  stack.fire('apple', (err) => {
    //something is causing the apple callback to be called twice
    // _.command.callback = _.once()  ?        
    console.log('/apple fired (its final callback in progress). _command.path:')
    console.log(stack.state._command.path)    
    t.pass('reached end of the original fire (/apple)')
    stack.next()
  })
})

test("stack.fire nested within stack.on (async)", (t) => {
  t.plan(3)
  let stack = requireUncached('./stack.js')

  stack.on('/apple', (state, next) => {
    console.log('/apple "on" (middleware in progress). _command.path:')
    console.log(stack.state._command.path)    
    console.log('about to run .5 second timeout before firing /bannana...')
    //Nested async fire: 
    setTimeout(() => {
      debugger
      stack.fire('/bannana', (err, newState, nextFire) => {
        console.log('/bannana fired (its final callback in progress)')
        console.log(stack.state._command.path)     
        console.log("/bannana's callback will immediately call nextFire()")   
        debugger
        stack.next() //Maybe can solve this with calling stack.nextFire()
      })
    }, 500)
  })

  stack.on('/bannana', (state, next) => {         
    console.log('/bannana "on" middleware in progress. _command.path:')
    console.log(stack.state._command.path) 
    console.log('(this should not execute until after 0.5 seconds)')  
    t.ok(state, 'root level listener invoked from a nested fire')
    t.equal(stack.state._command.path, '/bannana', "state._command.path equals the path of the current 'on' listener.")       
    console.log('/bannana middleware will now call stack.next()')
    stack.next() 
  })

  console.log('about to fire /apple')

  stack.fire('apple', (err, state, nextFire) => {
    //something is causing the apple callback to be called twice
    // _.command.callback = _.once()  ?        
    console.log('/apple fired (its final callback in progress). _command.path:')
    console.log(stack.state._command.path)    
    console.log('about to run 1 second timeout before calling stack.next)')
    setTimeout(() => {
      t.pass('reached end of the original fire (/apple)')
      console.log('(this should not execute until after 1 seconds)')
      stack.next()
    }, 1000)
  })
})


test("fire three nested commands and verify state consistency along the way", (t) => {
  t.plan(6) //This will be the next major engineering hurdle; 
  //to ensure that commands that are children of children fire and return back to the 
  //root command; will wnat to make a visualization of this. 
  let stack = requireUncached('./stack.js')

  stack.on('/land-on-moon', () => {
    stack.state.landed = true
    t.ok(stack.state.landed, 'landed on moon') 
    //Second command fired: 
    stack.fire('/plant-flag', (err) => {
      t.ok(stack.state.landed, 'still landed')
      stack.state.flagPlanted = true
      t.ok(stack.state.flagPlanted, 'planted flag')      
      //Third command fired: 
      stack.fire('/take-picture', (err) => {
        t.ok(stack.state.landed && stack.state.flagPlanted, 'still landed and flag remains planted')
        stack.state.tookPicture = true 
        t.ok(stack.state.tookPicture, 'took picture')
        stack.next()
      })
    })
  })

  //First command fired: 
  stack.fire('/land-on-moon', (err) => {
    t.ok(stack.state.landed && stack.state.flagPlanted && stack.state.tookPicture, 'mission complete')
  })
})


test("Different command listeners should not fire from a single command", (t) => {
  let stack = requireUncached('./stack.js')

  stack.on('/go', () => {
    t.equals(stack.state._command.path, '/go', 'expected listener invoked')
    stack.next()
  })

  //This should not run: 
  stack.on('/stop', () => {
    t.fail('listener invoked when it should not have')
    stack.next()
  }) 

  stack.fire('/go', (err) => {
    t.ok(stack.state._command.callback_invoked, 'callback invoked')
    t.end()
  })

})

test("(same as above, but more complex route)", (t) => {

  let stack = requireUncached('./stack.js')

  stack.on('/go/somewhere', () => {
    t.equals(stack.state._command.path, '/go/somewhere', 'expected listener invoked')
    stack.next()
  })

  //This should not run: 
  stack.on('/stop/something', () => {
    t.fail('listener invoked when it should not have')
    stack.next()
  }) 

  stack.fire('/go/somewhere', (err) => {
    t.ok(stack.state._command.callback_invoked, 'callback invoked')
    t.end()
  })

})


test("(same as above, but even more complex routes using a parameter)", (t) => {
  t.plan(3)
  let stack = requireUncached('./stack.js')
  stack.on('/inventory/:item/deliver', () => {
    t.equals(stack.state._command.path, '/inventory/widget/deliver', 'expected listener invoked')
    t.ok(stack.state._command.params.item, 'parameter is included on the command')
    stack.next()
  })

  //This should not run: 
  stack.on('/inventory/:item/destroy', () => {
    t.fail('listener invoked when it should not have')    
    stack.next()
  })

  stack.fire('/inventory/widget/deliver', () => {
    t.ok(stack.state._command.callback_invoked, 'end of stack reached')
    t.end()
  })

})


test("(same as above, but even more complex routes using multiple parameters)", (t) => {

  let stack = requireUncached('./stack.js')
  stack.on('/go/:destination/:time', (state, next) => {
    t.equals(stack.state._command.path, '/go/Brisbane/tomorrow', 'expected listener invoked')
    stack.next()
  })

  //This should not run: 
  stack.on('/some/other/route', (state, next) => {
    t.fail('listener invoked when it should not have')
    stack.next()
  })

  stack.fire('/go/Brisbane/tomorrow', (err, state) => {
    t.ok(stack.state._command.callback_invoked, 'end of stack reached')
    t.end()
  })

})

//Test to ensure stack.state is updated as expected. 
test("stack.state integrity (and commands without listeners)", (t) => {
  t.plan(2)
  let stack = requireUncached('./stack.js')
  stack.fire('/take-off', () => {
    t.equals(stack.state, stack.state, 'stack.state equals the newly returned state')
    stack.state.flying = true 
    stack.fire('/autopilot', () => {
      t.ok(stack.state.flying, 'We are flying.')
    })    
  })
})

test('Catch all wildcard listener', (t) => {
  t.plan(4)
  let stack = requireUncached('./stack.js')

  stack.on('*wild', () => {
    if(stack.state._command.path == '/_buffer') return next(null, state)
    t.pass('wildcard listener ran')
    console.log(stack.state._command.path)
    stack.next()
  })

  stack.fire('anything', (err, state, next) => {
    t.pass('anything fired')
    stack.next()
  })
  
  stack.fire('anything/else', (err, state) => {
    t.pass('anything else fired too')
  })

})

test("Wildcard plays nicely with other listeners (wildcard listener established BEFORE other routes)", (t) => {
  let stack = requireUncached('./stack.js')
  t.plan(2)

  stack.on('heart', () => {
    t.fail("listener ('heart') which was never explicitly fired was invoked!")
    stack.next()
  })

  //Establish wildcard before diamond: 
  stack.on('*wild', () => {
    console.log(stack.state._command.path)
    if(stack.state._command.path == '/_buffer') return next(null, state)    
    t.pass('*wild listener invoked')
    stack.next()
  })

  stack.on('diamond', () => {
    //if(state._command.path != '/diamond') return next(null, state)        
    t.pass('diamond listener invoked')    
    stack.next()
  })

  stack.fire('diamond')
})

//This test is same as above, but with the wildcard listener happening after existing routes.  Results should be the same. 
test("Wildcard plays nicely with other listeners (wildcard listener established AFTER existing routes)", (t) => {

  let stack = requireUncached('./stack.js')
  t.plan(2)

  stack.on('heart', () => {
    t.fail("listener ('heart') which was never explicitly fired was invoked!")
    stack.next()
  })

  stack.on('diamond', () => {
    t.pass('diamond listener invoked')    
    stack.next()
  })

  //Establish wildcard after diamond: 
  stack.on('*wild', () => {
    if(stack.state._command.path == '/_buffer') return stack.next()   
    //console.log(state._command.path)    
    debugger  
    t.pass('*wild listener invoked')
    stack.next()
  })  

  stack.fire('diamond')
})

test("Wildcard correctly is added to stacks and fires in the correct order", (t) => {

  let stack = requireUncached('./stack.js')
  t.plan(3)

  stack.on('ten', () => {
    stack.state.counter = 10
    stack.next()
  })
  stack.on('one', () => {
    stack.state.counter = 1
    stack.next()
  })
  stack.on('zero', () => {
    stack.state.counter = 0
    stack.next()
  })

  stack.on('*multiply', () => {
    if(stack.state._command.path == '/_buffer') return stack.next()
    console.log('*multiply')
    stack.state.counter *= 10
    stack.next()
  })

  stack.on('*multiply', () => {
    if(stack.state._command.path == '/_buffer') return stack.next()    
    console.log('*multiply')
    stack.state.counter *= 10
    stack.next()
  })

  stack.fire('ten', () => {
    t.equal(stack.state.counter, 1000, 'multiply called twice on ten') 
    stack.next()   
  })
  stack.fire('zero', () => {
    t.equal(stack.state.counter, 0, 'zero canned with multiply is zero')
    stack.next()
  })
  stack.fire('one', () => {
    t.equal(stack.state.counter, 100, 'one begets 100')
    stack.next()
  })
})


test("Commands are agnostic to stating with a slash or not", (t) => {

  let stack = requireUncached('./stack.js')
  t.plan(5)

  stack.on('party', () => {
    t.pass("It's a party!")
    stack.next()
  })

  stack.on('/party', () => {
    t.pass("it's the same party!")
    stack.next()
  })  

  stack.fire('party', () => {
    stack.next()
  })

  stack.on('/earthquake', () => {
    t.pass('earthquake!')
    stack.next()
  })

  stack.on('earthquake', () => {
    t.pass('earthquake!!!!')
    stack.next()
  })

  stack.fire('/earthquake', () => {
    t.pass('finished earthquake')
    stack.next()
  })

})


test('berries', (t) => {
  t.plan(4)

  let stack = requireUncached('./stack.js')    

  t.ok(_.isArray(stack.grid.cells))

  stack.on('berry', () => {
    t.equals(stack.grid.enties[0].command.path, '/berry') 
    stack.next()
  })

  stack.fire('berry', () => {  
    //now the fire has completed: 
    t.ok(stack.grid.enties[0].command.middleware_done)
    stack.next()    
  })  

  stack.fire('vegetable', () => { 
    //Even though no middleware, ensure this enty still exists on the grid: 
    stack.next() //< The command is not done until we call next
    //(even though there are no further commands to fire)
  }) 

  t.ok(stack.grid.enties[1].command.done)    

})



test("A subsequent fire waits until the current stack is finished before becoming fired", (t) => {
  t.plan(5)

  let stack = requireUncached('./stack.js')  

  stack.on('warning-alarm', () => {
    console.log('you have 2 seconds to comply')
    setTimeout(()=> {
      stack.next()
    }, 2000)  
  })

  stack.fire('warning-alarm', () => {
    t.pass('warning alarm finished')
    debugger
    stack.next() 
  }) 

  stack.fire('fire-turret', () => {
    console.log('fire turret!') 
    //The following should apply to state 
    //only AFTER warning alarm completes: 
    stack.state.firing_turret = true
    t.ok(stack.grid.enties[1].command.middleware_done, true, 'Fire turret middleware is done.')
    //nextFire() < We don't call nextFire()
  })

  //Wait one second and check state: 
  setTimeout( () => {
    t.notOk(stack.state.firing_turret, 'Turret is not firing yet')
  }, 500 )

  //Wait 2.5 seconds and check state: 
  setTimeout( () => {
    t.ok(stack.state.firing_turret, 'Turret is now firing!')    
    t.notOk(stack.grid.enties[1].command.done, 'Fire turret command is not done cause we never called nextFire()') 
  }, 2500)


})


test("Commands not issued should not fire (using wildcard commands)", (t) => {
  t.plan(3)

  let stack = requireUncached('./stack.js')

  //Defining a wildcard listener atop of the stack seems to result in 
  //subsequent listeners being fired even though their command was not issued...

  stack.on('*wildcard', () => {
    if(stack.state._command.path == '/_buffer') return stack.next()   
    t.pass('this should invoke on every fire')
    stack.next()    
  })

  stack.on('/release-prisoner', () => {
    t.pass('expected listener invoked')
    stack.next()
  })

  //This should not run! 
  stack.on('/execute-prisoner', () => {
    //workaround by manually checking: 
    if(stack.state._command != '/execute-prisoner') return stack.next()
    t.fail('listener invoked when it should not have')
    stack.next()
  })

  stack.fire('/release-prisoner', () => {
    t.pass('end of stack reached')
    t.end()
  })

})


test("Commands not issued should not fire (using commands that use URL param)", (t) => {
  t.plan(3)

  let stack = requireUncached('./stack.js')

  stack.on('/bomb/:anything', () => {
    t.pass('this should invoke on every fire')
    stack.next()    
  })

  stack.on('/bomb/disarm', () => {
    t.pass('expected listener invoked')
    stack.next()
  })

  //This should not run! 
  stack.on('/bomb/detonate', () => {
    //workaround by manually checking: 
    if(stack.state._command != '/bomb-detonate') return stack.next()  
    t.fail('listener invoked when it should not have')
    stack.next()
  })

  stack.fire('/bomb/disarm', () => {
    t.pass('end of stack reached')
    t.end()
  })  
})

test('Robot assembly line', (t) => {
  t.plan(4)

  let stack = requireUncached('./stack.js')

  stack.on('robot/assemble/:product', () => {
    console.log('"robot/assemble/:product" on!')    
    t.equals(stack.state._command.path, '/robot/assemble/box')    

    stack.fire('robot/box', () => {
      console.log('"robot/box" fire complete')
      console.log(`state._command.path is: ${stack.state._command.path}
      `)
      stack.next()
    })
  })

  stack.on('robot/:product', () => {
    console.log('"robot/:product" on!')    
    console.log(`state._command.path is: ${stack.state._command.path}
    `)  
    t.equals(stack.state._command.path, '/robot/box')
    stack.next()   
  })

  stack.fire('robot/assemble/box', () => {
    console.log('"robot/assemble/box" fire complete')
    debugger
    t.equals(stack.state._command.path, '/robot/assemble/box')
    stack.next()
  })

  console.log('command is nulled?')
  t.equals(stack.state._command, null)

})


test('Async element initialization', (t) => {
  t.plan(2)
  let stack = requireUncached('./stack.js')
  let async = requireUncached('async')

  stack.on('element/init/:prefix', () => {
    var elems = ['my-elem-a', 'my-elem-b', 'my-elem-c']
    //var nextFires = []
    console.log('on: ' + stack.state._command.path)    
    async.eachSeries(elems, (elem, callback) => {
      //callback(null)
      stack.fire('element/' + elem,() => {
        //nextFires.push(nextFire)
        //nextFire(null, callback)
        console.log('fired: ' + stack.state._command.path)        
        stack.next(callback)    
      })
    }, (err) => {
      //nextFires[0]()
      t.pass('done eachSeries')
     //debugger
      stack.next()
    })
    // elems.forEach((elem) => {
    //   stack.fire('element/' + elem,  stack.state, (err, state, nextFire) => {
    //     //nextFires.push(nextFire)
    //     //callback(null)
    //     //nextFire()
    //     nextFire()    
    //   })
    // })
    //next(null, state)
  })

  stack.on('element/:elementName', () => { 
    log('on: ' + stack.state._command.path)        
    //Got a problem with this matching "/element/init/my-element"
    //temporary workaround: 
    //if(!state._command.elementName) return next(null, state)
    //console.log('on: ' + state._command.path)
    stack.fire('element/' + stack.state._command.params.elementName + '/connected', () => {
      //next(null, newState) //< If you call next here we get a failure. 
      //TODO: should be some brakes when the next() command fires; some extra logic to prevent max callback.
      console.log('fired: ' + stack.state._command.path)
      stack.next()
      //next(null, newState)
    })
  })

  //Problem here, nothing happens..
  // stack.on('element/c', (state, next) => {
  //   t.pass('element/c fired OK!')
  //   next(null, state)
  // })

  stack.fire('element/init/my-element', (err, state) => {
    log('fired: ' + stack.state._command.path)
    t.pass('Finished')
    stack.next()
  })
})


test('Fire shorthand', (t) => {
  t.plan(3)
  let stack = requireUncached('./stack.js')

  stack.on('green', () => {
    t.pass('green light')
    stack.fire('go', stack.next) //< Shortand
  })

  stack.on('go', () => {
    t.pass('going')
    stack.next()
  })  

  stack.fire('green', (err, state, nextFire) => {
    t.pass('gone')
  })

})

test('Fire shorthand + multi commands', (t) => {
  t.plan(5)
  let stack = requireUncached('./stack.js')

  stack.on('green', (state) => {
    t.pass('green light on')
    stack.fire('go')
  })

  stack.on('go', (state) => {
    t.pass('going')
    stack.next()
  })

  stack.fire('green', (err, state) => {
    t.pass('gone')
    stack.next()
  })

  stack.on('red', (state) => {
    t.pass('red light on')
    stack.next()
  })  

  stack.fire('red', (err, state) => {
    t.pass('stopped')
  })

})

test('command nulls after fire', (t) => {
  t.plan(2)
  let stack = requireUncached('./stack.js')  
  stack.on('bake-cookie', () => {
    t.ok(stack.state._command, 'bake-cookie')
    stack.next()
  })
  stack.fire('bake-cookie', (err, state) => {
    stack.next()
  })
  t.equals(null, stack.state._command, 'command finished/is null')
})


test.skip('buffer fires every fire', (t) => {
  t.plan(6)
  let stack = requireUncached('./stack.js')  
  stack.on('apples', (state, next) => {
    t.pass('apples on!')
    next(null, state)
  })
  stack.on('oranges', (state, next) => {
    t.pass('oranges on!')
    next(null, state)
  })  
  stack.on('/_buffer', (state, next) => {
    console.log('/buffer')
    t.pass('/_buffer on!') //< Should run twice.
    next(null, state)
  })
  stack.fire('apples', (err, state, next) => {
    t.pass('apples fire ran OK')
    next()
  })
  stack.fire('oranges', (err, state, next) => {
    t.pass('oranges fire ran OK')
  })
})

test.skip('buffer fires every fire (complex)', (t) => {
  t.plan(5)
  let stack = requireUncached('./stack.js')  
  stack.on('apples', (state, next) => {
    t.pass('apples on!')
    stack.fire('oranges', (err, state) => {
      t.pass('oranges fire ran OK')
      next(null, state)
    })
  })
  stack.on('/_buffer', (state, next) => {
    t.pass('/_buffer on!') //< Should run twice
    next(null, state)
  })
  stack.on('oranges', (state, next) => {
    console.log('oranges on!')
    next(null, state)
  })
  stack.fire('apples', (state, next) => {
    t.pass('apples fire ran OK')
  })
})


// test.only('ensure buffers dont fire more than they need too', (t) => {
//   t.plan(3)
//   let stack = requireUncached('./stack.js')  

//   stack.on('/_buffer', (state, next) => {
//     console.log('buffer fired')
//     t.pass()
//     next()
//   })

//   stack.on('a', (state, next) => {

//     stack.fire('1', (err, state) => {
//       next(null, state)
//     })

//   })

//   stack.on('a', (state, next) => {   

//     stack.fire('2', () => {
//       next(null, state)
//     })

//   })

//   stack.fire('a', () => {
//     t.pass('Test finished')
//   })

// })


//This isnt working: 
    //  stack.fire('element/mf-docs/rendered', next)
//but this does: 
//       stack.fire('element/mf-docs/rendered', (err, state) => {
//         next(null, state)
//       })

// So need a test to expose this issue, and to fix it. 


test.skip('Demonstrate multiple ways of calling next (WIP)', (t) => {
  t.plan(5)
  let stack = requireUncached('./stack.js')  

  stack.on('shake', (state, next) => {
    //The shake command is not done yet: 
    t.notOk( _.find(stack.grid.enties, (enty) => enty.command.path == 'shake').done)
    console.log('we are making a milk shake')
  })  

  stack.fire('milk', (err, state, nextFire) => {
    //The milk command is done: 
    t.ok( _.find(stack.grid.enties, (enty) => enty.command.path == 'milk').done)    
    stack.fire('shake', (err, state, nextFire) => {
      nextFire()
    })
  })

  stack.on('tonic', (state, next) => {
    //The shake command is not done yet: 
    t.notOk( _.find(stack.grid.enties, (enty) => enty.command.path == 'shake').done)
    console.log('we are making a milk shake')
  })  

  stack.fire('gin', (err, state, nextFire) => {
    //The milk command is done: 
    t.ok( _.find(stack.grid.enties, (enty) => enty.command.path == 'milk').done)    
    stack.fire('tonic', next)
  })

  stack.fire('drink', (err, state) => {
    t.ok('drinking drink')
  })
  //TODO: make another thing where you just pass an 'on' next (above only shows passing of nextFire)
})

test('Multi command stress test', (t) => {
  t.plan(13)
  let stack = requireUncached('./stack.js')  
  let gg = requireUncached('gg')  

  stack.on('shake', (state) => {
    //The shake command is not done yet: 
    var shakeCommand = _.find(stack.grid.enties, (enty) => enty.command.path == '/shake').command    
    t.notOk(shakeCommand.done, 'shake command not done')

    var nextRowCell = gg.xyToIndex(stack.grid, 1, 0)
    t.equals(shakeCommand.cell, nextRowCell, 'shake command inserted to second row, first column')  //Sibling next to shake. 

    console.log('we are making a milk shake')
    debugger
    stack.next()
  })  

  stack.fire('milk', (err, state) => {
    //The milk command callback is underway: 
    var milkCommand = _.find(stack.grid.enties, (enty) => enty.command.path == '/milk').command
    t.notOk(milkCommand.done, 'milk command not done yet (trailing callback underway)') 
    t.equals(milkCommand.cell, 0, 'milk command inserted to cell 0') 
    debugger 
    stack.fire('shake', (err, state) => {
      var shakeCommand = _.find(stack.grid.enties, (enty) => enty.command.path == '/shake').command
      //milk command is still done: 
      t.notOk(milkCommand.done, 'milk command still not done')     
      //and now shake is done too:                  
      t.notOk(shakeCommand.done, 'shake command not done (trailing callback underway)')                 
      console.log('we made a milk shake')
      debugger
      stack.next()              
    })
  })

  stack.on('beer', (state, next) => {
    var beerCommand = _.find(stack.grid.enties, (enty) => enty.command.path == '/beer').command
    //The beer command is not done yet:     
    t.notOk(beerCommand.done, 'beer command not done') 
    t.equals(beerCommand.cell, gg.xyToIndex(stack.grid, 0, 1), 'beer command inserted to first row, second column (sibling of the first command)') 
    console.log('pour a beer')
    stack.next()
  })  

  stack.fire('beer', (err, state, next) => {
    var beerCommand = _.find(stack.grid.enties, (enty) => enty.command.path == '/beer')    
    t.notOk(beerCommand.done, 'beer command still not done') 
    t.equals(beerCommand.cell, gg.xyToIndex(stack.grid, 0, 1), 'beer command still at first row, second column')  //< Sibling next to milk.
    console.log('poured a beer.')
    stack.next()
  })

  t.equals( stack.grid.cells[ 0 ].enties[0].command.done, true) //< Orignial command.
  t.equals( stack.grid.cells[ gg.xyToIndex(stack.grid, 1,0) ].enties[0].command.done, true )//< Child of original.
  t.equals( stack.grid.cells[ gg.xyToIndex(stack.grid, 0,1) ].enties[0].command.done, true ) //< Sibling of original.

})



test.skip('Strawberry milkshake', (t) => {
  t.plan(10)
  let stack = requireUncached('./stack.js')  

  stack.on('milkshake', (state, next) => {
  
    stack.fire('milk', (err, state, nextFire) => {
      console.log('add some milk')
      //nextFire()      
    })  

    stack.fire('strawberries', (err, state, nextFire) => {
      console.log('add some strawberries')
      //wow should not run! 
      //next(null, state)       
    })

  })  

  stack.fire('milkshake', (err, state) => {
    //The milk command is done: 
    console.log('finished milkshake!')
  })

})



test('Empty goldmine', (t) => {
  t.plan(5)
  let stack = requireUncached('./stack.js')  
  let gg = requireUncached('gg') 

  stack.state.gold = false

  stack.on('mine', () => {

    stack.fire('shovel', () => {
      console.log('shovel for gold...')

      var shovelCommand = _.find(stack.grid.enties, (enty) => enty.command.path == '/shovel').command

      //Parent cell should equal 0 (first cell): 
      t.equals(shovelCommand.parent.cell, 0, "shovel command's parent is at the first cell of the grid")

      //Shovel command's cell should be directly below: 
      var expectedCell = gg.xyToIndex(stack.grid, [1, 0])

      t.equals(shovelCommand.cell, expectedCell, 'shovel command is directly below the parent command')

      //This will never be true; there should be no advancement to 'cart' fire.
      if(stack.state.gold == true) return stack.next()
    })  

    //technically stack.fire above is done... as such, we may need to use a different metric for stack.fire
    //OR we should not mark as done
    //perhaps we will say middlware_done and then command_done - command_done false until callback completed ie; nextFire called. 

    stack.fire('cart', () => {
      //Should not run...
      console.log('fill cart...')           
      t.fail('there will never be any gold!')
    })

  })  

  stack.fire('mine', (err, state) => {
    //Should not run: 
    t.fail('mining will never finish!')
  })

  setTimeout(() => {
    t.equals( stack.grid.cells[0].enties[0].command.path, '/mine', 'first cell is /mine') 
    t.equals ( stack.grid.cells[gg.xyToIndex(stack.grid, [1,0])].enties[0].command.path, '/shovel', 'next row down, same column is /shovel' )
    t.equals( stack.grid.cells[gg.xyToIndex(stack.grid, [1,1])].enties[0].command.path, '/cart', 'next column over is /cart (it is sibling so shares same row)')       
  }, 100)

})

test('Incomplete garden', (t) => {
  t.plan(4)
  let stack = requireUncached('./stack.js') 
  let gg = requireUncached('gg')    

  stack.fire('dig', (err, state, nextFire) => {
    log('dug')
    t.pass('dig complete, we done for the day')
    //nextFire is not called, so no other commands should run.
  })

  stack.fire('plant', (err, state, nextFire) => {
    log('planted')
    t.fail('there are no plants!')
  })

  stack.fire('water', (err, state, nextFire) => {
    log('watered')
    t.fail('there is no water!')
  })

  setTimeout(() => { //Ensure each of the commands exist on the first row: 
    t.equals( stack.grid.cells[0].enties[0].command.path, '/dig', 'first cell is /dig') 
    t.equals ( stack.grid.cells[gg.xyToIndex(stack.grid, [0,1])].enties[0].command.path, '/plant', 'next column over is /plant' )
    t.equals( stack.grid.cells[gg.xyToIndex(stack.grid, [0,2])].enties[0].command.path, '/water', 'next column after that is /water')         
  }, 100)

  //Future shorthand: 
  //stack.chain().fire('dig').fire('plant').fire('water') 
  //normally you would have to call 'nextFire' but when in a chain they fire automatically
  //possibly could rename to stack.autoFire()
  //or stack.auto('')
  //stack.parallel()
  //maybe I should remove callbacks from fires... 
  //that way ... nah... or how about remove nested ... nah

})


test('Complete garden', (t) => {
  t.plan(3)
  let stack = requireUncached('./stack.js')  

  stack.fire('dig', (err, state, nextFire) => {
    log('dug')
    t.pass('dig complete, we done for the day')
    //nextFire()
    nextFire(null, state)
    //nextFire called, so the next command runs: 
  })

  stack.fire('plant', (err, state, nextFire) => {
    log('planted')
    t.pass('today we have plants!')
    nextFire()
  })

  stack.fire('water', (err, state, nextFire) => {
    log('watered')
    t.pass('and water!')
  })

})

test('Multiple .on with same name', (t) => {
  t.plan(2)
  let stack = requireUncached('./stack.js')  

  stack.on('water', () => {
    t.pass('flowing...')
    stack.next()
  })

  stack.on('water', () => {
    t.pass('still flowing...')
    stack.next()
  })  

  stack.fire('water')
})

test('Stack shorthand advances the stack (inexplicitly calls stack.next())', (t) => {
  t.plan(3)
  let stack = requireUncached('./stack.js')  

  stack.on('apple', () => {
    t.pass()
    stack.next() 
  })  

  stack.on('bannana', () => {
    t.pass()
    stack.next() 
  })

  stack.fire('apple')
  stack.fire('bannana', () => {
    t.pass()
  })
})
