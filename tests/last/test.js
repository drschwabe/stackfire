const { log, warn } = console
const stack = require('../../stack.js')
const test = require('tape')
const _l = require('lodash') 


test("stack.last listener is the last invoked after a fire",  t => {
  t.plan(1)


  let count = 0 

  stack.on('vacation', () => {
    log('aloha!') 
    count++ 
  }) 

  stack.last('vacation', () => {
    log('sayonara')
    count++ 
    t.equals(count, 3, 'stack.last listener was invoked last') 
  })

  stack.on('vacation', () => {
    log('surfs up!') 
    count++ 
  }) 

  stack.fire('vacation') 

})
