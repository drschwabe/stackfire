const test = require('tape-catch'), 
      requireUncached = require('require-uncached'), 
      //^ ensures a clean slate for stack for each test. 
      _ = require('underscore'), 
      log = console.log

//Export tests a module so all of the tests are available for consumption 
//by other modules or tools: 
var testObj = {
  tests : [],
  //Run tests unless the param is provided 
  //(typically when required/consumed by another module)
  queue : (run) => {
    //Prepare an array and function for populating it with tests
    var newTest = (testName, testFunc) => {
      testObj.tests.push({
        name : testName, 
        func : (testName) => {
          test(testName, testFunc) 
        }
      })
    }
    newTest.only = (testName, testFunc) => {
      testObj.only = {
        name : testName, 
        func : (testName) => {
          test(testName, testFunc) 
        }
      }
    }
    //^ if run == true we will loop over this to perform 
    //the tests

    //Now write each test as normal, but call it with queuing function:  
    newTest("stack.fire invokes stack.on", (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      stack.on('/do-something', () => {
        t.ok(stack.state, 'listener invoked and stack state established') 
        t.equal(stack.state.path, '/do-something', "state.path equals '/do-something'")
      })

      stack.fire('/do-something')

    })


    newTest("Mulitiple listeners invoke in a series (not parallel)", (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      stack.on('/boot', () => {
        t.ok(stack.state.path == '/boot', 'first boot listener ran')
        stack.state.booting = true 
      })

      stack.on('/boot', () => {
        t.ok(stack.state.path == '/boot', 'second boot listener ran')
        t.ok(stack.state.booting, 'variable set on state during first listener exists with expected value')
      })

      stack.fire('/boot')
    })

    newTest("Mulitiple listeners are placed in the same column of the grid (not on row)", (t) => {
      t.plan(4)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      stack.on('/boot', () => {
        t.ok(stack.state.path == '/boot', 'first boot listener ran')
      })

      stack.on('/boot', () => {
        t.ok(stack.state.path == '/boot', 'second boot listener ran')
      })

      stack.on('/boot', () => {
        t.ok(stack.state.path == '/boot', 'third boot listener ran')
      })      

      stack.fire('/boot')

      //Verify each listener (grid enty) exists at cells 0, 3, and 6
      t.ok(stack.grid.enties[0].cell == 0 && stack.grid.enties[1].cell == 3 && stack.grid.enties[2].cell == 6, 'Each listener exist in the same column')
      //ie: 
      //0 x x
      //3 x x 
      //6 x x
    })

    newTest("Different commands align into different columns (and fire in order)", (t) => {
      t.plan(5)

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      stack.on('/boot', () => t.ok(stack.state.path == '/boot', 'first boot listener ran'))

      stack.on('/boot', () => t.ok(stack.state.path == '/boot', 'second boot listener ran'))

      stack.on('/boot', () => t.ok(stack.state.path == '/boot', 'third boot listener ran'))

      stack.on('/strap', () => t.ok(stack.state.path == '/strap', 'first "strap" listener ran'))

      stack.on('/strap', () => t.ok(stack.state.path == '/strap', 'second "strap" listener ran'))

      stack.fire('/boot')

      stack.fire('/strap')
    })

    newTest("stack.fire nested within stack.on", (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      stack.on('/apple', () => {
        console.log('/apple "on" (listener function in progress).')
        t.equal(stack.state.path, '/apple', "state.path equals the path of the current 'on' listener.")        
        stack.fire('/bannana')
      })

      stack.on('/bannana', () => {     
        console.log('/bannana "on" listener in progress. state.path:')
        console.log(stack.state.path) 
        t.ok(stack.state, 'root level listener invoked from a nested fire')
        t.equal(stack.state.path, '/bannana', "state.path equals the path of the current 'on' listener.")
      })
      console.log('about to fire /apple')
      stack.fire('apple')
    })

    newTest("stack.fire nested within stack.on (complex)", (t) => {
      t.plan(12)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      stack.on('orange', () => {
        console.log('/orange "on" (listener function in progress)')
        t.ok(stack.state.path, '/orange')
      })

      stack.on('orange', () => {
        console.log('/orange again')
        t.ok(stack.state.path, '/orange')
      })

      stack.on('orange', () => {
        console.log('/orange yet again!')
        t.ok(stack.state.path, '/orange')        
        stack.fire('grapefruit')
      })        

      stack.on('/grapefruit', () => {     
        console.log('/grapefruit "on" listener in progress.')
        t.ok(stack.state, 'root level listener invoked from a nested fire')
        t.ok(stack.state.path, '/grapefruit')
      })

      stack.on('/grapefruit', () => {     
        console.log('/grapefruit again')
        t.equal(stack.state.path, '/grapefruit', "state.path equals the path of the current 'on' listener.")
      })  
      
      stack.on('orange', () => {
        console.log('/orange again (should occur after grapefruit listeners)')
        t.ok(stack.state.path, '/orange')
        debugger   
        t.equal(stack.state.cell.num, gg.xyToIndex(stack.grid, [4,0]), 'orange first listener after grapefruit command assigned to correct cell')
      })

      stack.on('orange', () => {
        console.log('/orange last time!')
        t.ok(stack.state.path, '/orange')  
        t.equal(stack.state.cell.num, gg.xyToIndex(stack.grid, [5,0]), 'orange second listener after grapefruit assigned to correct cell')        
      })

      console.log('about to fire /orange')
      stack.fire('orange')

      t.equal(stack.grid.cells[13].enties[0].command.route.spec, '/grapefruit')
      t.equal(stack.grid.cells[19].enties[0].command.route.spec, '/grapefruit' )


    })

    newTest("stack.fire nested within stack.on (complex 2)", (t) => {
      t.plan(11)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      stack.on('strawberry', () => {
        console.log('/strawberry "on" (listener function in progress)')   
        debugger     
      })

      stack.on('orange', () => {
        console.log('/orange "on" (listener function in progress)')
        t.ok(stack.state.path, '/orange')
      })

      stack.on('orange', () => {
        console.log('/orange again')
        t.ok(stack.state.path, '/orange')
        debugger
      })

      stack.on('orange', () => {
        console.log('/orange yet again!')
        t.ok(stack.state.path, '/orange')  
        debugger              
        stack.fire('grapefruit')
      })        

      stack.on('/grapefruit', () => {     
        console.log('/grapefruit "on" listener in progress.')
        t.ok(stack.state, 'root level listener invoked from a nested fire')
        debugger
      })

      stack.on('/grapefruit', () => {     
        console.log('/grapefruit again')
        t.equal(stack.state.path, '/grapefruit', "state.path equals the path of the current 'on' listener.")
        debugger
      })  
      
      stack.on('orange', () => {
        console.log('/orange again (should occur after grapefruit listeners)')
        t.ok(stack.state.path, '/orange')   
        t.equal(stack.state.cell.num, gg.xyToIndex(stack.grid, [4,1]), 'orange first listener after grapefruit command assigned to correct cell')
      })

      stack.on('orange', () => {
        console.log('/orange last time!')
        t.ok(stack.state.path, '/orange')  
        t.equal(stack.state.cell.num, gg.xyToIndex(stack.grid, [5,1]), 'orange second listener after grapefruit assigned to correct cell')        
      })

      console.log('about to fire /strawberry')
      stack.fire('strawberry')

      console.log('about to fire /orange')
      stack.fire('orange')

      t.equal(stack.grid.cells[14].enties[0].command.route.spec, '/grapefruit')
      t.equal(stack.grid.cells[20].enties[0].command.route.spec, '/grapefruit')

    })


    newTest("stack.fire nested within stack.on, which was nested in another stack.on", (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      t.plan(3)      
      stack.on('green', () => {
        t.pass("green listener's callback invoked")
        stack.fire('blue')
      })

      stack.on('blue', () => {
        t.pass("blue listener's callback invoked")
        debugger
        stack.fire('red')
      })

      stack.on('red', () => {
        t.pass("red listener's callback invoked")
      })

      stack.fire('green')

    })


    newTest("stack.fire nested within stack.on, which was nested in another stack.on (complex)", (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      t.plan(9)      

      stack.on('green', () => {
        t.pass("green listener's first callback invoked")
      })

      stack.on('green', () => {
        t.pass("green listener's second callback invoked")
      })

      stack.on('green', () => {
        t.pass("green listener's third callback invoked")        
      })

      stack.on('green', () => {
        t.pass("green listener's fourth callback invoked")
        stack.fire('blue')
      })

      stack.on('green', () => {
        t.pass("green listener's last callback invoked")
        //TODO:  another test to ensure blue and red commands finished
      })

      stack.on('blue', () => {
        t.pass("blue listener's first callback invoked")
      })

      stack.on('blue', () => {
        t.pass("blue listener's second callback invoked")
      })

      stack.on('blue', () => {
        t.pass("blue listener's third callback invoked")
        stack.fire('red')
      })

      stack.on('red', () => {
        t.pass("red listener's callback invoked")
      })

      stack.fire('green')

    })

    newTest("stack.fire nested spiderweb", (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      t.plan(11) 
      
      stack.on('green', () => {
        t.pass("green listener's first callback invoked")
      })

      stack.on('green', () => {
        t.pass("green listener's second callback invoked")
      })

      stack.on('green', () => {
        t.pass("green listener's third callback invoked")        
      })

      stack.on('green', () => {
        t.pass("green listener's fourth callback invoked")
        stack.fire('blue')
      })

      stack.on('green', () => {
        t.pass("green listener's last callback invoked")
        //TODO:  another test to ensure blue and red commands finished
      })

      stack.on('blue', () => {
        t.pass("blue listener's first callback invoked")
      })

      stack.on('blue', () => {
        t.pass("blue listener's second callback invoked")
      })

      stack.on('blue', () => {
        t.pass("blue listener's third callback invoked")
        debugger
        stack.fire('red')
      })

      stack.on('red', () => {
        t.pass("red listener's callback invoked")
      })

      stack.on('red', () => {
        t.pass("red listener's second callback invoked")
      }) 

      stack.on('red', () => {
        t.pass("red listener's third callback invoked")
      })              

      stack.fire('green')

    })



    newTest('stack.fire can be supplied with a callback', (t) => {
      //to execute after all other listener callbacks finish
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
            
      t.plan(1)

      stack.fire('test', () => {
        t.pass('callback is executed')
      })
    })


    newTest('stack.fire can be supplied with a callback (plus a listner)', (t) => {

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
            
      t.plan(2)

      stack.on('test', () => {
        t.pass('listener invoked')
      })

      stack.fire('test', () => {
        t.pass('callback is executed')
      })      

    })

    newTest('stack.fire can be supplied with a callback (plus multiple listeners)', (t) => {

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
            
      t.plan(3)

      stack.on('test', () => {
        t.pass('listener invoked')
      })

      stack.on('test', () => {
        t.pass('second listener invoked')
      })

      stack.fire('test', () => {
        t.pass('callback is executed')
      })    

    })

    newTest("stack.fire can be fired from another fire callback", (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      t.plan(3)

      stack.on('purple', () => {
        t.pass("purple listener's callback executed")
      })

      stack.on('pink', () => {
        t.pass("pink listener's callback executed")
      })

      stack.fire('purple', () => {
        t.pass('purple callback is executed')
        stack.fire('pink')
      })  

    })

    newTest('basic async example', (t) => {
      t.plan(6)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      var firstSip = (next) => {
        stack.state.listener = 'first'
        setTimeout(() => {
          console.log('first sip (takes 100 ms)')
          t.equals(stack.state.listener, 'first')
          next() 
        }, 100)        
      }

      var secondSip = (next) => {
        stack.state.listener = 'second'
        setTimeout(() => {
          console.log('second sip (takes 200 ms)')
          t.equals(stack.state.listener, 'second')
          next()
        }, 200)        
      }

      var thirdSip = (next) => {
        stack.state.listener = 'third'
        setTimeout(() => {
          console.log('third sip (takes 300 ms)')
          t.equals(stack.state.listener, 'third')
        }, 300)        
      }            

      stack.on('sip latte', firstSip)

      stack.on('sip latte', secondSip)

      stack.on('sip latte', thirdSip)

      stack.fire('sip latte')

      setTimeout(() => {
        //check that the functions are placed in the same order: 
        t.equals( stack.grid.enties[0].func.toString(), firstSip.toString() )
        t.equals( stack.grid.enties[1].func.toString(), secondSip.toString() )
        t.equals( stack.grid.enties[2].func.toString(), thirdSip.toString() )       
      }, 700)

    })

    newTest('Presence of next param in cb fn determines if to be async or not', (t) => {
      t.plan(1)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      var executeSyncly = () => console.log('executed syncly')
      var executeAsyncly = (next) => setTimeout( () => {
        console.log('executed asyncly')
        next() 
      }, 300)

      var executeSynclyAgain = () => console.log('executed syncly (again)')

      var executeAsynclyButDontCallNext = (next) => setTimeout( () => {
        console.log('executed asyncly')
      }, 300)

      var dontExecuteEver = () => t.fail('should not have executed')

      stack.on('go', executeSyncly )
      stack.on('go', executeAsyncly )
      stack.on('go', executeSynclyAgain )
      stack.on('go', executeAsynclyButDontCallNext )
      stack.on('go', dontExecuteEver )

      stack.fire('go')
      setTimeout(() => {
        t.pass() 
      }, 700)
    })

    newTest("stack.fire nested within stack.on (async)", (t) => {
      t.plan(4)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      stack.on('/apple', () => {
        debugger
        console.log('/apple "on" (middleware in progress).  state.path:')
        console.log(stack.state.path)  
        console.log('about to run .5 second timeout before firing /bannana...')
        //Nested async fire: 
        setTimeout(() => {
          debugger
          stack.fire('/bannana', () => {
            debugger
            t.pass('/bannana reaches its callback')
            console.log('/bannana fired (its final callback in progress)')
            console.log(stack.state.path)  
            console.log("/bannana's callback will immediately call nextFire()")   
          })
        }, 500)
      })

      debugger
      stack.on('/bannana', () => {         
        console.log('/bannana "on" middleware in progress. state.path:')
        console.log(stack.state.path) 
        console.log('(this should not execute until after 0.5 seconds)')  
        t.ok(stack.state, 'root level listener invoked from a nested fire')
        t.equal(stack.state.path, '/bannana', "state.path equals the path of the current 'on' listener.")       
        console.log('/bannana middleware will now call stack.next()')
        //stack.next() 
        debugger
      })

      console.log('about to fire /apple')

      debugger
      stack.fire('apple', () => {
        debugger
        //something is causing the apple callback to be called twice
        // _.command.callback = _.once()  ?        
        console.log('/apple fired (its final callback in progress). state.path:')
        console.log(stack.state.path)    
        console.log('about to run 1 second timeout before calling stack.next)')
        setTimeout(() => {
          t.pass('reached end of the original fire (/apple)')
          console.log('(this should not execute until after 1 seconds)')
          //stack.next()
        }, 1000)
      })
    })


    newTest("fire three nested commands and verify state consistency along the way", (t) => {
      t.plan(6) //This will be the next major engineering hurdle; 
      //to ensure that commands that are children of children fire and return back to the 
      //root command; will wnat to make a visualization of this. 
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

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
          })
        })
        //TODO - test grid placement
      })

      //First command fired: 
      stack.fire('/land-on-moon')

      t.ok(stack.state.landed && stack.state.flagPlanted && stack.state.tookPicture, 'mission complete')
    })


    newTest("Different command listeners should not fire from a single command", (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      t.plan(2)

      stack.on('/go', () => {
        t.equals(stack.state.path, '/go', 'expected listener invoked')
      })

      //This should not run: 
      stack.on('/stop', () => {
        t.fail('listener invoked when it should not have')
      }) 

      stack.fire('/go', () => {
        t.pass('callback invoked')
      })

      //TODO - check grid placement, ensure the /go fire callback executes last

    })

    newTest("(same as above, but more complex route)", (t) => {

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      t.plan(2)

      stack.on('/go/somewhere', () => {
        t.equals(stack.state.path, '/go/somewhere', 'expected listener invoked')
      })

      //This should not run: 
      stack.on('/stop/something', () => {
        t.fail('listener invoked when it should not have')
      }) 

      stack.fire('/go/somewhere', (err) => {
        t.pass('callback invoked')
      })

    })

    newTest("(same as above, but even more complex routes using a parameter)", (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      stack.on('/inventory/:item/deliver', () => {
        debugger
        t.equals(stack.state.path, '/inventory/widget/deliver', 'expected listener invoked')
        t.ok(stack.state.params.item, 'parameter is included on the command')
      })

      //This should not run: 
      stack.on('/inventory/:item/destroy', () => {
        t.fail('listener invoked when it should not have')    
      })

      stack.fire('/inventory/widget/deliver', () => {
        t.pass('end of stack reached')
      })

    })


    newTest("(same as above, but even more complex routes using multiple parameters)", (t) => {

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      t.plan(2)

      stack.on('/go/:destination/:time', (state, next) => {
        t.equals(stack.state.path, '/go/Brisbane/tomorrow', 'expected listener invoked')
      })

      //This should not run: 
      stack.on('/some/other/route', (state, next) => {
        t.fail('listener invoked when it should not have')
      })

      stack.fire('/go/Brisbane/tomorrow', (err, state) => {
        t.pass('end of stack reached')
      })

    })

    //Test to ensure stack.state is updated as expected. 
    newTest("stack.state integrity (and commands without listeners)", (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      stack.fire('/take-off', () => {
        t.equals(stack.state, stack.state, 'stack.state equals the newly returned state')
        stack.state.flying = true 
        stack.fire('/autopilot', () => {
          t.ok(stack.state.flying, 'We are flying.')
        })    
      })
    })

    newTest('Catch all wildcard listener', (t) => {
      t.plan(4)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      stack.on('*wild', () => {
        t.pass('wildcard listener ran')
        t.equals(stack.state.path, '/anything')
        debugger
      })

      stack.fire('anything')

      t.equals( stack.grid.cells[0].enties[0].command.listeners[0].path, '/*wild' )
      t.equals( stack.grid.cells[0].enties[0].command.route.spec, '/anything' )

    })


    newTest('Catch all wildcard listener (wildcard listener defined after specific listener)', (t) => {
      t.plan(7)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      stack.on('anything', () => {
        t.pass('specific listener ran')
        t.equals(stack.state.path, '/anything')
        debugger        
      })

      stack.on('*wild', () => {
        t.pass('wildcard listener ran')
        t.equals(stack.state.path, '/anything')
        debugger
      })

      stack.fire('anything')

      //should result in a 2x2 grid 
      // [ /anything , 1  ]
      // [ /wild ,     3]

      //The command route spec should be '/anything' for both listeners: 
      t.equals( stack.grid.cells[0].enties[0].command.route.spec, '/anything' )
      //t.ok( stack.grid.cells[1].enties[0].length )
      //t.equals( stack.grid.cells[1].enties[0].command.route.spec, '/anything' )

      t.equals( stack.grid.cells[0].enties[0].command.listeners[0].path, '/*wild' )
      t.equals( stack.grid.cells[2].enties[0].command.listeners[0].path, '/anything' )

      t.equals( stack.grid.cells[0].enties[0].command.route.spec, '/anything' )

    })

    newTest('Catch all wildcard listener (using callbacks)', (t) => {
      t.plan(4)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      stack.on('*wild', () => {
        t.pass('wildcard listener ran')
      })

      stack.fire('anything', () => {
        t.pass('anything fired')
      })
      
      stack.fire('anything/else', () => {
        t.pass('anything else fired too')
      })

    })

    newTest("Wildcard plays nicely with other listeners (wildcard listener established BEFORE other routes)", (t) => {
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      t.plan(2)

      stack.on('heart', () => {
        t.fail("listener ('heart') which was never explicitly fired was invoked!")
      })

      //Establish wildcard before diamond: 
      stack.on('*wild', () => {
        console.log(stack.state.path)
        t.pass('*wild listener invoked')
      })

      stack.on('diamond', () => {
        //if(state._command.path != '/diamond') return next(null, state)        
        t.pass('diamond listener invoked')    
      })

      stack.fire('diamond')
    })

    //This test is same as above, but with the wildcard listener happening after existing routes.  Results should be the same. 
    // newTest("Wildcard plays nicely with other listeners (wildcard listener established AFTER existing routes)", (t) => {

    //   let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
    //   if(process.browser) window.stack = stack
    //   t.plan(2)

    //   stack.on('heart', () => {
    //     t.fail("listener ('heart') which was never explicitly fired was invoked!")
    //   })

    //   stack.on('diamond', () => {
    //     t.pass('diamond listener invoked')    
    //   })

    //   //Establish wildcard after diamond: 
    //   stack.on('*wild', () => {
    //     t.pass('*wild listener invoked')
    //   })  

    //   stack.fire('diamond')
    // })

    newTest("Wildcard correctly is added to stacks and fires in the correct order", (t) => {

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      t.plan(3)

      stack.on('ten', () => {
        stack.state.counter = 10
      })
      stack.on('one', () => {
        stack.state.counter = 1
      })
      stack.on('zero', () => {
        stack.state.counter = 0
      })

      stack.on('*multiply', () => {
        console.log('*multiply')
        stack.state.counter *= 10
      })

      stack.on('*multiply', () => {
        console.log('*multiply')
        stack.state.counter *= 10
      })

      stack.fire('ten', () => {
        t.equal(stack.state.counter, 1000, 'multiply called twice on ten') 
      })
      stack.fire('zero', () => {
        t.equal(stack.state.counter, 0, 'zero canned with multiply is zero')
      })
      stack.fire('one', () => {
        t.equal(stack.state.counter, 100, 'one begets 100')
      })
    })


    newTest("Commands are agnostic to stating with a slash or not", (t) => {

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      t.plan(5)

      stack.on('party', () => {
        t.pass("It's a party!")
      })

      stack.on('/party', () => {
        t.pass("it's the same party!")
      })  

      stack.fire('party')

      stack.on('/earthquake', () => {
        t.pass('earthquake!')
      })

      stack.on('earthquake', () => {
        t.pass('earthquake!!!!')
      })

      stack.fire('/earthquake', () => {
        t.pass('finished earthquake')
      })

    })


    newTest('berries', (t) => {
      t.plan(5)

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack    

      t.ok(_.isArray(stack.grid.cells))

      stack.on('berry', () => {
        t.equals(stack.grid.enties[0].command.route.spec, '/berry') 
      })

      stack.fire('berry', () => {  
        //now the fire has completed: 
        //t.ok(stack.grid.enties[0].command.middleware_done)
        t.pass()
      })  

      stack.fire('vegetable', () => { 
        //Even though no middleware, ensure this enty still exists on the grid: 
        t.pass('fired vegetable')
      }) 

      t.ok(stack.grid.enties[1].command.done)    
    })

    newTest("When a completed command is fired for the 2nd time, its callbacks all correctly re-enter the grid but in a new column", (t) => {
      t.plan(6)

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack
      
      stack.on('apple', () => {
        console.log('first apple callback')
      })

      stack.on('apple', () => {
        console.log('2nd apple callback')
      })

      stack.on('apple', () => {
        console.log('third apple callback')
      })    

      stack.fire('apple')    

      stack.fire('apple')  

      // [  apple   apple  ]
      // [  apple   apple  ]
      // [  apple   apple  ]    
  
      t.equals( stack.grid.cells[ gg.xyToIndex(stack.grid, [0,0]) ].enties[0].command.route.spec, '/apple' )
      t.equals( stack.grid.cells[ gg.xyToIndex(stack.grid, [1,0]) ].enties[0].command.route.spec, '/apple' )
      t.equals( stack.grid.cells[ gg.xyToIndex(stack.grid, [2,0]) ].enties[0].command.route.spec, '/apple' )

      t.equals( stack.grid.cells[ gg.xyToIndex(stack.grid, [0,1]) ].enties[0].command.route.spec, '/apple' )
      t.equals( stack.grid.cells[ gg.xyToIndex(stack.grid, [1,1]) ].enties[0].command.route.spec, '/apple' )
      t.equals( stack.grid.cells[ gg.xyToIndex(stack.grid, [2,1]) ].enties[0].command.route.spec, '/apple' )

    })

    // newTest("A subsequent fire waits until the current stack is finished before becoming fired", (t) => {
    //   t.plan(5)

    //   let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
    //   if(process.browser) window.stack = stack  

    //   stack.on('warning-alarm', () => {
    //     console.log('you have 2 seconds to comply')
    //     setTimeout(()=> {
    //       console.log('wait 2 seconds')
    //       //stack.next()
    //     }, 2000)  
    //   })

    //   stack.fire('warning-alarm', () => {
    //     t.pass('warning alarm finished')
    //     //stack.next() 
    //   }) 

    //   stack.fire('fire-turret', () => {
    //     console.log('fire turret!') 
    //     //The following should apply to state 
    //     //only AFTER warning alarm completes: 
    //     stack.state.firing_turret = true
    //     //t.ok(stack.grid.enties[1].command.middleware_done, true, 'Fire turret middleware is done.')
    //     //nextFire() < We don't call nextFire()
    //   })

    //   //Wait one second and check state: 
    //   setTimeout( () => {
    //     t.notOk(stack.state.firing_turret, 'Turret is not firing yet')
    //   }, 500 )

    //   //Wait 2.5 seconds and check state: 
    //   setTimeout( () => {
    //     t.ok(stack.state.firing_turret, 'Turret is now firing!')    
    //     t.notOk(stack.grid.enties[1].command.done, 'Fire turret command is not done cause we never called nextFire()') 
    //   }, 2500)


    // })


    newTest("Commands not issued should not fire (using wildcard commands)", (t) => {
      t.plan(3)

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      //Defining a wildcard listener atop of the stack seems to result in 
      //subsequent listeners being fired even though their command was not issued...

      stack.on('*wildcard', () => {
        t.pass('this should invoke on every fire')
        //stack.next()    
      })

      stack.on('/release-prisoner', () => {
        t.pass('expected listener invoked')
        //stack.next()
      })

      //This should not run! 
      stack.on('/execute-prisoner', () => {
        //workaround by manually checking: 
        //if(stack.state.path != '/execute-prisoner') return stack.next()
        t.fail('listener invoked when it should not have')
        //stack.next()
      })

      stack.fire('/release-prisoner', () => {
        t.pass('end of stack reached')
      })

    })


    newTest("Commands not issued should not fire (using commands that use URL param)", (t) => {
      t.plan(3)

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      stack.on('/bomb/:anything', () => {
        t.pass('this should invoke on every fire')
        //stack.next()    
      })

      stack.on('/bomb/disarm', () => {
        t.pass('expected listener invoked')
        //stack.next()
      })

      //This should not run! 
      stack.on('/bomb/detonate', () => {
        //workaround by manually checking: 
        //if(stack.state._command != '/bomb-detonate') return stack.next()  
        t.fail('listener invoked when it should not have')
        //stack.next()
      })

      stack.fire('/bomb/disarm', () => {
        t.pass('end of stack reached')
      })  
    })

    newTest('Robot assembly line', (t) => {
      t.plan(4)

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack

      stack.on('robot/assemble/:product', () => {
        console.log('"robot/assemble/:product" on!')    
        t.equals(stack.state.path, '/robot/assemble/box')    

        stack.fire('robot/box', () => {
          console.log('"robot/box" fire complete')
          console.log(`state._command.path is: ${stack.state.path}
          `)
          // stack.next()
          // stack.next() 
        })
      })

      stack.on('robot/:product', () => {
        console.log('"robot/:product" on!')    
        console.log(`state.path is: ${stack.state.path}
        `)  
        t.equals(stack.state.path, '/robot/box')
        //stack.next()   
      })

      stack.fire('robot/assemble/box', () => {
        console.log('"robot/assemble/box" fire complete')
        debugger
        t.equals(stack.state.path, '/robot/assemble/box')
        //stack.next()
      })

      console.log('command is nulled?')
      t.equals(stack.state.path, null)

    })


    // newTest('Async element initialization', (t) => {
    //   t.plan(2)
    //   let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
    //   if(process.browser) window.stack = stack
    //   let async = process.browser ? require('async') : requireUncached('async')

    //   stack.on('element/init/:prefix', () => {
    //     var elems = ['my-elem-a', 'my-elem-b', 'my-elem-c']
    //     //var nextFires = []
    //     console.log('on: ' + stack.state._command.path)    
    //     async.eachSeries(elems, (elem, callback) => {
    //       //callback(null)
    //       stack.fire('element/' + elem,() => {
    //         //nextFires.push(nextFire)
    //         //nextFire(null, callback)
    //         console.log('fired: ' + stack.state._command.path)        
    //         stack.next(callback)    
    //       })
    //     }, (err) => {
    //       //nextFires[0]()
    //       t.pass('done eachSeries')
    //      //debugger
    //       stack.next()
    //     })
    //     // elems.forEach((elem) => {
    //     //   stack.fire('element/' + elem,  stack.state, (err, state, nextFire) => {
    //     //     //nextFires.push(nextFire)
    //     //     //callback(null)
    //     //     //nextFire()
    //     //     nextFire()    
    //     //   })
    //     // })
    //     //next(null, state)
    //   })

    //   stack.on('element/:elementName', () => { 
    //     log('on: ' + stack.state._command.path)        
    //     //Got a problem with this matching "/element/init/my-element"
    //     //temporary workaround: 
    //     //if(!state._command.elementName) return next(null, state)
    //     //console.log('on: ' + state._command.path)
    //     stack.fire('element/' + stack.state._command.params.elementName + '/connected', () => {
    //       //next(null, newState) //< If you call next here we get a failure. 
    //       //TODO: should be some brakes when the next() command fires; some extra logic to prevent max callback.
    //       console.log('fired: ' + stack.state._command.path)
    //       stack.next()
    //       stack.next()  //Could be an issue with doing double calls like this though.... 
    //       //for an async func in particular, stack.next might get called
    //       //but without reference to the original middleware that it's intended for - 
    //       //you can't necessarily move forward the stack...
    //       //which is why it may be important to pass stack.next('element/:elemnetName') here... 
    //       //or stack.next('element/' + stack.state._command.params.elementName)
    //       //next(null, newState)
    //       //if you call just stack.next() it will do a general advance; but may cause issue if 
    //       //you need things to execute in specific order so thats why its advisable to use stack.next('/name-of-function') or possibly another way would be to do it my original way which was to pass
    //       //the 'next' object
    //     })
    //   })

    //   //Problem here, nothing happens..
    //   // stack.on('element/c', (state, next) => {
    //   //   t.pass('element/c fired OK!')
    //   //   next(null, state)
    //   // })

    //   stack.fire('element/init/my-element', (err, state) => {
    //     log('fired: ' + stack.state._command.path)
    //     t.pass('Finished')
    //     stack.next()
    //   })
    // })


    // newTest('Fire shorthand', (t) => {
    //   t.plan(3)
    //   let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
    //   if(process.browser) window.stack = stack

    //   stack.on('green', () => {
    //     t.pass('green light')
    //     stack.fire('go', stack.next) //< Shortand
    //     stack.next() //< You have to call stack.next() for the ON
    //   })

    //   stack.on('go', () => {
    //     t.pass('going')
    //     stack.next() 
    //   })  

    //   stack.fire('green', (err, state, nextFire) => {
    //     t.pass('gone')
    //   })

    // })

    // newTest('Fire shorthand + multi commands', (t) => {
    //   t.plan(6)
    //   let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
    //   if(process.browser) window.stack = stack
    //   let gg = process.browser ? require('gg') : requireUncached('gg')

    //   stack.on('green', (state) => {
    //     t.pass('green light on')
    //     stack.fire('go', stack.next)
    //     stack.next()
    //   })

    //   stack.on('go', (state) => {
    //     t.pass('going')
    //     stack.next()
    //   })

    //   stack.fire('green', (err, state) => {
    //     t.pass('gone')
    //     stack.next()
    //   })

    //   stack.on('red', (state) => {
    //     t.pass('red light on')
    //     stack.next()
    //   })  

    //   //Red should be a sibling of root... 
    //   stack.fire('red', (err, state) => {
    //     t.pass('stopped')
    //   })

    //   t.equals(gg.examine(stack.grid, [0,1]).command.path, '/red')

    // })

    newTest('command nulls after fire', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack  
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
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack  
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
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack  
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

    test.skip('Demonstrate multiple ways of calling next (WIP)', (t) => {
      t.plan(5)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack  

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

    newTest('Multi command stress test', (t) => {
      t.plan(13)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack  
      let gg = process.browser ? require('gg') : requireUncached('gg')  

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
        stack.fire('shake', () => {
          var shakeCommand = _.find(stack.grid.enties, (enty) => enty.command.path == '/shake').command
          //milk command is still done: 
          t.notOk(milkCommand.done, 'milk command still not done')     
          //and now shake is done too:                  
          t.notOk(shakeCommand.done, 'shake command not done (trailing callback underway)')                 
          console.log('we made a milk shake')
          debugger
          stack.next()              
        })
        stack.next()
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
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack  

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



    // newTest('Empty goldmine', (t) => {
    //   t.plan(5)
    //   let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
    //   if(process.browser) window.stack = stack  
    //   let gg = process.browser ? require('gg') : requireUncached('gg') 

    //   stack.state.gold = false

    //   stack.on('mine', () => {

    //     stack.fire('shovel', () => {
    //       console.log('shovel for gold...')

    //       var shovelCommand = _.find(stack.grid.enties, (enty) => enty.command.route.spec == '/shovel').command

    //       debugger

    //       //Parent cell should equal 0 (first cell): 
    //       t.equals(shovelCommand.parent.cell, 0, "shovel command's parent is at the first cell of the grid")

    //       //Shovel command's cell should be directly below: 
    //       var expectedCell = gg.xyToIndex(stack.grid, [1, 0])

    //       t.equals(shovelCommand.cell, expectedCell, 'shovel command is directly below the parent command')

    //       //This will never be true; there should be no advancement to 'cart' fire.
    //       if(stack.state.gold == true) return stack.next()
    //     })  

    //     //technically stack.fire above is done... as such, we may need to use a different metric for stack.fire
    //     //OR we should not mark as done
    //     //perhaps we will say middlware_done and then command_done - command_done false until callback completed ie; nextFire called. 

    //     stack.fire('cart', () => {
    //       //Should not run...
    //       console.log('fill cart...')           
    //       t.fail('there will never be any gold!')
    //     })

    //   })  

    //   stack.fire('mine', (err, state) => {
    //     //Should not run: 
    //     t.fail('mining will never finish!')
    //   })

    //   setTimeout(() => {
    //     t.equals( stack.grid.cells[0].enties[0].command.path, '/mine', 'first cell is /mine') 
    //     t.equals ( stack.grid.cells[gg.xyToIndex(stack.grid, [1,0])].enties[0].command.path, '/shovel', 'next row down, same column is /shovel' )
    //     t.equals( stack.grid.cells[gg.xyToIndex(stack.grid, [1,1])].enties[0].command.path, '/cart', 'next column over is /cart (it is sibling so shares same row)')       
    //   }, 100)

    // })

    newTest('Incomplete garden', (t) => {
      t.plan(4)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 
      let gg = process.browser ? require('gg') : requireUncached('gg')    

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


    newTest('Complete garden', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack  

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

    newTest('Multiple .on with same name', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack  

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

    newTest('Stack shorthand advances the stack (inexplicitly calls stack.next())', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack  

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


    newTest('inadvertent next calls', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack  

      stack.on('init', () => {
        t.pass('/init on')
        console.log('initializing... takes 3 seconds...')
        setTimeout(() => {
          stack.next()
        }, 3000)
      })

      stack.on('connect', () => {
        console.log("/connect on")
        stack.next()
      })

      stack.fire('init', () => {
        console.log('initialization complete!')
        t.pass('/init reached callback')
        stack.next()
      })

      stack.fire('connect', () => {
        console.log('connected! (should happen last')
        t.pass('/connect reached callback')
      })


    })



    newTest('inadvertent next calls pt2', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack  
      let gg = process.browser ? require('gg') : requireUncached('gg')  

      stack.on('bannana-shake', () => {
        console.log('brrshh-zzzzzze....')
        setTimeout(() => {
          stack.next() 
        }, 2000)
      })

      stack.on('cherry', () => {
        t.pass('put a cherry on top')
        stack.next() 
      })

      stack.fire('apple', () => {
        t.pass('apple fire callback reached')
        //stack.next()
        stack.fire('bannana-shake', stack.next)
        stack.fire('cherry', stack.next)
        stack.next()
      })

      setTimeout(() => {
        //apple command completes cause stack.fire without callback 
        //inexplicilty advance the stack: 
        var firstCellCommand = gg.examine(stack.grid, [0,0]).command
        t.ok( firstCellCommand.path = '/apple' &&  gg.examine(stack.grid, [0,0]).command.done, 'First command /apple is done')
      }, 3000)

    })



    newTest('inadvertent next calls pt3', (t) => {
      t.plan(4)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack  
      let gg = process.browser ? require('gg') : requireUncached('gg')  

      stack.on('bannana-shake', () => {
        console.log('brrshh-zzzzzze....')
        setTimeout(() => {
          stack.next() 
        }, 2000)
      })

      stack.on('cherry', () => {
        t.pass('put a cherry on top')
        stack.next() 
      })

      stack.fire('apple', () => {
        t.pass('apple fire callback reached')
        //stack.next()
        stack.fire('bannana-shake', stack.next)
        stack.fire('cherry', () => {
          t.pass('cherry fire callback reached')
          console.log('do not finish apple') //< By invoking a callback that does not
          //call stack.next() we block the stack; apple will never complete. 
        })
      })

      setTimeout(() => {
        //apple command should not complete cause we provided a callback
        //and did not expliclitly call stack.next() to advance the stack: 
        var appleCommand = gg.examine(stack.grid, [0,0]).command
        t.notOk(gg.examine(stack.grid, [0,0]).command.done, 'First command /apple is not done')
      }, 3000)

    })


    newTest('rows of siblings', (t) => {
      t.plan(8)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 
      let gg = process.browser ? require('gg') : requireUncached('gg')     
      stack.fire('fruits', () => {
        stack.fire('apple')
        stack.fire('bannana')
        stack.fire('cherry')
        stack.fire('pineapple')
        stack.fire('kiwi')
        stack.fire('watermellon')
        //stack.next() //< we do not call, 
        //therefore the fruits command should never complete
      })

      //1 parent, and row of 6 siblings: 
      //fruits
      //apple | bannana | cherry | pineapple | kiwi | watermellon 

      t.equals(gg.examine(stack.grid, 0).command.path, '/fruits' )
      t.notOk(gg.examine(stack.grid, 0).command.done)
      t.equals(gg.examine(stack.grid, [1,0]).command.path, '/apple' )
      t.equals(gg.examine(stack.grid, [1,1]).command.path, '/bannana' )  
      t.equals(gg.examine(stack.grid, [1,2]).command.path, '/cherry' )  
      t.equals(gg.examine(stack.grid, [1,3]).command.path, '/pineapple' )  
      t.equals(gg.examine(stack.grid, [1,4]).command.path, '/kiwi' )  
      t.equals(gg.examine(stack.grid, [1,5]).command.path, '/watermellon' )  
    })


    newTest('stack.next() caller check', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 
      let gg = process.browser ? require('gg') : requireUncached('gg')       

      stack.fire('stone', () => {
        stack.next()
      })

      stack.fire('wood', () => {
        //stack.next()
        stack.fire('paper', () => {
          stack.next() 
        })
      })

      //  stone | wood 
      //          paper

      t.ok(gg.examine(stack.grid, 0).command.done)
      t.notOk(gg.examine(stack.grid, [0, 1]).command.done)
      t.ok(gg.examine(stack.grid, [1, 1]).command.done)
      //Wood is not done cause it never calls stack.next()
      //Stone and paper are both done cause their callbacks both call stack.next() 
    })


    newTest('wait for loading...', (t) => {
      t.plan(5)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 
      let gg = process.browser ? require('gg') : requireUncached('gg')    

      var loaded = false 

      stack.on('init', () => {
        stack.fire('load', () => {
          setTimeout(() => { //< (simulate loading)
            t.pass('loading complete')
            loaded = true
            //stack.next() 
          }, 1000)
        })
        //This should wait for it's sibling to finish loading:  
        stack.fire('do-other-stuff', () => {
          console.log('now do other stuff')      
          t.ok(loaded)
        })
      })

      stack.fire('init')

      //cell check: 
      setTimeout(() => {
        t.equals(  _.find(stack.grid.enties, (enty) => enty.command.route.spec == '/init').command.cell, 0)
        //Both these commands are siblings of the original '/init' command: 
        t.equals(  _.find(stack.grid.enties, (enty) => enty.command.route.spec == '/load').command.cell, 2) 
        t.equals(  _.find(stack.grid.enties, (enty) => enty.command.route.spec == '/do-other-stuff').command.cell, 3) 
      }, 2000)
    })

    newTest('stack.next for ons vs fires', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 
      let gg = process.browser ? require('gg') : requireUncached('gg')   

      stack.on('apple', () => {
        stack.fire('bannana', stack.next)
        stack.next()
      })

      stack.fire('apple', stack.next)

      t.ok(gg.examine(stack.grid, [1, 0]).command.done)  //< /apple is done
      t.ok(gg.examine(stack.grid, 0).command.done) //< /bannana is done
    })


    newTest('stack.next for ons vs fires pt2', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 
      let gg = process.browser ? require('gg') : requireUncached('gg')   

      stack.on('cherry', () => {
        debugger
        stack.fire('date', () => {

        }) 
        //^ Both cherry and date should be incomplete; stack.next is never called on either. 
      })
      stack.fire('cherry')
      
      debugger
      t.notOk(gg.examine(stack.grid, [1, 0]).command.done)  //< date is not done
      t.notOk(gg.examine(stack.grid, 0).command.done) //< cherry is not done
      //actually date is done cause there is no middleware... if date was fired with a callback it would not be done. 
    })


    newTest('stack.next for ons vs fires pt3', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 
      let gg = process.browser ? require('gg') : requireUncached('gg')   

      stack.on('asparagus', () => {
        stack.fire('bean-sprouts') 
      })
      stack.fire('asparagus')
      t.ok(gg.examine(stack.grid, [1, 0]).command.done)  //< bean-sprouts is done because there is no middleware, nor callback provided. 
      t.notOk(gg.examine(stack.grid, 0).command.done) //< asparagus is not done
    })

    newTest('stack.next for ons vs fires pt4', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 
      let gg = process.browser ? require('gg') : requireUncached('gg')   

      stack.on('bean-sprouts', () => {
        console.log('bean-sprouts in progress')
        stack.next() 
      })

      stack.on('asparagus', () => {
        stack.fire('bean-sprouts') 
      })
      stack.fire('asparagus')
      t.ok(gg.examine(stack.grid, [1, 0]).command.done)  //< bean-sprouts is done because the middleware is done and no callback was provided. 
      t.notOk(gg.examine(stack.grid, 0).command.done)
    })


    newTest('stack.next for ons vs fires pt5', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 
      let gg = process.browser ? require('gg') : requireUncached('gg')   

      stack.on('bean-sprouts', () => {
        console.log('bean-sprouts in progress')
        stack.next() 
      })

      stack.on('asparagus', () => {
        stack.fire('bean-sprouts', () => {
          //callback provided but stack.next not called
        }) 
      })
      stack.fire('asparagus')
      t.notOk(gg.examine(stack.grid, [1, 0]).command.done)  //< bean-sprouts is not done because stack.next was not called during it's final callback. 
      t.notOk(gg.examine(stack.grid, 0).command.done)
    })



    newTest('nested on/next situation', (t) => {
      t.plan(1)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 
      let gg = process.browser ? require('gg') : requireUncached('gg')   

      stack.on('apple', () => {
        stack.fire('orange', stack.next)
        //stack.next is not called during the middleware function so apple should never complete... 
      })
      stack.fire('apple', stack.next)

      t.notOk(gg.examine(stack.grid, 0).command.done )

    })

    newTest('ensure unrelated commands never share same column', (t) => {
      t.plan(7)

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 
      let gg = process.browser ? require('gg') : requireUncached('gg')  

      stack.fire('apple', () => {
        stack.fire('green')
        stack.fire('red')
      })  

      stack.fire('berry', () => {
        stack.fire('strawberry')
        stack.fire('blueberry')
        stack.fire('saskatoon')
      })

      t.ok( gg.examine(stack.grid, 0).command.path == '/apple')
      t.ok( gg.examine(stack.grid, [1,0]).command.path == '/green')
      t.ok( gg.examine(stack.grid, [1,1]).command.path == '/red')

      t.ok( gg.examine(stack.grid, [0,2]).command.path == '/berry')
      t.ok( gg.examine(stack.grid, [1,2]).command.path == '/strawberry')
      t.ok( gg.examine(stack.grid, [1,3]).command.path == '/blueberry')
      t.ok( gg.examine(stack.grid, [1,4]).command.path == '/saskatoon')

    })

    newTest('Ensure commands do not get doubled in the grid if only fired once', (t) => {
      t.plan(1)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 
      let gg = process.browser ? require('gg') : requireUncached('gg') 

      stack.on('connect', () => {
        console.log('do something')
        stack.next() 
      })

      stack.on('connect', () => {
        console.log('do another thing')
        stack.next() 
      })

      stack.fire('connect', () => {
        t.pass(1)
        console.log(stack.grid.enties)
      })

      //this basic example does not reproduce the issue.... 

    })

    //Skipping for now until this is either passing or is noted in docs
    //(it's kind of a 'gotcha' something that could be unexpected)
    test.skip('Ensure commands do not get doubled in the grid if only fired once, specifically if they are using parameter', (t) => {
      t.plan(1)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 
      let gg = process.browser ? require('gg') : requireUncached('gg') 

      //Order is important here... 
      //the parameter version 'on' needs to like reverse itself
      //though this could be a feature that is like not needed; or just a gotcha
      //to watch out for. 

      stack.on('element/awesome-element/connected', () => {
        console.log('do another thing')
        stack.next() 
      })

      stack.on('element/:elementName/connected', () => {
        console.log('do something')
        stack.next() 
      })

      stack.fire('element/awesome-element/connected', () => {
        t.equals(stack.grid.enties.length, 1)
        console.log(stack.grid.enties)
      })

    })


    newTest('finish all middleware', (t) => {
      t.plan(2)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 
      let gg = process.browser ? require('gg') : requireUncached('gg') 

      stack.on('save', () => {
        t.pass('save stuff')
        stack.fire('elements/render', () => {
          stack.next() 
          stack.next() 
        })  
      })

      stack.on('elements/render', () => {
        stack.fire('buffet/render', () => {
          stack.next() 
          stack.next() 
        })
      })

      stack.on('save', () => {
        t.pass('save more stuff') 
      })

      stack.fire('save')
    })



    newTest('finish all middleware (triple on)', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 
      let gg = process.browser ? require('gg') : requireUncached('gg') 

      stack.on('/favvorite-main-save', () => {
        stack.fire('elements/render', () => {
          stack.next()
          stack.next()
        })
      })

      stack.on('/favvorite-main-save', () => {
        t.pass('first middleware invoked')
        stack.next() 
      })

      stack.on('favvorite-main-save', () => {
        t.pass('second middleware invoked') 
        stack.next()
      })

      stack.fire('/favvorite-main-save', () => {
        t.pass('command finished') 
        debugger
        //child done
        //possibly child.caller could be used ? 
        stack.next() 
      })

    })


    newTest('Completion pyramid', (t) => {
      t.plan(1)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 
      stack.fire('first', () => {
        stack.fire('second', () => {
          stack.fire('third', () => {
            stack.fire('fourth', () => {
              stack.fire('fifth', () => {
                stack.next()
                stack.next() 
                stack.next() 
                stack.next() 
                stack.next()             
              })
            })
          })      
        })
      })
      t.pass()
    })


    newTest('Middleware fires in correct order', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 

      stack.on('go', () => {
        t.pass('first wildcard')
        stack.next() 
      })

      stack.on('go', () => {
        t.pass('second listener')
        stack.next() 
      })

      stack.on('go', () => {
        t.pass('third listener')
        stack.next() 
      })

      stack.fire('go')

    })


    newTest('Middleware fires in correct order (with wildcards)', (t) => {
      t.plan(3)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 

      stack.on('*wild', () => {
        t.pass('first wildcard')
        stack.next() 
      })

      stack.on('go', () => {
        t.pass('go')
        stack.next() 
      })

      stack.on('*wild', () => {
        t.pass('second wildcard')
        stack.next() 
      })

      stack.fire('go')

    })


    newTest('All middleware fires', (t) => {
      t.plan(1)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 
      

      stack.on('click', () => {
        stack.fire('init')
      })

      stack.on('init', () => {
        t.ok('do something')
        stack.next() 
      })

      stack.on('init', () => {
        t.ok('do another thing')
        stack.next()
      })

      stack.fire('click')

    })

    newTest('Column logic cell placement into grid is based on fire order (and not on listener registration)', (t) => {
      t.plan(2)

      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 
      
      stack.on('apples', () => {
        //need not run
      })

      stack.on('bannanas', () => {
        //need not run
      })

      stack.on('cherries', () => {
        t.pass()
      })

      stack.fire('cherries') //< fire cherries and ensure it starts on column 1

      var command = _.find(stack.commands, (command) => command.route.spec == '/cherries')
      t.equals( command.route.spec, '/cherries')

    }) 

    newTest('Stress test', (t) => {

      t.plan(1)
      let stack = process.browser ? require('./stack.js') : requireUncached('./stack.js')
      if(process.browser) window.stack = stack 

      stack.on('ready', () => {
        stack.fire('init')
      })

      stack.on('init', () => console.log('init first'))

      stack.on('init', () => console.log('init second'))

      stack.on('init', () => {
        console.log('init third')
        debugger
        stack.fire('docs')
      })

      stack.on('init', () => {
        console.log('init fourth')
        debugger        
      })

      stack.on('docs', () => {
        console.log('docs first')
        debugger
      })

      stack.on('docs', () => {
        console.log('docs second')
        debugger        
      })

      stack.on('docs', () => {
        console.log('docs third')
        debugger
      })

      stack.fire('ready')

      t.pass('test finshes')

    })

    if(run) { 
      console.log('run tests...')
      if(testObj.only) { //Only run the one test: 
        return testObj.only.func(testObj.only.name)
      }
      testObj.tests.forEach((entry) => {
        entry.func(entry.name)
      })      
    }


    //Only send the one test: 
    if(testObj.only) return [testObj.only]

    return testObj.tests
  }
} 

if(process.browser) window.testObj = testObj 

module.exports = testObj
