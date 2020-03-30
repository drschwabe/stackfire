const _ = require('underscore')

module.exports = (test, stack) => {

  test("Body can be mutated and returned to ensure next listener has updated object (a wrapped function)", (t) => {
    t.plan(2)

    const createDoc = {
      save : message => {
        console.log('createDoc.save original function ran')
        return { id : 999, message : message}
      }
    }

    stack.wrap( createDoc, 'createDoc.save')

    stack.on('createDoc.save', () => {
      t.equals(stack.body().message, 'sunny', 'body object has expected property')
    })

    stack.on('createDoc.save', () => {
      let doc = stack.body() 
      doc.message = 'sunny days'
      return doc 
    })

    stack.on('createDoc.save', () => {
      t.equals(stack.body().message, 'sunny days', 'body object has updated property')
    })

    //stack.fire('green', { shade : 'light' })
    stack.fire.createDoc.save('sunny')

  })
}