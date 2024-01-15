const { log, warn } = console
const test = require('tape')
const requireUncached = require('require-uncached') 


test("Body can be mutated and returned to ensure next listener has updated object", (t) => {
  t.plan(2)


  const stack = requireUncached('../../stack.js')

  //async alt:
  stack.on('green', () => {
    t.equals(stack.body.shade, 'light', 'body object has expected property')
    return { shade : 'dark' }
  })

  stack.on('green', () => {
    t.equals(stack.body.shade, 
      'dark', 
      `body object has expected property 
      (after mutating/returning an updated value on previous listener)`)
  })

  stack.fire('green', { shade : 'light' })
}) 



const delay = async (seconds) =>
  await new Promise(r => setTimeout(r, seconds ? seconds * 1000 : 1000))


test("Body can be mutated and returned to ensure next listener has updated object (when involving async)", (t) => {
  t.plan(3)

  const stack = requireUncached('../../stack.js')

  stack.on('green', () => {
    t.equals(stack.body.shade, 'light', 'body object has expected property')
  }) 

  stack.on('green', async () => {
    t.equals(stack.body.shade, 'light', 'body object has expected property')
    await delay(1) 
    return { shade : 'dark' }
  })

  stack.on('green', async () => {
    log(stack.body) 
    await delay(1) 
    t.equals(stack.body.shade, 
      'dark', 
      `body object has expected property 
      (after mutating/returning an updated value on previous listener)`)
  })

  stack.fire('green', { shade : 'light' })
}) 

test("Body can be mutated and returned to ensure next listener has updated object (when involving wildcards)", (t) => {
  t.plan(4)

  const stack = requireUncached('../../stack.js')

  stack.on('color/*any', () => {
    log('this listener does nothing') 
  })  

  stack.on('color/*any', () => {
    t.equals(stack.body.shade, 'light', 'body object has expected property')
    return { shade : 'neutral' } 
  }) 

  stack.on('color/green', async () => {
    t.equals(stack.body.shade, 'neutral', 'body object has expected property')
    //t.equals(stack.body.shade, 'light', 'body object has expected property')
    await delay(1) 
    return { shade : 'dark', extra : 'info' }
  })

  stack.on('color/green', async () => {
    log('green?') 
    log(stack.body) 
    await delay(1) 
    t.equals(stack.body.shade, 
      'dark', 
      `body object has expected property 
      (after mutating/returning an updated value on previous listener)`)
    t.ok(stack.body.extra, 'Additional property supplied mid fire is included') 
  })

  stack.fire('color/green', { shade : 'light' })
})       


 
test("Body can be mutated and returned to ensure next listener has updated object (when involving branches)", (t) => {
  t.plan(4)

  const stack = requireUncached('../../stack.js')

  stack.on('season', () => {
    log('season listener (returning nothing)') 
  }) 

  stack.on('color/*any', () => {
    log('this listener does nothing') 
  })  

  stack.on('color/*any', () => {
    t.equals(stack.body.shade, 'light', "body object has expected property ('light')")
    log('returning new body { shade : "neutral" }') 
    return { shade : 'neutral' } 
  }) 

  stack.on('color/green', async () => {
    log("color/green async and this will stack.branch('season')")  
    t.equals(stack.body.shade, 'neutral', "body object has expected property ('neutral')")
    //t.equals(stack.body.shade, 'light', 'body object has expected property')
    await delay(1) 
    log('branch to season') 
    await stack.branch('season')
    log('returning new obj after branch { shade : "dark", ... }') 
    return { shade : 'dark', extra : 'info' }
  })

  stack.on('color/green', async () => {
    log('green') 
    log(stack.body) 
    await delay(1) 
    t.equals(stack.body.shade, 
      'dark', 
      `body object has expected property 
      (after mutating/returning an updated value on previous listener)`)
    t.ok(stack.body.extra, 'Additional property supplied mid fire is included') 
  })

  stack.fire('color/green', { shade : 'light' })
})       
           
