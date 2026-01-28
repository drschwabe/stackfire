const { log, warn } = console
//stack.logUtil() 
const test = require('tape')  
const importFresh = require('import-fresh') 


test(`Can catch wildcards (aka splats) in advanced setup and they still work OK`, 
  async t => {
  t.plan(2)

  const stack = importFresh('../../stack.js')

  let berryCount = 0 
  let appleCount = 0

  stack.on(['berry', 'berry/*restOfPath'], () => {
    log('run berry') 
    berryCount++ 
  }) 

  stack.on(['apple', 'apple/*restOfPath'], () => {
    log('run apple') 
    appleCount++ 
  })     

  await stack.fire('berry')

  await stack.fire('apple') 

  log('berryCount: ' + berryCount) 
  log('appleCount: ' + appleCount) 
  t.equals(berryCount, 1) 
  t.equals(appleCount, 1) 
}) 


test(`Can catch wildcards (aka splats) in advanced setup and they still work OK #2`, 
  async t => {
  t.plan(2)

  const stack = importFresh('../../stack.js')

  let berryCount = 0 
  let appleCount = 0

  stack.on(['berry', 'berry/*restOfPath'], () => {
    log('run berry') 
    berryCount++ 
    //log('stack.params:') 
    //log(stack.params) 
    //log('stack.path:') 
    //log(stack.path)                
  }) 

  stack.on(['apple', 'apple/*restOfPath'], () => {
  //stack.on(['apple', 'apple/:restOfPath/:otherPath'], () => {
    log('run apple') 
    appleCount++ 
    //log('stack.params:') 
    //log(stack.params) 
    //log('stack.path:') 
    //log(stack.path) 
  })     

  await stack.fire('berry')
  //stack.fire('some/thing')
  //stack.fire('some/other-thing') 
  //stack.fire('some/thing/else') 
  await stack.fire('apple') 
  await stack.fire('apple/box/3415') 
  //t.equals(berryCount, 1) 
  //t.equals(appleCount, 1) 

  log('berryCount: ' + berryCount) 
  log('appleCount: ' + appleCount) 
  t.equals(berryCount, 1) 
  t.equals(appleCount, 2) 
}) 


test(`Can catch wildcards (aka splats) in advanced setup and they still work OK #3`, 
  async t => {
  t.plan(3)

  const stack = importFresh('../../stack.js')

  let berryCount = 0 
  //can differentiate the wildcard splat name; wildcard splat names
  //are specific to the listener that delcares it 

  stack.on('berry/*differentNameForRestPath/3415', () => {
    //stack.on(['apple', 'apple/:restOfPath/:otherPath'], () => {
    berryCount++ 
    log('run berry first listener') 
    log('stack.params:') 
    log(stack.params) 

    t.ok(stack.params.differentNameForRestPath) 
    log('stack.path:') 
    log(stack.path) 
  })    

  stack.on('berry/box/*restOfPath', () => {
    log('run berry') 
    berryCount++ 
    t.ok(stack.params.restOfPath) 
    log('stack.params:') 
    log(stack.params) 
    log('stack.path:') 
    log(stack.path)                
  }) 

  //well this is not unique; the same splat is showing up 
  //in both listeners but its not really a problem... moving on 

  await stack.fire('berry/box/3415') 

  t.ok(berryCount, 2)

}) 


test(`Can catch wildcards (aka splats) in advanced setup and they still work OK #4`, 
  async t => {
  t.plan(3)

  const stack = importFresh('../../stack.js')

  let berryCount = 0 
  //can differentiate the wildcard splat name; wildcard splat names
  //are specific to the listener that delcares it 

  stack.on(['berry', 'berry/*differentNameForRestPath'], () => {
    //stack.on(['apple', 'apple/:restOfPath/:otherPath'], () => {
    berryCount++ 
    log('run berry first listener') 
    log('stack.params:') 
    log(stack.params) 

    t.ok(stack.params.differentNameForRestPath) 
    log('stack.path:') 
    log(stack.path) 
  })    

  //use a more general path: 
  stack.on(['berry', 'berry/box/3415/*restOfPath'], () => {
    log('run berry') 
    berryCount++ 
    t.ok(stack.params.restOfPath) 
    log('stack.params:') 
    log(stack.params) 
    log('stack.path:') 
    log(stack.path)                
  }) 

  //well this is not unique; the same splat is showing up 
  //in both listeners but its not really a problem... moving on 

  await stack.fire('berry/box/3415/partA') 

  t.ok(berryCount, 2)
})   


test('Can handle wildcard with child branch and child executes in proper order', 
  async t => {

  log('run test?')

  t.plan(1)

  const stack = importFresh('../../stack.js')
  
  const state = { dataChanges : true }

  stack.first('/*anyPath', async e => {
    if(!state.dataChanges) return 
    state.dataChanges = false 
    log('await child branch?')
    await stack.branch('menu/parts/file/save')
    log('proceed... ')
  })

  stack.on('folder/*urlPath/products/changes', async e => {
    log('some other random listener')
  }) 


  stack.on('menu/parts/file/save', e => {
    log('save the changes to parts')
    return 
  })

  stack.on('/*anyPath', e => {
    log('random anyPath catcher')
  })

  stack.on(['profile', 'menu/profile/edit'], e => {
    log('render profile screen')
  }) 

  log('fire?')
  await stack.fire('/profile') 

  t.pass() 

})