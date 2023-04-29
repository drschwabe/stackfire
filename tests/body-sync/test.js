const { log, warn } = console
const stack = require('../../stack.js')
const test = require('tape')
const _l = require('lodash') 


test("Stack body as string or object", async t => {
  t.plan(4)

  //with a body that is an object: 
  stack.on('green', () => {
    t.ok( _l.isObject( stack.body ))
    t.equals(stack.body.hex, '#008000', 
      'body (object) has expected property')
  })

  await stack.fire('green', { hex : '#008000' })

  //body a string:
  stack.on('red', () => {
    t.ok( _l.isString( stack.body ), 'body is a string')
    t.equals(stack.body, '#ff0000', 
      'body (string) has expected value ')
  })

  await stack.fire('red', '#ff0000')

})
