const _ = require('underscore')

module.exports = (test, stack) => {
  test('next.fireEach fires a list of commands while retaining scope of original', (t) => {
    t.plan(6)

    let myFavvColors = ['blue', 'green', 'yellow', 'orange']

    stack.on('trash-list', next => {
      console.log('trash?')
      next.fireEach( myFavvColors, color => 'trash-favv/' + color , () => {
        t.equals(myFavvColors.length, 0, 'all of the items removed')
        next()
      })
    })

    stack.on('trash-favv/:name', next => {
      console.log('trash favv')
      setTimeout( () => {
        console.log(stack.params())
        t.ok( stack.params().name , 'name parameter is defined' )
        myFavvColors = _.without(myFavvColors, stack.params().name)
        next() 
      }, 250)
    })

    stack.fire('trash-list', () => {
      t.pass('finished firing')
    })

  })
}