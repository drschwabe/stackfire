const { log, warn } = console
const stack = require('../../stack.js')
const test = require('tape')

const delay = async seconds => 
  await new Promise(r => 
    setTimeout(r, seconds ? seconds * 1000 : 1000 ))

test('basic async example', async t => {
  let listener

  let firstSip = async () => 
    await new Promise(async r => { 
    listener = 'first'
    await delay(1) 
    log('first sip (takes 100 ms)')
    t.equals(listener, 'first')
    r()
  })

  let secondSip = async () => 
    await new Promise(async r => {                
    listener = 'second'
    await delay(1) 
    log('second sip (takes 200 ms)')
    t.equals(listener, 'second')
    r()
  }) 

  let thirdSip = async () => 
    await new Promise(async r => {               
    listener = 'third' 
    await delay(1) 
    log('third sip (takes 300 ms)')
    t.equals(listener, 'third')
    r()
  })


  stack.on('sip latte', firstSip) 
  stack.on('sip latte', secondSip) 
  stack.on('sip latte', thirdSip) 

  await stack.fire('sip latte') 

  t.equals(listener, 'third', 'sequence ran in order') 

  await delay(0.5) 

  t.end() 
})

