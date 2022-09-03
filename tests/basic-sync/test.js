const { log, warn } = console
const stack = require('../../stack.js')
const test = require('tape')

test('basic sync example', t => { 
  let listener

  let firstSip = () => { 
    listener = 'first'
    log('first sip')
    t.equals(listener, 'first')
  }

  let secondSip = () => { 
    listener = 'second'
    log('second sip')
    t.equals(listener, 'second')
  } 

  let thirdSip = () => { 
    listener = 'third' 
    log('third sip')
    t.equals(listener, 'third')
  }

  stack.on('sip latte', firstSip) 
  stack.on('sip latte', secondSip) 
  stack.on('sip latte', thirdSip) 

  stack.fire('sip latte') 

  t.equals(listener, 'third', 'sequence ran in order') 

  t.end() 
}) 

