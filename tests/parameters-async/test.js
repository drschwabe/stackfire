const { log, warn } = console
const stack = require('../../stack.js')
const test = require('tape')

test('Parameter test (async)', async t => {
  t.plan(3)

  log('stack.on /inventory/:item/deliver') 
  stack.on('/inventory/:item/deliver', () => {
    t.equals(stack.path, '/inventory/widget/deliver', 
      'expected listener invoked')
    t.equals(stack.params.item, 'widget', 
      'parameter is included on the command')
    log('stack.on /inventory/:item/deliver DONE') 
  })

  //This should not run:
  log('stack.on /inventory/:item/destroy') 
  stack.on('/inventory/:item/destroy', () => {
    log('stack.on /inventory/:item/destroy DONE, SHOULD NOT HAVE') 
    t.fail('listener invoked when it should not have')
  })

  log('stack.fire /inventory/widget/deliver DONE') 
  await stack.fire('/inventory/widget/deliver') 
  t.pass('end of stack reached')
  log('firing /inventory/widget/deliver DONE') 

})            
